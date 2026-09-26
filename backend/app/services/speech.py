from pathlib import Path

import requests
from flask import current_app

from app.services.llm import IntegrationNotConfigured


def synthesize(text: str, *, name: str) -> str:
    """Write narration mp3 under the media directory and return the relative path.

    WhatsApp voice notes want Opus. This returns MPEG; the sender can still
    attach it, and a later step can transcode before posting a nightly recap.
    """
    api_key = current_app.config["ELEVENLABS_API_KEY"]
    voice_id = current_app.config["ELEVENLABS_VOICE_ID"]
    if not api_key or not voice_id:
        raise IntegrationNotConfigured("ElevenLabs is not configured")

    response = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        headers={
            "xi-api-key": api_key,
            "accept": "audio/mpeg",
            "content-type": "application/json",
        },
        json={
            "text": text,
            "model_id": current_app.config["ELEVENLABS_MODEL_ID"],
        },
        timeout=120,
    )
    response.raise_for_status()

    directory = Path(current_app.config["MEDIA_DIR"]) / "narration"
    directory.mkdir(parents=True, exist_ok=True)
    relative = f"narration/{name}.mp3"
    (directory / f"{name}.mp3").write_bytes(response.content)
    return relative
