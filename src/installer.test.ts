import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { installSkill } from "./installer.js";

describe("installSkill", () => {
  let tmpDir: string;
  let sourceDir: string;
  let targetBase: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
    sourceDir = path.join(tmpDir, "source", "skills", "my-skill");
    targetBase = path.join(tmpDir, "target", "skills");
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.mkdir(targetBase, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("copies skill directory to target", async () => {
    await fs.writeFile(path.join(sourceDir, "SKILL.md"), "---\nname: my-skill\n---\ncontent");
    await fs.mkdir(path.join(sourceDir, "references"));
    await fs.writeFile(path.join(sourceDir, "references", "guide.md"), "ref content");

    await installSkill({ name: "my-skill", description: "", path: sourceDir }, targetBase);

    const installedDir = path.join(targetBase, "my-skill");
    const md = await fs.readFile(path.join(installedDir, "SKILL.md"), "utf-8");
    assert.equal(md, "---\nname: my-skill\n---\ncontent");

    const ref = await fs.readFile(path.join(installedDir, "references", "guide.md"), "utf-8");
    assert.equal(ref, "ref content");
  });

  it("overwrites existing skill directory", async () => {
    // Install first version
    await fs.writeFile(path.join(sourceDir, "SKILL.md"), "---\nname: my-skill\n---\nv1");
    await installSkill({ name: "my-skill", description: "", path: sourceDir }, targetBase);

    // Install updated version
    await fs.writeFile(path.join(sourceDir, "SKILL.md"), "---\nname: my-skill\n---\nv2");
    await installSkill({ name: "my-skill", description: "", path: sourceDir }, targetBase);

    const md = await fs.readFile(path.join(targetBase, "my-skill", "SKILL.md"), "utf-8");
    assert.equal(md, "---\nname: my-skill\n---\nv2");
  });

  it("creates target directory if it does not exist", async () => {
    const freshTarget = path.join(tmpDir, "does-not-exist", "skills");
    await fs.writeFile(path.join(sourceDir, "SKILL.md"), "---\nname: my-skill\n---\ncontent");

    await installSkill({ name: "my-skill", description: "", path: sourceDir }, freshTarget);

    const md = await fs.readFile(path.join(freshTarget, "my-skill", "SKILL.md"), "utf-8");
    assert.equal(md, "---\nname: my-skill\n---\ncontent");
  });
});
