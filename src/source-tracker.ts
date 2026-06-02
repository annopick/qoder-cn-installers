import fs from "node:fs/promises";
import path from "node:path";

export interface SourceEntry {
  source: string;
  ref: string;
}

export interface SourceTracker {
  skills: Record<string, SourceEntry>;
  agents: Record<string, SourceEntry>;
  mcp: Record<string, SourceEntry>;
  commands: Record<string, SourceEntry>;
}

const EMPTY_TRACKER: SourceTracker = { skills: {}, agents: {}, mcp: {}, commands: {} };

export async function readSourceTracker(filePath: string): Promise<SourceTracker> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content);
    return {
      skills: parsed.skills ?? {},
      agents: parsed.agents ?? {},
      mcp: parsed.mcp ?? {},
      commands: parsed.commands ?? {},
    };
  } catch {
    return { ...EMPTY_TRACKER };
  }
}

export async function writeSourceTracker(filePath: string, data: SourceTracker): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}
