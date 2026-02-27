import { CodexExecProvider } from "./codex-exec/provider.js";
import { CodexRpcProvider } from "./codex-rpc/provider.js";
import type { Provider, SessionProvider } from "../types/events.js";

/**
 * Provider factory with environment-based selection.
 * 
 * Modes:
 * - exec (default): Spawns `codex exec --json` for each turn (stateless)
 * - rpc: Uses `codex-app-server` with persistent threads (stateful)
 * 
 * Design decisions:
 * - Default to exec so the CLI works out-of-the-box without app-server
 * - Return null for createSessionProvider() in exec mode (graceful degradation)
 * - Both providers implement the same Provider interface (transport abstraction)
 */

export function providerMode(): "exec" | "rpc" {
  const mode = process.env.NANO_PROVIDER?.toLowerCase();
  return mode === "rpc" ? "rpc" : "exec";
}

export function createProvider(): Provider {
  // Default to exec so local setup works even without app-server installed.
  return providerMode() === "rpc" ? new CodexRpcProvider() : new CodexExecProvider();
}

export function createSessionProvider(): SessionProvider | null {
  // Exec mode doesn't support sessions natively (it's stateless).
  // The chat loop handles this gracefully by falling back to runTask().
  if (providerMode() === "rpc") {
    return new CodexRpcProvider();
  }
  return null;
}
