# Campfire

Campfire joins a friend group's existing WhatsApp trip chat and turns the texts, photos, and voice notes already in that thread into a narrated story: a short voice note each night, and a full **Around the Campfire** playback when the trip is over.

This repository captures a WhatsApp trip, writes the nightly recap and the full Around the Campfire story, and plays that story back. Side quests, next-trip suggestions, and anniversary posts are still stubs. Product detail lives in [docs/PROJECT.md](docs/PROJECT.md).

## Layout

```
whatsapp-service/           Node + Baileys — WhatsApp session and Redis bridge
backend/                    Flask, Postgres/pgvector, Celery, model clients
frontend/                   React playback app (Vite)
docs/                       Product and architecture notes
scripts/                    Local and VPS start helpers
deploy/                     Caddy site config for the VPS
docker-compose.yml          Shared stack (no host ports)
docker-compose.override.yml Local ports and the Vite dev server
docker-compose.prod.yml     HTTPS on a VPS
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

Copy `.env.example` to `.env` when you add ChatGPT, ElevenLabs, or Backboard keys. Compose starts without those keys. Nightly recaps and the full story need an OpenAI key plus an ElevenLabs voice. Voice-note transcripts use that same ElevenLabs key. The playback map is illustrated from the trip's coordinates and does not use `GOOGLE_MAPS_API_KEY`.

| Service | URL |
| --- | --- |
| Playback app | http://localhost:5173 |
| API health | http://localhost:5000/api/health |
| Postgres | localhost:5432 (`campfire` / `campfire`) |
| Redis | localhost:6379 |

On Windows, `scripts/dev.ps1` copies `.env.example` when `.env` is missing and starts Compose. On Linux and macOS, `scripts/dev.sh` does the same. Both use the dev override, which publishes the ports above and runs the Vite server.

## Run it on a Vultr VPS

The dashboard and the WhatsApp agent can stay up on a VPS so your laptop can be off. Use Ubuntu 24.04, 2 GB of RAM (4 GB is safer while images build), and an SSH key. In the Vultr firewall, allow only ports 22, 80, and 443.

1. Create an A record for your hostname (for example `campfire.example.com`) pointing at the VPS IP. Wait until it resolves before starting the stack, or certificate issuance fails.
2. Install Docker Engine and the Compose plugin.
3. Clone this repo and copy `.env.example` to `.env`. Set `SITE_ADDRESS` to the hostname only, `PUBLIC_APP_URL` to `https://` plus that hostname, `SESSION_COOKIE_SECURE=true`, a long random `SECRET_KEY`, and your OpenAI and ElevenLabs keys.
4. Run `scripts/prod.sh`. Caddy listens on ports 80 and 443 and requests a Let's Encrypt certificate. Postgres, Redis, and the API are not published on the host.
5. Stop the stack on your laptop once the VPS is up. Two Baileys sessions on the same number will both ingest the group and can double-post recaps.

Link WhatsApp once. The session is stored in the `whatsapp_auth` volume and survives reboots.

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f whatsapp
```

Scan the QR code from WhatsApp on the spare number: Linked devices. Wait for `WhatsApp connected`, then disconnect. Open `https://campfire.example.com` on your phone. Playback links from `/campfire end` use `PUBLIC_APP_URL`, so they point at that same host. If WhatsApp later logs the session out, clear the `whatsapp_auth` volume and scan again.

## WhatsApp commands

`/campfire start` · `/campfire end` · `/campfire off the record` · `/campfire on the record` · `/campfire forget` · `/campfire help`

Capture is stored only between start and end, and only while the trip is on the record. Direct messages are ignored unless Campfire is waiting on a side-quest reply.

The linked WhatsApp account is the bot. Use a spare number. Baileys is an unofficial WhatsApp Web client.

## Current limits

Side-quest detection, next-trip suggestions, and anniversary posts are not generated yet. The anniversary job only logs trips that are due. Playback links are the trip id, with no account login. Place pins on a generated story use coordinates from the model.
