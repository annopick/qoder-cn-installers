import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveVariableValues, substituteVariables } from "./mcp-substitute.js";
import type { McpVariable } from "./mcp-discovery.js";

function makeVar(overrides: Partial<McpVariable> = {}): McpVariable {
  return {
    name: "TOKEN",
    description: "",
    type: "string",
    required: true,
    sensitive: true,
    ...overrides,
  };
}

describe("resolveVariableValues", () => {
  it("uses --env value when provided", () => {
    const vars = [makeVar({ name: "CNB_TOKEN" })];
    const resolved = resolveVariableValues(vars, { CNB_TOKEN: "from-cli" });
    assert.equal(resolved.CNB_TOKEN, "from-cli");
  });

  it("falls back to process.env when --env not set", () => {
    process.env.QCI_TEST_VAR = "from-process-env";
    try {
      const vars = [makeVar({ name: "QCI_TEST_VAR" })];
      const resolved = resolveVariableValues(vars);
      assert.equal(resolved.QCI_TEST_VAR, "from-process-env");
    } finally {
      delete process.env.QCI_TEST_VAR;
    }
  });

  it("process.env fallback is case-insensitive", () => {
    process.env.QCI_CASE_TEST = "ci-value";
    try {
      const vars = [makeVar({ name: "qci_case_test" })];
      const resolved = resolveVariableValues(vars);
      assert.equal(resolved.qci_case_test, "ci-value");
    } finally {
      delete process.env.QCI_CASE_TEST;
    }
  });

  it("--env takes priority over process.env", () => {
    process.env.QCI_DUP = "from-env";
    try {
      const vars = [makeVar({ name: "QCI_DUP" })];
      const resolved = resolveVariableValues(vars, { QCI_DUP: "from-cli" });
      assert.equal(resolved.QCI_DUP, "from-cli");
    } finally {
      delete process.env.QCI_DUP;
    }
  });

  it("throws for a required variable with no value", () => {
    const vars = [makeVar({ name: "MISSING_REQUIRED" })];
    assert.throws(
      () => resolveVariableValues(vars),
      /Missing required MCP variable "MISSING_REQUIRED"/,
    );
  });

  it("uses default for an optional variable with no value", () => {
    const vars = [makeVar({ name: "OPT", required: false, default: "fallback" })];
    const resolved = resolveVariableValues(vars);
    assert.equal(resolved.OPT, "fallback");
  });

  it("omits optional variable when no value and no default", () => {
    const vars = [makeVar({ name: "OPT", required: false })];
    const resolved = resolveVariableValues(vars);
    assert.equal("OPT" in resolved, false);
  });

  it("resolves multiple variables at once", () => {
    const vars = [
      makeVar({ name: "A" }),
      makeVar({ name: "B", required: false, default: "dv" }),
    ];
    const resolved = resolveVariableValues(vars, { A: "1" });
    assert.equal(resolved.A, "1");
    assert.equal(resolved.B, "dv");
  });
});

describe("substituteVariables", () => {
  it("replaces a standalone placeholder value", () => {
    const result = substituteVariables({ env: { TOKEN: "{{TOKEN}}" } }, { TOKEN: "secret" });
    assert.equal((result as any).env.TOKEN, "secret");
  });

  it("replaces a placeholder embedded in a URL substring", () => {
    const url = "https://cnb:{{CNB_TOKEN}}@pypi.cnb.cool/repo";
    const result = substituteVariables({ args: [url] }, { CNB_TOKEN: "abc123" });
    assert.equal((result as any).args[0], "https://cnb:abc123@pypi.cnb.cool/repo");
  });

  it("walks nested objects and arrays", () => {
    const input = {
      mcpServers: {
        srv: {
          command: "uvx",
          args: ["--key", "{{KEY}}"],
          env: { SECRET: "{{SECRET}}" },
        },
      },
    };
    const result = substituteVariables(input, { KEY: "k1", SECRET: "s1" }) as any;
    assert.equal(result.mcpServers.srv.args[1], "k1");
    assert.equal(result.mcpServers.srv.env.SECRET, "s1");
  });

  it("leaves unknown {{...}} placeholders untouched", () => {
    const result = substituteVariables({ url: "{{UNKNOWN_VAR}}" }, {});
    assert.equal((result as any).url, "{{UNKNOWN_VAR}}");
  });

  it("does not mutate the input object", () => {
    const input = { env: { TOKEN: "{{TOKEN}}" } };
    substituteVariables(input, { TOKEN: "x" });
    assert.equal((input as any).env.TOKEN, "{{TOKEN}}");
  });

  it("passes through non-string values unchanged", () => {
    const input = { port: 8080, enabled: true, nested: null };
    const result = substituteVariables(input, {}) as any;
    assert.equal(result.port, 8080);
    assert.equal(result.enabled, true);
    assert.equal(result.nested, null);
  });
});
