# services/media — Python FastAPI media service

- Endpoints and error envelope: docs/API.md "Media service". Behaviour: docs/PIPELINE.md §2.
- Layout: `app/main.py` (routes + auth), `app/youtube.py`, `app/transcribe.py`, `app/ocr.py`, `app/vtt.py`, `app/errors.py`, `app/settings.py`.
- Require header `X-Internal-Token` == `MEDIA_SERVICE_TOKEN` on every route except `/health`.
- Load Whisper and PaddleOCR models once at startup (lifespan), not per request.
- Work in a per-request temp dir; always clean up.
- Use yt-dlp's Python API (`yt_dlp.YoutubeDL`) — not shelling out. FFmpeg via subprocess with argument lists (no shell=True).
- Guard durations before downloading/transcribing (`maxSeconds`).
- PaddleOCR 2.x vs 3.x APIs differ — check the installed version first.
- Tests: pytest with mocks; never hit YouTube in tests. Run `uv run pytest`.
