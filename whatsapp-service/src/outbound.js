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

async function sendOne(sock, payload) {
  if (payload.type === "audio" && payload.audio_path) {
    const audio = await fs.readFile(resolveAudio(payload.audio_path));
    const opus = String(payload.audio_path).toLowerCase().endsWith(".ogg");
    await sock.sendMessage(payload.group_jid, {
      audio,
      mimetype: opus ? "audio/ogg; codecs=opus" : "audio/mpeg",
      ptt: opus,
    });
    return;
  }
  if (payload.text) {
    await sock.sendMessage(payload.group_jid, { text: payload.text });
  }
}

async function deliverBatch(redis, getSocket, offset) {
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
        await sendOne(socket, JSON.parse(data || "{}"));
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
