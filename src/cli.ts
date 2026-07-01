#!/usr/bin/env node
import { runAdd } from "./cli-add.js";
import { parseAddArgs } from "./cli-add-args.js";
import { runList } from "./cli-list.js";
import { runRemove } from "./cli-remove.js";
import { setVerbose, debug } from "./log.js";
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
  --command <name...>          Install specific command(s)
  --path <subpath>             Subpath within repository (git sources only)
  --list                       List available resources without installing
  -y, --yes                    Skip confirmation prompts

List options:
  --skill                      List only skills
  --agent                      List only agents
  --mcp                        List only MCP services
  --command                    List only commands
  --json                       Output in JSON format

Remove options:
  --skill <name...>            Remove specific skill(s)
  --agent <name...>            Remove specific agent(s)
  --mcp <name...>              Remove specific MCP service(s)
  --command <name...>          Remove specific command(s)
  --all                        Remove all resources

Update options:
  --skill <name...>            Update specific skill(s)
  --agent <name...>            Update specific agent(s)
  --mcp <name...>              Update specific MCP service(s)
  --command <name...>          Update specific command(s)

Global options:
  -v, --verbose                Show debug diagnostics (clone details, errors)`);
  process.exit(0);
}

// Pre-scan for the global -v / --verbose flag anywhere in argv, then strip it
// so `qci -v add <src>` and `qci add <src> -v` both work. Must run before
// treating args[0] as the command.
const args = process.argv.slice(2).filter((a) => {
  if (a === "-v" || a === "--verbose") {
    setVerbose(true);
    return false;
  }
  return true;
});
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  showHelp();
}

try {
if (command === "add" || command === "a" || command === "i" || command === "install") {
  const parsed = parseAddArgs(args.slice(1));

  if (parsed.list) {
    // Discover and list resources without installing
    const { parseSource } = await import("./source-parser.js");
    const { discoverSkills } = await import("./skills.js");
    const { discoverAgents } = await import("./agents.js");
    const { discoverMcpServices } = await import("./mcp-discovery.js");
    const { discoverCommands } = await import("./commands.js");

    const source = parseSource(parsed.source);

    let scanPath: string;
    let cleanup: (() => Promise<void>) | undefined;

    if (source.type === "local") {
      scanPath = source.path;
    } else {
      const url = source.type === "git-url" ? source.url : source.url;
      const { cloneRepo } = await import("./git.js");
      const result = await cloneRepo(url, parsed.subpath);
      scanPath = result.cloneDir;
      cleanup = result.cleanup;
    }

    try {
    const [skills, agents, mcpServices, commands] = await Promise.all([
      discoverSkills(scanPath),
      discoverAgents(scanPath),
      discoverMcpServices(scanPath),
      discoverCommands(scanPath),
    ]);

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
    if (commands.length > 0) {
      console.log("\nCommands:");
      for (const c of commands) {
        const desc = c.description ? `: ${c.description}` : "";
        console.log(`  - ${c.name}${desc}`);
      }
    }
    } finally {
      await cleanup?.();
    }
    process.exit(0);
  }

  await runAdd(parsed.source, {
    subpath: parsed.subpath,
    filterSkills: parsed.skills,
    filterAgents: parsed.agents,
    filterMcp: parsed.mcp,
    filterCommands: parsed.commands,
  });
} else if (command === "list" || command === "ls") {
  const restArgs = args.slice(1);
  let type: "skill" | "agent" | "mcp" | "command" | undefined;
  let jsonOutput = false;

  for (const arg of restArgs) {
    if (arg === "--skill") type = "skill";
    else if (arg === "--agent") type = "agent";
    else if (arg === "--mcp") type = "mcp";
    else if (arg === "--command") type = "command";
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
    if (result.commands.length > 0) {
      console.log("Commands:");
      for (const name of result.commands) console.log(`  - ${name}`);
    }
    if (result.skills.length === 0 && result.agents.length === 0 && result.mcp.length === 0 && result.commands.length === 0) {
      console.log("No resources installed.");
    }
  }
} else if (command === "remove" || command === "rm" || command === "r") {
  const restArgs = args.slice(1);
  let skills: string[] = [];
  let agents: string[] = [];
  let mcpServices: string[] = [];
  let commands: string[] = [];
  let all = false;

  for (let i = 0; i < restArgs.length; i++) {
    const arg = restArgs[i];
    if (arg === "--skill") { skills = collectValues(restArgs, ++i); i += skills.length - 1; }
    else if (arg === "--agent") { agents = collectValues(restArgs, ++i); i += agents.length - 1; }
    else if (arg === "--mcp") { mcpServices = collectValues(restArgs, ++i); i += mcpServices.length - 1; }
    else if (arg === "--command") { commands = collectValues(restArgs, ++i); i += commands.length - 1; }
    else if (arg === "--all") all = true;
  }

  await runRemove({
    qoderDir: DEFAULT_QODER_DIR,
    mcpTargetDir: getDefaultMcpTargetDir(),
    skills: skills.length > 0 ? skills : undefined,
    agents: agents.length > 0 ? agents : undefined,
    mcpServices: mcpServices.length > 0 ? mcpServices : undefined,
    commands: commands.length > 0 ? commands : undefined,
    all,
  });
  console.log("Removed successfully.");
} else if (command === "update" || command === "upgrade" || command === "check") {
  const restArgs = args.slice(1);
  let filterSkills: string[] = [];
  let filterAgents: string[] = [];
  let filterMcp: string[] = [];
  let filterCommands: string[] = [];

  for (let i = 0; i < restArgs.length; i++) {
    const arg = restArgs[i];
    if (arg === "--skill") { filterSkills = collectValues(restArgs, ++i); i += filterSkills.length - 1; }
    else if (arg === "--agent") { filterAgents = collectValues(restArgs, ++i); i += filterAgents.length - 1; }
    else if (arg === "--mcp") { filterMcp = collectValues(restArgs, ++i); i += filterMcp.length - 1; }
    else if (arg === "--command") { filterCommands = collectValues(restArgs, ++i); i += filterCommands.length - 1; }
  }

  const { runUpdate } = await import("./cli-update.js");
  const result = await runUpdate({
    qoderDir: DEFAULT_QODER_DIR,
    mcpTargetDir: getDefaultMcpTargetDir(),
    filterSkills: filterSkills.length > 0 ? filterSkills : undefined,
    filterAgents: filterAgents.length > 0 ? filterAgents : undefined,
    filterMcp: filterMcp.length > 0 ? filterMcp : undefined,
    filterCommands: filterCommands.length > 0 ? filterCommands : undefined,
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
} catch (err) {
  // Top-level guard: print a clean message instead of a raw stack trace.
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[qci] ${message}`);
  if (err instanceof Error && err.stack) debug(err.stack);
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
