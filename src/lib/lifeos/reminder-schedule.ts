/**
 * Decides WHEN a scheduled reminder is due. No imports, so it can be unit-tested directly.
 * The scheduler runs every ~10 minutes; a reminder is sent once per local day, from the chosen time until
 * SEND_WINDOW_MINUTES later (so a long outage never produces a stale reminder late at night).
 */
export const SEND_WINDOW_MINUTES = 180;

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The local calendar date and minutes-since-midnight in a time zone, or null if the zone is not valid. */
export function localParts(now: Date, tz: string): { date: string; minutes: number } | null {
  if (!isValidTimeZone(tz)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: hour * 60 + Number(get("minute")) };
}

export function parseTime(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h < 24 && m < 60 ? h * 60 + m : null;
}

export type ReminderKind = "daily" | "weekly";

export function decideReminders(input: {
  prefs: { enabled: boolean; time: string; weekly: boolean; lastDaily: string; lastWeekly: string };
  parts: { date: string; minutes: number };
  /** Today is in the program, habits exist, and nothing is logged yet. */
  needsLog: boolean;
  /** A weekly review is pending (Sunday, or Monday catch-up). */
  reviewPending: boolean;
}): ReminderKind[] {
  const { prefs, parts, needsLog, reviewPending } = input;
  if (!prefs.enabled) return [];
  const at = parseTime(prefs.time);
  if (at === null) return [];
  if (parts.minutes < at || parts.minutes >= at + SEND_WINDOW_MINUTES) return [];
  const kinds: ReminderKind[] = [];
  if (needsLog && prefs.lastDaily !== parts.date) kinds.push("daily");
  if (prefs.weekly && reviewPending && prefs.lastWeekly !== parts.date) kinds.push("weekly");
  return kinds;
}
