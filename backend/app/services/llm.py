import logging

from flask import current_app
from openai import OpenAI

logger = logging.getLogger(__name__)


class IntegrationNotConfigured(RuntimeError):
    pass


def generate_text(*, system: str, user: str, max_tokens: int = 2000) -> str:
    api_key = current_app.config["OPENAI_API_KEY"]
    if not api_key:
        raise IntegrationNotConfigured("OPENAI_API_KEY is not set")

    client = OpenAI(api_key=api_key, timeout=120)
    message = client.chat.completions.create(
        model=current_app.config["OPENAI_MODEL"],
        max_completion_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    content = message.choices[0].message.content if message.choices else ""
    text = content if isinstance(content, str) else ""
    if not text:
        logger.warning("ChatGPT returned no text")
    return text
