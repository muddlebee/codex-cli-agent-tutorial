import type { RuntimeEvent } from "../types/events.js";

/**
 * Converts normalized runtime events into terminal output.
 *
 * Note: This renderer is intentionally minimal. Unknown events are ignored so
 * the CLI remains stable while event mapping evolves.
 */
export function renderEvent(event: RuntimeEvent): void {
  switch (event.type) {
    case "assistant_delta":
      process.stdout.write(event.text);
      break;
    case "turn_completed":
      process.stdout.write("\n[turn completed]\n");
      break;
    case "turn_failed":
      process.stderr.write(`\n[turn failed] ${event.error}\n`);
      break;
    case "approval_required":
      process.stdout.write(`\n[approval required] ${event.kind}\n`);
      break;
    case "error":
      process.stderr.write(`\n[error] ${event.error}\n`);
      break;
    default:
      break;
  }
}
