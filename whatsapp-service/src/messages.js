import fs from "node:fs/promises";
import path from "node:path";

import { downloadMediaMessage } from "@whiskeysockets/baileys";

import { logger, mediaDir } from "./config.js";

function unwrap(message) {
  let current = message;
  for (let depth = 0; current && depth < 4; depth += 1) {
    const inner =
      current.ephemeralMessage?.message ||
      current.viewOnceMessage?.message ||
      current.viewOnceMessageV2?.message ||
      current.documentWithCaptionMessage?.message;
    if (!inner) break;
    current = inner;
  }
  return current;
}

function extensionFor(mime, fallback) {
  if (!mime) return fallback;
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("mp4")) return "mp4";
  return fallback;
}

function quotedId(content) {
  return (
    content.reactionMessage?.key?.id ||
    content.extendedTextMessage?.contextInfo?.stanzaId ||
    content.imageMessage?.contextInfo?.stanzaId ||
    content.videoMessage?.contextInfo?.stanzaId ||
    content.audioMessage?.contextInfo?.stanzaId ||
    null
  );
}

function phoneJid(candidates) {
  return candidates.find((jid) => typeof jid === "string" && jid.endsWith("@s.whatsapp.net")) || null;
}

export function describeMessage(msg) {
  const key = msg.key || {};
  const jid = key.remoteJid;
  if (!jid || key.fromMe || jid === "status@broadcast" || jid.endsWith("@broadcast")) {
    return null;
  }

  const content = unwrap(msg.message);
  if (!content || content.protocolMessage) return null;

  let type = "text";
  let text = content.conversation || content.extendedTextMessage?.text || "";
  let mime = null;
  let fallbackExt = "bin";

  if (content.imageMessage) {
    type = "image";
    text = content.imageMessage.caption || text;
    mime = content.imageMessage.mimetype;
    fallbackExt = "jpg";
  } else if (content.audioMessage) {
    type = "audio";
    mime = content.audioMessage.mimetype;
    fallbackExt = "ogg";
  } else if (content.videoMessage) {
    type = "video";
    text = content.videoMessage.caption || text;
    mime = content.videoMessage.mimetype;
    fallbackExt = "mp4";
  } else if (content.reactionMessage) {
    type = "reaction";
    text = content.reactionMessage.text || "";
  } else if (content.stickerMessage) {
    type = "sticker";
  } else if (!text) {
    return null;
  }

  const rawTimestamp = msg.messageTimestamp;
  const timestamp = Number(rawTimestamp?.toString?.() || rawTimestamp || 0);

  return {
    isGroup: jid.endsWith("@g.us"),
    jid,
    senderJid: phoneJid([key.participantAlt, key.participantPn, key.senderPn, key.participant, jid]) || key.participant || jid,
    messageId: key.id,
    pushName: msg.pushName || "",
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    type,
    text: text || "",
    quotedMessageId: quotedId(content),
    hasMedia: Boolean(mime),
    mime,
    fallbackExt,
  };
}

export async function saveMedia(sock, msg, described) {
  const buffer = await downloadMediaMessage(msg, "buffer", {}, {
    logger,
    reuploadRequest: sock.updateMediaMessage,
  });
  const safeId = String(described.messageId || "media").replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = `${safeId}.${extensionFor(described.mime, described.fallbackExt)}`;
  const directory = path.join(mediaDir, "inbound");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, filename), buffer);
  return path.posix.join("inbound", filename);
}
