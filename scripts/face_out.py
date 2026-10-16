# Detect the face on every rendered presenter frame (cache/fg) and store an exact face box
# (hair above, chin below) per output frame in cache/timeline.json. Gaps are filled from neighbours.
import cv2, json, numpy as np, os
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
det = vision.FaceDetector.create_from_options(vision.FaceDetectorOptions(
    base_options=BaseOptions(model_asset_path="models/blaze_face_short_range.tflite"), min_detection_confidence=0.4))
tl = json.load(open("cache/timeline.json"))
raw = {}
for i, fr in enumerate(tl["frames"]):
    if fr["mode"] == "card": continue
    im = cv2.imread(f"cache/fg/f_{i:05d}.png")
    small = cv2.resize(im, (540, 960))
    exp_w = fr.get("fbox") and (fr["fbox"][2] - fr["fbox"][0]) / 1.32  # face width predicted from the source track
    def ok(dd): return dd and (not exp_w or 0.5 * exp_w < 2 * max(dd, key=lambda x: x.bounding_box.width).bounding_box.width < 1.0 * exp_w)
    d = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(small, cv2.COLOR_BGR2RGB))).detections
    if not ok(d):  # coloured light (blue scene): retry on contrast-boosted greyscale
        g = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)).apply(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY))
        d = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(g, cv2.COLOR_GRAY2RGB))).detections
    if ok(d):
        b = max(d, key=lambda x: x.bounding_box.width).bounding_box
        raw[i] = (2 * (b.origin_x + b.width / 2), 2 * (b.origin_y + b.height / 2), 2 * b.width)
# drop outliers (size far from the segment median), then smooth
import statistics
for sid in set(f["seg"] for f in tl["frames"] if f["mode"] != "card"):
    ks = [k for k in raw if tl["frames"][k]["seg"] == sid]
    if not ks: continue
    mw = statistics.median(raw[k][2] for k in ks)
    ew = statistics.median((tl["frames"][k]["fbox"][2] - tl["frames"][k]["fbox"][0]) / 1.32 for k in ks)
    print("seg", sid, "det", round(mw), "exp", round(ew))
    if not (0.55 * ew < mw < 1.0 * ew):  # whole shot locked onto a false face: drop it, neighbours fill in
        for k in ks: del raw[k]
        continue
    for k in ks:
        if not (0.65 * mw < raw[k][2] < 1.45 * mw): del raw[k]
sm = {}
for k in raw:
    nb = [raw[j] for j in range(k - 2, k + 3) if j in raw and tl["frames"][j]["seg"] == tl["frames"][k]["seg"]]
    sm[k] = tuple(sum(v[i] for v in nb) / len(nb) for i in range(3))
raw = sm
idx = sorted(raw)
for i, fr in enumerate(tl["frames"]):
    if fr["mode"] == "card": fr["fbox"] = None; continue
    if i in raw: cx, cy, w = raw[i]
    else:  # nearest detections in the same segment
        same = [k for k in idx if tl["frames"][k]["seg"] == fr["seg"]] or idx
        k0 = max([k for k in same if k < i], default=None); k1 = min([k for k in same if k > i], default=None)
        if k0 is None or k1 is None: cx, cy, w = raw[k0 if k0 is not None else k1]
        else:
            u = (i - k0) / (k1 - k0); cx, cy, w = [raw[k0][j] + (raw[k1][j] - raw[k0][j]) * u for j in range(3)]
    fr["fbox"] = [round(cx - 0.72 * w), round(cy - 1.05 * w), round(cx + 0.72 * w), round(cy + 0.95 * w)]
json.dump(tl, open("cache/timeline.json", "w"))
print("detected", len(raw), "of", sum(1 for f in tl["frames"] if f["mode"] != "card"))
