# PROGRESS - Octonics x KNX Reel   (updated 2026-10-16)
Phase: DONE v2 (delivered, awaiting client feedback)
Current version: renders/final/octonics_knx_reel_v2.mp4 (1080x1920, 30 fps, 60.0 s). v1 kept untouched.
Client feedback on v1 (applied in v2):
- Keep ALL dialogue in original order (the Drive file is the final cut); only trim gaps/silence. -> scripts/build_edit.py auto EDL: 26 cuts, silences > 0.34 s tightened, "uh" removed, Alexa light reaction kept.
- No blue: warm champagne/copper gradient (#F6E3BC -> #E2B577 -> #C0834A) on ink #0B0A09, ivory #F5EFE6.
- Must feel like a pro editor / motion designer, not AI: Satoshi Black + Instrument Serif Italic captions, gold word box,
  solid hairline cards (no glassmorphism), line-art architectural inserts (lamp, thermostat dial, curtains, single-cable bus,
  house facade, floor plan), alternating MCU/CU punch-ins on every jump cut, warm flash on insert entry, grain + vignette.
- New 60 s music (warm_bed60_v1), SFX retimed. Voice 10-13 dB over music, -14 LUFS.
Rebuild order: scripts/build_edit.py -> scripts/timeline.py -> scripts/matte.py -> scripts/face_out.py -> scripts/mix_audio.py -> src/render.js
QA v2: 1080x1920, 30/1, 1800 frames, H.264 High yuv420p + AAC LC 48k stereo, 60.000 s, faststart, 99.3 MB, -14.2 LUFS, TP -1.6 dBTP, decode OK,
  all 160 spoken words present (only 3x 'uh' removed). Sheet: renders/final/qa_contact_v2.jpg.
Next step: wait for feedback; changes go to v3, never overwrite v1/v2.
Key decisions & preferences:
- Original dialogue only, full flow. No HuggingFace. ElevenLabs only for sound. No AI image/video generation.
- No em-dashes. No top text. Face never covered. KNX logo on white. End card: logos only. No blue accent.
Key files: plan/beats.json (generated), src/scene.js, src/render.js, scripts/*.py
