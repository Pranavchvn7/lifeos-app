/**
 * Streak freezes. A frozen day behaves like a rest day: it does not break a streak and is left out of averages.
 * You get FREEZES_PER_BLOCK freezes in each 30-day block of the program (days 1-30, 31-60, ...), so they cannot all
 * be spent at once. This module has no imports so it can be unit-tested directly; dates are YYYY-MM-DD strings.
 */
export const FREEZES_PER_BLOCK = 2;
export const FREEZE_BLOCK_DAYS = 30;

/** 0 for the program's first day, 1 for the next, ... (negative before the start). */
export function programDayIndex(programStart: string, date: string): number {
  const [y1, m1, d1] = programStart.split("-").map(Number);
  const [y2, m2, d2] = date.split("-").map(Number);
  const a = Date.UTC(y1 as number, (m1 ?? 1) - 1, d1 ?? 1);
  const b = Date.UTC(y2 as number, (m2 ?? 1) - 1, d2 ?? 1);
  return Math.round((b - a) / 86_400_000);
}

export function freezeBlockOf(programStart: string, date: string): number {
  return Math.floor(programDayIndex(programStart, date) / FREEZE_BLOCK_DAYS);
}

/** Program day numbers (1-based, inclusive) of the block that holds `date`, e.g. 31-60. */
export function freezeBlockRange(programStart: string, date: string): { from: number; to: number } {
  const block = freezeBlockOf(programStart, date);
  return { from: block * FREEZE_BLOCK_DAYS + 1, to: (block + 1) * FREEZE_BLOCK_DAYS };
}

/** Freezes still available in the block that holds `date` (not counting `date` itself if it is already frozen). */
export function freezesLeft(freezeDays: Record<string, boolean>, programStart: string, date: string): number {
  const block = freezeBlockOf(programStart, date);
  const used = Object.keys(freezeDays).filter(
    (d) => freezeDays[d] && d !== date && freezeBlockOf(programStart, d) === block,
  ).length;
  return Math.max(0, FREEZES_PER_BLOCK - used);
}

export type FreezeCheck =
  | { ok: true; left: number }
  | { ok: false; reason: "future" | "outside" | "not-needed" | "limit" };

export function checkFreeze(args: {
  freezeDays: Record<string, boolean>;
  programStart: string;
  programDays: number;
  date: string;
  today: string;
  /** The day has habits scheduled and is not a good day yet, so a freeze would actually protect something. */
  needed: boolean;
}): FreezeCheck {
  const { freezeDays, programStart, programDays, date, today, needed } = args;
  if (date > today) return { ok: false, reason: "future" };
  const index = programDayIndex(programStart, date);
  if (index < 0 || index >= programDays) return { ok: false, reason: "outside" };
  if (!needed) return { ok: false, reason: "not-needed" };
  const left = freezesLeft(freezeDays, programStart, date);
  if (left <= 0) return { ok: false, reason: "limit" };
  return { ok: true, left };
}
