import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { RuntimeEvent } from "../types/events.js";

/**
 * SessionStore manages local persistence for chat sessions.
 * 
 * Storage layout per session:
 * .nano-agent/sessions/<uuid>/
 *   ├── meta.json          # Session metadata (id, timestamps, remoteThreadId)
 *   ├── transcript.jsonl   # User/assistant message pairs (append-only)
 *   ├── events.jsonl       # Raw runtime events for debugging
 *   └── todo.json          # Planning state (managed by TodoManager)
 * 
 * Design decisions:
 * - JSONL for transcripts/events: append-only, human-readable, easy to stream/tail
 * - File-based storage: no database dependencies, easy to inspect/debug
 * - UUID session IDs: collision-resistant, no central coordination needed
 * - remoteThreadId mapping: bridges local sessions to RPC provider threads
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface SessionMeta {
  id: string;
  createdAt: string;
  updatedAt: string;
  remoteThreadId?: string;
}

const BASE_DIR = join(process.cwd(), ".nano-agent", "sessions");

function sessionDir(id: string): string {
  return join(BASE_DIR, id);
}

function transcriptPath(id: string): string {
  return join(sessionDir(id), "transcript.jsonl");
}

function eventPath(id: string): string {
  return join(sessionDir(id), "events.jsonl");
}

function metaPath(id: string): string {
  return join(sessionDir(id), "meta.json");
}

/**
 * Creates a new local session directory and metadata file.
 */
export async function createSession(): Promise<SessionMeta> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const meta: SessionMeta = { id, createdAt: now, updatedAt: now };
  await mkdir(sessionDir(id), { recursive: true });
  await writeFile(metaPath(id), JSON.stringify(meta, null, 2) + "\n", "utf8");
  return meta;
}

export async function loadSession(id: string): Promise<SessionMeta | null> {
  const path = metaPath(id);
  if (!existsSync(path)) {
    return null;
  }
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as SessionMeta;
}

/**
 * Updates `updatedAt` in session metadata to indicate recent activity.
 */
export async function touchSession(id: string): Promise<void> {
  const existing = await loadSession(id);
  if (!existing) {
    return;
  }
  existing.updatedAt = new Date().toISOString();
  await writeFile(metaPath(id), JSON.stringify(existing, null, 2) + "\n", "utf8");
}

export async function setRemoteThreadId(id: string, remoteThreadId: string): Promise<void> {
  const existing = await loadSession(id);
  if (!existing) {
    return;
  }
  existing.remoteThreadId = remoteThreadId;
  existing.updatedAt = new Date().toISOString();
  await writeFile(metaPath(id), JSON.stringify(existing, null, 2) + "\n", "utf8");
}

/**
 * Appends one user/assistant message to transcript.jsonl.
 */
export async function appendTranscript(id: string, message: ChatMessage): Promise<void> {
  await mkdir(sessionDir(id), { recursive: true });
  // JSONL keeps appends cheap and makes manual debugging straightforward.
  // No need to parse/rewrite the entire file for each message.
  await writeFile(transcriptPath(id), JSON.stringify(message) + "\n", { encoding: "utf8", flag: "a" });
  await touchSession(id);
}

export async function readTranscript(id: string): Promise<ChatMessage[]> {
  const path = transcriptPath(id);
  if (!existsSync(path)) {
    return [];
  }
  const raw = await readFile(path, "utf8");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ChatMessage);
}

/**
 * Appends one normalized runtime event to events.jsonl.
 */
export async function appendEvent(id: string, event: RuntimeEvent): Promise<void> {
  await mkdir(sessionDir(id), { recursive: true });
  // Runtime events are intentionally stored separately from chat messages.
  await writeFile(eventPath(id), JSON.stringify({ ts: new Date().toISOString(), event }) + "\n", {
    encoding: "utf8",
    flag: "a"
  });
}

export async function listSessions(): Promise<SessionMeta[]> {
  if (!existsSync(BASE_DIR)) {
    return [];
  }
  const entries = await readdir(BASE_DIR, { withFileTypes: true });
  const sessions: SessionMeta[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const meta = await loadSession(entry.name);
    if (meta) {
      sessions.push(meta);
    }
  }
  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Builds the prompt context from recent local transcript messages.
 */
export function buildHistoryPrompt(messages: ChatMessage[], userInput: string): string {
  // Keep history bounded to limit prompt growth and runaway token usage.
  // For production, consider more sophisticated strategies:
  // - Summarization of old messages
  // - Sliding window with importance scoring
  // - Separate long-term memory store
  const history = messages
    .slice(-20)
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n\n");

  if (!history) {
    return userInput;
  }

  return `Continue this conversation.\n\n${history}\n\nUSER: ${userInput}\n\nASSISTANT:`;
}
