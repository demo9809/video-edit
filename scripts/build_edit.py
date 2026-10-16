# Build plan/beats.json from the transcript: every spoken line in original order, silences tightened,
# filler "uh" removed, real Alexa light reaction kept. Jump cuts alternate framing (MCU <-> CU).
import json
words = [w for w in json.load(open("plan/transcript_words.json"))["words"] if w.get("type") == "word"]
words = [w for w in words if w["text"].lower().strip(",.") != "uh"]
TAKES = [0.0, 14.3, 35.5, 42.8, 50.3, 68.26]
take = lambda t: max(i for i, s in enumerate(TAKES[:-1]) if t >= s)
GAP, PRE, POST = 0.34, 0.09, 0.14
chunks, cur = [], [words[0]]
for w in words[1:]:
    if w["start"] - cur[-1]["end"] > GAP or take(w["start"]) != take(cur[-1]["start"]):
        chunks.append(cur); cur = [w]
    else: cur.append(w)
chunks.append(cur)
segs = []
for i, ch in enumerate(chunks):
    a = ch[0]["start"] - PRE; e = ch[-1]["end"] + POST
    if i > 0: a = max(a, (chunks[i - 1][-1]["end"] + ch[0]["start"]) / 2)
    if i + 1 < len(chunks): e = min(e, (ch[-1]["end"] + chunks[i + 1][0]["start"]) / 2)
    a = max(a, TAKES[take(ch[0]["start"])] + 0.02); e = min(e, TAKES[take(ch[0]["start"]) + 1] - 0.02)
    segs.append({"src": [round(a, 3), round(e, 3)], "speed": 1, "text": " ".join(w["text"] for w in ch)})
# "Hey, Alexa," + "dim the light." stay one continuous take (the pause is part of the moment)
k = next(k for k, s in enumerate(segs) if s["text"].startswith("Hey, Alexa"))
if segs[k + 1]["text"].startswith("dim"):
    segs[k]["text"] += " " + segs[k + 1]["text"]; del segs[k + 1]
# Alexa: keep the real light change after "dim the light", slow-mo warm-down after "twenty percentage"
for s in segs:
    if s["text"].startswith("Hey, Alexa"): s["src"][1] = 9.45
    if s["text"].startswith("twenty"): s["src"] = [11.2, 12.15]
i = next(k for k, s in enumerate(segs) if s["text"].startswith("twenty"))
segs.insert(i + 1, {"src": [12.15, 13.0], "speed": 0.6, "text": ""})
# framing: alternate MCU / CU inside a take so every jump cut reads as an edit
MCU = {"z0": 1.70, "z1": 1.76, "eye": 0.37, "dx": 0}
CU = {"z0": 1.95, "z1": 2.02, "eye": 0.38, "dx": 0}
prev_take, k = None, 0
for n, s in enumerate(segs):
    t = take(s["src"][0]); k = 0 if t != prev_take else k + 1; prev_take = t
    real = 6.5 <= s["src"][0] < 13.05
    s["id"] = n + 1; s["mode"] = "real" if real else "matte"; s["bg"] = "REAL" if real else "arch"
    if real:
        s["cam"] = {"z0": 1.6, "z1": 1.72, "eye": 0.4, "dx": 0} if k % 2 == 0 else {"z0": 1.74, "z1": 1.78, "eye": 0.38, "dx": 0}
    elif s["src"][0] <= 23.18 <= s["src"][1]:  # "one umbrella and system": presenter left, graphic right
        s["cam"] = {**MCU, "dx": -0.19}
    elif 32.9 <= s["src"][0] < 42.5:  # phone / app section: presenter left, UI right
        s["cam"] = {**MCU, "dx": -0.19, "z0": 1.70 + 0.1 * (k % 2), "z1": 1.76 + 0.1 * (k % 2)}
    else:
        s["cam"] = dict(CU if k % 2 else MCU)
b = json.load(open("plan/beats.json"))
b["segments"] = segs + [{"id": len(segs) + 1, "card": "end", "dur": 2.6}]
b["note"] = "Auto-built by scripts/build_edit.py: full dialogue in order, silences > 0.34 s tightened, 'uh' removed."
json.dump(b, open("plan/beats.json", "w"), indent=1)
tot = sum((s["src"][1] - s["src"][0]) / s["speed"] for s in segs) + 2.6
print(len(segs), "segments, total", round(tot, 2), "s")
for s in segs: print(s["id"], s["src"], s["speed"], s["mode"], s["cam"]["z0"], s["text"][:60])
