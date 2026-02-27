import test from "node:test";
import assert from "node:assert/strict";
import { buildHistoryPrompt } from "../../src/core/session-store.js";

test("buildHistoryPrompt includes trailing user input", () => {
  const prompt = buildHistoryPrompt(
    [
      { role: "user", content: "hello", createdAt: "2026-01-01T00:00:00.000Z" },
      { role: "assistant", content: "hi", createdAt: "2026-01-01T00:00:01.000Z" }
    ],
    "next"
  );

  assert.match(prompt, /USER: next/);
  assert.match(prompt, /ASSISTANT:/);
});
