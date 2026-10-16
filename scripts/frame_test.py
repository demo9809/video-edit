# Framing + background-separation test. Writes renders/previews/framing_test.jpg
import cv2, json, numpy as np
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
    base_options=BaseOptions(model_asset_path="models/selfie_multiclass_256x256.tflite"), output_confidence_masks=True))
faces = [f for f in json.load(open("cache/faces.json")) if f["cx"]]
def face_at(t): return min(faces, key=lambda f: abs(f["t"] - t))
def grab(t):
    cap = cv2.VideoCapture("assets/footage/Octonics_demo.mp4"); cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    return cap.read()[1]
def crop(img, f, zoom, eye_frac=0.36):
    W, H = 1080, 1920; cw, ch = int(W / zoom), int(H / zoom)
    x = int(np.clip(f["cx"] - cw / 2, 0, W - cw)); y = int(np.clip(f["cy"] - eye_frac * ch, 0, H - ch))
    return cv2.resize(img[y:y + ch, x:x + cw], (W, H), interpolation=cv2.INTER_LANCZOS4)
def dark_bg():
    yy, xx = np.mgrid[0:1920, 0:1080].astype(np.float32)
    base = np.array([20, 14, 10], np.float32)  # #0A0E14 in BGR
    glow = np.exp(-(((xx - 760) / 520) ** 2 + ((yy - 700) / 700) ** 2))[..., None]
    warm = np.exp(-(((xx - 180) / 300) ** 2 + ((yy - 1300) / 500) ** 2))[..., None]
    img = base + glow * np.array([70, 45, 25], np.float32) + warm * np.array([20, 45, 75], np.float32)
    for x in range(120, 1080, 210): img[:, x:x + 3] += 10  # architectural slats
    return np.clip(img, 0, 255)
def separate(img):
    m = seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB))).confidence_masks
    bgm = cv2.resize(m[0].numpy_view(), (img.shape[1], img.shape[0]))
    a = np.clip(1 - bgm, 0, 1)
    a = cv2.GaussianBlur(cv2.erode((a > 0.5).astype(np.float32), np.ones((3, 3))), (5, 5), 0)[..., None]
    g = img.astype(np.float32) * 0.92  # gentle grade
    return np.clip(g * a + dark_bg() * (1 - a), 0, 255).astype(np.uint8)
def label(im, s):
    im = cv2.resize(im, (360, 640)); cv2.rectangle(im, (0, 600), (360, 640), (0, 0, 0), -1)
    cv2.putText(im, s, (8, 628), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (80, 220, 255), 2); return im
rows = []
for t in (1.0, 36.5, 55.0):
    img, f = grab(t), face_at(t)
    comp = separate(img)
    rows.append(np.hstack([label(img, f"source {t}s"), label(crop(img, f, 1.7), "MCU 1.7x"),
                           label(crop(img, f, 2.0, 0.40), "CU 2.0x"), label(crop(comp, f, 1.7), "MCU + dark bg test")]))
cv2.imwrite("renders/previews/framing_test.jpg", np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 88])
cv2.imwrite("renders/previews/style_test_full.jpg", crop(separate(grab(36.5)), face_at(36.5), 1.7))
