import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextDue, toggleTodoList } from "./recurrence.ts";
import type { Todo } from "./model.ts";

const todo = (over: Partial<Todo> = {}): Todo => ({
  id: "t1",
  title: "Water plants",
  done: false,
  priority: "medium",
  due: "2026-11-23",
  notes: "",
  created: "2026-11-01",
  doneOn: "",
  ...over,
});
let n = 0;
const newId = () => `new${++n}`;

describe("nextDue", () => {
  it("daily and weekly add 1 and 7 days", () => {
    assert.equal(nextDue("daily", "2026-11-23"), "2026-11-24");
    assert.equal(nextDue("weekly", "2026-11-23"), "2026-11-30");
  });
  it("crosses month and year ends", () => {
    assert.equal(nextDue("daily", "2026-12-31"), "2027-01-01");
    assert.equal(nextDue("weekly", "2026-12-28"), "2027-01-04");
  });
  it("weekdays skip the weekend", () => {
    assert.equal(nextDue("weekdays", "2026-11-20"), "2026-11-23"); // Fri -> Mon
    assert.equal(nextDue("weekdays", "2026-11-21"), "2026-11-23"); // Sat -> Mon
    assert.equal(nextDue("weekdays", "2026-11-23"), "2026-11-24"); // Mon -> Tue
  });
  it("monthly keeps the day and clamps to the end of short months", () => {
    assert.equal(nextDue("monthly", "2026-11-15"), "2026-12-15");
    assert.equal(nextDue("monthly", "2026-12-15"), "2027-01-15");
    assert.equal(nextDue("monthly", "2027-01-31"), "2027-02-28");
    assert.equal(nextDue("monthly", "2028-01-31"), "2028-02-29"); // leap year
  });
});

describe("toggleTodoList", () => {
  it("completing a one-off task just completes it", () => {
    const out = toggleTodoList([todo()], "t1", "2026-11-23", newId);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.done, true);
    assert.equal(out[0]?.doneOn, "2026-11-23");
  });

  it("completing a daily task keeps it as done and adds tomorrow's", () => {
    const out = toggleTodoList([todo({ repeat: "daily" })], "t1", "2026-11-23", newId);
    assert.equal(out.length, 2);
    const next = out.find((t) => !t.done);
    assert.equal(next?.due, "2026-11-24");
    assert.equal(next?.repeat, "daily");
    assert.equal(next?.title, "Water plants");
    assert.equal(out.find((t) => t.done)?.spawned, next?.id);
  });

  it("finishing an overdue daily task today schedules tomorrow, not today again", () => {
    const out = toggleTodoList([todo({ repeat: "daily", due: "2026-11-20" })], "t1", "2026-11-23", newId);
    assert.equal(out.find((t) => !t.done)?.due, "2026-11-24");
  });

  it("finishing a task early schedules after its due date", () => {
    const out = toggleTodoList([todo({ repeat: "weekly", due: "2026-11-30" })], "t1", "2026-11-23", newId);
    assert.equal(out.find((t) => !t.done)?.due, "2026-12-07");
  });

  it("a recurring task with no due date repeats from today", () => {
    const out = toggleTodoList([todo({ repeat: "daily", due: "" })], "t1", "2026-11-23", newId);
    assert.equal(out.find((t) => !t.done)?.due, "2026-11-24");
  });

  it("reopening removes the untouched occurrence it created", () => {
    const done = toggleTodoList([todo({ repeat: "daily" })], "t1", "2026-11-23", newId);
    const reopened = toggleTodoList(done, "t1", "2026-11-23", newId);
    assert.equal(reopened.length, 1);
    assert.equal(reopened[0]?.done, false);
    assert.equal(reopened[0]?.doneOn, "");
    assert.equal(reopened[0]?.spawned, undefined);
  });

  it("reopening keeps the next occurrence if it was already completed", () => {
    let list = toggleTodoList([todo({ repeat: "daily" })], "t1", "2026-11-23", newId);
    const nextId = list.find((t) => !t.done)!.id;
    list = toggleTodoList(list, nextId, "2026-11-24", newId); // completes day 2, spawns day 3
    const reopened = toggleTodoList(list, "t1", "2026-11-24", newId);
    assert.ok(reopened.some((t) => t.id === nextId));
  });

  it("does not spawn past the 500 task limit", () => {
    const many = Array.from({ length: 500 }, (_, i) => todo({ id: `x${i}`, repeat: i === 0 ? "daily" : undefined }));
    const out = toggleTodoList(many, "x0", "2026-11-23", newId);
    assert.equal(out.length, 500);
    assert.equal(out[0]?.done, true);
  });

  it("ignores an unknown id", () => {
    const list = [todo()];
    assert.equal(toggleTodoList(list, "nope", "2026-11-23", newId), list);
  });
});
