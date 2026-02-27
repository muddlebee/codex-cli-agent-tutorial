import { z } from "zod";
import type { RuntimeEvent } from "../../types/events.js";

const AnyEvent = z.object({
  method: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  event: z.string().optional(),
  type: z.string().optional()
}).passthrough();

/**
 * Splits a possibly-partial JSONL stream buffer into:
 * - complete lines ready to parse now
 * - trailing remainder to keep for the next chunk
 */
export function parseJsonlChunk(buffer: string): { lines: string[]; rest: string } {
  // Keep the trailing partial line for the next chunk.
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  const lines = parts.filter((line) => line.trim().length > 0);
  return { lines, rest };
}

function pullName(data: Record<string, unknown>): string {
  return String(data.method ?? data.event ?? data.type ?? "unknown");
}

/**
 * Helper for safely extracting optional non-empty strings from unknown values.
 */
function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Maps one raw JSONL event line from `codex exec --json` into the internal
 * RuntimeEvent union used by the rest of the CLI.
 */
export function mapCodexEvent(line: string): RuntimeEvent {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const check = AnyEvent.safeParse(parsed);
    if (!check.success) {
      return { type: "raw", name: "unparsed", payload: parsed };
    }

    const data = check.data as Record<string, unknown>;
    const name = pullName(data);
    const params = (data.params ?? data) as Record<string, unknown>;

    // Mapping is intentionally loose to survive minor Codex event-shape changes.
    if (name.includes("agentMessage") && typeof params.delta === "string") {
      return { type: "assistant_delta", text: params.delta };
    }
    if (name.includes("item/started") || name.includes("item.started")) {
      const item = (params.item ?? {}) as Record<string, unknown>;
      const itemType = getString(params.itemType) ?? getString(item.type) ?? "item";
      const id = getString(params.id) ?? getString(item.id);
      return { type: "item_started", itemType, id };
    }
    if (name.includes("item/updated") || name.includes("item.updated")) {
      const item = (params.item ?? {}) as Record<string, unknown>;
      const itemType = getString(params.itemType) ?? getString(item.type) ?? "item";
      const id = getString(params.id) ?? getString(item.id);
      const delta = getString(params.delta) ?? getString(item.delta);
      return {
        type: "item_updated",
        itemType,
        id,
        delta
      };
    }
    if (name.includes("item/completed") || name.includes("item.completed")) {
      const item = (params.item ?? {}) as Record<string, unknown>;
      const itemType = getString(params.itemType) ?? getString(item.type) ?? "item";
      const id = getString(params.id) ?? getString(item.id);
      const text = getString(item.text);
      if (itemType === "agent_message" && text) {
        // Newer Codex event shape sends full assistant text in item.completed.
        return { type: "assistant_delta", text };
      }
      return {
        type: "item_completed",
        itemType,
        id,
        summary: getString(params.summary) ?? text
      };
    }
    if (name.includes("requestApproval")) {
      const kind = name.includes("command") ? "command" : name.includes("file") ? "file_change" : "unknown";
      return { type: "approval_required", kind, payload: params };
    }
    if (name.includes("turn/completed") || name.includes("turn.completed") || name.includes("TurnCompleted")) {
      const usage = (params.usage ?? undefined) as Record<string, number> | undefined;
      return { type: "turn_completed", usage };
    }
    if (name.includes("turn/failed") || name.includes("turn.failed") || name.includes("TurnFailed")) {
      return { type: "turn_failed", error: String(params.error ?? "turn failed") };
    }
    if (name.includes("error")) {
      return { type: "error", error: String(params.message ?? params.error ?? "unknown error") };
    }

    return { type: "raw", name, payload: params };
  } catch {
    return { type: "raw", name: "invalid_json", payload: line };
  }
}
