import fs from "node:fs/promises";
import path from "node:path";

export interface ListOptions {
  qoderDir: string;
  mcpTargetDir: string;
  type?: "skill" | "agent" | "mcp" | "command";
}

export interface ListResult {
  skills: string[];
  agents: string[];
  mcp: string[];
  commands: string[];
}

export async function runList(options: ListOptions): Promise<ListResult> {
  const result: ListResult = { skills: [], agents: [], mcp: [], commands: [] };
  const { qoderDir, mcpTargetDir, type } = options;

  if (!type || type === "skill") {
    result.skills = await listSkills(qoderDir);
  }

  if (!type || type === "agent") {
    result.agents = await listAgents(qoderDir);
  }

  if (!type || type === "mcp") {
    result.mcp = await listMcp(mcpTargetDir);
  }

  if (!type || type === "command") {
    result.commands = await listCommands(qoderDir);
  }

  return result;
}

async function listSkills(qoderDir: string): Promise<string[]> {
  const skillsDir = path.join(qoderDir, "skills");
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function listAgents(qoderDir: string): Promise<string[]> {
  const agentsDir = path.join(qoderDir, "agents");
  try {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => e.name.replace(/\.md$/, ""));
  } catch {
    return [];
  }
}

async function listMcp(mcpTargetDir: string): Promise<string[]> {
  const mcpPath = path.join(mcpTargetDir, "mcp.json");
  try {
    const content = await fs.readFile(mcpPath, "utf-8");
    const config = JSON.parse(content);
    if (config.mcpServers && typeof config.mcpServers === "object") {
      return Object.keys(config.mcpServers);
    }
    return [];
  } catch {
    return [];
  }
}

async function listCommands(qoderDir: string): Promise<string[]> {
  const commandsDir = path.join(qoderDir, "commands");
  try {
    const entries = await fs.readdir(commandsDir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => e.name.replace(/\.md$/, ""));
  } catch {
    return [];
  }
}
