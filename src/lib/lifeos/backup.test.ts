import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BACKUP_MAX_BYTES, buildBackup, mergeBackup, readBackup, summarizeLog } from "./backup";
import { createBlank, type LifeData } from "./model";
import { parseLifeData } from "./validate";

function log(over: Partial<LifeData> = {}): LifeData {
  return parseLifeData({
    ...createBlank("2026-11-01"),
    dos: [{ id: "a", label: "Walk" }],
    donts: [{ id: "x", label: "Sugar" }],
    ...over,
  });
}

describe("readBackup", () => {
  it("round-trips a backup made by buildBackup, with its labels", () => {
    const data = log({ oneLines: { "2026-11-02": "good day" } });
    const text = buildBackup(data, "1.4.0", new Date("2026-11-24T10:00:00.000Z"));
    const res = readBackup(text);
    assert.ok(res.ok);
    assert.deepEqual(res.data, data);
    assert.deepEqual(res.meta, { exportedAt: "2026-11-24T10:00:00.000Z", appVersion: "1.4.0" });
  });

  it("still reads an old backup with no labels", () => {
    const res = readBackup(JSON.stringify({ version: 1, ...log() }));
    assert.ok(res.ok);
    assert.deepEqual(res.meta, { exportedAt: null, appVersion: null });
  });

  it("explains what is wrong instead of throwing", () => {
    const bad = (text: string) => {
      const res = readBackup(text);
      assert.equal(res.ok, false);
      return res.ok ? "" : res.error;
    };
    assert.match(bad("not json {"), /valid backup/);
    assert.match(bad("[]"), /isn't a LifeOS backup/);
    assert.match(bad('{"hello":1}'), /isn't a LifeOS backup/);
    assert.match(bad("x".repeat(BACKUP_MAX_BYTES + 1)), /too large/);
    assert.equal(typeof bad(JSON.stringify({ dos: [{ id: 5 }], donts: [] })), "string");
  });

  it("ignores junk labels", () => {
    const res = readBackup(JSON.stringify({ ...log(), exportedAt: "<script>", appVersion: "9".repeat(50) }));
    assert.ok(res.ok);
    assert.deepEqual(res.meta, { exportedAt: null, appVersion: null });
  });
});

describe("summarizeLog", () => {
  it("counts what is in the log", () => {
    const data = log({
      doChecks: { "2026-11-03": { a: { done: true, notes: "" } } },
      dontChecks: { "2026-11-02": { x: { status: "Avoided", notes: "" } } },
    });
    const s = summarizeLog(data);
    assert.equal(s.habits, 2);
    assert.equal(s.loggedDays, 2);
    assert.equal(s.firstDay, "2026-11-02");
    assert.equal(s.lastDay, "2026-11-03");
  });
});

describe("mergeBackup", () => {
  it("keeps current data and adds days the backup has", () => {
    const current = log({ doChecks: { "2026-11-05": { a: { done: true, notes: "now" } } } });
    const backup = log({ doChecks: { "2026-11-02": { a: { done: true, notes: "old" } } } });
    const merged = mergeBackup(current, backup);
    assert.equal(merged.doChecks["2026-11-05"]?.a?.notes, "now");
    assert.equal(merged.doChecks["2026-11-02"]?.a?.notes, "old");
  });

  it("current value wins when both have the same thing", () => {
    const current = log({ oneLines: { "2026-11-02": "current" } });
    const backup = log({ oneLines: { "2026-11-02": "backup" } });
    assert.equal(mergeBackup(current, backup).oneLines["2026-11-02"], "current");
  });

  it("adds habits and to-dos that are missing, without duplicating ones that match", () => {
    const todo = (id: string, title: string) => ({
      id, title, done: false, priority: "medium" as const, due: "", notes: "", created: "2026-11-01", doneOn: "",
    });
    const current = log({ todos: [todo("t1", "Shared")] });
    const backup = log({
      dos: [{ id: "a", label: "Walk" }, { id: "b", label: "Read" }],
      todos: [todo("t1", "Shared"), todo("t2", "Only in backup")],
    });
    const merged = mergeBackup(current, backup);
    assert.deepEqual(merged.dos.map((h) => h.id).sort(), ["a", "b"]);
    assert.deepEqual(merged.todos.map((t) => t.id).sort(), ["t1", "t2"]);
  });

  it("keeps the current program dates", () => {
    const current = log({ programStart: "2026-11-01", programDays: 90 });
    const backup = log({ programStart: "2026-06-01", programDays: 30 });
    const merged = mergeBackup(current, backup);
    assert.equal(merged.programStart, "2026-11-01");
    assert.equal(merged.programDays, 90);
  });

  it("merging a backup of itself changes nothing", () => {
    const data = log({ oneLines: { "2026-11-02": "same" }, freezeDays: { "2026-11-03": true } });
    assert.deepEqual(mergeBackup(data, data), data);
  });
});
