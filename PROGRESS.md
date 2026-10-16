# PROGRESS - Octonics x KNX Reel   (updated 2026-10-16)
Phase: preflight (BLOCKED on source download)
Current version: none
Done:
- Brief received (master meta prompt, 9:16 1080x1920, 30-40 s, original presenter audio, no new VO).
- Drive folder inventoried (see manifest.json).
- Tool preflight run (see PROJECT.md).
In progress: -
Next step: once Google Drive download is allowed in the environment network policy, download
  assets/raw video/Octonics_demo.mp4 (649 MB) + logos, then ffprobe, contact sheet, transcript.
Open issues:
- Environment network policy blocks drive.google.com / drive.usercontent.google.com, huggingface.co, pixabay.com, cdn.jsdelivr.net.
- Drive connector returns files inline as base64, unusable for a 649 MB video.
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
Key files: PROJECT.md, LOG.md, manifest.json
