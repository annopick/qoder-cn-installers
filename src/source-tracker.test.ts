import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { readSourceTracker, writeSourceTracker, type SourceTracker, type SourceEntry } from "./source-tracker.js";

describe("source tracker", () => {
  let tmpDir: string;
  let trackerPath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qci-test-"));
    trackerPath = path.join(tmpDir, ".qci.source.json");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("reads empty tracker when file does not exist", async () => {
    const tracker = await readSourceTracker(trackerPath);
    const expected: SourceTracker = { skills: {}, agents: {}, mcp: {}, commands: {} };
    assert.deepStrictEqual(tracker, expected);
  });

  it("writes and reads back tracker data", async () => {
    const entry: SourceEntry = { source: "/some/path", ref: "abc123" };
    const tracker: SourceTracker = {
      skills: { "my-skill": entry },
      agents: {},
      mcp: {},
      commands: {},
    };

    await writeSourceTracker(trackerPath, tracker);
    const read = await readSourceTracker(trackerPath);

    assert.deepStrictEqual(read, tracker);
  });

  it("updates existing entry", async () => {
    const tracker: SourceTracker = {
      skills: { "my-skill": { source: "/path", ref: "v1" } },
      agents: {},
      mcp: {},
      commands: {},
    };
    await writeSourceTracker(trackerPath, tracker);

    tracker.skills["my-skill"] = { source: "/path", ref: "v2" };
    await writeSourceTracker(trackerPath, tracker);

    const read = await readSourceTracker(trackerPath);
    assert.equal(read.skills["my-skill"].ref, "v2");
  });

  it("adds new entry alongside existing ones", async () => {
    const tracker: SourceTracker = {
      skills: { "skill-a": { source: "/path", ref: "a1" } },
      agents: {},
      mcp: {},
      commands: {},
    };
    await writeSourceTracker(trackerPath, tracker);

    tracker.skills["skill-b"] = { source: "/other", ref: "b1" };
    await writeSourceTracker(trackerPath, tracker);

    const read = await readSourceTracker(trackerPath);
    assert.equal(Object.keys(read.skills).length, 2);
    assert.equal(read.skills["skill-b"].ref, "b1");
  });

  it("removes an entry", async () => {
    const tracker: SourceTracker = {
      skills: {
        "skill-a": { source: "/path", ref: "a1" },
        "skill-b": { source: "/path", ref: "b1" },
      },
      agents: {},
      mcp: {},
      commands: {},
    };
    await writeSourceTracker(trackerPath, tracker);

    delete tracker.skills["skill-a"];
    await writeSourceTracker(trackerPath, tracker);

    const read = await readSourceTracker(trackerPath);
    assert.ok(!("skill-a" in read.skills));
    assert.equal(Object.keys(read.skills).length, 1);
  });
});
