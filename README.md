# Campfire

Campfire joins a friend group's existing WhatsApp trip chat and turns the texts, photos, and voice notes already in that thread into a narrated story: a short voice note each night, and a full **Around the Campfire** playback when the trip is over.

This repository is the first runnable scaffold: WhatsApp capture, the trip privacy window, Postgres, and the playback shell. Story generation, side quests, and anniversary posts are stubbed behind the same boundaries the rest of the system will use. Product detail lives in [docs/PROJECT.md](docs/PROJECT.md).

## Layout

```
whatsapp-service/   Node + Baileys — WhatsApp session and Redis bridge
backend/            Flask, Postgres/pgvector, Celery, model clients
frontend/           React playback app (Vite)
docs/               Product and architecture notes
scripts/            Local start helpers
docker-compose.yml
```

## Run it

Docker Compose is the supported local setup.

```bash
docker compose up --build
```

Then:

1. Watch the `whatsapp` service logs and scan the QR code from WhatsApp → Linked devices.
2. Add that account to a group and send `/campfire start`.
3. Open http://localhost:5173 for Around the Campfire.

Load a sample trip without WhatsApp:

```bash
docker compose exec backend python -m app.seed
```

Copy `.env.example` to `.env` when you add Claude, Whisper, ElevenLabs, Backboard, or Google Maps keys. Compose starts without those keys. The map on the playback page appears after `GOOGLE_MAPS_API_KEY` is set and the frontend container is restarted.

| Service | URL |
| --- | --- |
| Playback app | http://localhost:5173 |
| API health | http://localhost:5000/api/health |
| Postgres | localhost:5432 (`campfire` / `campfire`) |
| Redis | localhost:6379 |

On Windows, `scripts/dev.ps1` copies `.env.example` when `.env` is missing and starts Compose. On the VPS, `scripts/dev.sh` does the same.

## WhatsApp commands

`/campfire start` · `/campfire end` · `/campfire off the record` · `/campfire on the record` · `/campfire forget` · `/campfire help`

Capture is stored only between start and end, and only while the trip is on the record. Direct messages are ignored unless Campfire is waiting on a side-quest reply.

The linked WhatsApp account is the bot. Use a spare number. Baileys is an unofficial WhatsApp Web client.

## Current limits

Nightly scripts, full-story audio, side-quest detection, next-trip suggestions, and anniversary posts are not generated yet. Celery records that a nightly recap is due and logs anniversaries; it does not call the model providers. Playback links are the trip id, with no account login.
