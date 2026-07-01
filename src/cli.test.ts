import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runAdd } from "./cli-add.js";

describe("CLI add (local path)", () => {
  let tmpDir: string;
  let repoDir: string;
  let qoderDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
    repoDir = path.join(tmpDir, "repo");
    qoderDir = path.join(tmpDir, "qoder-cn");

    // Create a repo with two skills
    for (const name of ["code-review", "debugging"]) {
      const skillDir = path.join(repoDir, "skills", name);
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        `---\nname: ${name}\ndescription: ${name} skill\n---\n\nContent for ${name}.`,
      );
    }
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("installs all skills from local path", async () => {
    await runAdd(repoDir, { qoderDir });

    const skillsDir = path.join(qoderDir, "skills");
    const entries = await fs.readdir(skillsDir);
    assert.deepStrictEqual(entries.sort(), ["code-review", "debugging"]);

    const md = await fs.readFile(path.join(skillsDir, "code-review", "SKILL.md"), "utf-8");
    assert.ok(md.includes("Content for code-review."));
  });

  it("writes source tracker after install", async () => {
    await runAdd(repoDir, { qoderDir });

    const trackerPath = path.join(qoderDir, ".qci.source.json");
    const content = await fs.readFile(trackerPath, "utf-8");
    const tracker = JSON.parse(content);

    assert.ok(tracker.skills["code-review"]);
    assert.ok(tracker.skills["debugging"]);
    assert.equal(tracker.skills["code-review"].source, repoDir);
  });

  it("creates qoder-cn directory if it does not exist", async () => {
    const freshQoderDir = path.join(tmpDir, "nested", "qoder-cn");
    await runAdd(repoDir, { qoderDir: freshQoderDir });

    const entries = await fs.readdir(path.join(freshQoderDir, "skills"));
    assert.equal(entries.length, 2);
  });

  it("overwrites previously installed skill", async () => {
    await runAdd(repoDir, { qoderDir });

    // Update source skill
    await fs.writeFile(
      path.join(repoDir, "skills", "code-review", "SKILL.md"),
      "---\nname: code-review\ndescription: updated\n---\nUpdated content.",
    );

    await runAdd(repoDir, { qoderDir });

    const md = await fs.readFile(
      path.join(qoderDir, "skills", "code-review", "SKILL.md"),
      "utf-8",
    );
    assert.ok(md.includes("Updated content."));
  });
});

describe("CLI add (all resource types)", () => {
  let tmpDir: string;
  let repoDir: string;
  let qoderDir: string;
  let mcpTargetDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
    repoDir = path.join(tmpDir, "repo");
    qoderDir = path.join(tmpDir, "qoder-cn");
    mcpTargetDir = path.join(tmpDir, "SharedClientCache");

    // Skill
    const skillDir = path.join(repoDir, "skills", "my-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "---\nname: my-skill\ndescription: A skill\n---\nSkill content.");

    // Agent
    const agentsDir = path.join(repoDir, "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.writeFile(
      path.join(agentsDir, "code-review.md"),
      "---\nname: code-review\ndescription: Code review expert\n---\nYou are a reviewer.",
    );

    // Command
    const commandsDir = path.join(repoDir, "commands");
    await fs.mkdir(commandsDir, { recursive: true });
    await fs.writeFile(
      path.join(commandsDir, "code-inspect.md"),
      "---\ndescription: Code inspection command\n---\n## Overview\nInspect code.",
    );

    // MCP
    const mcpDir = path.join(repoDir, "mcp", "github");
    await fs.mkdir(mcpDir, { recursive: true });
    await fs.writeFile(
      path.join(mcpDir, "mcp.json"),
      JSON.stringify({ mcpServers: { github: { command: "npx", args: ["server-github"] } } }),
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("installs skill, agent, command and MCP together", async () => {
    await runAdd(repoDir, { qoderDir, mcpTargetDir });

    // Skill
    const skillMd = await fs.readFile(path.join(qoderDir, "skills", "my-skill", "SKILL.md"), "utf-8");
    assert.ok(skillMd.includes("Skill content."));

    // Agent
    const agentMd = await fs.readFile(path.join(qoderDir, "agents", "code-review.md"), "utf-8");
    assert.ok(agentMd.includes("You are a reviewer."));

    // Command
    const commandMd = await fs.readFile(path.join(qoderDir, "commands", "code-inspect.md"), "utf-8");
    assert.ok(commandMd.includes("Inspect code."));

    // MCP
    const mcpJson = JSON.parse(await fs.readFile(path.join(mcpTargetDir, "mcp.json"), "utf-8"));
    assert.ok(mcpJson.mcpServers.github);
  });

  it("records all resource types in source tracker", async () => {
    await runAdd(repoDir, { qoderDir, mcpTargetDir });

    const tracker = JSON.parse(await fs.readFile(path.join(qoderDir, ".qci.source.json"), "utf-8"));
    assert.ok(tracker.skills["my-skill"]);
    assert.ok(tracker.agents["code-review"]);
    assert.ok(tracker.mcp["github"]);
    assert.ok(tracker.commands["code-inspect"]);
  });

  it("skips MCP server if already installed", async () => {
    // Pre-create mcp.json with github already present
    await fs.mkdir(mcpTargetDir, { recursive: true });
    await fs.writeFile(
      path.join(mcpTargetDir, "mcp.json"),
      JSON.stringify({ mcpServers: { github: { command: "existing" } } }),
    );

    await runAdd(repoDir, { qoderDir, mcpTargetDir });

    const mcpJson = JSON.parse(await fs.readFile(path.join(mcpTargetDir, "mcp.json"), "utf-8"));
    assert.deepStrictEqual(mcpJson.mcpServers.github, { command: "existing" });
  });

  it("creates mcp.json if target does not exist", async () => {
    // mcpTargetDir does not exist yet
    await runAdd(repoDir, { qoderDir, mcpTargetDir });

    const mcpJson = JSON.parse(await fs.readFile(path.join(mcpTargetDir, "mcp.json"), "utf-8"));
    assert.ok(mcpJson.mcpServers.github);
  });
});

describe("CLI add (git source)", () => {
  let tmpDir: string;
  let localRepo: string;
  let qoderDir: string;
  let mcpTargetDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
    localRepo = path.join(tmpDir, "repo");
    qoderDir = path.join(tmpDir, "qoder-cn");
    mcpTargetDir = path.join(tmpDir, "SharedClientCache");

    // Create a git repo with skills
    const skillDir = path.join(localRepo, "skills", "git-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "---\nname: git-skill\ndescription: From git\n---\nGit skill content.");

    const { execFile: execFileCb } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFileCb);
    const env = { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@test.com", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@test.com" };
    await execFileAsync("git", ["init"], { cwd: localRepo });
    await execFileAsync("git", ["add", "."], { cwd: localRepo });
    await execFileAsync("git", ["commit", "-m", "init"], { cwd: localRepo, env });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("installs skills from git URL (local file:// repo)", async () => {
    await runAdd(localRepo, { qoderDir, mcpTargetDir });

    const md = await fs.readFile(path.join(qoderDir, "skills", "git-skill", "SKILL.md"), "utf-8");
    assert.ok(md.includes("Git skill content."));
  });

  it("records git source in tracker", async () => {
    await runAdd(localRepo, { qoderDir, mcpTargetDir });

    const tracker = JSON.parse(await fs.readFile(path.join(qoderDir, ".qci.source.json"), "utf-8"));
    assert.equal(tracker.skills["git-skill"].source, localRepo);
  });
});

describe("CLI add (filter)", () => {
  let tmpDir: string;
  let repoDir: string;
  let qoderDir: string;
  let mcpTargetDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
    repoDir = path.join(tmpDir, "repo");
    qoderDir = path.join(tmpDir, "qoder-cn");
    mcpTargetDir = path.join(tmpDir, "SharedClientCache");

    // Create repo with multiple resources
    for (const name of ["skill-a", "skill-b"]) {
      const dir = path.join(repoDir, "skills", name);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: ${name}\n---\n`);
    }
    await fs.mkdir(path.join(repoDir, "agents"), { recursive: true });
    await fs.writeFile(path.join(repoDir, "agents", "agent-a.md"), "---\nname: agent-a\ndescription: A\n---\n");
    const mcpDir = path.join(repoDir, "mcp", "github");
    await fs.mkdir(mcpDir, { recursive: true });
    await fs.writeFile(path.join(mcpDir, "mcp.json"), JSON.stringify({ mcpServers: { github: { command: "npx" } } }));
    const commandsDir = path.join(repoDir, "commands");
    await fs.mkdir(commandsDir, { recursive: true });
    await fs.writeFile(path.join(commandsDir, "cmd-a.md"), "---\ndescription: Command A\n---\nContent A");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("installs only filtered skill", async () => {
    await runAdd(repoDir, { qoderDir, mcpTargetDir, filterSkills: ["skill-a"] });

    const entries = await fs.readdir(path.join(qoderDir, "skills"));
    assert.deepStrictEqual(entries, ["skill-a"]);
    // Agents, MCP, commands should not be installed
    const agentsExist = await fs.access(path.join(qoderDir, "agents")).then(() => true).catch(() => false);
    assert.equal(agentsExist, false);
    const commandsExist = await fs.access(path.join(qoderDir, "commands")).then(() => true).catch(() => false);
    assert.equal(commandsExist, false);
  });

  it("installs only filtered agent", async () => {
    await runAdd(repoDir, { qoderDir, mcpTargetDir, filterAgents: ["agent-a"] });

    const agentMd = await fs.readFile(path.join(qoderDir, "agents", "agent-a.md"), "utf-8");
    assert.ok(agentMd.includes("agent-a"));
    const skillsExist = await fs.access(path.join(qoderDir, "skills")).then(() => true).catch(() => false);
    assert.equal(skillsExist, false);
  });

  it("installs only filtered MCP", async () => {
    await runAdd(repoDir, { qoderDir, mcpTargetDir, filterMcp: ["github"] });

    const mcpJson = JSON.parse(await fs.readFile(path.join(mcpTargetDir, "mcp.json"), "utf-8"));
    assert.ok(mcpJson.mcpServers.github);
    const skillsExist = await fs.access(path.join(qoderDir, "skills")).then(() => true).catch(() => false);
    assert.equal(skillsExist, false);
  });

  it("installs only filtered command", async () => {
    await runAdd(repoDir, { qoderDir, mcpTargetDir, filterCommands: ["cmd-a"] });

    const commandMd = await fs.readFile(path.join(qoderDir, "commands", "cmd-a.md"), "utf-8");
    assert.ok(commandMd.includes("Content A"));
    const skillsExist = await fs.access(path.join(qoderDir, "skills")).then(() => true).catch(() => false);
    assert.equal(skillsExist, false);
  });

  it("installs all skills when filter is empty array", async () => {
    await runAdd(repoDir, { qoderDir, mcpTargetDir, filterSkills: [] });

    const entries = await fs.readdir(path.join(qoderDir, "skills"));
    assert.equal(entries.length, 2);
    // Other types should not be installed
    const agentsExist = await fs.access(path.join(qoderDir, "agents")).then(() => true).catch(() => false);
    assert.equal(agentsExist, false);
  });

  it("installs all skills and all commands when both filters are empty arrays", async () => {
    await runAdd(repoDir, { qoderDir, mcpTargetDir, filterSkills: [], filterCommands: [] });

    const skillEntries = await fs.readdir(path.join(qoderDir, "skills"));
    assert.equal(skillEntries.length, 2);
    const commandEntries = await fs.readdir(path.join(qoderDir, "commands"));
    assert.equal(commandEntries.length, 1);
    // Agents and MCP should not be installed
    const agentsExist = await fs.access(path.join(qoderDir, "agents")).then(() => true).catch(() => false);
    assert.equal(agentsExist, false);
  });
});

describe("CLI add (MCP.md format)", () => {
  let tmpDir: string;
  let repoDir: string;
  let qoderDir: string;
  let mcpTargetDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
    repoDir = path.join(tmpDir, "repo");
    qoderDir = path.join(tmpDir, "qoder-cn");
    mcpTargetDir = path.join(tmpDir, "SharedClientCache");

    // MCP.md with variables
    const mcpDir = path.join(repoDir, "mcp", "github");
    await fs.mkdir(mcpDir, { recursive: true });
    await fs.writeFile(
      path.join(mcpDir, "MCP.md"),
      `---
name: github
description: GitHub MCP server
variables:
  - name: GITHUB_TOKEN
    description: GitHub API token
    type: string
    required: true
    sensitive: true
---

GitHub MCP server configuration.

\`\`\`json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "{{GITHUB_TOKEN}}" }
    }
  }
}
\`\`\`
`,
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("installs MCP.md, substitutes variables, and preserves the original file", async () => {
    await runAdd(repoDir, { qoderDir, mcpTargetDir, mcpEnv: { GITHUB_TOKEN: "ghp_test123" } });

    // mcp.json should contain the substituted value
    const mcpJson = JSON.parse(await fs.readFile(path.join(mcpTargetDir, "mcp.json"), "utf-8"));
    assert.ok(mcpJson.mcpServers.github);
    assert.equal(mcpJson.mcpServers.github.env.GITHUB_TOKEN, "ghp_test123");

    // Original MCP.md should be preserved (with placeholder intact)
    const preservedPath = path.join(qoderDir, "mcp", "github", "MCP.md");
    const preservedContent = await fs.readFile(preservedPath, "utf-8");
    assert.ok(preservedContent.includes("GITHUB_TOKEN"));
    assert.ok(preservedContent.includes("variables:"));
  });

  it("errors when a required MCP variable has no value", async () => {
    await assert.rejects(
      () => runAdd(repoDir, { qoderDir, mcpTargetDir }),
      /Missing required MCP variable "GITHUB_TOKEN"/,
    );
  });

  it("preserves MCP.md even when mcp.json already exists", async () => {
    // Pre-create mcp.json
    await fs.mkdir(mcpTargetDir, { recursive: true });
    await fs.writeFile(
      path.join(mcpTargetDir, "mcp.json"),
      JSON.stringify({ mcpServers: { github: { command: "existing" } } }),
    );

    await runAdd(repoDir, { qoderDir, mcpTargetDir, mcpEnv: { GITHUB_TOKEN: "ghp_test" } });

    // Original should be preserved
    const preservedPath = path.join(qoderDir, "mcp", "github", "MCP.md");
    const preservedContent = await fs.readFile(preservedPath, "utf-8");
    assert.ok(preservedContent.includes("variables:"));
  });
});

describe("CLI add (MCP.md with variable in args URL)", () => {
  let tmpDir: string;
  let repoDir: string;
  let qoderDir: string;
  let mcpTargetDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
    repoDir = path.join(tmpDir, "repo");
    qoderDir = path.join(tmpDir, "qoder-cn");
    mcpTargetDir = path.join(tmpDir, "SharedClientCache");

    const mcpDir = path.join(repoDir, "mcp", "my-private-mcp");
    await fs.mkdir(mcpDir, { recursive: true });
    await fs.writeFile(
      path.join(mcpDir, "MCP.md"),
      `---
name: my-private-mcp
description: Private MCP server with token in URL
variables:
  - name: PRIVATE_TOKEN
    description: Token for private package registry
    type: string
    required: true
    sensitive: true
---

\`\`\`json
{
  "mcpServers": {
    "my-private-mcp": {
      "command": "uvx",
      "args": [
        "--index-url",
        "https://user:{{PRIVATE_TOKEN}}@private-registry.example.com/org/pypi/-/packages/simple",
        "my-private-mcp-pkg"
      ]
    }
  }
}
\`\`\`
`,
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("substitutes {{VAR}} placeholder in args URL at install time", async () => {
    await runAdd(repoDir, { qoderDir, mcpTargetDir, mcpEnv: { PRIVATE_TOKEN: "tok123" } });

    // mcp.json should contain the substituted value in args URL
    const mcpJson = JSON.parse(await fs.readFile(path.join(mcpTargetDir, "mcp.json"), "utf-8"));
    const serverConfig = mcpJson.mcpServers["my-private-mcp"];
    assert.ok(serverConfig);
    assert.equal(serverConfig.command, "uvx");
    assert.equal(
      serverConfig.args[1],
      "https://user:tok123@private-registry.example.com/org/pypi/-/packages/simple",
    );

    // Preserved MCP.md should still contain the original placeholder
    const preservedPath = path.join(qoderDir, "mcp", "my-private-mcp", "MCP.md");
    const preservedContent = await fs.readFile(preservedPath, "utf-8");
    assert.ok(preservedContent.includes("PRIVATE_TOKEN"));
    assert.ok(preservedContent.includes("sensitive: true"));
  });
});
