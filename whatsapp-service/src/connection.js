import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";

import { authDir, awaitingDmKey, logger } from "./config.js";
import { describeMessage, saveMedia } from "./messages.js";

const subjects = new Map();
let reconnectTimer = null;
let session = 0;

async function groupSubject(sock, jid) {
  if (subjects.has(jid)) return subjects.get(jid);
  try {
    const meta = await sock.groupMetadata(jid);
    const subject = meta.subject || "";
    subjects.set(jid, subject);
    return subject;
  } catch (err) {
    logger.warn({ err, jid }, "Could not read the group subject");
    subjects.set(jid, "");
    return "";
  }
}

async function allowed(redis, described) {
  if (described.isGroup) return true;
  const waiting = await redis.sismember(awaitingDmKey, described.senderJid);
  if (!waiting) {
    logger.debug({ jid: described.jid }, "Ignored a direct message");
  }
  return Boolean(waiting);
}

export async function connectWhatsApp({ redis, onSocket, onMessage }) {
  const mine = ++session;
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  let version;
  try {
    version = (await fetchLatestBaileysVersion()).version;
  } catch (err) {
    logger.warn({ err }, "Using Baileys' default version");
  }

  const sock = makeWASocket({
    auth: state,
    ...(version ? { version } : {}),
    logger: pino({ level: "warn" }),
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => {
    if (mine !== session) return;
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      qrcode.generate(qr, { small: true });
      logger.info("Scan this QR code in WhatsApp → Linked devices");
    }
    if (connection === "open") {
      logger.info("WhatsApp connected");
      onSocket(sock);
    }
    if (connection === "close") {
      onSocket(null);
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        logger.error("WhatsApp logged this session out. Clear the auth volume and scan again.");
        return;
      }
      if (reconnectTimer) return;
      logger.warn({ statusCode }, "WhatsApp connection closed; reconnecting");
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWhatsApp({ redis, onSocket, onMessage }).catch((err) => {
          logger.error({ err }, "Reconnect failed");
        });
      }, 2000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (mine !== session || type !== "notify") return;
    for (const msg of messages) {
      try {
        const described = describeMessage(msg);
        if (!described || !(await allowed(redis, described))) continue;

        let mediaPath = null;
        if (described.hasMedia) {
          mediaPath = await saveMedia(sock, msg, described);
        }

        const subject = described.isGroup ? await groupSubject(sock, described.jid) : "";
        await onMessage({
          group_jid: described.jid,
          sender_jid: described.senderJid,
          push_name: described.pushName,
          group_subject: subject,
          message_id: described.messageId,
          timestamp: described.timestamp,
          type: described.type,
          text: described.text,
          media_path: mediaPath,
          quoted_message_id: described.quotedMessageId,
          direct: !described.isGroup,
        });
      } catch (err) {
        logger.error({ err }, "Failed to handle a WhatsApp message");
      }
    }
  });
}
