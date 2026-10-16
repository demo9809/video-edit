# Build the full soundtrack: cleaned dialogue (original audio only) + music bed (ducked) + SFX.
# Output: cache/mix.wav (48 kHz stereo, -14 LUFS integrated, TP <= -1.5 dBTP)
import json, subprocess, re
tl = json.load(open("cache/timeline.json")); M = tl["marks"]
DUR = tl["duration"]; SRC = "assets/footage/Octonics_demo.mp4"
MUSIC, MUSIC_OFF = "assets/music/music_bed_v1.mp3", 41.0 - DUR  # music ending lands on the end card
SFX = {"impact": "impact_v1", "whoosh": "whoosh_v3", "click": "ui_click_v3", "confirm": "confirm_v1",
       "listen": "listen_v3", "swell": "swell_v3", "brand": "brand_hit_v4"}
segs = {s["id"]: s for s in tl["segments"]}
cue = lambda k: next(s for s in [M[k]])
events = [  # (time, sfx, gain)
    (0.0, "impact", 0.55), (1.90, "whoosh", 0.32), (M["hey_alexa"] - 0.05, "listen", 0.5),
    (M["twenty"] - 0.02, "click", 0.4), (M["twenty"] + 0.8, "confirm", 0.42), (8.45, "swell", 0.45),
    (M["knx"] - 0.5, "whoosh", 0.28), (M["not_just"] - 0.15, "whoosh", 0.25),
    (M["lighting"] - 0.2, "whoosh", 0.3), (M["ac"] - 0.05, "click", 0.35), (M["ac"] + 0.05, "click", 0.3),
    (M["curtains"] - 0.05, "click", 0.35), (M["every"] - 0.45, "whoosh", 0.3), (M["single"] - 0.85, "whoosh", 0.22),
    (24.3, "whoosh", 0.3), (M["smarter"] - 0.78, "whoosh", 0.26), (M["comfortable"] - 0.48, "whoosh", 0.26),
    (M["plan"] - 0.04, "impact", 0.22), (M["build"] - 0.04, "impact", 0.22), (M["choose"] - 0.04, "impact", 0.3),
    (M["end"], "brand", 0.6)]
inputs, fc, dl = ["-i", SRC], [], []
# dialogue pieces (speed 1 segments only; the slow-motion beat carries music + swell)
for s in tl["segments"]:
    if "src" not in s or s["speed"] != 1: continue
    a, e = s["src"]; o = s["out"][0]; d = e - a
    lab = f"d{s['id']}"
    fc.append(f"[0:a]atrim={a}:{e},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=mono,"
              f"afade=t=in:d=0.012,afade=t=out:st={d-0.02:.3f}:d=0.02,adelay={int(o*1000)}:all=1[{lab}]")
    dl.append(f"[{lab}]")
fc.append(f"{''.join(dl)}amix=inputs={len(dl)}:normalize=0,apad=whole_dur={DUR},"
          "highpass=f=80,afftdn=nf=-28,deesser=i=0.35,acompressor=threshold=-20dB:ratio=3:attack=5:release=90:makeup=2,"
          "equalizer=f=3200:t=q:w=1.2:g=1.5,aformat=channel_layouts=stereo,asplit=2[dlg][sc]")
inputs += ["-i", MUSIC]
fc.append(f"[1:a]atrim={MUSIC_OFF:.3f},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=0.30,"
          f"afade=t=out:st={DUR-0.35:.2f}:d=0.35[mus]")
fc.append("[mus][sc]sidechaincompress=threshold=0.03:ratio=8:attack=25:release=320:makeup=1[musd]")
sl = []
for k, (t, name, g) in enumerate(events):
    inputs += ["-i", f"assets/sfx/{SFX[name]}.mp3"]
    fc.append(f"[{k+2}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={g},adelay={max(0,int(t*1000))}:all=1[s{k}]")
    sl.append(f"[s{k}]")
fc.append(f"[dlg][musd]{''.join(sl)}amix=inputs={2+len(sl)}:normalize=0,atrim=0:{DUR},alimiter=limit=0.89[pre]")
def run(extra):
    cmd = ["ffmpeg", "-y", "-v", "info", *inputs, "-filter_complex", ";".join(fc) + ";" + extra, "-map", "[out]"]
    return cmd
# pass 1: measure
r = subprocess.run(run("[pre]loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json[out]") + ["-f", "null", "-"], capture_output=True, text=True)
js = json.loads(re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr)[-1])
ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}"
      f":measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
subprocess.run(run(f"[pre]{ln},aresample=48000[out]") + ["-ar", "48000", "-c:a", "pcm_s16le", "cache/mix.wav"], check=True, capture_output=True)
v = subprocess.run(["ffmpeg", "-hide_banner", "-i", "cache/mix.wav", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
print("pass1", js["input_i"], js["input_tp"]); print("\n".join(l for l in v.splitlines()[-12:] if any(k in l for k in ("I:", "Peak:", "LRA:"))))

import sys
if "--stems" in sys.argv:
    g = ";".join(f for f in fc if not re.search(r"\[s\d+\]$", f) and not f.startswith("[dlg][musd]")) + ";[musd]anull[m2]"
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", g, "-map", "[dlg]", "-t", str(DUR), "cache/stem_dlg.wav",
                    "-map", "[m2]", "-t", str(DUR), "cache/stem_mus.wav"], check=True)
    for f in ("cache/stem_dlg.wav", "cache/stem_mus.wav"):
        for a, b in ((17, 23), (28.4, 34)):
            o = subprocess.run(["ffmpeg", "-hide_banner", "-ss", str(a), "-to", str(b), "-i", f, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
            print(f, a, b, [l.strip() for l in o.splitlines() if l.strip().startswith("I:")][-1])
