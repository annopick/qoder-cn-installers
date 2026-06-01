#!/usr/bin/env node
import { runAdd } from "./cli-add.js";
import { parseAddArgs } from "./cli-add-args.js";
import { runList } from "./cli-list.js";
import { runRemove } from "./cli-remove.js";
import path from "node:path";

const home = process.env.HOME || process.env.USERPROFILE || "~";
const DEFAULT_QODER_DIR = path.join(home, ".qoder-cn");
function getDefaultMcpTargetDir() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "QoderCN", "SharedClientCache");
  }
  return path.join(home, "Library", "Application Support", "QoderCN", "SharedClientCache");
}

function showHelp(): never {
  console.log(`qci - QoderCN resource installer

Usage:
  qci add <source> [options]   Install resources from a source
  qci list [options]           List installed resources
  qci remove [options]         Remove installed resources
  qci --help                   Show this help message

Add options:
  --all                        Install all discovered resources
  --skill <name...>            Install specific skill(s)
  --agent <name...>            Install specific agent(s)
  --mcp <name...>              Install specific MCP service(s)
  --path <subpath>             Subpath within repository (git sources only)
  --list                       List available resources without installing
  -y, --yes                    Skip confirmation prompts

List options:
  --skill                      List only skills
  --agent                      List only agents
  --mcp                        List only MCP services
  --json                       Output in JSON format

Remove options:
  --skill <name...>            Remove specific skill(s)
  --agent <name...>            Remove specific agent(s)
  --mcp <name...>              Remove specific MCP service(s)
  --all                        Remove all resources`);
  process.exit(0);
}

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  showHelp();
}

if (command === "add" || command === "a" || command === "i" || command === "install") {
  const parsed = parseAddArgs(args.slice(1));

  if (parsed.list) {
    // Discover and list resources without installing
    const { parseSource } = await import("./source-parser.js");
    const { discoverSkills } = await import("./skills.js");
    const { discoverAgents } = await import("./agents.js");
    const { discoverMcpServices } = await import("./mcp-discovery.js");

    const source = parseSource(parsed.source);
    // For listing, we'd need to clone if git source — simplified for now
    if (source.type !== "local") {
      console.error("--list is only supported for local paths currently");
      process.exit(1);
    }
    const skills = await discoverSkills(source.path);
    const agents = await discoverAgents(source.path);
    const mcpServices = await discoverMcpServices(source.path);

    console.log("Available resources:");
    if (skills.length > 0) {
      console.log("\nSkills:");
      for (const s of skills) console.log(`  - ${s.name}: ${s.description}`);
    }
    if (agents.length > 0) {
      console.log("\nAgents:");
      for (const a of agents) console.log(`  - ${a.name}: ${a.description}`);
    }
    if (mcpServices.length > 0) {
      console.log("\nMCP services:");
      for (const m of mcpServices) console.log(`  - ${m.name}`);
    }
    process.exit(0);
  }

  await runAdd(parsed.source, {
    subpath: parsed.subpath,
    filterSkills: parsed.skills,
    filterAgents: parsed.agents,
    filterMcp: parsed.mcp,
  });
} else if (command === "list" || command === "ls") {
  const restArgs = args.slice(1);
  let type: "skill" | "agent" | "mcp" | undefined;
  let jsonOutput = false;

  for (const arg of restArgs) {
    if (arg === "--skill") type = "skill";
    else if (arg === "--agent") type = "agent";
    else if (arg === "--mcp") type = "mcp";
    else if (arg === "--json") jsonOutput = true;
  }

  const result = await runList({
    qoderDir: DEFAULT_QODER_DIR,
    mcpTargetDir: getDefaultMcpTargetDir(),
    type,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.skills.length > 0) {
      console.log("Skills:");
      for (const name of result.skills) console.log(`  - ${name}`);
    }
    if (result.agents.length > 0) {
      console.log("Agents:");
      for (const name of result.agents) console.log(`  - ${name}`);
    }
    if (result.mcp.length > 0) {
      console.log("MCP services:");
      for (const name of result.mcp) console.log(`  - ${name}`);
    }
    if (result.skills.length === 0 && result.agents.length === 0 && result.mcp.length === 0) {
      console.log("No resources installed.");
    }
  }
} else if (command === "remove" || command === "rm" || command === "r") {
  const restArgs = args.slice(1);
  let skills: string[] = [];
  let agents: string[] = [];
  let mcpServices: string[] = [];
  let all = false;

  for (let i = 0; i < restArgs.length; i++) {
    const arg = restArgs[i];
    if (arg === "--skill") { skills = collectValues(restArgs, ++i); i += skills.length - 1; }
    else if (arg === "--agent") { agents = collectValues(restArgs, ++i); i += agents.length - 1; }
    else if (arg === "--mcp") { mcpServices = collectValues(restArgs, ++i); i += mcpServices.length - 1; }
    else if (arg === "--all") all = true;
  }

  await runRemove({
    qoderDir: DEFAULT_QODER_DIR,
    mcpTargetDir: getDefaultMcpTargetDir(),
    skills: skills.length > 0 ? skills : undefined,
    agents: agents.length > 0 ? agents : undefined,
    mcpServices: mcpServices.length > 0 ? mcpServices : undefined,
    all,
  });
  console.log("Removed successfully.");
} else if (command === "update" || command === "upgrade" || command === "check") {
  const restArgs = args.slice(1);
  let filterSkills: string[] = [];
  let filterAgents: string[] = [];
  let filterMcp: string[] = [];

  for (let i = 0; i < restArgs.length; i++) {
    const arg = restArgs[i];
    if (arg === "--skill") { filterSkills = collectValues(restArgs, ++i); i += filterSkills.length - 1; }
    else if (arg === "--agent") { filterAgents = collectValues(restArgs, ++i); i += filterAgents.length - 1; }
    else if (arg === "--mcp") { filterMcp = collectValues(restArgs, ++i); i += filterMcp.length - 1; }
  }

  const { runUpdate } = await import("./cli-update.js");
  const result = await runUpdate({
    qoderDir: DEFAULT_QODER_DIR,
    mcpTargetDir: getDefaultMcpTargetDir(),
    filterSkills: filterSkills.length > 0 ? filterSkills : undefined,
    filterAgents: filterAgents.length > 0 ? filterAgents : undefined,
    filterMcp: filterMcp.length > 0 ? filterMcp : undefined,
  });

  if (result.updated.length > 0) {
    console.log(`Updated: ${result.updated.join(", ")}`);
  }
  if (result.skipped.length > 0) {
    console.log(`No changes: ${result.skipped.join(", ")}`);
  }
  if (result.updated.length === 0 && result.skipped.length === 0) {
    console.log("No resources to update. Install resources first with `qci add`.");
  }
} else {
  console.error(`Unknown command: "${command}". Run "qci --help" for usage.`);
  process.exit(1);
}

function collectValues(args: string[], startIdx: number): string[] {
  const values: string[] = [];
  let i = startIdx;
  while (i < args.length && !args[i].startsWith("-")) {
    values.push(args[i]);
    i++;
  }
  return values;
}
