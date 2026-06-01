import fs from "node:fs/promises";
import path from "node:path";
import type { Skill } from "./skills.js";

export async function installSkill(skill: Skill, targetBase: string): Promise<void> {
  const destDir = path.join(targetBase, skill.name);

  // Remove existing if present, then copy fresh
  await fs.rm(destDir, { recursive: true, force: true });
  await fs.mkdir(destDir, { recursive: true });

  await copyDir(skill.path, destDir);
}

async function copyDir(src: string, dest: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
