import fs from "node:fs/promises";
import path from "node:path";

export interface McpService {
  name: string;
  config: { mcpServers: Record<string, unknown> };
  sourcePath: string;
}

export async function discoverMcpServices(basePath: string): Promise<McpService[]> {
  const mcpDir = path.join(basePath, "mcp");

  try {
    await fs.access(mcpDir);
  } catch {
    return [];
  }

  const entries = await fs.readdir(mcpDir, { withFileTypes: true });
  const services: McpService[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const mcpJsonPath = path.join(mcpDir, entry.name, "mcp.json");
    try {
      const content = await fs.readFile(mcpJsonPath, "utf-8");
      const config = JSON.parse(content);
      if (config.mcpServers && typeof config.mcpServers === "object") {
        services.push({
          name: entry.name,
          config,
          sourcePath: mcpJsonPath,
        });
      }
    } catch {
      // No mcp.json or invalid JSON — skip
    }
  }

  return services;
}
