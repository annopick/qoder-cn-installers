import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { discoverSkills } from "./skills.js";

describe("discoverSkills", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("discovers skills from skills/ directory", async () => {
    const skillDir = path.join(tmpDir, "skills", "my-skill");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      "---\nname: my-skill\ndescription: A test skill\n---\n\nSkill content here.",
    );

    const skills = await discoverSkills(tmpDir);

    assert.equal(skills.length, 1);
    assert.equal(skills[0].name, "my-skill");
    assert.equal(skills[0].description, "A test skill");
    assert.equal(skills[0].path, skillDir);
  });

  it("returns empty array when no skills/ directory exists", async () => {
    const skills = await discoverSkills(tmpDir);
    assert.deepStrictEqual(skills, []);
  });

  it("discovers multiple skills", async () => {
    for (const name of ["skill-a", "skill-b"]) {
      const skillDir = path.join(tmpDir, "skills", name);
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        `---\nname: ${name}\ndescription: ${name} desc\n---\n`,
      );
    }

    const skills = await discoverSkills(tmpDir);
    assert.equal(skills.length, 2);
    const names = skills.map((s) => s.name).sort();
    assert.deepStrictEqual(names, ["skill-a", "skill-b"]);
  });

  it("includes subdirectories in skill path", async () => {
    const skillDir = path.join(tmpDir, "skills", "code-review");
    const refsDir = path.join(skillDir, "references");
    await fs.mkdir(refsDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "---\nname: code-review\ndescription: Review code\n---\n");
    await fs.writeFile(path.join(refsDir, "guide.md"), "Some reference");

    const skills = await discoverSkills(tmpDir);
    assert.equal(skills.length, 1);
    assert.equal(skills[0].name, "code-review");
    // Verify the original directory has the subdirectory intact
    const entries = await fs.readdir(skillDir);
    assert.ok(entries.includes("references"));
  });
});
