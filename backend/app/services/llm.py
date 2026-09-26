import logging

from anthropic import Anthropic
from flask import current_app

logger = logging.getLogger(__name__)


class IntegrationNotConfigured(RuntimeError):
    pass


def generate_text(*, system: str, user: str, max_tokens: int = 2000) -> str:
    api_key = current_app.config["ANTHROPIC_API_KEY"]
    if not api_key:
        raise IntegrationNotConfigured("ANTHROPIC_API_KEY is not set")

    client = Anthropic(api_key=api_key)
    message = client.messages.create(
        model=current_app.config["ANTHROPIC_MODEL"],
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    parts = [block.text for block in message.content if getattr(block, "text", None)]
    if not parts:
        logger.warning("Claude returned no text")
    return "".join(parts)
