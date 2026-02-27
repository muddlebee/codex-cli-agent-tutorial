import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TodoManager } from "../../src/core/todo-manager.js";

test("todo manager enforces single in_progress", async () => {
  const originalCwd = process.cwd();
  const temp = await mkdtemp(join(tmpdir(), "nano-agent-test-"));
  process.chdir(temp);

  try {
    const manager = new TodoManager("s1");
    const a = await manager.add("task A");
    const b = await manager.add("task B");
    await manager.setStatus(a.id, "in_progress");

    await assert.rejects(async () => {
      await manager.setStatus(b.id, "in_progress");
    }, /only one in_progress/);
  } finally {
    process.chdir(originalCwd);
  }
});
