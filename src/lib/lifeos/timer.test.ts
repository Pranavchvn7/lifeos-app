import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBlank, type Habit, type LifeData, type RunningTimer, type Todo } from "./model";
import {
  commitTimer,
  formatClock,
  isTimedHabit,
  MAX_TIMER_SECONDS,
  newTimer,
  pauseTimer,
  resumeTimer,
  timerSeconds,
} from "./timer";

const T0 = Date.parse("2026-11-26T10:00:00.000Z");
const at = (seconds: number) => T0 + seconds * 1000;
const DAY = "2026-11-26";

const study: Habit = { id: "study", label: "Study", since: "2026-11-01", amount: { unit: "min", target: 30 } };
const pages: Habit = { id: "pages", label: "Read", since: "2026-11-01", amount: { unit: "pages" } };

function timerOf(overrides: Partial<RunningTimer> = {}): RunningTimer {
  return { kind: "habit", id: "study", date: DAY, bankedSeconds: 0, startedAt: new Date(T0).toISOString(), ...overrides };
}

function dataWith(overrides: Partial<LifeData> = {}): LifeData {
  return { ...createBlank("2026-11-01"), dos: [study, pages], ...overrides };
}

describe("timed habits", () => {
  it("a minutes unit can be timed; other units and plain habits cannot", () => {
    assert.equal(isTimedHabit(study), true);
    assert.equal(isTimedHabit({ ...study, amount: { unit: "Minutes" } }), true);
    assert.equal(isTimedHabit({ ...study, amount: { unit: "mins" } }), true);
    assert.equal(isTimedHabit(pages), false);
    assert.equal(isTimedHabit({ id: "x", label: "Walk" }), false);
  });
});

describe("elapsed time", () => {
  it("counts from the start while running", () => {
    assert.equal(timerSeconds(timerOf(), at(90)), 90);
  });

  it("stops counting while paused, and carries on from the pause on resume", () => {
    const paused = pauseTimer(timerOf(), at(60));
    assert.equal(paused.startedAt, null);
    assert.equal(timerSeconds(paused, at(600)), 60); // paused: no time added
    const running = resumeTimer(paused, at(600));
    assert.equal(timerSeconds(running, at(630)), 90); // 60 banked + 30 running
  });

  it("a clock that runs backwards counts as zero, never negative", () => {
    assert.equal(timerSeconds(timerOf(), at(-100)), 0);
  });

  it("one run is capped at 12 hours", () => {
    assert.equal(timerSeconds(timerOf(), at(10 * MAX_TIMER_SECONDS)), MAX_TIMER_SECONDS);
  });

  it("pausing or resuming twice changes nothing", () => {
    const timer = timerOf();
    assert.equal(pauseTimer(pauseTimer(timer, at(10)), at(20)).bankedSeconds, 10);
    assert.equal(resumeTimer(timer, at(5)), timer);
  });

  it("a new task timer does not count minutes toward a day", () => {
    assert.equal(newTimer("task", "t1", DAY, T0).date, "");
    assert.equal(newTimer("habit", "study", DAY, T0).date, DAY);
  });
});

describe("clock display", () => {
  it("shows minutes and seconds, adding hours from one hour up", () => {
    assert.equal(formatClock(0), "0:00");
    assert.equal(formatClock(42), "0:42");
    assert.equal(formatClock(3729), "1:02:09");
    assert.equal(formatClock(-5), "0:00");
  });
});

describe("stopping the timer", () => {
  it("adds the minutes to a timed habit's day, and marks it done at the target", () => {
    const data = dataWith({ timer: timerOf() });
    const patch = commitTimer(data, at(15 * 60));
    assert.equal(patch.timer, null);
    assert.equal(patch.doChecks?.[DAY]?.study?.value, 15);
    assert.equal(patch.doChecks?.[DAY]?.study?.done, false);

    const full = commitTimer(dataWith({ timer: timerOf() }), at(30 * 60));
    assert.equal(full.doChecks?.[DAY]?.study?.done, true);
  });

  it("adds to what the day already holds", () => {
    const data = dataWith({
      timer: timerOf(),
      doChecks: { [DAY]: { study: { done: false, notes: "morning", value: 10 } } },
    });
    const patch = commitTimer(data, at(5 * 60));
    assert.equal(patch.doChecks?.[DAY]?.study?.value, 15);
    assert.equal(patch.doChecks?.[DAY]?.study?.notes, "morning");
  });

  it("adds tracked seconds to a task", () => {
    const todo: Todo = { id: "t1", title: "Essay", done: false, priority: "medium", due: "", notes: "", created: DAY, doneOn: "" };
    const data = dataWith({ todos: [todo], timer: newTimer("task", "t1", "", T0) });
    const patch = commitTimer(data, at(120));
    assert.equal(patch.todos?.[0]?.trackedSeconds, 120);
    assert.equal(patch.timer, null);
  });

  it("under a second is discarded, and nothing else changes", () => {
    const patch = commitTimer(dataWith({ timer: timerOf() }), at(0.4));
    assert.deepEqual(patch, { timer: null });
  });

  it("a habit that is no longer timed discards the time", () => {
    const patch = commitTimer(dataWith({ timer: timerOf({ id: "pages" }) }), at(600));
    assert.deepEqual(patch, { timer: null });
  });

  it("does nothing with no timer", () => {
    assert.deepEqual(commitTimer(dataWith(), at(600)), {});
  });
});
