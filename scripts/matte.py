# Presenter layer: reframe + grade + (for "matte" segments) cut out from the white wall.
# Reads cache/timeline.json, writes cache/fg/f_00000.png (RGBA, 1080x1920) per output frame.
# Usage: matte.py [--from N] [--to N] [--jobs 4]
import argparse, json, os, cv2, numpy as np
from multiprocessing import Pool

SRC = "assets/footage/Octonics_demo.mp4"
OUT = "cache/fg"
W, H = 1080, 1920


def grade(img):
    """Gentle look: neutralise the cool cast on skin, soft contrast, keep black tee texture."""
    f = img.astype(np.float32) / 255.0
    f[..., 2] *= 1.035  # R
    f[..., 0] *= 0.965  # B
    f = np.clip(f, 0, 1)
    f = 0.02 + 0.96 * (f + 0.10 * (f - f * f) * (2 * f - 1) * -1)  # mild S, lifted toe
    lum = f @ np.array([0.114, 0.587, 0.299], np.float32)
    f = lum[..., None] + 0.94 * (f - lum[..., None])
    return np.clip(f * 255, 0, 255).astype(np.uint8)


class Matter:
    def __init__(self):
        import mediapipe as mp
        from mediapipe.tasks.python import vision, BaseOptions
        self.mp = mp
        self.seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
            base_options=BaseOptions(model_asset_path="models/selfie_multiclass_256x256.tflite"),
            output_confidence_masks=True))
        self.prev = None

    def __call__(self, img):
        h, w = img.shape[:2]
        res = self.seg.segment(self.mp.Image(image_format=self.mp.ImageFormat.SRGB,
                                             data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
        person = 1.0 - cv2.resize(res.confidence_masks[0].numpy_view(), (w, h), interpolation=cv2.INTER_LINEAR)
        hard = (person > 0.5).astype(np.uint8)
        inner = cv2.erode(hard, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
        outer = cv2.dilate(hard, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (51, 51)))
        imgf = img.astype(np.float32)
        # clean wall plate from pixels that are surely background (normalised blur at 1/8 res)
        s = 8
        small = cv2.resize(imgf, (w // s, h // s), interpolation=cv2.INTER_AREA)
        bgm = cv2.resize((1 - outer).astype(np.float32), (w // s, h // s), interpolation=cv2.INTER_AREA)
        num = cv2.GaussianBlur(small * bgm[..., None], (0, 0), 10)
        den = cv2.GaussianBlur(bgm, (0, 0), 10)[..., None] + 1e-4
        plate = cv2.resize(num / den, (w, h), interpolation=cv2.INTER_LINEAR)
        # key: colour distance and luminance drop against the plate (subject is darker than the wall)
        lw = np.array([0.114, 0.587, 0.299], np.float32)
        dl = plate @ lw - imgf @ lw
        dc = np.linalg.norm(imgf - plate, axis=2)
        d = np.maximum(dl * 1.15, dc)
        key = np.clip((d - 9.0) / (62.0 - 9.0), 0, 1)
        key = key * key * (3 - 2 * key)
        a = np.where(inner > 0, 1.0, np.where(outer > 0, key, 0.0)).astype(np.float32)
        # the red chair is never the presenter
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        red = ((hsv[..., 0] < 6) | (hsv[..., 0] > 168)) & (hsv[..., 1] > 100) & (person < 0.6)
        a[red] = 0
        # soft removal of far specks: keep the presenter blob(s) with a feathered halo
        n, lab, st, _ = cv2.connectedComponentsWithStats((a > 0.5).astype(np.uint8), 8)
        if n > 1:
            big = st[1:, cv2.CC_STAT_AREA].max()
            keep = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 0.04 * big]).astype(np.uint8)
            soft = cv2.GaussianBlur(cv2.dilate(keep, np.ones((25, 25), np.uint8)).astype(np.float32), (0, 0), 6)
            a *= np.clip(soft * 1.4, 0, 1)
        # edge-aware refinement guided by the image
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
        a = np.clip(cv2.ximgproc.guidedFilter(gray, a, 3, 2e-4), 0, 1)
        a[(inner > 0)] = 1.0
        if self.prev is not None and self.prev.shape == a.shape:
            band = (outer > 0) & (inner == 0)
            a[band] = 0.75 * a[band] + 0.25 * self.prev[band]
        self.prev = a.copy()
        # colour: unmix the wall out of edge pixels, and bleed interior colour into low-alpha pixels
        af = a[..., None]
        core = (a > 0.97).astype(np.float32)
        ext = cv2.GaussianBlur(imgf * core[..., None], (0, 0), 4) / (cv2.GaussianBlur(core, (0, 0), 4)[..., None] + 1e-4)
        unmix = np.clip((imgf - (1 - af) * plate) / np.maximum(af, 0.05), 0, 255)
        wgt = np.clip((af - 0.35) / 0.6, 0, 1)
        edgecol = wgt * unmix + (1 - wgt) * ext
        edge = af < 0.97
        out = np.where(edge, np.minimum(edgecol, np.maximum(imgf, 0) + 0 * imgf), imgf)
        out = np.where(edge, np.minimum(out, unmix + 18), out)  # never brighter than the unmixed colour
        out = np.where(edge, np.minimum(out, ext + 14), out)  # edge never brighter than the body colour next to it
        return np.clip(out, 0, 255).astype(np.uint8), a


def crop_params(seg, u):
    c = seg["cam"]; z = c["z0"] + (c["z1"] - c["z0"]) * (u * u * (3 - 2 * u))
    cw, ch = W / z, H / z
    fx, fy = seg["face"]
    x = fx - (0.5 + c["dx"]) * cw
    y = fy - c["eye"] * ch
    return float(np.clip(x, 0, W - cw)), float(np.clip(y, 0, H - ch)), cw, ch


def warp(img, x, y, cw, ch, interp=cv2.INTER_LANCZOS4):
    sx = W / cw
    M = np.array([[sx, 0, -x * sx], [0, sx, -y * sx]], np.float32)
    return cv2.warpAffine(img, M, (W, H), flags=interp, borderMode=cv2.BORDER_REPLICATE)


def run_segment(job):
    seg, items = job
    os.makedirs(OUT, exist_ok=True)
    cap = cv2.VideoCapture(SRC); fps = cap.get(cv2.CAP_PROP_FPS)
    matter = Matter() if seg["mode"] == "matte" else None
    first = round(items[0][1]["src_t"] * fps)
    cap.set(cv2.CAP_PROP_POS_FRAMES, first); cur, frame = first - 1, None
    for idx, fr in items:
        want = round(fr["src_t"] * fps)
        while cur < want:
            ok, frame = cap.read(); cur += 1
            if not ok: raise RuntimeError(f"read failed at {cur}")
        img = grade(frame)
        if matter:
            img, a = matter(img)
        else:
            a = np.ones(img.shape[:2], np.float32)
        x, y, cw, ch = crop_params(seg, fr["u"])
        rgb = warp(img, x, y, cw, ch)
        al = warp(a, x, y, cw, ch, cv2.INTER_LINEAR)
        rgba = np.dstack([rgb, np.clip(al * 255, 0, 255).astype(np.uint8)])
        cv2.imwrite(f"{OUT}/f_{idx:05d}.png", rgba, [cv2.IMWRITE_PNG_COMPRESSION, 1])
    return seg["id"], len(items)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="f0", type=int, default=0)
    ap.add_argument("--to", dest="f1", type=int, default=10 ** 9)
    ap.add_argument("--jobs", type=int, default=4)
    ap.add_argument("--chunk", type=int, default=45)
    args = ap.parse_args()
    tl = json.load(open("cache/timeline.json"))
    segs = {s["id"]: s for s in tl["segments"]}
    jobs, cur = [], None
    for idx, fr in enumerate(tl["frames"]):
        if fr["mode"] == "card" or not (args.f0 <= idx <= args.f1):
            continue
        if cur is None or cur[0]["id"] != fr["seg"] or len(cur[1]) >= args.chunk:
            cur = (segs[fr["seg"]], []); jobs.append(cur)
        cur[1].append((idx, fr))
    with Pool(args.jobs) as p:
        for sid, n in p.imap_unordered(run_segment, jobs):
            print("seg", sid, "frames", n, flush=True)
