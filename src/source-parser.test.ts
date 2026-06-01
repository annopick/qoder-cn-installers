import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { parseSource } from "./source-parser.js";


describe("parseSource", () => {
  it("recognizes local absolute path on macOS/Linux", () => {
    const result = parseSource("/Users/me/my-skills-repo");
    assert.deepStrictEqual(result, { type: "local", path: "/Users/me/my-skills-repo" });
  });

  it("recognizes local absolute path on Windows", () => {
    const result = parseSource("C:\\Users\\me\\my-skills-repo");
    assert.deepStrictEqual(result, { type: "local", path: "C:\\Users\\me\\my-skills-repo" });
  });

  it("rejects relative path", () => {
    assert.throws(
      () => parseSource("./my-skills"),
      /absolute path required/i,
    );
  });

  it("rejects bare relative name", () => {
    assert.throws(
      () => parseSource("my-skills"),
      /unsupported source format/i,
    );
  });

  it("recognizes git HTTPS URL", () => {
    const result = parseSource("https://github.com/owner/repo");
    assert.deepStrictEqual(result, { type: "git-url", url: "https://github.com/owner/repo" });
  });

  it("recognizes git URL with .git suffix", () => {
    const result = parseSource("https://github.com/owner/repo.git");
    assert.deepStrictEqual(result, { type: "git-url", url: "https://github.com/owner/repo.git" });
  });

  it("recognizes git URL on custom host", () => {
    const result = parseSource("https://gitlab.mycompany.com/team/project");
    assert.deepStrictEqual(result, { type: "git-url", url: "https://gitlab.mycompany.com/team/project" });
  });

  it("recognizes git SSH format", () => {
    const result = parseSource("git@github.com:owner/repo.git");
    assert.deepStrictEqual(result, { type: "git-ssh", url: "git@github.com:owner/repo.git" });
  });

  it("recognizes git SSH on custom host", () => {
    const result = parseSource("git@gitlab.com:team/project.git");
    assert.deepStrictEqual(result, { type: "git-ssh", url: "git@gitlab.com:team/project.git" });
  });
});
