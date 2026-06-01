import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runRemove } from "./cli-remove.js";

describe("runRemove", () => {
  let tmpDir: string;
  let qoderDir: string;
  let mcpTargetDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
    qoderDir = path.join(tmpDir, "qoder-cn");
    mcpTargetDir = path.join(tmpDir, "SharedClientCache");

    // Create installed resources
    const skillDir = path.join(qoderDir, "skills", "my-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "---\nname: my-skill\n---\n");

    await fs.mkdir(path.join(qoderDir, "agents"), { recursive: true });
    await fs.writeFile(
      path.join(qoderDir, "agents", "my-agent.md"),
      "---\nname: my-agent\n---\nAgent content",
    );

    await fs.mkdir(mcpTargetDir, { recursive: true });
    await fs.writeFile(
      path.join(mcpTargetDir, "mcp.json"),
      JSON.stringify({ mcpServers: { github: { command: "npx" }, db: { command: "psql" } } }),
    );

    // Create source tracker
    await fs.writeFile(
      path.join(qoderDir, ".qci.source.json"),
      JSON.stringify({
        skills: { "my-skill": { source: "/path", ref: "abc" } },
        agents: { "my-agent": { source: "/path", ref: "def" } },
        mcp: { github: { source: "/path", ref: "ghi" }, db: { source: "/path", ref: "jkl" } },
      }),
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("removes a skill", async () => {
    await runRemove({ qoderDir, mcpTargetDir, skills: ["my-skill"] });

    await assert.rejects(fs.access(path.join(qoderDir, "skills", "my-skill")));
    const tracker = JSON.parse(await fs.readFile(path.join(qoderDir, ".qci.source.json"), "utf-8"));
    assert.ok(!tracker.skills["my-skill"]);
  });

  it("removes an agent", async () => {
    await runRemove({ qoderDir, mcpTargetDir, agents: ["my-agent"] });

    await assert.rejects(fs.access(path.join(qoderDir, "agents", "my-agent.md")));
    const tracker = JSON.parse(await fs.readFile(path.join(qoderDir, ".qci.source.json"), "utf-8"));
    assert.ok(!tracker.agents["my-agent"]);
  });

  it("removes an MCP service", async () => {
    await runRemove({ qoderDir, mcpTargetDir, mcpServices: ["github"] });

    const mcpJson = JSON.parse(await fs.readFile(path.join(mcpTargetDir, "mcp.json"), "utf-8"));
    assert.ok(!mcpJson.mcpServers.github);
    assert.ok(mcpJson.mcpServers.db);
    const tracker = JSON.parse(await fs.readFile(path.join(qoderDir, ".qci.source.json"), "utf-8"));
    assert.ok(!tracker.mcp["github"]);
    assert.ok(tracker.mcp["db"]);
  });

  it("removes all resources with --all", async () => {
    await runRemove({ qoderDir, mcpTargetDir, all: true });

    const skillEntries = await fs.readdir(path.join(qoderDir, "skills")).catch(() => []);
    assert.equal(skillEntries.length, 0);

    const agentEntries = await fs.readdir(path.join(qoderDir, "agents")).catch(() => []);
    assert.equal(agentEntries.length, 0);

    const mcpJson = JSON.parse(await fs.readFile(path.join(mcpTargetDir, "mcp.json"), "utf-8"));
    assert.equal(Object.keys(mcpJson.mcpServers).length, 0);

    const tracker = JSON.parse(await fs.readFile(path.join(qoderDir, ".qci.source.json"), "utf-8"));
    assert.equal(Object.keys(tracker.skills).length, 0);
    assert.equal(Object.keys(tracker.agents).length, 0);
    assert.equal(Object.keys(tracker.mcp).length, 0);
  });

  it("preserves mcp.json file after removing all services", async () => {
    await runRemove({ qoderDir, mcpTargetDir, mcpServices: ["github", "db"] });

    const content = await fs.readFile(path.join(mcpTargetDir, "mcp.json"), "utf-8");
    assert.ok(content.length > 0);
    const mcpJson = JSON.parse(content);
    assert.ok(mcpJson.mcpServers);
  });
});
