import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkFreeze, freezeBlockOf, freezeBlockRange, freezesLeft, programDayIndex } from "./freeze.ts";

const START = "2026-09-23";
const base = { freezeDays: {}, programStart: START, programDays: 90, today: "2026-11-23", needed: true };

describe("program day numbering", () => {
  it("counts days from the start, across month ends", () => {
    assert.equal(programDayIndex(START, "2026-09-23"), 0);
    assert.equal(programDayIndex(START, "2026-10-01"), 8);
    assert.equal(programDayIndex(START, "2026-12-22"), 90);
  });
  it("splits the program into 30-day blocks", () => {
    assert.equal(freezeBlockOf(START, "2026-09-23"), 0);
    assert.equal(freezeBlockOf(START, "2026-10-22"), 0); // day 30
    assert.equal(freezeBlockOf(START, "2026-10-23"), 1); // day 31
    assert.deepEqual(freezeBlockRange(START, "2026-11-23"), { from: 61, to: 90 });
  });
});

describe("freezesLeft", () => {
  it("allows 2 per block and counts only the same block", () => {
    const frozen = { "2026-09-25": true, "2026-10-30": true };
    assert.equal(freezesLeft(frozen, START, "2026-09-30"), 1); // block 0 has one used
    assert.equal(freezesLeft(frozen, START, "2026-11-02"), 1); // block 1 has one used
    assert.equal(freezesLeft(frozen, START, "2026-11-23"), 2); // block 2 untouched
  });
  it("ignores entries set to false and does not count the day itself", () => {
    const frozen = { "2026-09-25": true, "2026-09-26": true, "2026-09-27": false };
    assert.equal(freezesLeft(frozen, START, "2026-09-28"), 0);
    assert.equal(freezesLeft(frozen, START, "2026-09-25"), 1); // un-freezing it would give one back
  });
});

describe("checkFreeze", () => {
  it("allows a missed day in the program", () => {
    assert.deepEqual(checkFreeze({ ...base, date: "2026-11-22" }), { ok: true, left: 2 });
  });
  it("allows today but not a future day", () => {
    assert.equal(checkFreeze({ ...base, date: "2026-11-23" }).ok, true);
    assert.deepEqual(checkFreeze({ ...base, date: "2026-11-24" }), { ok: false, reason: "future" });
  });
  it("refuses days outside the program", () => {
    assert.deepEqual(checkFreeze({ ...base, date: "2026-09-22" }), { ok: false, reason: "outside" });
    assert.deepEqual(checkFreeze({ ...base, programDays: 30, date: "2026-11-01" }), { ok: false, reason: "outside" });
  });
  it("refuses a day that does not need it (good day or nothing scheduled)", () => {
    assert.deepEqual(checkFreeze({ ...base, date: "2026-11-22", needed: false }), { ok: false, reason: "not-needed" });
  });
  it("refuses a third freeze in the same block", () => {
    const freezeDays = { "2026-11-10": true, "2026-11-12": true };
    assert.deepEqual(checkFreeze({ ...base, freezeDays, date: "2026-11-15" }), { ok: false, reason: "limit" });
    assert.equal(checkFreeze({ ...base, freezeDays, date: "2026-10-05" }).ok, true); // different block
  });
});
