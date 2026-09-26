from pathlib import Path

import requests
from flask import current_app

from app.services.llm import IntegrationNotConfigured


def transcribe(media_path: str) -> str:
    """Transcribe one voice note with ElevenLabs speech to text."""
    api_key = current_app.config["ELEVENLABS_API_KEY"]
    if not api_key:
        raise IntegrationNotConfigured("ELEVENLABS_API_KEY is not set")

    path = Path(current_app.config["MEDIA_DIR"]) / media_path
    with path.open("rb") as handle:
        response = requests.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers={"xi-api-key": api_key},
            data={"model_id": current_app.config["ELEVENLABS_STT_MODEL_ID"]},
            files={"file": (path.name, handle)},
            timeout=120,
        )
    response.raise_for_status()
    return _transcript_text(response.json())


def _transcript_text(payload: dict) -> str:
    if not isinstance(payload, dict):
        raise ValueError("ElevenLabs returned no transcript")

    text = payload.get("text")
    if isinstance(text, str) and text.strip():
        return text.strip()

    transcripts = payload.get("transcripts")
    if isinstance(transcripts, list):
        parts = [
            item["text"].strip()
            for item in transcripts
            if isinstance(item, dict) and isinstance(item.get("text"), str) and item["text"].strip()
        ]
        if parts:
            return " ".join(parts)

    words = payload.get("words")
    if isinstance(words, list):
        tokens = []
        for word in words:
            if not isinstance(word, dict) or word.get("type") not in (None, "word"):
                continue
            token = str(word.get("text") or "").strip()
            if token:
                tokens.append(token)
        if tokens:
            return " ".join(tokens)

    if isinstance(text, str):
        return text.strip()
    return ""
