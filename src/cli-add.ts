import { parseSource } from "./source-parser.js";
import { discoverSkills } from "./skills.js";
import { installSkill } from "./installer.js";
import { discoverAgents } from "./agents.js";
import { discoverCommands } from "./commands.js";
import { discoverMcpServices } from "./mcp-discovery.js";
import { mergeMcpConfig, type McpConfig } from "./mcp-merger.js";
import { cloneRepo } from "./git.js";
import { readSourceTracker, writeSourceTracker } from "./source-tracker.js";
import path from "node:path";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";

export interface AddOptions {
  qoderDir?: string;
  mcpTargetDir?: string;
  subpath?: string;
  filterSkills?: string[];
  filterAgents?: string[];
  filterMcp?: string[];
  filterCommands?: string[];
}

const DEFAULT_QODER_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".qoder-cn",
);

function getMcpTargetDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || "~";
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "QoderCN", "SharedClientCache");
  }
  return path.join(home, "Library", "Application Support", "QoderCN", "SharedClientCache");
}

function getSourceIdentifier(parsed: ReturnType<typeof parseSource>): string {
  switch (parsed.type) {
    case "local": return parsed.path;
    case "git-url": return parsed.url;
    case "git-ssh": return parsed.url;
  }
}

export async function runAdd(source: string, options: AddOptions = {}): Promise<void> {
  const qoderDir = options.qoderDir ?? DEFAULT_QODER_DIR;
  const mcpTargetDir = options.mcpTargetDir ?? getMcpTargetDir();
  const parsed = parseSource(source);

  let scanPath: string;
  let cleanup: (() => Promise<void>) | undefined;

  if (parsed.type === "local") {
    scanPath = parsed.path;
  } else {
    const result = await cloneRepo(getSourceIdentifier(parsed), options.subpath);
    scanPath = result.cloneDir;
    cleanup = result.cleanup;
  }

  try {
    let skills = await discoverSkills(scanPath);
    let agents = await discoverAgents(scanPath);
    let mcpServices = await discoverMcpServices(scanPath);
    let commands = await discoverCommands(scanPath);

    // Apply filters — when any filter is specified, unfiltered types are excluded
    const hasAnyFilter = options.filterSkills || options.filterAgents || options.filterMcp || options.filterCommands;
    if (hasAnyFilter) {
      if (options.filterSkills) {
        if (options.filterSkills.length > 0) {
          skills = skills.filter((s) => options.filterSkills!.includes(s.name));
        }
        // empty array = install all skills (no filter)
      } else {
        skills = [];
      }
      if (options.filterAgents) {
        if (options.filterAgents.length > 0) {
          agents = agents.filter((a) => options.filterAgents!.includes(a.name));
        }
      } else {
        agents = [];
      }
      if (options.filterMcp) {
        if (options.filterMcp.length > 0) {
          mcpServices = mcpServices.filter((m) => options.filterMcp!.includes(m.name));
        }
      } else {
        mcpServices = [];
      }
      if (options.filterCommands) {
        if (options.filterCommands.length > 0) {
          commands = commands.filter((c) => options.filterCommands!.includes(c.name));
        }
      } else {
        commands = [];
      }
    }

    if (skills.length === 0 && agents.length === 0 && mcpServices.length === 0 && commands.length === 0) {
      console.log("No resources found in the source.");
      return;
    }

    const sourceId = getSourceIdentifier(parsed);
    const trackerPath = path.join(qoderDir, ".qci.source.json");
    const tracker = await readSourceTracker(trackerPath);

    // Install skills
    const skillsDir = path.join(qoderDir, "skills");
    for (const skill of skills) {
      await installSkill(skill, skillsDir);
      tracker.skills[skill.name] = {
        source: sourceId,
        ref: await computeDirHash(skill.path),
      };
    }

    // Install agents
    const agentsDir = path.join(qoderDir, "agents");
    if (agents.length > 0) {
      await fs.mkdir(agentsDir, { recursive: true });
    }
    for (const agent of agents) {
      const destPath = path.join(agentsDir, `${agent.name}.md`);
      await fs.copyFile(agent.path, destPath);
      tracker.agents[agent.name] = {
        source: sourceId,
        ref: await computeFileHash(agent.path),
      };
    }

    // Install MCP services
    if (mcpServices.length > 0) {
      await fs.mkdir(mcpTargetDir, { recursive: true });
      const mcpTargetPath = path.join(mcpTargetDir, "mcp.json");

      let existing: McpConfig | undefined;
      try {
        const content = await fs.readFile(mcpTargetPath, "utf-8");
        existing = JSON.parse(content);
      } catch {
        // File doesn't exist — will create new
      }

      let merged = existing ?? { mcpServers: {} };
      for (const service of mcpServices) {
        merged = mergeMcpConfig(merged, service.config);
        tracker.mcp[service.name] = {
          source: sourceId,
          ref: await computeFileHash(service.sourcePath),
        };
      }

      await fs.writeFile(mcpTargetPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
    }

    // Install commands
    const commandsDir = path.join(qoderDir, "commands");
    if (commands.length > 0) {
      await fs.mkdir(commandsDir, { recursive: true });
    }
    for (const command of commands) {
      const destPath = path.join(commandsDir, `${command.name}.md`);
      await fs.copyFile(command.path, destPath);
      tracker.commands[command.name] = {
        source: sourceId,
        ref: await computeFileHash(command.path),
      };
    }

    await writeSourceTracker(trackerPath, tracker);

    const parts: string[] = [];
    if (skills.length > 0) parts.push(`${skills.length} skill(s)`);
    if (agents.length > 0) parts.push(`${agents.length} agent(s)`);
    if (mcpServices.length > 0) parts.push(`${mcpServices.length} MCP service(s)`);
    if (commands.length > 0) parts.push(`${commands.length} command(s)`);
    console.log(`Installed ${parts.join(", ")}`);
  } finally {
    await cleanup?.();
  }
}

async function computeDirHash(dirPath: string): Promise<string> {
  const hash = createHash("sha256");
  const entries = await walkDir(dirPath);
  for (const filePath of entries.sort()) {
    const content = await fs.readFile(filePath);
    hash.update(filePath).update(content);
  }
  return hash.digest("hex").slice(0, 12);
}

async function computeFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

async function walkDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkDir(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}
