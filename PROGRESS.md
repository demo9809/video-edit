# PROGRESS - Octonics x KNX Reel   (updated 2026-10-16)
Phase: storyboard (awaiting approval)
Current version: none
Done:
- Source + logos downloaded (assets/footage, assets/logos). Transcript via ElevenLabs Scribe (375 credits).
- Storyboard v1 written; framing test + matte test rendered (renders/previews).
- Brief received (master meta prompt, 9:16 1080x1920, 30-40 s, original presenter audio, no new VO).
- Drive folder inventoried (see manifest.json).
- Tool preflight run (see PROJECT.md).
In progress: -
Next step: get plan approval + decisions (Alexa order, B-roll source, ElevenLabs music/SFX credits), then refine matte and build style frames.
Open issues:
- Matte test shows thin white edge halo; needs refinement pass.
- No music, SFX, brand guideline, website or contact info supplied.
Key decisions & preferences:
- Use original recorded dialogue; no ElevenLabs VO (user override of skill rule 9).
- No em-dashes in any on-screen or written copy.
- No presenter reference image needed (user, 2026-10-16).
- End card: logos only, no website/handle (user confirmed none).
- Reframe with proper cinematic zoom/crop; user finds the current framing weak.
- NEVER use HuggingFace. No AI image/video generation. ElevenLabs allowed for sound only (SFX, music, transcription).
- Isolation plan: white-background key + MediaPipe (PyPI) instead of HF matting models.
- Do not invent website, phone, social handle, certifications or Alexa claims.
Key files: plan/storyboard.md, plan/beats.json, plan/transcript_words.json, scripts/face_track.py, scripts/frame_test.py, cache/faces.json
