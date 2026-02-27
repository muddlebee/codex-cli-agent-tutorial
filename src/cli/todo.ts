import type { TodoManager } from "../core/todo-manager.js";

export async function handleTodoCommand(manager: TodoManager, line: string): Promise<string | null> {
  if (!line.startsWith("/todo")) {
    return null;
  }

  const [, action, ...rest] = line.split(" ");
  if (!action || action === "help") {
    return "todo commands: /todo add <text> | /todo start <id> | /todo done <id> | /todo list";
  }

  if (action === "add") {
    const text = rest.join(" ").trim();
    if (!text) {
      return "usage: /todo add <text>";
    }
    const item = await manager.add(text);
    return `added todo #${item.id}`;
  }

  if (action === "start") {
    const id = Number(rest[0]);
    if (!Number.isInteger(id)) {
      return "usage: /todo start <id>";
    }
    await manager.setStatus(id, "in_progress");
    return `todo #${id} is in_progress`;
  }

  if (action === "done") {
    const id = Number(rest[0]);
    if (!Number.isInteger(id)) {
      return "usage: /todo done <id>";
    }
    await manager.setStatus(id, "completed");
    return `todo #${id} completed`;
  }

  if (action === "list") {
    const items = await manager.list();
    if (items.length === 0) {
      return "no todos";
    }
    return items.map((item) => `#${item.id} [${item.status}] ${item.text}`).join("\n");
  }

  return "unknown /todo command";
}
