# PROGRESS - Octonics x KNX Reel   (updated 2026-10-16)
Phase: preview (awaiting user approval of preview_v1)
Current version: preview_v1 -> renders/previews/preview_v1.mp4 (540x960, 39.3 s, mixed audio)
Done:
- Source + logos downloaded; ElevenLabs Scribe transcript (plan/transcript_words.json).
- Plan approved (Alexa kept early, option C: code-drawn visuals only, ElevenLabs sound spend OK).
- Music + 7 SFX generated on ElevenLabs (4 variations each, assets/music, assets/sfx).
- Presenter matte pipeline (scripts/matte.py) -> cache/fg (1104 frames). Reframing per plan/beats.json cam.
- Renderer src/scene.js + src/render.js (deterministic, Playwright + ffmpeg). Preview loop scripts/preview.mjs.
- Audio mix scripts/mix_audio.py -> cache/mix.wav (-14.0 LUFS, TP -1.5, voice 11-13 dB over music).
- Style frames: renders/previews/style_frames/style_01..05.jpg. Contact sheets over full duration checked.
In progress: -
Next step: on approval, final render: node src/render.js --from 0 --to 39.3 --scale 1 --crf 16 --preset slow --audio cache/mix.wav --out renders/final/octonics_knx_reel_v1.mp4, QA, upload to Drive.
Rebuild order if source timing changes: scripts/timeline.py -> scripts/matte.py -> scripts/mix_audio.py -> render.
Open issues: small chair edge near frame bottom corners is hidden by bottom fade; verify in final.
Key decisions & preferences:
- Original dialogue only. No HuggingFace. ElevenLabs only for sound. No AI image/video generation.
- No em-dashes anywhere. End card: logos only (Octonics wordmark + KNX), no contact info.
- Accent from brand blue #0072BC (text tint #4FA8E8). Inter font (OFL).
- Captions verbatim except brand spelling "Octonics" and "20%".
Key files: plan/beats.json, cache/timeline.json (generated), src/scene.js, scripts/*.py
