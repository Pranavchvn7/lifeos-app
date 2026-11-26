import { amountDone, type Habit, type LifeData, type RunningTimer } from "./model";

/**
 * The timer (v2.3). Pure functions only: the store, the bar and the buttons all call these.
 *
 * A timed habit is a do-habit whose unit is minutes (e.g. "Study: min"). Stopping the timer adds the minutes to
 * that day's amount, through the same rule as typing a number. A task keeps its own tracked seconds.
 */

/** A single run can never count more than 12 hours, so a timer left running by mistake cannot add days. */
export const MAX_TIMER_SECONDS = 12 * 60 * 60;

const MINUTE_UNIT = /^min(ute)?s?$/i;

/** A do-habit that can be timed: it has an amount, and the unit is minutes. */
export function isTimedHabit(habit: Habit): boolean {
  return !!habit.amount && MINUTE_UNIT.test(habit.amount.unit.trim());
}

/** Seconds on the timer now. A clock that runs backwards counts as zero, never negative. */
export function timerSeconds(timer: RunningTimer, nowMs: number): number {
  const running = timer.startedAt ? Math.max(0, (nowMs - Date.parse(timer.startedAt)) / 1000) : 0;
  return Math.min(MAX_TIMER_SECONDS, Math.max(0, timer.bankedSeconds) + running);
}

export function newTimer(kind: RunningTimer["kind"], id: string, date: string, nowMs: number): RunningTimer {
  return { kind, id, date: kind === "habit" ? date : "", bankedSeconds: 0, startedAt: new Date(nowMs).toISOString() };
}

/** Stop counting but keep the time so far. */
export function pauseTimer(timer: RunningTimer, nowMs: number): RunningTimer {
  if (!timer.startedAt) return timer;
  return { ...timer, bankedSeconds: timerSeconds(timer, nowMs), startedAt: null };
}

/** Carry on counting from where the pause left off. */
export function resumeTimer(timer: RunningTimer, nowMs: number): RunningTimer {
  if (timer.startedAt) return timer;
  return { ...timer, startedAt: new Date(nowMs).toISOString() };
}

/** 0:42 under an hour, 1:02:09 from an hour up. */
export function formatClock(seconds: number): string {
  const total = Math.floor(Math.max(0, seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Stop the timer and put its time where it belongs. Returns the LifeData fields to change.
 * Under one second is discarded. A habit that is gone or no longer timed discards it too.
 */
export function commitTimer(data: LifeData, nowMs: number): Partial<LifeData> {
  const timer = data.timer;
  if (!timer) return {};
  const seconds = timerSeconds(timer, nowMs);
  if (seconds < 1) return { timer: null };

  if (timer.kind === "task") {
    const todos = data.todos.map((todo) =>
      todo.id === timer.id ? { ...todo, trackedSeconds: (todo.trackedSeconds ?? 0) + Math.round(seconds) } : todo,
    );
    return { timer: null, todos };
  }

  const habit = data.dos.find((h) => h.id === timer.id);
  if (!habit?.amount || !isTimedHabit(habit)) return { timer: null };
  const day = data.doChecks[timer.date] ?? {};
  const prev = day[timer.id] ?? { done: false, notes: "" };
  const value = Math.min(1_000_000, Math.round(((prev.value ?? 0) + seconds / 60) * 100) / 100);
  const next = { ...prev, value, done: amountDone(habit.amount, value) };
  return { timer: null, doChecks: { ...data.doChecks, [timer.date]: { ...day, [timer.id]: next } } };
}
