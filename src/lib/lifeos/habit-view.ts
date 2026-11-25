import { formatMonthDay, isScheduled, mondayOf, parseISODate, shiftDate, type Habit, type LifeData } from "./model";
import { earliestDate } from "./score";

/**
 * Per-habit history for the Habits tab and each habit's dashboard (v2.2).
 * Pure functions over LifeData: no state, no React.
 *
 * Streak rules match the Today screen and the Board: a done day extends the run, a missed day ends it,
 * and days that do not count (not scheduled, frozen, before the start date, today not logged yet, the future)
 * neither extend nor break it.
 */

export type HabitKind = "do" | "dont";
export type HabitRef = { kind: HabitKind; habit: Habit };

/**
 * done    - the habit was kept (ticked, target reached, or "Avoided")
 * missed  - it applied and was not kept (a past day with nothing done, or "Gave In")
 * open    - it applies today and is not logged yet
 * off     - not scheduled on this weekday
 * frozen  - a streak freeze protects this day
 * before  - before the habit's start date
 * future  - after today
 */
export type DayState = "done" | "missed" | "open" | "off" | "frozen" | "before" | "future";

export type DayRecord = {
  date: string;
  state: DayState;
  /** Logged amount for an amount habit (0 when nothing is logged). */
  value: number;
  notes: string;
  /** Don'ts only: "Avoided", "Gave In" or "" (not yet marked). */
  status: "Avoided" | "Gave In" | "";
};

export type HabitStats = {
  /** Kept days (done) for a tick or don't; total amount for an amount habit. */
  total: number;
  /** Days the habit applied and has passed (done + missed). */
  countable: number;
  /** Share of countable days kept, 0–1. */
  completion: number;
  /** Amount habits: average amount per countable day. Other habits: same as completion. */
  average: number;
  current: number;
  best: number;
};

export type WeekBucket = {
  start: string;
  end: string;
  /** Short label for charts, e.g. "16 Nov". */
  label: string;
  hits: number;
  countable: number;
  amount: number;
  completion: number;
};

export type MonthBar = { date: string; day: number; state: DayState; value: number };

export type StreakPoint = { date: string; streak: number };

const COUNTABLE: ReadonlySet<DayState> = new Set(["done", "missed"]);

export function findHabit(data: LifeData, id: string): HabitRef | null {
  const dos = data.dos.find((habit) => habit.id === id);
  if (dos) return { kind: "do", habit: dos };
  const dont = data.donts.find((habit) => habit.id === id);
  return dont ? { kind: "dont", habit: dont } : null;
}

/** First day the habit counts: its start date, or for habits made before v2.1 the first day anything was logged. */
export function habitStart(data: LifeData, habit: Habit): string {
  return habit.since ?? earliestDate(data);
}

export function dayRecord(data: LifeData, ref: HabitRef, date: string, today: string): DayRecord {
  const { kind, habit } = ref;
  const doDay = kind === "do" ? data.doChecks[date]?.[habit.id] : undefined;
  const dontDay = kind === "dont" ? data.dontChecks[date]?.[habit.id] : undefined;
  const value = doDay?.value ?? 0;
  const notes = (kind === "do" ? doDay?.notes : dontDay?.notes) ?? "";
  const status = dontDay?.status ?? "";

  let state: DayState;
  if (date > today) state = "future";
  else if (habit.since && date < habit.since) state = "before";
  else if (data.freezeDays[date] === true) state = "frozen";
  else if (!isScheduled(habit, date)) state = "off";
  else if (kind === "do" ? doDay?.done === true : status === "Avoided") state = "done";
  else if (kind === "dont" && status === "Gave In") state = "missed";
  else state = date === today ? "open" : "missed";

  return { date, state, value, notes, status: kind === "dont" ? status : "" };
}

/** Records from the habit's start (or `from`, if later) up to today, oldest first. */
export function dayStates(data: LifeData, ref: HabitRef, today: string, from?: string): DayRecord[] {
  const start = from ?? habitStart(data, ref.habit);
  const records: DayRecord[] = [];
  if (start > today) return records;
  for (let date = start, guard = 0; date <= today && guard < 4000; date = shiftDate(date, 1), guard += 1) {
    records.push(dayRecord(data, ref, date, today));
  }
  return records;
}

/** Current and best streak. Done extends, missed breaks, every other state is neutral. */
export function streakFrom(records: DayRecord[]): { current: number; best: number } {
  let run = 0;
  let best = 0;
  for (const record of records) {
    if (record.state === "done") run += 1;
    else if (record.state === "missed") run = 0;
    best = Math.max(best, run);
  }
  return { current: run, best };
}

/** Running streak after each day (for the streak history chart). */
export function streakSeries(records: DayRecord[]): StreakPoint[] {
  let run = 0;
  return records.map((record) => {
    if (record.state === "done") run += 1;
    else if (record.state === "missed") run = 0;
    return { date: record.date, streak: run };
  });
}

export function habitStats(data: LifeData, ref: HabitRef, today: string): HabitStats {
  const records = dayStates(data, ref, today);
  const countableDays = records.filter((record) => COUNTABLE.has(record.state));
  const kept = records.filter((record) => record.state === "done").length;
  const isAmount = ref.kind === "do" && !!ref.habit.amount;
  const totalAmount = isAmount ? records.reduce((sum, record) => sum + record.value, 0) : 0;
  const completion = countableDays.length ? kept / countableDays.length : 0;
  const { current, best } = streakFrom(records);
  return {
    total: isAmount ? totalAmount : kept,
    countable: countableDays.length,
    completion,
    average: isAmount ? (countableDays.length ? totalAmount / countableDays.length : 0) : completion,
    current,
    best,
  };
}

/** Last `count` weeks (Monday first), oldest first, ending with the week of `today`. */
export function weeklyBuckets(data: LifeData, ref: HabitRef, today: string, weeks = 12): WeekBucket[] {
  const thisMonday = mondayOf(today);
  const buckets: WeekBucket[] = [];
  for (let back = weeks - 1; back >= 0; back -= 1) {
    const start = shiftDate(thisMonday, -7 * back);
    const end = shiftDate(start, 6);
    let hits = 0;
    let countable = 0;
    let amount = 0;
    for (let date = start; date <= end; date = shiftDate(date, 1)) {
      const record = dayRecord(data, ref, date, today);
      if (record.state === "done") hits += 1;
      if (COUNTABLE.has(record.state)) countable += 1;
      amount += record.value;
    }
    buckets.push({
      start,
      end,
      label: formatMonthDay(start),
      hits,
      countable,
      amount,
      completion: countable ? hits / countable : 0,
    });
  }
  return buckets;
}

/** One bar per day of a month (YYYY-MM): the logged amount for amount habits, otherwise 1 for kept, 0 otherwise. */
export function monthBars(data: LifeData, ref: HabitRef, month: string, today: string): MonthBar[] {
  const days = daysInMonth(month);
  const bars: MonthBar[] = [];
  for (let day = 1; day <= days; day += 1) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const record = dayRecord(data, ref, date, today);
    const isAmount = ref.kind === "do" && !!ref.habit.amount;
    bars.push({ date, day, state: record.state, value: isAmount ? record.value : record.state === "done" ? 1 : 0 });
  }
  return bars;
}

/** Monday-first weeks of a month (YYYY-MM); null pads the first and last week. */
export function monthGrid(month: string): (string | null)[][] {
  const days = daysInMonth(month);
  const first = parseISODate(`${month}-01`);
  const lead = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = [...Array<null>(lead).fill(null)];
  for (let day = 1; day <= days; day += 1) cells.push(`${month}-${String(day).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** The last seven days ending today (oldest first), for the list strip. */
export function lastDays(data: LifeData, ref: HabitRef, today: string, count = 7): DayRecord[] {
  const days: DayRecord[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    days.push(dayRecord(data, ref, shiftDate(today, -back), today));
  }
  return days;
}

/** Month key (YYYY-MM) shifted by whole months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y as number, (m as number) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y as number, m as number, 0).getDate();
}

