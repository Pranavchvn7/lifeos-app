import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeLifeData, sameData } from "./merge.ts";
import type { LifeData } from "./model.ts";

function blank(): LifeData {
  return {
    dos: [
      { id: "a", label: "Walk" },
      { id: "b", label: "Read" },
    ],
    donts: [{ id: "x", label: "Sugar" }],
    doChecks: {},
    dontChecks: {},
    journals: {},
    oneLines: {},
    goals: [],
    reflections: {},
    todos: [],
    weeklyReviews: {},
    programStart: "2026-09-23",
    programDays: 90,
    pastPrograms: [],
  };
}
const todo = (id: string, title: string) => ({
  id,
  title,
  done: false,
  priority: "medium" as const,
  due: "",
  notes: "",
  created: "2026-11-21",
  doneOn: "",
});
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("mergeLifeData", () => {
  it("takes the server copy when this device changed nothing", () => {
    const base = blank();
    const server = clone(base);
    server.oneLines["2026-11-21"] = "from laptop";
    assert.deepEqual(mergeLifeData(base, clone(base), server), server);
  });

  it("keeps this device's copy when the server did not change", () => {
    const base = blank();
    const local = clone(base);
    local.oneLines["2026-11-21"] = "from phone";
    assert.deepEqual(mergeLifeData(base, local, clone(base)), local);
  });

  it("keeps both when different habits were ticked on the same day", () => {
    const base = blank();
    const local = clone(base);
    local.doChecks["2026-11-21"] = { a: { done: true, notes: "" } };
    const server = clone(base);
    server.doChecks["2026-11-21"] = { b: { done: true, notes: "" } };
    const merged = mergeLifeData(base, local, server);
    assert.equal(merged.doChecks["2026-11-21"]?.a?.done, true);
    assert.equal(merged.doChecks["2026-11-21"]?.b?.done, true);
  });

  it("keeps different fields of the same journal entry", () => {
    const base = blank();
    base.journals["2026-11-21"] = { mood: null, grateful: "", win: "", reflection: "" };
    const local = clone(base);
    local.journals["2026-11-21"]!.win = "ran 5k";
    const server = clone(base);
    server.journals["2026-11-21"]!.mood = 4;
    const merged = mergeLifeData(base, local, server);
    assert.equal(merged.journals["2026-11-21"]?.win, "ran 5k");
    assert.equal(merged.journals["2026-11-21"]?.mood, 4);
  });

  it("this device wins when the same value was changed on both", () => {
    const base = blank();
    const local = clone(base);
    local.oneLines["2026-11-21"] = "phone";
    const server = clone(base);
    server.oneLines["2026-11-21"] = "laptop";
    assert.equal(mergeLifeData(base, local, server).oneLines["2026-11-21"], "phone");
  });

  it("keeps to-dos added on both devices", () => {
    const base = blank();
    const local = clone(base);
    local.todos.push(todo("t1", "Phone task"));
    const server = clone(base);
    server.todos.push(todo("t2", "Laptop task"));
    const merged = mergeLifeData(base, local, server);
    assert.deepEqual(merged.todos.map((t) => t.id).sort(), ["t1", "t2"]);
  });

  it("applies a delete when the other side did not touch the item", () => {
    const base = blank();
    base.todos.push(todo("t1", "Old"));
    const local = clone(base);
    local.todos = [];
    assert.deepEqual(mergeLifeData(base, local, clone(base)).todos, []);
  });

  it("keeps an item that was edited on one device and deleted on the other", () => {
    const base = blank();
    base.todos.push(todo("t1", "Old"));
    const local = clone(base);
    local.todos = [];
    const server = clone(base);
    server.todos[0]!.title = "Edited on laptop";
    const merged = mergeLifeData(base, local, server);
    assert.equal(merged.todos[0]?.title, "Edited on laptop");
  });

  it("merges habit renames with a new habit added elsewhere", () => {
    const base = blank();
    const local = clone(base);
    local.dos[0]!.label = "Long walk";
    const server = clone(base);
    server.dos.push({ id: "c", label: "Stretch" });
    const merged = mergeLifeData(base, local, server);
    assert.equal(merged.dos.find((h) => h.id === "a")?.label, "Long walk");
    assert.ok(merged.dos.some((h) => h.id === "c"));
  });
});

describe("sameData", () => {
  it("compares deeply and ignores key order", () => {
    assert.ok(sameData({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }));
    assert.ok(!sameData({ a: 1 }, { a: 2 }));
    assert.ok(!sameData([1, 2], [2, 1]));
  });
});
