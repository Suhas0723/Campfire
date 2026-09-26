import json
import time
import urllib.request
from pathlib import Path

import requests
from flask import current_app

from app.services.llm import IntegrationNotConfigured


def synthesize(text: str, *, name: str, voice: str = "woman") -> str:
    """Write one narrator voice as Ogg Opus and return its media-relative path."""
    voice_id = dict(_voices())[voice]
    return _write(text, name=name, voice_id=voice_id)


def synthesize_voices(text: str, *, name: str) -> dict[str, str]:
    """Write the woman and man narration files. Keys are woman and man."""
    return {key: _write(text, name=f"{name}-{key}", voice_id=voice_id) for key, voice_id in _voices()}


def _voices() -> list[tuple[str, str]]:
    woman = current_app.config["ELEVENLABS_VOICE_WOMAN"]
    man = current_app.config["ELEVENLABS_VOICE_MAN"]
    if not current_app.config["ELEVENLABS_API_KEY"] or not woman or not man:
        raise IntegrationNotConfigured("ElevenLabs is not configured")
    return [("woman", woman), ("man", man)]


def _write(text: str, *, name: str, voice_id: str) -> str:
    cleaned = " ".join(text.split())
    if not cleaned:
        raise ValueError("Nothing to speak")

    response = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        params={"output_format": "opus_48000_128"},
        headers={
            "xi-api-key": current_app.config["ELEVENLABS_API_KEY"],
            "accept": "audio/ogg",
            "content-type": "application/json",
        },
        json={
            "text": cleaned,
            "model_id": current_app.config["ELEVENLABS_MODEL_ID"],
        },
        timeout=120,
    )
    if not response.ok:
        # #region agent log
        _agent_log(
            "A",
            "elevenlabs tts rejected",
            {
                "status": response.status_code,
                "voiceName": name,
                "outputFormat": "opus_48000_128",
                "body": (response.text or "")[:500],
            },
        )
        # #endregion
    response.raise_for_status()

    directory = Path(current_app.config["MEDIA_DIR"]) / "narration"
    directory.mkdir(parents=True, exist_ok=True)
    relative = f"narration/{name}.ogg"
    (directory / f"{name}.ogg").write_bytes(response.content)
    # #region agent log
    _agent_log(
        "A",
        "elevenlabs tts wrote opus",
        {"status": response.status_code, "voiceName": name, "outputFormat": "opus_48000_128", "bytes": len(response.content)},
    )
    # #endregion
    return relative


def _agent_log(hypothesis_id: str, message: str, data: dict) -> None:
    # #region agent log
    payload = {
        "sessionId": "2501dd",
        "hypothesisId": hypothesis_id,
        "location": "speech.py:_write",
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
        "runId": "pre-fix",
    }
    line = json.dumps(payload)
    print(line, flush=True)
    try:
        request = urllib.request.Request(
            "http://host.docker.internal:7258/ingest/ba74c370-9513-448b-a7ab-dd2a8ecd14b6",
            data=line.encode(),
            headers={"Content-Type": "application/json", "X-Debug-Session-Id": "2501dd"},
        )
        urllib.request.urlopen(request, timeout=2)
    except Exception:
        pass
    # #endregion
