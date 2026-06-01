import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export interface Agent {
  name: string;
  description: string;
  path: string;
}

export async function discoverAgents(basePath: string): Promise<Agent[]> {
  const agentsDir = path.join(basePath, "agents");

  try {
    await fs.access(agentsDir);
  } catch {
    return [];
  }

  const entries = await fs.readdir(agentsDir, { withFileTypes: true });
  const agents: Agent[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

    const filePath = path.join(agentsDir, entry.name);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const parsed = parseFrontmatter(content);

      if (parsed.name && parsed.description) {
        agents.push({
          name: parsed.name,
          description: parsed.description,
          path: filePath,
        });
      }
    } catch {
      // Unreadable — skip
    }
  }

  return agents;
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const parsed = parseYaml(match[1]);
  return (parsed ?? {}) as Record<string, string>;
}
