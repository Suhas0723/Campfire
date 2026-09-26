import { logger, loginCodeGroup, loginCodeStream } from "./config.js";

const CODE_TTL_MS = 10 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureGroup(redis) {
  try {
    await redis.xgroup("CREATE", loginCodeStream, loginCodeGroup, "0", "MKSTREAM");
  } catch (err) {
    if (!String(err?.message || err).includes("BUSYGROUP")) throw err;
  }
}

// Entries hold a live code, so they are deleted as soon as they are handled.
async function forget(redis, id) {
  await redis.xack(loginCodeStream, loginCodeGroup, id);
  await redis.xdel(loginCodeStream, id);
}

async function handle(redis, sock, id, flat) {
  const createdAt = Number(id.split("-")[0]);
  if (Date.now() - createdAt > CODE_TTL_MS) {
    await forget(redis, id);
    return true;
  }
  const index = flat.indexOf("data");
  const job = JSON.parse(index === -1 ? "{}" : flat[index + 1]);
  if (!job.jid || !job.text) {
    await forget(redis, id);
    return true;
  }
  try {
    await sock.sendMessage(job.jid, { text: job.text });
    await forget(redis, id);
    logger.info({ id }, "Sent login code");
    return true;
  } catch (err) {
    logger.error({ err, id }, "Login code send failed");
    return false;
  }
}

async function readBatch(redis, getSocket, offset) {
  const rows = await redis.xreadgroup(
    "GROUP",
    loginCodeGroup,
    "whatsapp-1",
    "COUNT",
    10,
    ...(offset === ">" ? ["BLOCK", 5000] : []),
    "STREAMS",
    loginCodeStream,
    offset,
  );
  if (!rows) return true;
  let ok = true;
  for (const [, entries] of rows) {
    for (const [id, flat] of entries) {
      const sock = getSocket();
      if (!sock) return false;
      ok = (await handle(redis, sock, id, flat)) && ok;
    }
  }
  return ok;
}

export async function startLoginCodes(baseRedis, getSocket) {
  const redis = baseRedis.duplicate();
  await ensureGroup(redis);

  for (;;) {
    if (!getSocket()) {
      await sleep(1000);
      continue;
    }
    try {
      if (!(await readBatch(redis, getSocket, "0"))) {
        await sleep(2000);
        continue;
      }
      await readBatch(redis, getSocket, ">");
    } catch (err) {
      logger.error({ err }, "Login code read failed");
      await sleep(2000);
    }
  }
}
