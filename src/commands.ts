import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export interface Command {
  name: string;
  description: string;
  path: string;
}

export async function discoverCommands(basePath: string): Promise<Command[]> {
  const commandsDir = path.join(basePath, "commands");

  try {
    await fs.access(commandsDir);
  } catch {
    return [];
  }

  const entries = await fs.readdir(commandsDir, { withFileTypes: true });
  const commands: Command[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

    const filePath = path.join(commandsDir, entry.name);
    const name = entry.name.replace(/\.md$/, "");

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const parsed = parseFrontmatter(content);
      commands.push({
        name,
        description: parsed.description ?? "",
        path: filePath,
      });
    } catch {
      commands.push({ name, description: "", path: filePath });
    }
  }

  return commands;
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const parsed = parseYaml(match[1]);
  return (parsed ?? {}) as Record<string, string>;
}
