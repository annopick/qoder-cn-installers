import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runList, type ListResult } from "./cli-list.js";

describe("runList", () => {
  let tmpDir: string;
  let qoderDir: string;
  let mcpTargetDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
    qoderDir = path.join(tmpDir, "qoder-cn");
    mcpTargetDir = path.join(tmpDir, "SharedClientCache");

    // Create installed skills
    for (const name of ["skill-a", "skill-b"]) {
      const dir = path.join(qoderDir, "skills", name);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "SKILL.md"), `---\nname: ${name}\n---\n`);
    }

    // Create installed agents
    await fs.mkdir(path.join(qoderDir, "agents"), { recursive: true });
    await fs.writeFile(
      path.join(qoderDir, "agents", "agent-a.md"),
      "---\nname: agent-a\ndescription: Agent A\n---\n",
    );

    // Create mcp.json
    await fs.mkdir(mcpTargetDir, { recursive: true });
    await fs.writeFile(
      path.join(mcpTargetDir, "mcp.json"),
      JSON.stringify({ mcpServers: { github: { command: "npx" }, db: { command: "psql" } } }),
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("lists all installed resources", async () => {
    const result = await runList({ qoderDir, mcpTargetDir });

    assert.equal(result.skills.length, 2);
    assert.equal(result.agents.length, 1);
    assert.equal(result.mcp.length, 2);
    assert.equal(result.skills[0], "skill-a");
    assert.equal(result.agents[0], "agent-a");
    assert.ok(result.mcp.includes("github"));
    assert.ok(result.mcp.includes("db"));
  });

  it("filters by skill only", async () => {
    const result = await runList({ qoderDir, mcpTargetDir, type: "skill" });

    assert.equal(result.skills.length, 2);
    assert.equal(result.agents.length, 0);
    assert.equal(result.mcp.length, 0);
  });

  it("filters by agent only", async () => {
    const result = await runList({ qoderDir, mcpTargetDir, type: "agent" });

    assert.equal(result.skills.length, 0);
    assert.equal(result.agents.length, 1);
    assert.equal(result.mcp.length, 0);
  });

  it("filters by mcp only", async () => {
    const result = await runList({ qoderDir, mcpTargetDir, type: "mcp" });

    assert.equal(result.skills.length, 0);
    assert.equal(result.agents.length, 0);
    assert.equal(result.mcp.length, 2);
  });

  it("returns empty when qoder-cn does not exist", async () => {
    const emptyDir = path.join(tmpDir, "no-exist");
    const result = await runList({ qoderDir: emptyDir, mcpTargetDir: path.join(tmpDir, "no-mcp") });

    assert.deepStrictEqual(result.skills, []);
    assert.deepStrictEqual(result.agents, []);
    assert.deepStrictEqual(result.mcp, []);
  });

  it("returns empty mcp when mcp.json does not exist", async () => {
    const result = await runList({ qoderDir, mcpTargetDir: path.join(tmpDir, "no-mcp") });

    assert.equal(result.skills.length, 2);
    assert.deepStrictEqual(result.mcp, []);
  });
});
