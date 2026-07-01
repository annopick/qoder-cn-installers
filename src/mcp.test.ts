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

  it("discovers MCP services from mcp/ directory (legacy mcp.json)", async () => {
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
    assert.deepStrictEqual(services[0].variables, []);
  });

  it("returns empty array when no mcp/ directory exists", async () => {
    const services = await discoverMcpServices(tmpDir);
    assert.deepStrictEqual(services, []);
  });

  it("discovers multiple MCP services (legacy format)", async () => {
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

  describe("MCP.md format", () => {
    it("discovers MCP.md with code block JSON", async () => {
      const mcpDir = path.join(tmpDir, "mcp", "github");
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
      "args": ["-y", "@modelcontextprotocol/server-github"]
    }
  }
}
\`\`\`
`,
      );

      const services = await discoverMcpServices(tmpDir);

      assert.equal(services.length, 1);
      assert.equal(services[0].name, "github");
      assert.ok(services[0].config.mcpServers.github);
      assert.equal(services[0].variables.length, 1);
      assert.equal(services[0].variables[0].name, "GITHUB_TOKEN");
      assert.equal(services[0].variables[0].description, "GitHub API token");
      assert.equal(services[0].variables[0].type, "string");
      assert.equal(services[0].variables[0].required, true);
      assert.equal(services[0].variables[0].sensitive, true);
    });

    it("discovers MCP.md with plain text JSON", async () => {
      const mcpDir = path.join(tmpDir, "mcp", "database");
      await fs.mkdir(mcpDir, { recursive: true });
      await fs.writeFile(
        path.join(mcpDir, "MCP.md"),
        `---
name: database
description: Database MCP server
---

{"mcpServers": {"database": {"command": "npx", "args": ["db-server"]}}}
`,
      );

      const services = await discoverMcpServices(tmpDir);

      assert.equal(services.length, 1);
      assert.equal(services[0].name, "database");
      assert.ok(services[0].config.mcpServers.database);
      assert.deepStrictEqual(services[0].variables, []);
    });

    it("MCP.md takes priority over mcp.json when both exist", async () => {
      const mcpDir = path.join(tmpDir, "mcp", "github");
      await fs.mkdir(mcpDir, { recursive: true });
      await fs.writeFile(
        path.join(mcpDir, "MCP.md"),
        `---
name: github
description: GitHub MCP server
---

{"mcpServers": {"github": {"command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"]}}}
`,
      );
      await fs.writeFile(
        path.join(mcpDir, "mcp.json"),
        JSON.stringify({ mcpServers: { github: { command: "legacy" } } }),
      );

      const services = await discoverMcpServices(tmpDir);

      assert.equal(services.length, 1);
      assert.equal(services[0].name, "github");
      assert.equal(services[0].config.mcpServers.github.command, "npx");
    });

    it("falls back to mcp.json when MCP.md is missing", async () => {
      const mcpDir = path.join(tmpDir, "mcp", "legacy");
      await fs.mkdir(mcpDir, { recursive: true });
      await fs.writeFile(
        path.join(mcpDir, "mcp.json"),
        JSON.stringify({ mcpServers: { legacy: { command: "legacy" } } }),
      );

      const services = await discoverMcpServices(tmpDir);

      assert.equal(services.length, 1);
      assert.equal(services[0].name, "legacy");
      assert.equal(services[0].config.mcpServers.legacy.command, "legacy");
    });

    it("throws when frontmatter.name does not match directory", async () => {
      const mcpDir = path.join(tmpDir, "mcp", "github");
      await fs.mkdir(mcpDir, { recursive: true });
      await fs.writeFile(
        path.join(mcpDir, "MCP.md"),
        `---
name: wrong-name
---

{"mcpServers": {"wrong-name": {"command": "npx"}}}
`,
      );

      await assert.rejects(async () => discoverMcpServices(tmpDir), /mismatch/);
    });

    it("throws when mcpServers has more than one key", async () => {
      const mcpDir = path.join(tmpDir, "mcp", "github");
      await fs.mkdir(mcpDir, { recursive: true });
      await fs.writeFile(
        path.join(mcpDir, "MCP.md"),
        `---
name: github
---

{"mcpServers": {"github": {"command": "npx"}, "other": {"command": "npx"}}}
`,
      );

      await assert.rejects(async () => discoverMcpServices(tmpDir), /exactly one/);
    });

    it("preserves {{VAR}} placeholder embedded in args URL string", async () => {
      const mcpDir = path.join(tmpDir, "mcp", "my-private-mcp");
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

      const services = await discoverMcpServices(tmpDir);

      assert.equal(services.length, 1);
      assert.equal(services[0].name, "my-private-mcp");
      assert.equal(services[0].variables.length, 1);
      assert.equal(services[0].variables[0].name, "PRIVATE_TOKEN");
      assert.equal(services[0].variables[0].sensitive, true);

      // Verify the placeholder is preserved in args URL
      const serverConfig = services[0].config.mcpServers["my-private-mcp"] as { args: string[] };
      assert.equal(
        serverConfig.args[1],
        "https://user:{{PRIVATE_TOKEN}}@private-registry.example.com/org/pypi/-/packages/simple",
      );
    });
  });
});
