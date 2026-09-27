import assert from "node:assert/strict";
import test from "node:test";

import { describeMessage } from "../src/messages.js";

const base = {
  key: { remoteJid: "crew@g.us", participant: "traveler@s.whatsapp.net", id: "incoming-1" },
  messageTimestamp: 1_800_000_000,
  pushName: "Traveler",
};

test("reply target comes from contextInfo", () => {
  const described = describeMessage({
    ...base,
    message: { extendedTextMessage: { text: "approve", contextInfo: { stanzaId: "proposal-1" } } },
  });
  assert.equal(described.quotedMessageId, "proposal-1");
});

test("reaction target comes from reactionMessage key", () => {
  const described = describeMessage({
    ...base,
    message: { reactionMessage: { text: "👍🏽", key: { id: "proposal-2" } } },
  });
  assert.equal(described.type, "reaction");
  assert.equal(described.text, "👍🏽");
  assert.equal(described.quotedMessageId, "proposal-2");
});
