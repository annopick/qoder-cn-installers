import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export interface Skill {
  name: string;
  description: string;
  path: string;
}

export async function discoverSkills(basePath: string): Promise<Skill[]> {
  const skillsDir = path.join(basePath, "skills");

  try {
    await fs.access(skillsDir);
  } catch {
    return [];
  }

  const entries = await fs.readdir(skillsDir, { withFileTypes: true });
  const skills: Skill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillDir = path.join(skillsDir, entry.name);
    const skillMdPath = path.join(skillDir, "SKILL.md");

    try {
      const content = await fs.readFile(skillMdPath, "utf-8");
      const parsed = parseFrontmatter(content);

      if (parsed.name && parsed.description) {
        skills.push({
          name: parsed.name,
          description: parsed.description,
          path: skillDir,
        });
      }
    } catch {
      // No SKILL.md or unreadable — skip
    }
  }

  return skills;
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const parsed = parseYaml(match[1]);
  return (parsed ?? {}) as Record<string, string>;
}
