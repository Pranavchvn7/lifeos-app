import type { Todo } from "./model";

/** How a recurring to-do repeats. A task without a repeat is a one-off. */
export const TODO_REPEATS = ["daily", "weekdays", "weekly", "monthly"] as const;
export type Repeat = (typeof TODO_REPEATS)[number];

export const REPEAT_LABEL: Record<Repeat, string> = {
  daily: "Every day",
  weekdays: "Weekdays",
  weekly: "Every week",
  monthly: "Every month",
};

/** Keep this module free of imports so it can be unit-tested directly (dates are plain YYYY-MM-DD strings). */
function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y as number, (m ?? 1) - 1, d ?? 1);
}

function format(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The first occurrence strictly after `fromISO`. Monthly keeps the day of the month, clamped to the month's end. */
export function nextDue(repeat: Repeat, fromISO: string): string {
  const from = parse(fromISO);
  if (repeat === "monthly") {
    const target = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(from.getDate(), lastDay));
    return format(target);
  }
  const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + (repeat === "weekly" ? 7 : 1));
  if (repeat === "weekdays") {
    while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
  }
  return format(next);
}

const MAX_TODOS = 500;

/**
 * Complete or reopen a to-do.
 *  - Completing a recurring task keeps it in the Completed list and adds the next occurrence. The next due date is
 *    the first occurrence after the LATER of "its due date" and "today", so finishing an overdue daily task today
 *    schedules tomorrow's, not a second one for today.
 *  - Reopening a task removes the occurrence it created, if that one is still untouched and open.
 */
export function toggleTodoList(todos: Todo[], id: string, today: string, newId: () => string): Todo[] {
  const target = todos.find((t) => t.id === id);
  if (!target) return todos;

  if (target.done) {
    const { spawned, ...rest } = target;
    const reopened: Todo = { ...rest, done: false, doneOn: "" };
    return todos
      .filter((t) => !(spawned && t.id === spawned && !t.done))
      .map((t) => (t.id === id ? reopened : t));
  }

  const completed: Todo = { ...target, done: true, doneOn: today };
  if (!target.repeat || todos.length >= MAX_TODOS) {
    return todos.map((t) => (t.id === id ? completed : t));
  }
  const from = target.due && target.due > today ? target.due : today;
  const next: Todo = {
    id: newId(),
    title: target.title,
    done: false,
    priority: target.priority,
    due: nextDue(target.repeat, from),
    notes: target.notes,
    created: today,
    doneOn: "",
    repeat: target.repeat,
  };
  completed.spawned = next.id;
  return [...todos.map((t) => (t.id === id ? completed : t)), next];
}
