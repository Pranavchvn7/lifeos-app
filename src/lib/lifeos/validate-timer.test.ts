import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBlank } from "./model";
import { parseLifeData, selectData } from "./validate";

const base = {
  ...createBlank("2026-11-01"),
  dos: [{ id: "study", label: "Study", amount: { unit: "min" } }],
  todos: [{ id: "t1", title: "Essay", done: false, priority: "medium", due: "", notes: "", created: "2026-11-26", doneOn: "" }],
};

describe("timer in the synced log", () => {
  it("keeps a valid habit timer", () => {
    const timer = { kind: "habit", id: "study", date: "2026-11-26", bankedSeconds: 60, startedAt: "2026-11-26T10:00:00.000Z" };
    assert.deepEqual(parseLifeData({ ...base, timer }).timer, timer);
  });

  it("keeps a paused task timer", () => {
    const timer = { kind: "task", id: "t1", date: "", bankedSeconds: 30, startedAt: null };
    assert.deepEqual(parseLifeData({ ...base, timer }).timer, timer);
  });

  it("drops a timer for a habit or task that no longer exists, instead of failing the log", () => {
    const gone = { kind: "habit", id: "nope", date: "2026-11-26", bankedSeconds: 0, startedAt: null };
    assert.equal(parseLifeData({ ...base, timer: gone }).timer, null);
    const goneTask = { kind: "task", id: "nope", date: "", bankedSeconds: 0, startedAt: null };
    assert.equal(parseLifeData({ ...base, timer: goneTask }).timer, null);
  });

  it("drops a damaged timer and caps absurd banked time", () => {
    assert.equal(parseLifeData({ ...base, timer: { kind: "habit", id: "study", date: "soon" } }).timer, null);
    assert.equal(parseLifeData({ ...base, timer: "yes" }).timer, null);
    const huge = { kind: "task", id: "t1", date: "", bankedSeconds: 1e12, startedAt: "not a date" };
    const parsed = parseLifeData({ ...base, timer: huge });
    assert.equal(parsed.timer?.startedAt, null);
    assert.equal(parsed.timer?.bankedSeconds, 12 * 60 * 60);
  });

  it("logs saved before v2.3 have no timer and still parse", () => {
    const { timer: _ignored, ...old } = createBlank("2026-11-01");
    assert.equal(parseLifeData(old).timer, null);
  });

  it("keeps tracked seconds on a task and drops zero", () => {
    const tracked = parseLifeData({ ...base, todos: [{ ...base.todos[0], trackedSeconds: 125.4 }] });
    assert.equal(tracked.todos[0]?.trackedSeconds, 125);
    const none = parseLifeData({ ...base, todos: [{ ...base.todos[0], trackedSeconds: 0 }] });
    assert.equal(none.todos[0]?.trackedSeconds, undefined);
  });

  it("the timer is part of what gets saved", () => {
    const state = parseLifeData({ ...base, timer: { kind: "task", id: "t1", date: "", bankedSeconds: 5, startedAt: null } });
    assert.equal(selectData(state).timer?.bankedSeconds, 5);
  });
});
