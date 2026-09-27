# Campfire

Campfire joins a friend group's existing WhatsApp trip chat and turns the texts, photos, and voice notes already in that thread into a narrated story: a short voice note each night, and a full **Around the Campfire** playback when the trip is over.

This repository captures a WhatsApp trip, writes the nightly recap and the full Around the Campfire story, and plays that story back. Side quests, next-trip suggestions, and anniversary posts are still stubs. Product detail lives in [docs/PROJECT.md](docs/PROJECT.md).

## Layout

```
whatsapp-service/   Node + Baileys — WhatsApp session and Redis bridge
backend/            Flask, Postgres/pgvector, Celery, model clients
frontend/           React playback app (Vite)
docs/               Product and architecture notes
scripts/            Local start helpers
deploy/             Production Caddy image (HTTPS + built frontend)
docker-compose.yml
docker-compose.prod.yml
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

On Windows, `scripts/dev.ps1` copies `.env.example` when `.env` is missing and starts Compose. On Linux, `scripts/dev.sh` does the same for this local stack.

## Production (Vultr)

Use a 2 vCPU / 4 GB Ubuntu 24.04 Cloud Compute instance. Photos, voice notes, and narration accumulate in the `media_data` volume.

1. Install Docker Engine and the Compose plugin.
2. Point an `A` record for the domain (and `www`, if you use it) at the server's IPv4 address. In the Vultr firewall or `ufw`, allow 22, 80, and 443 only. Leave 5432, 6379, and 5000 closed.
3. Clone this repo, copy `.env.example` to `.env`, and set a long `SECRET_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, and `DOMAIN` (hostname only, no scheme). Set `PUBLIC_APP_URL` to `https://` plus that hostname, and set `SESSION_COOKIE_SECURE=true` and `BEHIND_PROXY=true`.
4. After the name resolves to this server:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Caddy serves the built playback app and proxies `/api` to Flask on one HTTPS hostname. Certificate issuance fails if port 80 is closed or DNS does not point here yet.

5. Link WhatsApp once:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f whatsapp
```

Scan the QR from WhatsApp → Linked devices. The `whatsapp_auth` volume keeps that session across rebuilds. Use a spare number. Baileys is an unofficial client, and a datacenter IP can be logged out.

Back up the `postgres_data`, `media_data`, and `whatsapp_auth` volumes. Losing `whatsapp_auth` means scanning the QR again. Postgres and Redis stay on the Docker network; the only published ports are 80 and 443. A reboot brings the stack back (`restart: unless-stopped`). Local `docker compose up` is unchanged.

## WhatsApp commands

`/campfire start` · `/campfire end` · `/campfire off the record` · `/campfire on the record` · `/campfire forget` · `/campfire help`

Capture is stored only between start and end, and only while the trip is on the record. Direct messages are ignored unless Campfire is waiting on a side-quest reply.

The linked WhatsApp account is the bot. Use a spare number. Baileys is an unofficial WhatsApp Web client.

## Payments

This app is built against Visa Intelligent Commerce's actual API contract. It runs on a mock provider because production token requester ID provisioning requires Visa account manager sign-off outside this hackathon's timeframe. Switching to live Visa payments requires only setting `PAYMENT_PROVIDER=real_vic` and the corresponding credentials — no application code changes.

Checkout enrolls the card, starts a purchase intent, retrieves tokenized credentials, books the activity, then confirms the transaction with Visa. `PAYMENT_PROVIDER` defaults to `mock_vic`. The live switch also needs `ORG_ID`, `API_KEY`, `SHARED_SECRET`, `TOKEN_REQUESTER_ID`, and `RELATIONSHIP_ID`.

## Current limits

Side-quest detection, end-of-trip next-trip suggestions, and anniversary posts are not generated yet. The anniversary job only logs trips that are due. Place pins on a generated story use coordinates from the model. Nightly Muse tips need `MUSE_API_KEY` (Meta Model API); without it the day recap still posts.
