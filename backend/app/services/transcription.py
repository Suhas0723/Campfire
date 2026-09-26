from pathlib import Path

import requests
from flask import current_app

from app.services.llm import IntegrationNotConfigured


def transcribe(media_path: str) -> str:
    api_key = current_app.config["OPENAI_API_KEY"]
    if not api_key:
        raise IntegrationNotConfigured("OPENAI_API_KEY is not set")

    path = Path(current_app.config["MEDIA_DIR"]) / media_path
    with path.open("rb") as handle:
        response = requests.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            data={"model": "whisper-1"},
            files={"file": (path.name, handle)},
            timeout=120,
        )
    response.raise_for_status()
    return response.json()["text"]
