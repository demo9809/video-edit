# Face position every 0.25 s via MediaPipe face detector (models/blaze_face_short_range.tflite).
# Usage: face_track.py <video> <out.json>
import cv2, json, sys
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
src, out = sys.argv[1], sys.argv[2]
det = vision.FaceDetector.create_from_options(vision.FaceDetectorOptions(
    base_options=BaseOptions(model_asset_path="models/blaze_face_short_range.tflite"), min_detection_confidence=0.5))
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS)
res, i, step = [], 0, int(round(fps * 0.25))
while cap.grab():
    if i % step == 0:
        _, f = cap.retrieve()
        img = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(f, cv2.COLOR_BGR2RGB))
        d = det.detect(img).detections
        r = {"t": round(i / fps, 2), "cx": None}
        if d:
            b = max(d, key=lambda x: x.bounding_box.width).bounding_box
            r = {"t": r["t"], "cx": b.origin_x + b.width // 2, "cy": b.origin_y + b.height // 2, "w": b.width}
        res.append(r)
    i += 1
json.dump(res, open(out, "w"))
print(len(res), "samples,", sum(1 for r in res if r["cx"]), "with face")
for r in res[::10]: print(r)
