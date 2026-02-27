import { z } from "zod";
import type { RuntimeEvent } from "../../types/events.js";

const AnyEvent = z.object({
  method: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  event: z.string().optional(),
  type: z.string().optional()
}).passthrough();

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
    if (name.includes("item/started")) {
      return { type: "item_started", itemType: String(params.itemType ?? "item"), id: String(params.id ?? "") || undefined };
    }
    if (name.includes("item/updated")) {
      return {
        type: "item_updated",
        itemType: String(params.itemType ?? "item"),
        id: String(params.id ?? "") || undefined,
        delta: typeof params.delta === "string" ? params.delta : undefined
      };
    }
    if (name.includes("item/completed")) {
      return {
        type: "item_completed",
        itemType: String(params.itemType ?? "item"),
        id: String(params.id ?? "") || undefined,
        summary: typeof params.summary === "string" ? params.summary : undefined
      };
    }
    if (name.includes("requestApproval")) {
      const kind = name.includes("command") ? "command" : name.includes("file") ? "file_change" : "unknown";
      return { type: "approval_required", kind, payload: params };
    }
    if (name.includes("turn/completed") || name.includes("TurnCompleted")) {
      const usage = (params.usage ?? undefined) as Record<string, number> | undefined;
      return { type: "turn_completed", usage };
    }
    if (name.includes("turn/failed") || name.includes("TurnFailed")) {
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
