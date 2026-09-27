import assert from "node:assert/strict";
import test from "node:test";

import { deliverBatch } from "../src/outbound.js";

test("delivery publishes the sent WhatsApp id for client correlation", async () => {
  const calls = [];
  const redis = {
    async xreadgroup() {
      return [["campfire:outbound", [["1-0", ["data", JSON.stringify({
        group_jid: "crew@g.us",
        type: "text",
        text: "Tomorrow",
        client_ref: "itinerary:bundle-1",
      })]]]]];
    },
    async xadd(...args) {
      calls.push(["xadd", ...args]);
    },
    async xack(...args) {
      calls.push(["xack", ...args]);
    },
  };
  const socket = {
    async sendMessage() {
      return { key: { id: "sent-wa-id" } };
    },
  };

  assert.equal(await deliverBatch(redis, () => socket, "0"), true);
  const event = JSON.parse(calls.find((call) => call[0] === "xadd")[4]);
  assert.equal(event.type, "outbound_sent");
  assert.equal(event.message_id, "sent-wa-id");
  assert.equal(event.client_ref, "itinerary:bundle-1");
});
