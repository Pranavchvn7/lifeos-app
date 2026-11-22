import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SEND_WINDOW_MINUTES, decideReminders, isValidTimeZone, localParts, parseTime } from "./reminder-schedule";

const prefs = { enabled: true, time: "20:00", weekly: true, lastDaily: "", lastWeekly: "" };
const base = { prefs, parts: { date: "2026-11-23", minutes: 20 * 60 + 10 }, needsLog: true, reviewPending: false };

describe("localParts", () => {
  it("converts to the user's local date and time", () => {
    // 15:00 UTC is 20:30 in India (UTC+5:30, no daylight saving)
    assert.deepEqual(localParts(new Date("2026-11-23T15:00:00Z"), "Asia/Kolkata"), { date: "2026-11-23", minutes: 20 * 60 + 30 });
  });
  it("rolls the date over for zones ahead of or behind UTC", () => {
    assert.deepEqual(localParts(new Date("2026-11-23T20:00:00Z"), "Asia/Kolkata"), { date: "2026-11-24", minutes: 1 * 60 + 30 });
    assert.deepEqual(localParts(new Date("2026-11-23T03:00:00Z"), "America/Los_Angeles"), { date: "2026-11-22", minutes: 19 * 60 });
  });
  it("treats midnight as 00:00, not 24:00", () => {
    assert.deepEqual(localParts(new Date("2026-11-23T18:30:00Z"), "Asia/Kolkata"), { date: "2026-11-24", minutes: 0 });
  });
  it("returns null for an invalid zone", () => {
    assert.equal(localParts(new Date(), "Not/AZone"), null);
    assert.equal(isValidTimeZone(""), false);
    assert.equal(isValidTimeZone("x".repeat(80)), false);
    assert.equal(isValidTimeZone(5), false);
    assert.equal(isValidTimeZone("Europe/London"), true);
  });
});

describe("parseTime", () => {
  it("reads HH:MM and refuses nonsense", () => {
    assert.equal(parseTime("20:00"), 1200);
    assert.equal(parseTime("00:05"), 5);
    for (const bad of ["24:00", "12:60", "8:00", "20-00", "", "ab:cd"]) assert.equal(parseTime(bad), null, bad);
  });
});

describe("decideReminders", () => {
  it("sends the daily reminder after the chosen time when nothing is logged", () => {
    assert.deepEqual(decideReminders(base), ["daily"]);
  });
  it("waits until the chosen time", () => {
    assert.deepEqual(decideReminders({ ...base, parts: { date: "2026-11-23", minutes: 19 * 60 + 59 } }), []);
    assert.deepEqual(decideReminders({ ...base, parts: { date: "2026-11-23", minutes: 20 * 60 } }), ["daily"]);
  });
  it("does not send a stale reminder after the window", () => {
    const late = { date: "2026-11-23", minutes: 20 * 60 + SEND_WINDOW_MINUTES };
    assert.deepEqual(decideReminders({ ...base, parts: late }), []);
    assert.deepEqual(decideReminders({ ...base, parts: { ...late, minutes: late.minutes - 1 } }), ["daily"]);
  });
  it("sends once per day", () => {
    assert.deepEqual(decideReminders({ ...base, prefs: { ...prefs, lastDaily: "2026-11-23" } }), []);
    assert.deepEqual(decideReminders({ ...base, prefs: { ...prefs, lastDaily: "2026-11-22" } }), ["daily"]);
  });
  it("skips the daily reminder when the day is already logged", () => {
    assert.deepEqual(decideReminders({ ...base, needsLog: false }), []);
  });
  it("does nothing when reminders are off", () => {
    assert.deepEqual(decideReminders({ ...base, prefs: { ...prefs, enabled: false } }), []);
  });
  it("adds the weekly review when it is pending and enabled", () => {
    assert.deepEqual(decideReminders({ ...base, reviewPending: true }), ["daily", "weekly"]);
    assert.deepEqual(decideReminders({ ...base, needsLog: false, reviewPending: true }), ["weekly"]);
    assert.deepEqual(decideReminders({ ...base, reviewPending: true, prefs: { ...prefs, weekly: false } }), ["daily"]);
    assert.deepEqual(decideReminders({ ...base, needsLog: false, reviewPending: true, prefs: { ...prefs, lastWeekly: "2026-11-23" } }), []);
  });
  it("ignores an invalid saved time", () => {
    assert.deepEqual(decideReminders({ ...base, prefs: { ...prefs, time: "25:99" } }), []);
  });
});
