import asyncio
import logging

from backboard import BackboardClient
from flask import current_app

logger = logging.getLogger(__name__)

_assistant_ids: dict[str, str] = {}


def remember(*, group_jid: str, kind: str, content: str, metadata: dict | None = None) -> None:
    """Store a cross-trip memory: nickname, inside joke, sentiment, side-quest pair."""
    if not current_app.config["BACKBOARD_API_KEY"]:
        logger.info("Backboard is unset; skipped remember kind=%s", kind)
        return

    async def run(client: BackboardClient) -> None:
        assistant_id = await _assistant_id(client, group_jid)
        await client.add_memory(
            assistant_id=assistant_id,
            content=content,
            metadata={**(metadata or {}), "kind": kind},
        )

    try:
        _run(run)
    except Exception:
        logger.exception("Backboard remember failed for %s", group_jid)


def recall(*, group_jid: str, query: str, limit: int = 8) -> list[dict]:
    if not current_app.config["BACKBOARD_API_KEY"]:
        return []

    async def run(client: BackboardClient) -> dict:
        assistant_id = await _assistant_id(client, group_jid)
        return await client.search_memories(assistant_id, query, limit=max(1, min(limit, 50)))

    try:
        found = _run(run)
    except Exception:
        logger.exception("Backboard recall failed for %s", group_jid)
        return []

    memories = []
    for item in found.get("memories") or []:
        content = str(item.get("content") or "").strip()
        if content:
            memories.append({"content": content, "metadata": item.get("metadata") or {}})
    return memories


def _run(work):
    """Celery tasks are synchronous; the SDK is async."""

    async def main():
        base_url = current_app.config["BACKBOARD_BASE_URL"]
        options = {"base_url": base_url} if base_url else {}
        async with BackboardClient(api_key=current_app.config["BACKBOARD_API_KEY"], **options) as client:
            return await work(client)

    return asyncio.run(main())


async def _assistant_id(client: BackboardClient, group_jid: str) -> str:
    """Backboard scopes memories to an assistant, so each WhatsApp group gets its own."""
    cached = _assistant_ids.get(group_jid)
    if cached:
        return cached
    name = f"campfire:{group_jid}"
    found = await client.list_assistants(name=name, limit=1)
    if found:
        assistant_id = str(found[0].assistant_id)
    else:
        created = await client.create_assistant(
            name=name,
            system_prompt="Memory for one friend group's trips: nicknames, inside jokes, and how they felt.",
        )
        assistant_id = str(created.assistant_id)
    _assistant_ids[group_jid] = assistant_id
    return assistant_id
