import { logger } from "./config.js";
import { connectWhatsApp } from "./connection.js";
import { startLoginCodes } from "./loginCodes.js";
import { publishInbound, startOutbound } from "./outbound.js";
import { redis } from "./redis.js";

let socket = null;

connectWhatsApp({
  redis,
  onSocket(next) {
    socket = next;
  },
  onMessage(payload) {
    return publishInbound(redis, payload);
  },
}).catch((err) => {
  logger.error({ err }, "WhatsApp setup failed");
  process.exit(1);
});

startOutbound(redis, () => socket).catch((err) => {
  logger.error({ err }, "Outbound loop failed");
  process.exit(1);
});

startLoginCodes(redis, () => socket).catch((err) => {
  logger.error({ err }, "Login code loop failed");
  process.exit(1);
});
