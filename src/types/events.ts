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
