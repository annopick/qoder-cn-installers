import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { discoverMcpServices } from "./mcp-discovery.js";

describe("discoverMcpServices", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("discovers MCP services from mcp/ directory", async () => {
    const mcpDir = path.join(tmpDir, "mcp", "github");
    await fs.mkdir(mcpDir, { recursive: true });
    await fs.writeFile(
      path.join(mcpDir, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          github: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
        },
      }, null, 2),
    );

    const services = await discoverMcpServices(tmpDir);

    assert.equal(services.length, 1);
    assert.equal(services[0].name, "github");
    assert.ok(services[0].config.mcpServers.github);
  });

  it("returns empty array when no mcp/ directory exists", async () => {
    const services = await discoverMcpServices(tmpDir);
    assert.deepStrictEqual(services, []);
  });

  it("discovers multiple MCP services", async () => {
    for (const name of ["github", "database"]) {
      const mcpDir = path.join(tmpDir, "mcp", name);
      await fs.mkdir(mcpDir, { recursive: true });
      await fs.writeFile(
        path.join(mcpDir, "mcp.json"),
        JSON.stringify({ mcpServers: { [name]: { command: name } } }),
      );
    }

    const services = await discoverMcpServices(tmpDir);
    assert.equal(services.length, 2);
    const names = services.map((s) => s.name).sort();
    assert.deepStrictEqual(names, ["database", "github"]);
  });

  it("skips directories without mcp.json", async () => {
    const mcpDir = path.join(tmpDir, "mcp", "valid");
    await fs.mkdir(mcpDir, { recursive: true });
    await fs.writeFile(
      path.join(mcpDir, "mcp.json"),
      JSON.stringify({ mcpServers: { valid: { command: "valid" } } }),
    );
    const emptyDir = path.join(tmpDir, "mcp", "empty");
    await fs.mkdir(emptyDir, { recursive: true });

    const services = await discoverMcpServices(tmpDir);
    assert.equal(services.length, 1);
    assert.equal(services[0].name, "valid");
  });
});
