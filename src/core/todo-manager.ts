import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * TodoManager provides explicit planning state for chat sessions.
 * 
 * Design constraints (intentional for tutorial scenarios):
 * - Max 20 todos: keeps prompts and state manageable
 * - Only one in_progress at a time: enforces serial focus
 * 
 * Why explicit planning?
 * - Conversation memory alone is not planning
 * - Todos give the agent (and user) a "working memory" surface
 * - Injecting todo context into prompts keeps the agent aware of the plan
 * 
 * Production considerations:
 * - More sophisticated task graphs (dependencies, priorities)
 * - Automatic todo extraction from conversation
 * - Integration with external project management tools
 */

export type TodoStatus = "pending" | "in_progress" | "completed";

export interface TodoItem {
  id: number;
  text: string;
  status: TodoStatus;
}

export interface TodoState {
  items: TodoItem[];
}

export class TodoManager {
  constructor(private readonly sessionId: string) {}

  private get path(): string {
    return join(process.cwd(), ".nano-agent", "sessions", this.sessionId, "todo.json");
  }

  async read(): Promise<TodoState> {
    if (!existsSync(this.path)) {
      return { items: [] };
    }
    const raw = await readFile(this.path, "utf8");
    return JSON.parse(raw) as TodoState;
  }

  private async write(state: TodoState): Promise<void> {
    await mkdir(join(process.cwd(), ".nano-agent", "sessions", this.sessionId), { recursive: true });
    await writeFile(this.path, JSON.stringify(state, null, 2) + "\n", "utf8");
  }

  async add(text: string): Promise<TodoItem> {
    const state = await this.read();
    // A hard cap keeps prompts and state manageable for tutorial scenarios.
    // This constraint is pedagogical: it forces thinking about priorities.
    if (state.items.length >= 20) {
      throw new Error("todo limit reached (max 20)");
    }
    const id = (state.items.at(-1)?.id ?? 0) + 1;
    const item: TodoItem = { id, text, status: "pending" };
    state.items.push(item);
    await this.write(state);
    return item;
  }

  async setStatus(id: number, status: TodoStatus): Promise<TodoItem> {
    const state = await this.read();
    const found = state.items.find((item) => item.id === id);
    if (!found) {
      throw new Error(`todo ${id} not found`);
    }

    if (status === "in_progress") {
      // Enforce single active task to encourage serial focus.
      // This prevents the agent (and user) from context-switching across too many tasks.
      const active = state.items.filter((item) => item.status === "in_progress" && item.id !== id);
      if (active.length > 0) {
        throw new Error("only one in_progress todo allowed");
      }
    }

    found.status = status;
    await this.write(state);
    return found;
  }

  async list(): Promise<TodoItem[]> {
    const state = await this.read();
    return state.items;
  }

  async renderForPrompt(): Promise<string> {
    const items = await this.list();
    if (items.length === 0) {
      return "No active todos.";
    }
    return items.map((item) => `- [${item.status}] #${item.id} ${item.text}`).join("\n");
  }
}
