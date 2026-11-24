import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { amountDone, createBlank, formatAmount, isScheduled } from "./model";
import { buildScores } from "./score";
import { useLife } from "./store";
import { parseLifeData, selectData } from "./validate";
import { buildExportSheets } from "./export";
import { draftToAmount } from "../../components/lifeos/amount-draft";

const TODAY = "2026-11-23";

function fresh() {
  useLife.getState().load("u1", createBlank("2026-11-16"));
  return useLife.getState();
}

describe("amount rules", () => {
  it("done means reaching the daily target, or anything above zero without a target", () => {
    assert.equal(amountDone({ unit: "pages", target: 30 }, 29), false);
    assert.equal(amountDone({ unit: "pages", target: 30 }, 30), true);
    assert.equal(amountDone({ unit: "pages" }, 0), false);
    assert.equal(amountDone({ unit: "pages" }, 0.5), true);
    assert.equal(amountDone(undefined, 1), true);
  });
  it("formats amounts without noise", () => {
    assert.equal(formatAmount(25), "25");
    assert.equal(formatAmount(2.5), "2.5");
    assert.equal(formatAmount(2.456), "2.46");
  });
  it("turns what was typed into an amount", () => {
    assert.deepEqual(draftToAmount({ enabled: true, unit: " pages ", target: "30" }), { unit: "pages", target: 30 });
    assert.deepEqual(draftToAmount({ enabled: true, unit: "glasses", target: "" }), { unit: "glasses" });
    assert.equal(draftToAmount({ enabled: true, unit: "  ", target: "5" }), null);
    assert.equal(draftToAmount({ enabled: false, unit: "pages", target: "5" }), null);
    assert.deepEqual(draftToAmount({ enabled: true, unit: "km", target: "0" }), { unit: "km" });
  });
});

describe("start dates", () => {
  it("a habit does not apply before its start date, old habits always apply", () => {
    assert.equal(isScheduled({ id: "a", label: "x", since: "2026-11-20" }, "2026-11-19"), false);
    assert.equal(isScheduled({ id: "a", label: "x", since: "2026-11-20" }, "2026-11-20"), true);
    assert.equal(isScheduled({ id: "a", label: "x" }, "2020-01-01"), true);
  });
  it("a new habit never makes earlier days look missed", () => {
    const s = fresh();
    s.addHabit("dos", "Old habit");
    const old = useLife.getState().dos[0]!;
    useLife.setState({ dos: [{ id: old.id, label: old.label }] }); // as if it was made before v2.1 (no start date)
    s.addHabit("dos", "New habit", { since: "2026-11-23" });
    const data = selectData(useLife.getState());
    data.doChecks["2026-11-20"] = { [old.id]: { done: true, notes: "" } };
    const day = buildScores(data, TODAY).find((d) => d.date === "2026-11-20")!;
    assert.equal(day.dosTotal, 1); // only the old habit counted that day
    assert.equal(day.dosPct, 1);
  });
  it("addHabit starts counting today by default", () => {
    const s = fresh();
    s.addHabit("donts", "Sugar");
    assert.equal(useLife.getState().donts[0]?.since, todayISOForTest());
  });
});

function todayISOForTest(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("logging an amount", () => {
  it("typing a value sets done from the target and keeps the number", () => {
    const s = fresh();
    s.addHabit("dos", "Read", { amount: { unit: "pages", target: 30 }, since: "2026-11-16" });
    const id = useLife.getState().dos[0]!.id;
    s.setDoValue(TODAY, id, 12);
    assert.deepEqual(useLife.getState().doChecks[TODAY]?.[id], { done: false, notes: "", value: 12 });
    s.setDoValue(TODAY, id, 30);
    assert.equal(useLife.getState().doChecks[TODAY]?.[id]?.done, true);
    s.setDoValue(TODAY, id, 45.678);
    assert.equal(useLife.getState().doChecks[TODAY]?.[id]?.value, 45.68);
  });
  it("refuses nonsense values", () => {
    const s = fresh();
    s.addHabit("dos", "Read", { amount: { unit: "pages", target: 30 } });
    const id = useLife.getState().dos[0]!.id;
    s.setDoValue(TODAY, id, Number.NaN);
    s.setDoValue(TODAY, id, -5);
    s.setDoValue(TODAY, id, 9e12);
    assert.equal(useLife.getState().doChecks[TODAY]?.[id]?.value, 1_000_000);
  });
  it("ticking an amount habit fills the target, un-ticking clears it", () => {
    const s = fresh();
    s.addHabit("dos", "Read", { amount: { unit: "pages", target: 30 } });
    const id = useLife.getState().dos[0]!.id;
    s.toggleDo(TODAY, id);
    assert.deepEqual(useLife.getState().doChecks[TODAY]?.[id], { done: true, notes: "", value: 30 });
    s.toggleDo(TODAY, id);
    assert.deepEqual(useLife.getState().doChecks[TODAY]?.[id], { done: false, notes: "", value: 0 });
  });
  it("ticking keeps a larger amount that was already typed", () => {
    const s = fresh();
    s.addHabit("dos", "Read", { amount: { unit: "pages", target: 30 } });
    const id = useLife.getState().dos[0]!.id;
    s.setDoValue(TODAY, id, 12);
    s.toggleDo(TODAY, id);
    assert.equal(useLife.getState().doChecks[TODAY]?.[id]?.value, 30);
  });
  it("a plain habit still just toggles", () => {
    const s = fresh();
    s.addHabit("dos", "Walk");
    const id = useLife.getState().dos[0]!.id;
    s.toggleDo(TODAY, id);
    assert.deepEqual(useLife.getState().doChecks[TODAY]?.[id], { done: true, notes: "" });
  });
  it("can turn a habit into an amount habit and back", () => {
    const s = fresh();
    s.addHabit("dos", "Water");
    const id = useLife.getState().dos[0]!.id;
    s.setHabitAmount(id, { unit: "glasses", target: 8 });
    assert.deepEqual(useLife.getState().dos[0]?.amount, { unit: "glasses", target: 8 });
    s.setHabitAmount(id, { unit: "litres" });
    assert.deepEqual(useLife.getState().dos[0]?.amount, { unit: "litres" });
    s.setHabitAmount(id, null);
    assert.equal(useLife.getState().dos[0]?.amount, undefined);
  });
  it("don'ts cannot be amount habits", () => {
    const s = fresh();
    s.addHabit("donts", "Sugar", { amount: { unit: "g" } });
    assert.equal(useLife.getState().donts[0]?.amount, undefined);
  });
});

describe("saving and restoring", () => {
  it("amounts, values and start dates survive validation", () => {
    const s = fresh();
    s.addHabit("dos", "Read", { amount: { unit: "pages", target: 30 }, since: "2026-11-10" });
    const id = useLife.getState().dos[0]!.id;
    s.setDoValue(TODAY, id, 12);
    const round = parseLifeData(JSON.parse(JSON.stringify(selectData(useLife.getState()))));
    assert.deepEqual(round.dos[0]?.amount, { unit: "pages", target: 30 });
    assert.equal(round.dos[0]?.since, "2026-11-10");
    assert.equal(round.doChecks[TODAY]?.[id]?.value, 12);
  });
  it("junk is dropped, old data without the new fields still loads", () => {
    const base = createBlank("2026-11-16");
    const bad = parseLifeData({
      ...base,
      dos: [{ id: "a", label: "Read", amount: { unit: "", target: -3 }, since: "yesterday" }, { id: "b", label: "Run", amount: { unit: "km", target: "x" } }],
      donts: [{ id: "c", label: "Sugar", amount: { unit: "g", target: 5 } }],
      doChecks: { [TODAY]: { a: { done: false, notes: "", value: -4 }, b: { done: true, notes: "", value: "lots" } } },
    });
    assert.equal(bad.dos[0]?.amount, undefined);
    assert.equal(bad.dos[0]?.since, undefined);
    assert.deepEqual(bad.dos[1]?.amount, { unit: "km" });
    assert.equal(bad.donts[0]?.amount, undefined);
    assert.equal(bad.doChecks[TODAY]?.a?.value, undefined);
    assert.equal(bad.doChecks[TODAY]?.b?.value, undefined);
    assert.ok(parseLifeData(JSON.parse(JSON.stringify(base))));
  });
  it("the export has the amount, unit and start date", () => {
    const s = fresh();
    s.addHabit("dos", "Read", { amount: { unit: "pages", target: 30 }, since: "2026-11-16" });
    const id = useLife.getState().dos[0]!.id;
    s.setDoValue(TODAY, id, 12);
    const sheets = buildExportSheets(selectData(useLife.getState()), TODAY);
    const log = sheets.find((sh) => sh.name === "Habit log")!;
    assert.deepEqual(log.rows[0], ["Date", "Type", "Habit", "Status", "Note", "Amount", "Unit"]);
    assert.ok(log.rows.some((r) => r[0] === TODAY && r[2] === "Read" && r[5] === 12 && r[6] === "pages"));
    const habits = sheets.find((sh) => sh.name === "Habits")!;
    assert.deepEqual(habits.rows[1], ["Do", "Read", "Every day", "pages", 30, "2026-11-16"]);
  });
});
