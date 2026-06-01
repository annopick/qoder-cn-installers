import fs from "node:fs/promises";
import path from "node:path";
import { readSourceTracker, writeSourceTracker } from "./source-tracker.js";
import { discoverSkills } from "./skills.js";
import { installSkill } from "./installer.js";
import { discoverAgents } from "./agents.js";
import { discoverMcpServices } from "./mcp-discovery.js";
import { createHash } from "node:crypto";

export interface UpdateOptions {
  qoderDir: string;
  mcpTargetDir: string;
  filterSkills?: string[];
  filterAgents?: string[];
  filterMcp?: string[];
}

export interface UpdateResult {
  updated: string[];
  skipped: string[];
}

export async function runUpdate(options: UpdateOptions): Promise<UpdateResult> {
  const { qoderDir, mcpTargetDir } = options;
  const trackerPath = path.join(qoderDir, ".qci.source.json");
  const tracker = await readSourceTracker(trackerPath);

  const result: UpdateResult = { updated: [], skipped: [] };

  // Update skills
  for (const [name, entry] of Object.entries(tracker.skills)) {
    if (options.filterSkills && !options.filterSkills.includes(name)) continue;

    try {
      const currentHash = await computeSourceHash(entry.source, "skill", name);
      if (currentHash === entry.ref) {
        result.skipped.push(name);
        continue;
      }

      // Re-install
      const skills = await discoverSkills(entry.source);
      const skill = skills.find((s) => s.name === name);
      if (skill) {
        await installSkill(skill, path.join(qoderDir, "skills"));
        tracker.skills[name] = { source: entry.source, ref: currentHash };
        result.updated.push(name);
      }
    } catch {
      result.skipped.push(name);
    }
  }

  // Update agents
  for (const [name, entry] of Object.entries(tracker.agents)) {
    if (options.filterAgents && !options.filterAgents.includes(name)) continue;

    try {
      const agents = await discoverAgents(entry.source);
      const agent = agents.find((a) => a.name === name);
      if (!agent) { result.skipped.push(name); continue; }

      const currentHash = await computeFileHash(agent.path);
      if (currentHash === entry.ref) {
        result.skipped.push(name);
        continue;
      }

      const destPath = path.join(qoderDir, "agents", `${name}.md`);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(agent.path, destPath);
      tracker.agents[name] = { source: entry.source, ref: currentHash };
      result.updated.push(name);
    } catch {
      result.skipped.push(name);
    }
  }

  // Update MCP — overwrite on conflict
  for (const [name, entry] of Object.entries(tracker.mcp)) {
    if (options.filterMcp && !options.filterMcp.includes(name)) continue;

    try {
      const services = await discoverMcpServices(entry.source);
      const service = services.find((s) => s.name === name);
      if (!service) { result.skipped.push(name); continue; }

      const currentHash = await computeFileHash(service.sourcePath);
      if (currentHash === entry.ref) {
        result.skipped.push(name);
        continue;
      }

      // Overwrite MCP config
      const mcpPath = path.join(mcpTargetDir, "mcp.json");
      await fs.mkdir(mcpTargetDir, { recursive: true });

      let config: { mcpServers: Record<string, unknown> } = { mcpServers: {} };
      try {
        config = JSON.parse(await fs.readFile(mcpPath, "utf-8"));
      } catch {
        // File doesn't exist
      }

      // Overwrite (not skip)
      for (const [serverName, serverConfig] of Object.entries(service.config.mcpServers)) {
        config.mcpServers[serverName] = serverConfig;
      }

      await fs.writeFile(mcpPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
      tracker.mcp[name] = { source: entry.source, ref: currentHash };
      result.updated.push(name);
    } catch {
      result.skipped.push(name);
    }
  }

  if (result.updated.length > 0) {
    await writeSourceTracker(trackerPath, tracker);
  }

  return result;
}

async function computeSourceHash(source: string, type: string, name: string): Promise<string> {
  if (type === "skill") {
    const skills = await discoverSkills(source);
    const skill = skills.find((s) => s.name === name);
    if (!skill) throw new Error(`Skill "${name}" not found`);
    return computeDirHash(skill.path);
  }
  return "";
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
