# PROGRESS - Octonics x KNX Reel   (updated 2026-10-16)
Phase: final (rendering v1 final)
Current version: renders/final/octonics_knx_reel_v1.mp4 (1080x1920, 30 fps, 39.3 s)
Done:
- Preview v1 reviewed by user. Feedback applied (v2 changes):
  1. Face always visible: per-frame face boxes detected on output frames (scripts/face_out.py), every overlay placed by face-aware place() in src/scene.js.
  2. Cutout rebuilt (matte v3): colour+luma key vs wall plate, soft speck cleanup, guided filter, edge unmix + interior colour bleed, no rim-light outline.
  3. All top titles removed (hook headline, section titles, plan title, final slams, KNX subtitle).
  4. Captions: Inter ExtraBold + Instrument Serif Italic accents, blue word box on spoken word, blur/pop reveals, auto-placed below the face.
  5. KNX logo on solid white card.
- User waived another low-res approval: go straight to final.
Next step: QA final (ffprobe, loudness, full contact sheet), deliver via SendUserFile, commit docs.
Rebuild order: scripts/timeline.py -> scripts/matte.py -> scripts/face_out.py -> scripts/mix_audio.py -> src/render.js
Key decisions & preferences:
- Original dialogue only. No HuggingFace. ElevenLabs only for sound. No AI image/video generation.
- No em-dashes anywhere. No top text. Face never covered. End card: logos only.
- Accent from brand blue #0072BC (tint #4FA8E8). Fonts: Inter (OFL), Instrument Serif (OFL).
Key files: plan/beats.json, src/scene.js, src/render.js, scripts/*.py, cache/timeline.json (generated)
