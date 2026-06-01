import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cloneRepo } from "./git.js";

const execFileAsync = promisify(execFile);

describe("cloneRepo", () => {
  let tmpDir: string;
  let localRepo: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
    localRepo = path.join(tmpDir, "local-repo");
    await fs.mkdir(localRepo, { recursive: true });
    await fs.writeFile(path.join(localRepo, "README.md"), "hello");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("clones a local git repo to a temp directory", async () => {
    const env = { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@test.com", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@test.com" };
    await execFileAsync("git", ["init"], { cwd: localRepo });
    await execFileAsync("git", ["add", "."], { cwd: localRepo });
    await execFileAsync("git", ["commit", "-m", "init"], { cwd: localRepo, env });

    const { cloneDir, cleanup } = await cloneRepo(localRepo);

    try {
      const readme = await fs.readFile(path.join(cloneDir, "README.md"), "utf-8");
      assert.equal(readme, "hello");
    } finally {
      await cleanup();
    }
  });

  it("throws descriptive error for invalid URL", async () => {
    await assert.rejects(
      () => cloneRepo("https://invalid-host-xyz.example.com/nonexistent"),
      /failed to clone/i,
    );
  });
});
