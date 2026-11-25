import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBlank, type LifeData } from "./model";
import {
  dayRecord,
  dayStates,
  findHabit,
  habitStats,
  lastDays,
  monthBars,
  monthGrid,
  shiftMonth,
  streakFrom,
  streakSeries,
  weeklyBuckets,
  type HabitRef,
} from "./habit-view";

// 2026-11-23 is a Monday.
const TODAY = "2026-11-23";

function base(overrides: Partial<LifeData> = {}): LifeData {
  return {
    ...createBlank("2026-11-01"),
    dos: [{ id: "read", label: "Read", since: "2026-11-01" }],
    donts: [{ id: "sugar", label: "No sugar", since: "2026-11-01" }],
    ...overrides,
  };
}

const read: HabitRef = { kind: "do", habit: { id: "read", label: "Read", since: "2026-11-01" } };

describe("finding a habit", () => {
  it("finds do's and don'ts by id, and nothing for an unknown id", () => {
    const data = base();
    assert.equal(findHabit(data, "read")?.kind, "do");
    assert.equal(findHabit(data, "sugar")?.kind, "dont");
    assert.equal(findHabit(data, "nope"), null);
  });
});

describe("day states", () => {
  it("a logged tick is done; an unlogged past day is missed; today unlogged is open", () => {
    const data = base({ doChecks: { "2026-11-20": { read: { done: true, notes: "" } } } });
    assert.equal(dayRecord(data, read, "2026-11-20", TODAY).state, "done");
    assert.equal(dayRecord(data, read, "2026-11-19", TODAY).state, "missed");
    assert.equal(dayRecord(data, read, TODAY, TODAY).state, "open");
  });

  it("days before the start date, after today, frozen and off-schedule are not counted", () => {
    const habit = { id: "read", label: "Read", since: "2026-11-10", days: [1, 2, 3, 4, 5] };
    const ref: HabitRef = { kind: "do", habit };
    const data = base({ dos: [habit], freezeDays: { "2026-11-12": true } });
    assert.equal(dayRecord(data, ref, "2026-11-09", TODAY).state, "before");
    assert.equal(dayRecord(data, ref, "2026-11-12", TODAY).state, "frozen"); // Thursday, frozen
    assert.equal(dayRecord(data, ref, "2026-11-14", TODAY).state, "off"); // Saturday
    assert.equal(dayRecord(data, ref, "2026-11-24", TODAY).state, "future");
  });

  it("an amount habit counts as done at the daily target, and keeps the logged value", () => {
    const habit = { id: "pages", label: "Read", since: "2026-11-01", amount: { unit: "pages", target: 25 } };
    const ref: HabitRef = { kind: "do", habit };
    const data = base({
      dos: [habit],
      doChecks: {
        "2026-11-20": { pages: { done: true, notes: "", value: 30 } },
        "2026-11-21": { pages: { done: false, notes: "", value: 10 } },
      },
    });
    assert.equal(dayRecord(data, ref, "2026-11-20", TODAY).state, "done");
    assert.equal(dayRecord(data, ref, "2026-11-20", TODAY).value, 30);
    assert.equal(dayRecord(data, ref, "2026-11-21", TODAY).state, "missed");
    assert.equal(dayRecord(data, ref, "2026-11-21", TODAY).value, 10);
  });

  it("a don't is done when avoided and missed when given in", () => {
    const ref: HabitRef = { kind: "dont", habit: { id: "sugar", label: "No sugar", since: "2026-11-01" } };
    const data = base({
      dontChecks: {
        "2026-11-20": { sugar: { status: "Avoided", notes: "" } },
        "2026-11-21": { sugar: { status: "Gave In", notes: "cake" } },
      },
    });
    assert.equal(dayRecord(data, ref, "2026-11-20", TODAY).state, "done");
    assert.equal(dayRecord(data, ref, "2026-11-21", TODAY).state, "missed");
    assert.equal(dayRecord(data, ref, "2026-11-21", TODAY).notes, "cake");
  });
});

describe("streaks and stats", () => {
  it("a missed day breaks the run; open, off and frozen days do not", () => {
    const data = base({
      doChecks: {
        "2026-11-17": { read: { done: true, notes: "" } },
        "2026-11-18": { read: { done: true, notes: "" } },
        "2026-11-19": { read: { done: true, notes: "" } },
        "2026-11-21": { read: { done: true, notes: "" } },
        "2026-11-22": { read: { done: true, notes: "" } },
      },
      freezeDays: { "2026-11-20": true },
    });
    const { current, best } = streakFrom(dayStates(data, read, TODAY, "2026-11-15"));
    assert.equal(best, 5); // 17,18,19 + frozen 20 + 21,22
    assert.equal(current, 5); // today is open (neutral), so the run through 22 is still live
  });

  it("stats: completion over countable days, and amount totals and averages", () => {
    const habit = { id: "pages", label: "Read", since: "2026-11-20", amount: { unit: "pages" } };
    const ref: HabitRef = { kind: "do", habit };
    const data = base({
      dos: [habit],
      doChecks: {
        "2026-11-20": { pages: { done: true, notes: "", value: 20 } },
        "2026-11-21": { pages: { done: true, notes: "", value: 10 } },
      },
    });
    const stats = habitStats(data, ref, TODAY);
    assert.equal(stats.total, 30); // sum of pages
    assert.equal(stats.countable, 3); // 20, 21 done and 22 missed; today (23) open
    assert.equal(stats.average, 10); // 30 pages over 3 countable days
    assert.equal(stats.best, 2);
  });

  it("tick stats: kept days and completion share", () => {
    const data = base({
      doChecks: {
        "2026-11-17": { read: { done: true, notes: "" } },
        "2026-11-18": { read: { done: true, notes: "" } },
      },
    });
    const stats = habitStats(data, read, TODAY);
    assert.equal(stats.total, 2);
    assert.equal(stats.countable, 22); // 1 Nov to 22 Nov (today open)
    assert.ok(Math.abs(stats.completion - 2 / 22) < 1e-9);
    assert.equal(stats.average, stats.completion);
  });
});

describe("chart series", () => {
  it("weekly buckets end with this week, Monday first, and sum the week", () => {
    const data = base({ doChecks: { "2026-11-17": { read: { done: true, notes: "" } } } });
    const weeks = weeklyBuckets(data, read, TODAY, 3);
    assert.equal(weeks.length, 3);
    assert.equal(weeks[2]?.start, "2026-11-23");
    assert.equal(weeks[1]?.start, "2026-11-16");
    assert.equal(weeks[1]?.hits, 1);
    assert.equal(weeks[1]?.countable, 7);
  });

  it("month bars give one bar per day with the amount for amount habits", () => {
    const habit = { id: "pages", label: "Read", since: "2026-11-01", amount: { unit: "pages" } };
    const ref: HabitRef = { kind: "do", habit };
    const data = base({ dos: [habit], doChecks: { "2026-11-05": { pages: { done: true, notes: "", value: 12 } } } });
    const bars = monthBars(data, ref, "2026-11", TODAY);
    assert.equal(bars.length, 30);
    assert.equal(bars[4]?.value, 12);
    assert.equal(bars[4]?.day, 5);
  });

  it("streak series runs day by day", () => {
    const data = base({
      doChecks: {
        "2026-11-20": { read: { done: true, notes: "" } },
        "2026-11-21": { read: { done: true, notes: "" } },
      },
    });
    const series = streakSeries(dayStates(data, read, TODAY, "2026-11-19"));
    assert.deepEqual(
      series.map((point) => point.streak),
      [0, 1, 2, 0, 0], // 19 missed (stays 0), 20, 21 done, 22 missed, 23 open
    );
  });

  it("last days strip ends today", () => {
    const days = lastDays(base(), read, TODAY);
    assert.equal(days.length, 7);
    assert.equal(days[6]?.date, TODAY);
    assert.equal(days[6]?.state, "open");
  });
});

describe("calendar helpers", () => {
  it("month grid is Monday first and pads the weeks", () => {
    const rows = monthGrid("2026-11");
    assert.ok(rows.every((row) => row.length === 7));
    // 1 Nov 2026 is a Sunday: Monday-first, that is the last column of the first row.
    assert.deepEqual(rows[0], [null, null, null, null, null, null, "2026-11-01"]);
    assert.equal(rows[rows.length - 1]?.[0], "2026-11-30"); // 30 Nov is a Monday, first column of the last row
  });

  it("shifts months across years", () => {
    assert.equal(shiftMonth("2026-12", 1), "2027-01");
    assert.equal(shiftMonth("2027-01", -1), "2026-12");
  });
});
