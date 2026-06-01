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
});
