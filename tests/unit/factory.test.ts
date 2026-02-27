import test from "node:test";
import assert from "node:assert/strict";
import { providerMode } from "../../src/providers/factory.js";

test("providerMode defaults to exec", () => {
  const original = process.env.NANO_PROVIDER;
  delete process.env.NANO_PROVIDER;
  try {
    assert.equal(providerMode(), "exec");
  } finally {
    if (original) {
      process.env.NANO_PROVIDER = original;
    }
  }
});
