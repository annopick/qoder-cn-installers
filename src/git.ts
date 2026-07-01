import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

export async function cloneRepo(url: string, subpath?: string): Promise<{ cloneDir: string; cleanup: () => Promise<void> }> {
  const cloneDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-clone-"));

  try {
    // Disable autocrlf so cloned files keep their original line endings.
    // The frontmatter/code-fence regexes expect LF; a user's global
    // core.autocrlf=true (common on Windows) would otherwise convert LF to
    // CRLF and break MCP.md / SKILL.md parsing.
    await execFileAsync("git", ["-c", "core.autocrlf=false", "clone", "--depth", "1", url, cloneDir], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      timeout: 60_000,
    });
  } catch (err) {
    await fs.rm(cloneDir, { recursive: true, force: true });
    throw new Error(`Failed to clone "${url}": ${err instanceof Error ? err.message : String(err)}`);
  }

  const resultDir = subpath ? path.join(cloneDir, subpath) : cloneDir;

  try {
    await fs.access(resultDir);
  } catch {
    await fs.rm(cloneDir, { recursive: true, force: true });
    throw new Error(`Subpath "${subpath}" does not exist in the cloned repository.`);
  }

  return {
    cloneDir: resultDir,
    cleanup: () => fs.rm(cloneDir, { recursive: true, force: true }),
  };
}
