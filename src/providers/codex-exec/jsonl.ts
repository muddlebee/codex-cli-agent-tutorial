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

interface EventEnvelope {
  rawName: string;
  normalizedName: string;
  params: Record<string, unknown>;
  item: Record<string, unknown>;
}

function normalizeEventName(name: string): string {
  return name.replaceAll("/", ".").toLowerCase();
}

function toEnvelope(data: Record<string, unknown>): EventEnvelope {
  const rawName = pullName(data);
  const normalizedName = normalizeEventName(rawName);
  const params = (data.params ?? data) as Record<string, unknown>;
  const item = (params.item ?? {}) as Record<string, unknown>;
  return { rawName, normalizedName, params, item };
}

function isEvent(name: string, expected: string): boolean {
  return name.includes(expected);
}

function itemType(envelope: EventEnvelope): string {
  return getString(envelope.params.itemType) ?? getString(envelope.item.type) ?? "item";
}

function itemId(envelope: EventEnvelope): string | undefined {
  return getString(envelope.params.id) ?? getString(envelope.item.id);
}

function mapItemStarted(envelope: EventEnvelope): RuntimeEvent {
  return {
    type: "item_started",
    itemType: itemType(envelope),
    id: itemId(envelope)
  };
}

function mapItemUpdated(envelope: EventEnvelope): RuntimeEvent {
  return {
    type: "item_updated",
    itemType: itemType(envelope),
    id: itemId(envelope),
    delta: getString(envelope.params.delta) ?? getString(envelope.item.delta)
  };
}

function mapItemCompleted(envelope: EventEnvelope): RuntimeEvent {
  const type = itemType(envelope);
  const text = getString(envelope.item.text);

  if (type === "agent_message" && text) {
    // Newer Codex exec responses may emit final assistant text here.
    return { type: "assistant_delta", text };
  }

  return {
    type: "item_completed",
    itemType: type,
    id: itemId(envelope),
    summary: getString(envelope.params.summary) ?? text
  };
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

    const envelope = toEnvelope(check.data as Record<string, unknown>);
    const { rawName, normalizedName, params } = envelope;

    if (isEvent(normalizedName, "agentmessage") && typeof params.delta === "string") {
      return { type: "assistant_delta", text: params.delta };
    }
    if (isEvent(normalizedName, "item.started")) {
      return mapItemStarted(envelope);
    }
    if (isEvent(normalizedName, "item.updated")) {
      return mapItemUpdated(envelope);
    }
    if (isEvent(normalizedName, "item.completed")) {
      return mapItemCompleted(envelope);
    }
    if (isEvent(normalizedName, "requestapproval")) {
      const kind = normalizedName.includes("command")
        ? "command"
        : normalizedName.includes("file")
          ? "file_change"
          : "unknown";
      return { type: "approval_required", kind, payload: params };
    }
    if (isEvent(normalizedName, "turn.completed")) {
      const usage = (params.usage ?? undefined) as Record<string, number> | undefined;
      return { type: "turn_completed", usage };
    }
    if (isEvent(normalizedName, "turn.failed")) {
      return { type: "turn_failed", error: String(params.error ?? "turn failed") };
    }
    if (isEvent(normalizedName, "error")) {
      return { type: "error", error: String(params.message ?? params.error ?? "unknown error") };
    }

    return { type: "raw", name: rawName, payload: params };
  } catch {
    return { type: "raw", name: "invalid_json", payload: line };
  }
}
