import fs from "node:fs/promises";
import path from "node:path";

import { inboundStream, logger, mediaDir, outboundGroup, outboundStream } from "./config.js";

function fieldsToObject(flat) {
  const result = {};
  for (let index = 0; index < flat.length; index += 2) {
    result[flat[index]] = flat[index + 1];
  }
  return result;
}

export async function publishInbound(redis, payload) {
  await redis.xadd(inboundStream, "*", "data", JSON.stringify(payload));
}

async function ensureOutboundGroup(redis) {
  try {
    await redis.xgroup("CREATE", outboundStream, outboundGroup, "0", "MKSTREAM");
  } catch (err) {
    if (!String(err?.message || err).includes("BUSYGROUP")) throw err;
  }
}

function resolveAudio(audioPath) {
  if (path.isAbsolute(audioPath)) return audioPath;
  return path.join(mediaDir, audioPath);
}

export async function sendOne(sock, payload) {
  if (payload.type === "poll" && payload.poll) {
    const values = (payload.poll.values || []).map((value) => String(value).trim()).filter(Boolean).slice(0, 12);
    if (values.length < 2) throw new Error("Poll needs at least two options");
    return sock.sendMessage(payload.group_jid, {
      poll: {
        name: String(payload.poll.name || "Where should the next fire be?").slice(0, 255),
        values,
        selectableCount: 1,
      },
    });
  }
  if (payload.type === "audio" && payload.audio_path) {
    const audio = await fs.readFile(resolveAudio(payload.audio_path));
    const opus = String(payload.audio_path).toLowerCase().endsWith(".ogg");
    return sock.sendMessage(payload.group_jid, {
      audio,
      mimetype: opus ? "audio/ogg; codecs=opus" : "audio/mpeg",
      ptt: opus,
    });
  }
  if (payload.text) {
    return sock.sendMessage(payload.group_jid, { text: payload.text });
  }
  return null;
}

export async function deliverBatch(redis, getSocket, offset) {
  const rows = await redis.xreadgroup(
    "GROUP",
    outboundGroup,
    "whatsapp-1",
    "COUNT",
    10,
    ...(offset === ">" ? ["BLOCK", 5000] : []),
    "STREAMS",
    outboundStream,
    offset,
  );
  if (!rows) return true;

  let delivered = true;
  for (const [, entries] of rows) {
    for (const [id, flat] of entries) {
      const socket = getSocket();
      if (!socket) return false;
      const data = fieldsToObject(flat).data;
      try {
        const payload = JSON.parse(data || "{}");
        const sent = await sendOne(socket, payload);
        if (payload.client_ref && sent?.key?.id) {
          await redis.xadd(inboundStream, "*", "data", JSON.stringify({
            group_jid: payload.group_jid,
            message_id: sent.key.id,
            timestamp: Math.floor(Date.now() / 1000),
            type: "outbound_sent",
            client_ref: payload.client_ref,
            direct: false,
          }));
        }
        await redis.xack(outboundStream, outboundGroup, id);
      } catch (err) {
        delivered = false;
        logger.error({ err, id }, "Outbound send failed");
      }
    }
  }
  return delivered;
}

export async function startOutbound(redis, getSocket) {
  await ensureOutboundGroup(redis);

  for (;;) {
    if (!getSocket()) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }
    try {
      const pendingOk = await deliverBatch(redis, getSocket, "0");
      if (!pendingOk) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      await deliverBatch(redis, getSocket, ">");
    } catch (err) {
      logger.error({ err }, "Outbound read failed");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}
