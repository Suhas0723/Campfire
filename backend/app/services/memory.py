import logging

from flask import current_app

from app.services.llm import IntegrationNotConfigured

logger = logging.getLogger(__name__)


def remember(*, group_jid: str, kind: str, content: str, metadata: dict | None = None) -> None:
    """Store a cross-trip memory: nickname, inside joke, sentiment, side-quest pair."""
    del group_jid, content, metadata
    if not current_app.config["BACKBOARD_API_KEY"]:
        logger.info("Backboard is unset; skipped remember kind=%s", kind)
        return
    raise IntegrationNotConfigured("Backboard HTTP API is not wired yet")


def recall(*, group_jid: str, query: str, limit: int = 8) -> list[dict]:
    del group_jid, query, limit
    if not current_app.config["BACKBOARD_API_KEY"]:
        return []
    raise IntegrationNotConfigured("Backboard HTTP API is not wired yet")
