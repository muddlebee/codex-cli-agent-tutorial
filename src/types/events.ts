/**
 * RuntimeEvent is the normalized event union that all providers emit.
 * 
 * Design decisions:
 * - Transport-agnostic: same event types for exec and RPC providers
 * - Discriminated union: type field enables exhaustive switch/case handling
 * - Minimal payload: only essential fields, raw events preserved for debugging
 * 
 * Event types:
 * - assistant_delta: Incremental text from the agent
 * - item_started/updated/completed: Tool/action lifecycle events
 * - approval_required: Agent requests permission (command, file change, etc.)
 * - turn_completed/failed: Turn lifecycle markers
 * - error: Non-fatal errors during execution
 * - raw: Unrecognized events (preserved for debugging)
 */
export type RuntimeEvent =
  | { type: "assistant_delta"; text: string }
  | { type: "item_started"; itemType: string; id?: string }
  | { type: "item_updated"; itemType: string; id?: string; delta?: string }
  | { type: "item_completed"; itemType: string; id?: string; summary?: string }
  | { type: "approval_required"; kind: "command" | "file_change" | "unknown"; payload: unknown }
  | { type: "turn_completed"; usage?: Record<string, number> }
  | { type: "turn_failed"; error: string }
  | { type: "error"; error: string }
  | { type: "raw"; name: string; payload: unknown };

export interface ProviderRunOptions {
  cwd?: string;
  model?: string;
}

/**
 * Provider interface hierarchy:
 * 
 * Provider (base)
 *   └─ SessionProvider (adds session lifecycle)
 *       └─ InteractiveSessionProvider (adds turn control + approvals)
 * 
 * This hierarchy reflects capability levels:
 * - CodexExecProvider implements Provider only (stateless)
 * - CodexRpcProvider implements InteractiveSessionProvider (full featured)
 */

export interface Provider {
  runTask(input: string, options?: ProviderRunOptions): AsyncGenerator<RuntimeEvent>;
}

export interface SessionProvider extends Provider {
  startSession(): Promise<string>;
  sendTurn(sessionId: string, input: string): AsyncGenerator<RuntimeEvent>;
  resumeSession(sessionId: string): Promise<boolean>;
}

export interface InteractiveSessionProvider extends SessionProvider {
  steerTurn(sessionId: string, input: string): Promise<void>;
  interruptTurn(sessionId: string): Promise<void>;
  respondApproval(requestId: string | number, allow: boolean): Promise<void>;
}
