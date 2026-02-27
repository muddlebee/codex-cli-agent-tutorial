import { CodexExecProvider } from "./codex-exec/provider.js";
import { CodexRpcProvider } from "./codex-rpc/provider.js";
import type { Provider, SessionProvider } from "../types/events.js";

export function providerMode(): "exec" | "rpc" {
  const mode = process.env.NANO_PROVIDER?.toLowerCase();
  return mode === "rpc" ? "rpc" : "exec";
}

export function createProvider(): Provider {
  return providerMode() === "rpc" ? new CodexRpcProvider() : new CodexExecProvider();
}

export function createSessionProvider(): SessionProvider | null {
  if (providerMode() === "rpc") {
    return new CodexRpcProvider();
  }
  return null;
}
