import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runUpdate, type UpdateResult } from "./cli-update.js";

describe("runUpdate", () => {
  let tmpDir: string;
  let repoDir: string;
  let qoderDir: string;
  let mcpTargetDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
    repoDir = path.join(tmpDir, "repo");
    qoderDir = path.join(tmpDir, "qoder-cn");
    mcpTargetDir = path.join(tmpDir, "SharedClientCache");

    // Create a source repo with a skill
    const skillDir = path.join(repoDir, "skills", "my-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "---\nname: my-skill\ndescription: v1\n---\nv1 content");

    // Simulate already installed
    const installedDir = path.join(qoderDir, "skills", "my-skill");
    await fs.mkdir(installedDir, { recursive: true });
    await fs.writeFile(path.join(installedDir, "SKILL.md"), "---\nname: my-skill\ndescription: v1\n---\nv1 content");

    // Create tracker
    await fs.writeFile(
      path.join(qoderDir, ".qci.source.json"),
      JSON.stringify({
        skills: { "my-skill": { source: repoDir, ref: "old-hash" } },
        agents: {},
        mcp: {},
        commands: {},
      }),
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("updates skill when content has changed", async () => {
    // Modify source
    await fs.writeFile(
      path.join(repoDir, "skills", "my-skill", "SKILL.md"),
      "---\nname: my-skill\ndescription: v2\n---\nv2 content",
    );

    const result = await runUpdate({ qoderDir, mcpTargetDir });

    assert.equal(result.updated.length, 1);
    assert.equal(result.updated[0], "my-skill");

    const md = await fs.readFile(path.join(qoderDir, "skills", "my-skill", "SKILL.md"), "utf-8");
    assert.ok(md.includes("v2 content"));
  });

  it("skips skill when content unchanged", async () => {
    // Run add first to get correct hash in tracker
    const { runAdd } = await import("./cli-add.js");
    await runAdd(repoDir, { qoderDir, mcpTargetDir });

    const result = await runUpdate({ qoderDir, mcpTargetDir });

    assert.equal(result.skipped.length, 1);
    assert.equal(result.skipped[0], "my-skill");
  });

  it("filters update by skill name", async () => {
    await fs.writeFile(
      path.join(repoDir, "skills", "my-skill", "SKILL.md"),
      "---\nname: my-skill\ndescription: v2\n---\nv2 content",
    );

    const result = await runUpdate({ qoderDir, mcpTargetDir, filterSkills: ["my-skill"] });

    assert.equal(result.updated.length, 1);
  });

  it("updates MCP with overwrite on conflict", async () => {
    // Set up MCP
    await fs.mkdir(path.join(repoDir, "mcp", "github"), { recursive: true });
    await fs.writeFile(
      path.join(repoDir, "mcp", "github", "mcp.json"),
      JSON.stringify({ mcpServers: { github: { command: "npx", args: ["v2"] } } }),
    );
    await fs.mkdir(mcpTargetDir, { recursive: true });
    await fs.writeFile(
      path.join(mcpTargetDir, "mcp.json"),
      JSON.stringify({ mcpServers: { github: { command: "old" } } }),
    );

    // Update tracker
    await fs.writeFile(
      path.join(qoderDir, ".qci.source.json"),
      JSON.stringify({
        skills: {},
        agents: {},
        mcp: { github: { source: repoDir, ref: "old-hash" } },
        commands: {},
      }),
    );

    const result = await runUpdate({ qoderDir, mcpTargetDir, filterMcp: ["github"] });

    const mcpJson = JSON.parse(await fs.readFile(path.join(mcpTargetDir, "mcp.json"), "utf-8"));
    assert.deepStrictEqual(mcpJson.mcpServers.github, { command: "npx", args: ["v2"] });
  });

  it("returns empty when no source tracker", async () => {
    await fs.rm(path.join(qoderDir, ".qci.source.json"));

    const result = await runUpdate({ qoderDir, mcpTargetDir });

    assert.equal(result.updated.length, 0);
    assert.equal(result.skipped.length, 0);
  });

  it("skips other resource types when only skill filter is specified", async () => {
    // Set up agent source
    const agentFile = path.join(repoDir, "agents", "my-agent.md");
    await fs.mkdir(path.dirname(agentFile), { recursive: true });
    await fs.writeFile(agentFile, "---\nname: my-agent\ndescription: v1\n---\nv1 content");

    // Set up command source
    const cmdFile = path.join(repoDir, "commands", "my-command.md");
    await fs.mkdir(path.dirname(cmdFile), { recursive: true });
    await fs.writeFile(cmdFile, "---\nname: my-command\ndescription: v1\n---\nv1 content");

    // Update tracker with multiple resource types
    await fs.writeFile(
      path.join(qoderDir, ".qci.source.json"),
      JSON.stringify({
        skills: { "my-skill": { source: repoDir, ref: "old-hash" } },
        agents: { "my-agent": { source: repoDir, ref: "old-hash" } },
        mcp: {},
        commands: { "my-command": { source: repoDir, ref: "old-hash" } },
      }),
    );

    // Install agent and command files
    await fs.mkdir(path.join(qoderDir, "agents"), { recursive: true });
    await fs.copyFile(agentFile, path.join(qoderDir, "agents", "my-agent.md"));
    await fs.mkdir(path.join(qoderDir, "commands"), { recursive: true });
    await fs.copyFile(cmdFile, path.join(qoderDir, "commands", "my-command.md"));

    // Only request skill update
    const result = await runUpdate({ qoderDir, mcpTargetDir, filterSkills: ["my-skill"] });

    // Skill should be updated (hash changed from "old-hash")
    assert.equal(result.updated.length, 1);
    assert.equal(result.updated[0], "my-skill");
    // Other types should not appear in skipped or updated
    assert.equal(result.skipped.length, 0);
  });

  it("handles git URL source by cloning and computing hash correctly", async () => {
    // Create a local git repo with a skill
    const localRepo = path.join(tmpDir, "git-repo");
    await fs.mkdir(localRepo, { recursive: true });
    const skillDir = path.join(localRepo, "skills", "git-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      "---\nname: git-skill\ndescription: v1\n---\nv1 content",
    );

    // Initialize git repo
    const { execFile: execFileCb } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFileCb);
    const env = { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@test.com", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@test.com" };
    await execFileAsync("git", ["init"], { cwd: localRepo });
    await execFileAsync("git", ["add", "."], { cwd: localRepo });
    await execFileAsync("git", ["commit", "-m", "init"], { cwd: localRepo, env });

    // Set tracker with git URL source
    await fs.writeFile(
      path.join(qoderDir, ".qci.source.json"),
      JSON.stringify({
        skills: { "git-skill": { source: `file://${localRepo}`, ref: "old-hash" } },
        agents: {},
        mcp: {},
        commands: {},
      }),
    );

    const result = await runUpdate({ qoderDir, mcpTargetDir });

    assert.equal(result.updated.length, 1);
    assert.equal(result.updated[0], "git-skill");

    // Verify the skill was installed
    const md = await fs.readFile(path.join(qoderDir, "skills", "git-skill", "SKILL.md"), "utf-8");
    assert.ok(md.includes("v1 content"));
  });

  it("updates command when content has changed", async () => {
    // Create source command
    const commandsDir = path.join(repoDir, "commands");
    await fs.mkdir(commandsDir, { recursive: true });
    await fs.writeFile(path.join(commandsDir, "code-inspect.md"), "---\ndescription: v1\n---\nv1 content");

    // Install first
    const { runAdd } = await import("./cli-add.js");
    await runAdd(repoDir, { qoderDir, mcpTargetDir, filterCommands: ["code-inspect"] });

    // Modify source
    await fs.writeFile(path.join(commandsDir, "code-inspect.md"), "---\ndescription: v2\n---\nv2 content");

    // Reset tracker to only contain command
    const tracker = JSON.parse(await fs.readFile(path.join(qoderDir, ".qci.source.json"), "utf-8"));
    await fs.writeFile(
      path.join(qoderDir, ".qci.source.json"),
      JSON.stringify({ skills: {}, agents: {}, mcp: {}, commands: tracker.commands }),
    );

    const result = await runUpdate({ qoderDir, mcpTargetDir });

    assert.equal(result.updated.length, 1);
    assert.equal(result.updated[0], "code-inspect");

    const md = await fs.readFile(path.join(qoderDir, "commands", "code-inspect.md"), "utf-8");
    assert.ok(md.includes("v2 content"));
  });

  it("skips command when content unchanged", async () => {
    const commandsDir = path.join(repoDir, "commands");
    await fs.mkdir(commandsDir, { recursive: true });
    await fs.writeFile(path.join(commandsDir, "code-inspect.md"), "---\ndescription: v1\n---\nv1 content");

    const { runAdd } = await import("./cli-add.js");
    await runAdd(repoDir, { qoderDir, mcpTargetDir, filterCommands: ["code-inspect"] });

    // Reset tracker to only contain command
    const tracker = JSON.parse(await fs.readFile(path.join(qoderDir, ".qci.source.json"), "utf-8"));
    await fs.writeFile(
      path.join(qoderDir, ".qci.source.json"),
      JSON.stringify({ skills: {}, agents: {}, mcp: {}, commands: tracker.commands }),
    );

    const result = await runUpdate({ qoderDir, mcpTargetDir });

    assert.equal(result.skipped.length, 1);
    assert.equal(result.skipped[0], "code-inspect");
  });
});
