import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { parseAddArgs } from "./cli-add-args.js";

describe("parseAddArgs", () => {
  it("parses source only", () => {
    const result = parseAddArgs(["https://github.com/owner/repo"]);
    assert.equal(result.source, "https://github.com/owner/repo");
    assert.equal(result.all, false);
    assert.equal(result.yes, false);
    assert.equal(result.list, false);
  });

  it("parses --all flag", () => {
    const result = parseAddArgs(["https://github.com/owner/repo", "--all"]);
    assert.equal(result.all, true);
    assert.equal(result.yes, true);
  });

  it("parses -y flag", () => {
    const result = parseAddArgs(["https://github.com/owner/repo", "-y"]);
    assert.equal(result.yes, true);
  });

  it("parses --yes flag", () => {
    const result = parseAddArgs(["https://github.com/owner/repo", "--yes"]);
    assert.equal(result.yes, true);
  });

  it("parses --skill flag", () => {
    const result = parseAddArgs(["https://github.com/owner/repo", "--skill", "code-review"]);
    assert.deepStrictEqual(result.skills, ["code-review"]);
  });

  it("parses --skill with multiple values", () => {
    const result = parseAddArgs(["https://github.com/owner/repo", "--skill", "a", "b"]);
    assert.deepStrictEqual(result.skills, ["a", "b"]);
  });

  it("parses --agent flag", () => {
    const result = parseAddArgs(["https://github.com/owner/repo", "--agent", "reviewer"]);
    assert.deepStrictEqual(result.agents, ["reviewer"]);
  });

  it("parses --mcp flag", () => {
    const result = parseAddArgs(["https://github.com/owner/repo", "--mcp", "github"]);
    assert.deepStrictEqual(result.mcp, ["github"]);
  });

  it("parses --list flag", () => {
    const result = parseAddArgs(["https://github.com/owner/repo", "--list"]);
    assert.equal(result.list, true);
  });

  it("parses --path flag", () => {
    const result = parseAddArgs(["https://github.com/owner/repo", "--path", "sub/dir"]);
    assert.equal(result.subpath, "sub/dir");
  });

  it("parses combined flags", () => {
    const result = parseAddArgs(["https://github.com/owner/repo", "--skill", "a", "--mcp", "x", "-y"]);
    assert.deepStrictEqual(result.skills, ["a"]);
    assert.deepStrictEqual(result.mcp, ["x"]);
    assert.equal(result.yes, true);
  });

  it("parses --command flag", () => {
    const result = parseAddArgs(["https://github.com/owner/repo", "--command", "code-inspect"]);
    assert.deepStrictEqual(result.commands, ["code-inspect"]);
  });

  it("parses --command with multiple values", () => {
    const result = parseAddArgs(["https://github.com/owner/repo", "--command", "a", "b"]);
    assert.deepStrictEqual(result.commands, ["a", "b"]);
  });

  it("throws when no source provided", () => {
    assert.throws(() => parseAddArgs([]), /source is required/i);
  });
});
