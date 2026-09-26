import pino from "pino";

export const logger = pino({ level: process.env.LOG_LEVEL || "info" });

export const redisUrl = process.env.REDIS_URL || "redis://localhost:6379/0";
export const mediaDir = process.env.MEDIA_DIR || "/data/media";
export const authDir = process.env.WHATSAPP_AUTH_DIR || "auth";

export const inboundStream = "campfire:inbound";
export const outboundStream = "campfire:outbound";
export const outboundGroup = "whatsapp";
export const awaitingDmKey = "campfire:awaiting_dm";
export const loginCodeStream = "campfire:login_codes";
export const loginCodeGroup = "whatsapp-login";
