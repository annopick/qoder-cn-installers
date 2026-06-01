import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { discoverAgents } from "./agents.js";

describe("discoverAgents", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("discovers agents from agents/ directory", async () => {
    const agentsDir = path.join(tmpDir, "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.writeFile(
      path.join(agentsDir, "code-review.md"),
      "---\nname: code-review\ndescription: Code review expert\n---\n\nYou are a code reviewer.",
    );

    const agents = await discoverAgents(tmpDir);

    assert.equal(agents.length, 1);
    assert.equal(agents[0].name, "code-review");
    assert.equal(agents[0].description, "Code review expert");
    assert.equal(agents[0].path, path.join(agentsDir, "code-review.md"));
  });

  it("returns empty array when no agents/ directory exists", async () => {
    const agents = await discoverAgents(tmpDir);
    assert.deepStrictEqual(agents, []);
  });

  it("discovers multiple agents", async () => {
    const agentsDir = path.join(tmpDir, "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.writeFile(
      path.join(agentsDir, "agent-a.md"),
      "---\nname: agent-a\ndescription: Agent A\n---\n",
    );
    await fs.writeFile(
      path.join(agentsDir, "agent-b.md"),
      "---\nname: agent-b\ndescription: Agent B\n---\n",
    );

    const agents = await discoverAgents(tmpDir);
    assert.equal(agents.length, 2);
    const names = agents.map((a) => a.name).sort();
    assert.deepStrictEqual(names, ["agent-a", "agent-b"]);
  });

  it("skips .md files without valid frontmatter", async () => {
    const agentsDir = path.join(tmpDir, "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.writeFile(path.join(agentsDir, "valid.md"), "---\nname: valid\ndescription: Valid agent\n---\n");
    await fs.writeFile(path.join(agentsDir, "invalid.md"), "No frontmatter here");

    const agents = await discoverAgents(tmpDir);
    assert.equal(agents.length, 1);
    assert.equal(agents[0].name, "valid");
  });
});
