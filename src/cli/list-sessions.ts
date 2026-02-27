import { listSessions } from "../core/session-store.js";

/**
 * Prints all locally persisted sessions in a compact table-like format.
 */
export async function runListSessions(): Promise<void> {
  const sessions = await listSessions();
  if (sessions.length === 0) {
    process.stdout.write("No sessions found.\n");
    return;
  }

  for (const session of sessions) {
    process.stdout.write(`${session.id}\t${session.updatedAt}\n`);
  }
}
