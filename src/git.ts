import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { debug } from "./log.js";

const execFileAsync = promisify(execFile);

export async function cloneRepo(url: string, subpath?: string): Promise<{ cloneDir: string; cleanup: () => Promise<void> }> {
  const cloneDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-clone-"));

  const gitArgs = ["-c", "core.autocrlf=false", "clone", "--depth", "1", url, cloneDir];
  debug(`Cloning "${url}" into ${cloneDir}`);
  debug(`git ${gitArgs.join(" ")}`);

  try {
    // Disable autocrlf so cloned files keep their original line endings.
    // The frontmatter/code-fence regexes expect LF; a user's global
    // core.autocrlf=true (common on Windows) would otherwise convert LF to
    // CRLF and break MCP.md / SKILL.md parsing.
    await execFileAsync("git", gitArgs, {
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      timeout: 60_000,
    });
  } catch (err) {
    await fs.rm(cloneDir, { recursive: true, force: true });

    // execFile rejections carry the real git output on .stderr/.stdout,
    // but the default .message is just "Command failed: git ...". Extract
    // the actual error (auth failure, repo not found, timeout, etc.).
    const detail = extractCloneErrorDetail(err);
    debug(`git clone failed: ${detail.full}`);

    // Surface a hint when the failure looks like a private-repo auth issue,
    // which is common in AI agent sandboxes without injected credentials.
    if (/could not read Username|Authentication failed|401|Unauthorized|Forbidden/i.test(detail.full)) {
      debug("Looks like a private repository auth failure: the current environment may be missing cnb.cool credentials/token.");
    }

    throw new Error(`Failed to clone "${url}": ${detail.summary}`);
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

/**
 * Extract a human-readable error detail from a failed `git clone`.
 *
 * Node's execFile rejection exposes `stderr`, `stdout`, `code` on the error
 * object, but `.message` alone is just "Command failed: git ..." with no clue
 * about *why* (auth, repo not found, network). We prefer the trimmed stderr.
 */
function extractCloneErrorDetail(err: unknown): { summary: string; full: string } {
  const e = err as { message?: string; stderr?: string; stdout?: string; code?: string | number };
  const stderr = (e.stderr ?? "").trim();
  const stdout = (e.stdout ?? "").trim();
  const code = e.code;

  // The summary is what shows to the user in the thrown error message.
  // Skip git's progress lines ("Cloning into", "remote:", "Receiving objects"…)
  // and prefer the real failure line ("fatal:", "error:"). Fall back to message.
  const lines = stderr.split("\n").map((l) => l.trim()).filter(Boolean);
  const errorLine =
    lines.find((l) => /^(fatal|error):/i.test(l)) ?? // the actual failure
    lines.find((l) => !/^(cloning into|remote:|receiving objects|counting objects|compressing)/i.test(l)) ?? // first non-progress line
    "";
  const summary = errorLine || (err instanceof Error ? err.message : String(err));

  // The full detail is used only under -v for deeper diagnosis.
  const parts: string[] = [];
  if (code !== undefined) parts.push(`code=${code}`);
  if (stderr) parts.push(`stderr:\n${stderr}`);
  if (stdout) parts.push(`stdout:\n${stdout}`);
  if (parts.length === 0) parts.push(err instanceof Error ? err.message : String(err));
  const full = parts.join("\n");

  return { summary, full };
}
