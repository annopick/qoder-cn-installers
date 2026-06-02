export interface AddArgs {
  source: string;
  skills?: string[];
  agents?: string[];
  mcp?: string[];
  commands?: string[];
  subpath?: string;
  all: boolean;
  yes: boolean;
  list: boolean;
}

export function parseAddArgs(args: string[]): AddArgs {
  if (args.length === 0) {
    throw new Error("Source is required. Usage: qci add <source> [options]");
  }

  const result: AddArgs = {
    source: "",
    all: false,
    yes: false,
    list: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--all") {
      result.all = true;
      result.yes = true;
    } else if (arg === "-y" || arg === "--yes") {
      result.yes = true;
    } else if (arg === "--list") {
      result.list = true;
    } else if (arg === "--skill") {
      i++;
      result.skills = collectValues(args, i);
      i += result.skills.length - 1;
    } else if (arg === "--agent") {
      i++;
      result.agents = collectValues(args, i);
      i += result.agents.length - 1;
    } else if (arg === "--mcp") {
      i++;
      result.mcp = collectValues(args, i);
      i += result.mcp.length - 1;
    } else if (arg === "--command") {
      i++;
      result.commands = collectValues(args, i);
      i += result.commands.length - 1;
    } else if (arg === "--path") {
      i++;
      result.subpath = args[i];
    } else if (!arg.startsWith("-")) {
      result.source = arg;
    }

    i++;
  }

  if (!result.source) {
    throw new Error("Source is required. Usage: qci add <source> [options]");
  }

  return result;
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
