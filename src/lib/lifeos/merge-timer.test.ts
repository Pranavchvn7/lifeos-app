import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBlank, type LifeData, type RunningTimer } from "./model";
import { mergeLifeData } from "./merge";

const running: RunningTimer = { kind: "habit", id: "study", date: "2026-11-26", bankedSeconds: 0, startedAt: "2026-11-26T10:00:00.000Z" };
const paused: RunningTimer = { ...running, bankedSeconds: 600, startedAt: null };

function withTimer(timer: RunningTimer | null): LifeData {
  return { ...createBlank("2026-11-01"), timer };
}

describe("timer across two devices", () => {
  it("a timer started on one device appears on the other", () => {
    const merged = mergeLifeData(withTimer(null), withTimer(null), withTimer(running));
    assert.deepEqual(merged.timer, running);
  });

  it("a timer stopped on this device stays stopped, even if the other device did not change it", () => {
    const merged = mergeLifeData(withTimer(running), withTimer(null), withTimer(running));
    assert.equal(merged.timer, null);
  });

  it("the other device stopping it wins when this device did not touch the timer", () => {
    const merged = mergeLifeData(withTimer(running), withTimer(running), withTimer(null));
    assert.equal(merged.timer, null);
  });

  it("paused on one device, still running on the other: this device's pause is kept", () => {
    const merged = mergeLifeData(withTimer(running), withTimer(paused), withTimer(running));
    assert.equal(merged.timer?.startedAt, null);
    assert.equal(merged.timer?.bankedSeconds, 600);
  });
});
