import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { discoverCommands } from "./commands.js";

describe("discoverCommands", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("discovers commands from commands/ directory", async () => {
    const commandsDir = path.join(tmpDir, "commands");
    await fs.mkdir(commandsDir, { recursive: true });
    await fs.writeFile(
      path.join(commandsDir, "code-inspect.md"),
      "---\ndescription: Code inspection command\n---\n## Overview\nInspect code.",
    );

    const commands = await discoverCommands(tmpDir);

    assert.equal(commands.length, 1);
    assert.equal(commands[0].name, "code-inspect");
    assert.equal(commands[0].description, "Code inspection command");
    assert.equal(commands[0].path, path.join(commandsDir, "code-inspect.md"));
  });

  it("returns empty array when no commands/ directory exists", async () => {
    const commands = await discoverCommands(tmpDir);
    assert.deepStrictEqual(commands, []);
  });

  it("discovers multiple commands", async () => {
    const commandsDir = path.join(tmpDir, "commands");
    await fs.mkdir(commandsDir, { recursive: true });
    await fs.writeFile(
      path.join(commandsDir, "cmd-a.md"),
      "---\ndescription: Command A\n---\nContent A",
    );
    await fs.writeFile(
      path.join(commandsDir, "cmd-b.md"),
      "---\ndescription: Command B\n---\nContent B",
    );

    const commands = await discoverCommands(tmpDir);
    assert.equal(commands.length, 2);
    const names = commands.map((c) => c.name).sort();
    assert.deepStrictEqual(names, ["cmd-a", "cmd-b"]);
  });

  it("discovers command without frontmatter", async () => {
    const commandsDir = path.join(tmpDir, "commands");
    await fs.mkdir(commandsDir, { recursive: true });
    await fs.writeFile(
      path.join(commandsDir, "plain.md"),
      "## Plain command\nNo frontmatter here.",
    );

    const commands = await discoverCommands(tmpDir);
    assert.equal(commands.length, 1);
    assert.equal(commands[0].name, "plain");
    assert.equal(commands[0].description, "");
  });

  it("skips non-markdown files", async () => {
    const commandsDir = path.join(tmpDir, "commands");
    await fs.mkdir(commandsDir, { recursive: true });
    await fs.writeFile(path.join(commandsDir, "valid.md"), "---\ndescription: Valid\n---\nContent");
    await fs.writeFile(path.join(commandsDir, "config.json"), "{}");

    const commands = await discoverCommands(tmpDir);
    assert.equal(commands.length, 1);
    assert.equal(commands[0].name, "valid");
  });
});
