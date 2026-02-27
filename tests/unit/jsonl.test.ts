import test from "node:test";
import assert from "node:assert/strict";
import { mapCodexEvent, parseJsonlChunk } from "../../src/providers/codex-exec/jsonl.js";

test("parseJsonlChunk splits complete lines and keeps rest", () => {
  const { lines, rest } = parseJsonlChunk('{"a":1}\n{"b":2}');
  assert.deepEqual(lines, ['{"a":1}']);
  assert.equal(rest, '{"b":2}');
});

test("mapCodexEvent maps assistant delta", () => {
  const event = mapCodexEvent(JSON.stringify({ method: "item/agentMessage/delta", params: { delta: "hello" } }));
  assert.equal(event.type, "assistant_delta");
});

test("mapCodexEvent maps dot-style item.completed agent message", () => {
  const event = mapCodexEvent(JSON.stringify({
    type: "item.completed",
    item: {
      id: "item_1",
      type: "agent_message",
      text: "GM. What do you want to work on first today?"
    }
  }));
  assert.equal(event.type, "assistant_delta");
  if (event.type === "assistant_delta") {
    assert.equal(event.text, "GM. What do you want to work on first today?");
  }
});

test("mapCodexEvent maps dot-style turn.completed", () => {
  const event = mapCodexEvent(JSON.stringify({
    type: "turn.completed",
    usage: { input_tokens: 1, output_tokens: 2 }
  }));
  assert.equal(event.type, "turn_completed");
});
