# PROGRESS - Octonics x KNX Reel   (updated 2026-10-16)
Phase: final v2 (rendering)
Current version: renders/final/octonics_knx_reel_v2.mp4 (1080x1920, 30 fps, 60.0 s). v1 kept untouched.
Client feedback on v1 (applied in v2):
- Keep ALL dialogue in original order (the Drive file is the final cut); only trim gaps/silence. -> scripts/build_edit.py auto EDL: 26 cuts, silences > 0.34 s tightened, "uh" removed, Alexa light reaction kept.
- No blue: warm champagne/copper gradient (#F6E3BC -> #E2B577 -> #C0834A) on ink #0B0A09, ivory #F5EFE6.
- Must feel like a pro editor / motion designer, not AI: Satoshi Black + Instrument Serif Italic captions, gold word box,
  solid hairline cards (no glassmorphism), line-art architectural inserts (lamp, thermostat dial, curtains, single-cable bus,
  house facade, floor plan), alternating MCU/CU punch-ins on every jump cut, warm flash on insert entry, grain + vignette.
- New 60 s music (warm_bed60_v1), SFX retimed. Voice 10-13 dB over music, -14 LUFS.
Rebuild order: scripts/build_edit.py -> scripts/timeline.py -> scripts/matte.py -> scripts/face_out.py -> scripts/mix_audio.py -> src/render.js
Next step: QA v2 (ffprobe, loudness/TP after AAC, full contact sheet), deliver.
Key decisions & preferences:
- Original dialogue only, full flow. No HuggingFace. ElevenLabs only for sound. No AI image/video generation.
- No em-dashes. No top text. Face never covered. KNX logo on white. End card: logos only. No blue accent.
Key files: plan/beats.json (generated), src/scene.js, src/render.js, scripts/*.py
