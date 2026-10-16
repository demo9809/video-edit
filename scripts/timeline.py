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
def mark(word, seg, nth=0):
    hits = [c for c in caps if c["seg"] == seg and c["w"].lower().strip(",.?") == word.lower()]
    return hits[nth]["t0"]
marks = {
    "dream": mark("dream", 1), "miss": mark("miss", 1), "smart_system": mark("smart", 2),
    "hey_alexa": mark("hey", 3), "dim": mark("dim", 3), "light": mark("light", 3), "twenty": mark("20%", 4),
    "warm_start": segs[4]["out"][0], "intelligent": mark("intelligent", 6), "knx": mark("knx", 6),
    "truly": mark("truly", 7), "phone": mark("phone", 8), "not_just": mark("not", 8),
    "lighting": mark("lighting", 9), "ac": mark("ac", 9), "curtains": mark("curtains", 9), "every": mark("every", 9),
    "single": mark("single", 9), "application": mark("application", 9),
    "wiring": mark("wiring", 10), "consider": mark("consider", 10), "knx2": mark("knx", 10),
    "planning": mark("planning", 11), "smarter": mark("smarter", 11), "easy": mark("easy", 11), "comfortable": mark("comfortable", 11),
    "plan": mark("plan", 12), "build": mark("build", 12), "choose": mark("choose", 12), "octonics": mark("octonics", 12),
    "end": segs[-1]["out"][0]}
tl = json.load(open("cache/timeline.json"))
tl["captions"] = [{"t0": g[0]["t0"], "t1": g[-1]["t1"], "words": g} for g in groups]
tl["marks"] = marks
json.dump(tl, open("cache/timeline.json", "w"))
print("caption groups", len(groups)); print(json.dumps(marks))
for g in groups: print(f'{g[0]["t0"]:6.2f} {" ".join(c["w"] for c in g)}')
