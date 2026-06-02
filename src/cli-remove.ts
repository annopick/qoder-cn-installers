import fs from "node:fs/promises";
import path from "node:path";
import { readSourceTracker, writeSourceTracker } from "./source-tracker.js";

export interface RemoveOptions {
  qoderDir: string;
  mcpTargetDir: string;
  skills?: string[];
  agents?: string[];
  mcpServices?: string[];
  commands?: string[];
  all?: boolean;
}

export async function runRemove(options: RemoveOptions): Promise<void> {
  const { qoderDir, mcpTargetDir } = options;
  const trackerPath = path.join(qoderDir, ".qci.source.json");
  const tracker = await readSourceTracker(trackerPath);

  if (options.all) {
    await removeAll(qoderDir, mcpTargetDir, tracker);
  } else {
    if (options.skills) await removeSkills(qoderDir, options.skills, tracker);
    if (options.agents) await removeAgents(qoderDir, options.agents, tracker);
    if (options.mcpServices) await removeMcpServices(mcpTargetDir, options.mcpServices, tracker);
    if (options.commands) await removeCommands(qoderDir, options.commands, tracker);
  }

  await writeSourceTracker(trackerPath, tracker);
}

async function removeAll(qoderDir: string, mcpTargetDir: string, tracker: Awaited<ReturnType<typeof readSourceTracker>>): Promise<void> {
  // Remove all skills
  const skillsDir = path.join(qoderDir, "skills");
  const skillEntries = await fs.readdir(skillsDir, { withFileTypes: true }).catch(() => []);
  for (const entry of skillEntries) {
    if (entry.isDirectory()) {
      await fs.rm(path.join(skillsDir, entry.name), { recursive: true, force: true });
    }
  }
  tracker.skills = {};

  // Remove all agents
  const agentsDir = path.join(qoderDir, "agents");
  const agentEntries = await fs.readdir(agentsDir, { withFileTypes: true }).catch(() => []);
  for (const entry of agentEntries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      await fs.rm(path.join(agentsDir, entry.name));
    }
  }
  tracker.agents = {};

  // Remove all MCP services
  const mcpPath = path.join(mcpTargetDir, "mcp.json");
  try {
    await fs.mkdir(mcpTargetDir, { recursive: true });
    await fs.writeFile(mcpPath, JSON.stringify({ mcpServers: {} }, null, 2) + "\n", "utf-8");
  } catch {
    // ignore
  }
  tracker.mcp = {};

  // Remove all commands
  const commandsDir = path.join(qoderDir, "commands");
  const commandEntries = await fs.readdir(commandsDir, { withFileTypes: true }).catch(() => []);
  for (const entry of commandEntries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      await fs.rm(path.join(commandsDir, entry.name));
    }
  }
  tracker.commands = {};
}

async function removeSkills(qoderDir: string, names: string[], tracker: Awaited<ReturnType<typeof readSourceTracker>>): Promise<void> {
  for (const name of names) {
    await fs.rm(path.join(qoderDir, "skills", name), { recursive: true, force: true });
    delete tracker.skills[name];
  }
}

async function removeAgents(qoderDir: string, names: string[], tracker: Awaited<ReturnType<typeof readSourceTracker>>): Promise<void> {
  for (const name of names) {
    await fs.rm(path.join(qoderDir, "agents", `${name}.md`), { force: true });
    delete tracker.agents[name];
  }
}

async function removeMcpServices(mcpTargetDir: string, names: string[], tracker: Awaited<ReturnType<typeof readSourceTracker>>): Promise<void> {
  const mcpPath = path.join(mcpTargetDir, "mcp.json");
  try {
    const content = await fs.readFile(mcpPath, "utf-8");
    const config = JSON.parse(content);
    for (const name of names) {
      delete config.mcpServers[name];
      delete tracker.mcp[name];
    }
    await fs.writeFile(mcpPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  } catch {
    // mcp.json doesn't exist — nothing to remove
  }
}

async function removeCommands(qoderDir: string, names: string[], tracker: Awaited<ReturnType<typeof readSourceTracker>>): Promise<void> {
  for (const name of names) {
    await fs.rm(path.join(qoderDir, "commands", `${name}.md`), { force: true });
    delete tracker.commands[name];
  }
}
