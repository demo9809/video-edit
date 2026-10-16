# Build per-output-frame timeline from plan/beats.json -> cache/timeline.json
import json, statistics
b = json.load(open("plan/beats.json")); fps = b["fps"]
faces = [f for f in json.load(open("cache/faces.json")) if f["cx"]]
frames, t_out, segs = [], 0.0, []
for s in b["segments"]:
    if "card" in s:
        n = round(s["dur"] * fps); segs.append({"id": s["id"], "card": s["card"], "out": [t_out, t_out + s["dur"]]})
        frames += [{"seg": s["id"], "mode": "card", "u": i / max(n - 1, 1)} for i in range(n)]
        t_out += s["dur"]; continue
    a, e = s["src"]; dur = (e - a) / s["speed"]; n = round(dur * fps)
    near = [f for f in faces if a - 0.2 <= f["t"] <= e + 0.2] or sorted(faces, key=lambda f: min(abs(f["t"] - a), abs(f["t"] - e)))[:4]
    cx = statistics.median(f["cx"] for f in near); cy = statistics.median(f["cy"] for f in near)
    segs.append({"id": s["id"], "src": s["src"], "speed": s["speed"], "out": [round(t_out, 4), round(t_out + n / fps, 4)],
                 "text": s["text"], "mode": s["mode"], "cam": s["cam"], "face": [cx, cy]})
    for i in range(n):
        u = i / max(n - 1, 1)
        frames.append({"seg": s["id"], "mode": s["mode"], "src_t": round(a + i / fps * s["speed"], 4), "u": round(u, 4)})
    t_out += n / fps
json.dump({"fps": fps, "n": len(frames), "duration": round(len(frames) / fps, 3), "segments": segs, "frames": frames},
          open("cache/timeline.json", "w"))
print("frames", len(frames), "duration", round(len(frames) / fps, 2))
for s in segs: print(s["id"], s["out"], s.get("face"))

# ---- captions + word marks (output times) ----
words = json.load(open("plan/transcript_words.json"))["words"]
FIX = {"Ocktronix": "Octonics", "Ocktronix.": "Octonics.", "percentage.": "%."}
caps = []
for s in segs:
    if "src" not in s: continue
    a, e = s["src"]; o = s["out"][0]; sp = s["speed"]
    for w in words:
        if w.get("type") != "word" or w["start"] < a - 0.02 or w["end"] > e + 0.08: continue
        if w["text"].lower().strip(",.") == "uh": continue
        caps.append({"w": FIX.get(w["text"], w["text"]), "t0": round(o + (w["start"] - a) / sp, 3),
                     "t1": round(o + (min(w["end"], e) - a) / sp, 3), "seg": s["id"]})
# "twenty" + "%." -> "20%."
for i, c in enumerate(caps):
    if c["w"].lower() == "twenty" and i + 1 < len(caps) and caps[i + 1]["w"] == "%.":
        c["w"] = "20%."; c["t1"] = caps[i + 1]["t1"]; caps[i + 1]["drop"] = True
caps = [c for c in caps if not c.get("drop")]
# group into 1-4 word phrases, break on punctuation or pause
groups, cur = [], []
for c in caps:
    if cur and (c["t0"] - cur[-1]["t1"] > 0.36 or len(cur) >= 3 or c["seg"] != cur[-1]["seg"]):
        groups.append(cur); cur = []
    cur.append(c)
    if c["w"][-1] in ",.?": groups.append(cur); cur = []
if cur: groups.append(cur)
def src2out(t):
    for s in segs:
        if "src" in s and s["src"][0] - 1e-3 <= t <= s["src"][1] + 1e-3:
            return round(s["out"][0] + (t - s["src"][0]) / s["speed"], 3)
    raise ValueError(f"source time {t} not in edit")
SRC_MARKS = {"dream": 1.0, "smart_system": 5.14, "hey_alexa": 6.72, "dim": 7.70, "light": 7.96, "twenty": 11.30,
    "plan_auto": 15.94, "knx1": 17.22, "lighting1": 18.40, "climate1": 19.72, "curtains1": 20.88, "umbrella": 23.18, "system1": 23.64,
    "talk_octonics": 24.52, "dream_project": 25.66, "knx_wiring": 26.62, "wiring": 27.80, "what_are": 29.38, "truly": 31.82,
    "not_just": 33.22, "phone": 34.76, "advanced": 36.44, "lighting2": 36.86, "ac": 37.64, "curtains2": 38.66, "every": 39.44,
    "single": 40.82, "application": 41.68, "intelligent": 43.68, "knx3": 45.04, "more_info": 45.94, "connect": 48.64,
    "connect_octonics": 49.02, "knx4": 50.82, "system4": 52.94, "before": 53.98, "wiring5": 55.42, "consider": 56.14, "knx5": 56.82,
    "planning": 59.72, "smarter": 62.38, "easy": 63.16, "comfortable": 64.52, "plan": 65.74, "build": 66.74, "choose": 67.54,
    "octonics_end": 67.74}
marks = {k: src2out(v) for k, v in SRC_MARKS.items()}
slow = next(s for s in segs if s.get("speed", 1) != 1)
marks["warm_start"] = slow["out"][0]; marks["warm_end"] = slow["out"][1]
marks["end"] = segs[-1]["out"][0]
tl = json.load(open("cache/timeline.json"))
tl["captions"] = [{"t0": g[0]["t0"], "t1": g[-1]["t1"], "words": g} for g in groups]
tl["marks"] = marks
json.dump(tl, open("cache/timeline.json", "w"))
print("caption groups", len(groups)); print(json.dumps(marks))
for g in groups: print(f'{g[0]["t0"]:6.2f} {" ".join(c["w"] for c in g)}')

# ---- per-frame face box in OUTPUT coordinates (incl. hair above, chin below) ----
import bisect
W_, H_ = 1080, 1920
allf = json.load(open("cache/faces.json")); ok = [f for f in allf if f["cx"]]
ts = [f["t"] for f in ok]
def face_at(t):
    i = bisect.bisect_left(ts, t)
    if i <= 0: return ok[0]
    if i >= len(ok): return ok[-1]
    a, b = ok[i - 1], ok[i]; u = (t - a["t"]) / max(b["t"] - a["t"], 1e-6)
    if b["t"] - a["t"] > 1.0:  # long gap (detector lost the face): hold nearest
        return a if u < 0.5 else b
    return {k: a[k] + (b[k] - a[k]) * u for k in ("cx", "cy", "w")}
tl = json.load(open("cache/timeline.json"))
segd = {s["id"]: s for s in tl["segments"]}
for fr in tl["frames"]:
    if fr["mode"] == "card": fr["fbox"] = None; continue
    s = segd[fr["seg"]]; c = s["cam"]; u = fr["u"]
    z = c["z0"] + (c["z1"] - c["z0"]) * (u * u * (3 - 2 * u)); cw, ch = W_ / z, H_ / z
    x = min(max(s["face"][0] - (0.5 + c["dx"]) * cw, 0), W_ - cw); y = min(max(s["face"][1] - c["eye"] * ch, 0), H_ - ch)
    f = face_at(fr["src_t"]); fx, fy, fw = (f["cx"] - x) * z, (f["cy"] - y) * z, f["w"] * z
    fr["fbox"] = [round(fx - 0.66 * fw), round(fy - 0.95 * fw), round(fx + 0.66 * fw), round(fy + 0.85 * fw)]
json.dump(tl, open("cache/timeline.json", "w"))
print("face boxes added")
