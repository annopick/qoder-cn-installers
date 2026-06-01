import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mergeMcpConfig } from "./mcp-merger.js";

describe("mergeMcpConfig", () => {
  it("appends new server to empty target", () => {
    const target = { mcpServers: {} };
    const source = { mcpServers: { github: { command: "npx", args: ["server-github"] } } };

    const result = mergeMcpConfig(target, source);

    assert.ok(result.mcpServers.github);
    assert.deepStrictEqual(result.mcpServers.github, { command: "npx", args: ["server-github"] });
  });

  it("appends new server to existing target", () => {
    const target = { mcpServers: { existing: { command: "old" } } };
    const source = { mcpServers: { github: { command: "new" } } };

    const result = mergeMcpConfig(target, source);

    assert.equal(Object.keys(result.mcpServers).length, 2);
    assert.ok(result.mcpServers.existing);
    assert.ok(result.mcpServers.github);
  });

  it("skips when server name already exists", () => {
    const target = { mcpServers: { github: { command: "old" } } };
    const source = { mcpServers: { github: { command: "new" } } };

    const result = mergeMcpConfig(target, source);

    assert.equal(Object.keys(result.mcpServers).length, 1);
    assert.deepStrictEqual(result.mcpServers.github, { command: "old" });
  });

  it("handles empty target object", () => {
    const source = { mcpServers: { db: { command: "psql" } } };

    const result = mergeMcpConfig(undefined, source);

    assert.ok(result.mcpServers.db);
  });

  it("merges multiple servers from source, skipping duplicates", () => {
    const target = { mcpServers: { github: { command: "existing" } } };
    const source = {
      mcpServers: {
        github: { command: "new" },
        database: { command: "psql" },
        filesystem: { command: "fs" },
      },
    };

    const result = mergeMcpConfig(target, source);

    assert.equal(Object.keys(result.mcpServers).length, 3);
    assert.deepStrictEqual(result.mcpServers.github, { command: "existing" });
    assert.ok(result.mcpServers.database);
    assert.ok(result.mcpServers.filesystem);
  });
});
