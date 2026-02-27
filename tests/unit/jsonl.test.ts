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
