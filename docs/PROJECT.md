# Campfire

Campfire is an AI agent that joins a friend group's or family's existing WhatsApp trip group chat and turns the texts, photos, and voice notes they're already sending into narrated trip stories — both live, day-by-day, and as a full narrated recap after the trip ends.

## The problem

When a group travels together, the best moments — inside jokes, voice notes, photos, who-said-what — get buried in an endless WhatsApp scroll. Nobody goes back and organizes it into something worth revisiting. Campfire does that automatically, using only the conversation the group is already having, with no separate app for group members to remember to use.

## Product

Campfire is a bot inside an existing WhatsApp group. It listens only during a defined trip window and produces two experiences:

1. **Nightly Campfire** — each night of the trip, it posts a short narrated voice-note recap of that day, stitched from real voice-note clips and a narrator track. Reactions to that recap feed the next night and the full story.
2. **Around the Campfire** — after the trip, one link plays the full story. A narrator walks through the trip, cutting to real voice notes, while a map moves between locations and photos fade in. It explains inside jokes as they come up, and ends by revealing who was behind the camera.

Also:

- **Side Quests** — when chat context shows a subset of the group split off, Campfire privately asks that subgroup what they got up to, turns their voice notes into a short side story, and lets them keep it private or fold it into the group story.
- **Next trip suggestions** — after the trip, suggestions follow the sentiment of the chat (cost, energy, activities people actually liked).
- **Anniversaries** — one year later, Campfire posts a callback into the group that plays that trip's story.

## Trip mode and privacy

- Listening runs only between `/campfire start` and `/campfire end`.
- Campfire announces itself when a trip starts.
- `/campfire off the record` pauses capture. `/campfire on the record` resumes it.
- `/campfire forget` removes the sender's latest captured message, or the message they replied to.
- Private 1:1 chats are not read. A direct message is accepted only when Campfire is waiting on a side-quest reply it asked for.

## Why the model matters

Transcription and speech synthesis are plumbing. The product depends on reading messy multi-person chat well enough to make a story:

- Attach a photo to the right moment and place from the surrounding conversation.
- Notice when a subgroup splits off.
- Keep inside jokes and nicknames across the trip and across later trips.
- Choose moments worth narrating.
- Read group sentiment for the next-trip suggestion.

## Stack

| Piece | Choice |
| --- | --- |
| WhatsApp connector | Node.js, Baileys (`whatsapp-service/`) |
| Bridge and queue | Redis streams, plus Redis as the Celery broker |
| API and data | Flask, Postgres, pgvector (`backend/`) |
| Background work | Celery: nightly recaps, anniversary checks |
| Reasoning and scripts | ChatGPT (OpenAI) |
| Voice notes to text | ElevenLabs speech to text (`scribe_v2`) |
| Narration audio | ElevenLabs |
| Cross-trip memory | Backboard |
| Nightly local tips | Muse Spark (Meta Model API) |
| Playback | React (`frontend/`). The story map is drawn in `TripMap.jsx` from stored coordinates. `@react-google-maps/api` is installed and unused. |
| Host | Vultr VPS |

Baileys talks to WhatsApp Web. It is an unofficial client: linked sessions can be logged out, and WhatsApp can restrict accounts that automate the consumer app. The service is isolated so the rest of the system only sees the Redis contract below.

## Data flow

```
WhatsApp group
      │
      ▼
whatsapp-service (Baileys)
      │  Redis stream campfire:inbound
      ▼
backend ingest
      ├── Postgres + pgvector
      ├── Celery (nightly recap, anniversaries)
      ├── ChatGPT, ElevenLabs, Backboard
      └── Redis stream campfire:outbound
                │
                ▼
      whatsapp-service sends the group message

frontend  ←  GET /api/trips/<id>/playback
```

## Redis contract

Streams are Redis streams of one field, `data`, whose value is a JSON object.

**`campfire:inbound`** — WhatsApp service to backend. Consumer group `backend`.

```json
{
  "group_jid": "120363...@g.us",
  "sender_jid": "1555...@s.whatsapp.net",
  "push_name": "Riley",
  "group_subject": "Yosemite",
  "message_id": "3EB0...",
  "timestamp": 1710000000,
  "type": "text",
  "text": "we made it",
  "media_path": null,
  "quoted_message_id": null,
  "direct": false
}
```

`type` is `text`, `image`, `audio`, `video`, `reaction`, or `sticker`. `media_path` is relative to the shared media directory. `direct: true` is a side-quest reply, and `group_jid` is the sender's own jid.

**`campfire:outbound`** — backend to WhatsApp service. Consumer group `whatsapp`.

```json
{
  "group_jid": "120363...@g.us",
  "type": "text",
  "text": "Campfire is listening for this trip.",
  "audio_path": null
}
```

`type: "audio"` sends `audio_path` (an absolute path on the shared volume, or a path under the media directory). A path ending in `.ogg` is sent as a WhatsApp voice note (Opus). Any other audio file is sent as an MPEG attachment.

**`campfire:awaiting_dm`** — a Redis set of jids. The WhatsApp service forwards a 1:1 message only when the sender is in this set.

## Playback payload

`GET /api/trips/<id>/playback`

```json
{
  "trip": {"id": "...", "name": "...", "status": "ended"},
  "locations": [{"name": "Tunnel View", "latitude": 37.72, "longitude": -119.68}],
  "segments": [
    {
      "order": 0,
      "kind": "narration",
      "text": "...",
      "audio_url": null,
      "voices": {"woman": null, "man": null},
      "photo_url": null,
      "location": {"name": "Tunnel View", "lat": 37.72, "lng": -119.68},
      "speaker": null
    }
  ],
  "suggestions": []
}
```

`kind` is `narration`, `voice_note`, or `photo`. Narration segments include `voices.woman` and `voices.man` when both takes exist. Playback can switch between them. The voice note posted to the group uses the woman voice. A real voice note from the chat stays that person's recording.

## Commands

| Command | Effect |
| --- | --- |
| `/campfire start` | Open a trip and announce that Campfire is listening |
| `/campfire end` | Stop listening, point the group at the playback link, and assemble the full story |
| `/campfire off the record` | Pause capture |
| `/campfire on the record` | Resume capture |
| `/campfire forget` | Drop the replied-to capture, or the sender's latest |
| `/campfire help` | List the commands |

## What this scaffold includes

- Compose stack: Postgres with pgvector, Redis, Flask, Celery worker and beat, ingest loop, Baileys service, Vite frontend.
- Schema for groups, users, trips, messages (with an embedding column), locations, stories, side quests, and suggestions.
- Inbound capture that stores messages only while a trip is active, and the command handling above. Voice notes are queued for ElevenLabs speech to text.
- Story loop. After the local recap hour, an active trip with messages from that calendar day becomes a nightly story: ChatGPT writes playback segments, ElevenLabs speaks the narration as Ogg Opus, and the group gets a voice note. The same ElevenLabs key transcribes voice notes. `/campfire end` assembles a `kind: "full"` story for the playback page. Place coordinates on those segments are the model's estimates. If ChatGPT is unset, or ElevenLabs cannot speak the narration, the story is marked `failed` and the group gets a short text note.
- Nightly local tips. After the day recap, Campfire reads that day's chat vibe (mood, energy, `suggest_mode`) and dietary notes, then asks **Muse Spark** (Meta Model API) for tomorrow's restaurants, activities, and fun near the trip location. The voice note includes a short vibe-matched "for tomorrow" line, and WhatsApp gets a text list. Without `MUSE_API_KEY`, or when Muse fails, the night still posts the day recap alone.
- Clients for ChatGPT and ElevenLabs are used by that loop.
- Cross-trip memory. Each WhatsApp group gets one Backboard assistant, named `campfire:<group jid>`. Before a nightly or full story, the prompt gets that group's closest memories under "Known about this group". The model returns new nicknames, jokes, and sentiment in `memories`, and each one is saved after the story is. Without `BACKBOARD_API_KEY`, or when Backboard fails, stories are written from the chat alone.
- Next-trip suggestions. After the full story is saved, ChatGPT writes one `Suggestion` (`body` + `rationale`) from the trip chat and known group memories. The Next fire window already reads those rows from playback. A failed suggestion is logged and does not fail the story. The rationale is also stored in Backboard as sentiment when remember succeeds.
- Playback walks story segments over an illustrated map in `frontend/src/windows/TripMap.jsx`. `GOOGLE_MAPS_API_KEY` does not change that page.

Same-day reactions are part of the recap prompt. Reactions on the recap voice note itself are not tied back yet, because the outbound bridge does not return the sent message id. Messages sent after that night's recap run are kept for the full story.

## What is still ahead

1. **Photos and places** — photo segments already use an image when the model cites one. Still ahead: embeddings for photo and message correlation, and a geocoder in place of model coordinates. The `messages.embedding` column is unused.
2. **Anniversaries** — the daily job can see which trips are due. It does not post the callback or set `anniversary_sent_at`.
3. **Side quests** — unused. The model and window stay; nothing detects split-offs or accepts DMs.
