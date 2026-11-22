import { createBlank, type LifeData } from "./model";
import { mergeLifeData } from "./merge";
import { parseLifeData } from "./validate";

/** Largest backup file the app will even try to read (a year of daily use is well under 1 MB). */
export const BACKUP_MAX_BYTES = 5_000_000;

export type BackupMeta = { exportedAt: string | null; appVersion: string | null };

export type BackupResult = { ok: true; data: LifeData; meta: BackupMeta } | { ok: false; error: string };

/**
 * The backup file is the log itself plus a few labels. Keeping `version: 1` and the flat shape means files made by
 * older releases (which had no labels) still restore, and files made now still open in older ones.
 */
export function buildBackup(data: LifeData, appVersion: string, now: Date): string {
  return JSON.stringify({ app: "LifeOS", version: 1, appVersion, exportedAt: now.toISOString(), ...data }, null, 2);
}

function label(value: unknown, pattern: RegExp): string | null {
  return typeof value === "string" && value.length <= 40 && pattern.test(value) ? value : null;
}

/** Read and fully validate a backup. Never throws; returns a plain-language error instead. */
export function readBackup(text: string): BackupResult {
  if (text.length > BACKUP_MAX_BYTES) return { ok: false, error: "That file is too large to be a LifeOS backup." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't a valid backup (it can't be read as JSON)." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed) || !Array.isArray((parsed as { dos?: unknown }).dos)) {
    return { ok: false, error: "That isn't a LifeOS backup." };
  }
  try {
    const data = parseLifeData(parsed);
    const obj = parsed as Record<string, unknown>;
    return {
      ok: true,
      data,
      meta: {
        exportedAt: label(obj.exportedAt, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/),
        appVersion: label(obj.appVersion, /^\d+\.\d+\.\d+$/),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not read that file." };
  }
}

export type LogSummary = {
  habits: number;
  loggedDays: number;
  firstDay: string | null;
  lastDay: string | null;
  todos: number;
  goals: number;
  journalDays: number;
  programStart: string;
  programDays: number;
};

/** The numbers shown side by side before a restore, so a wrong file is obvious. */
export function summarizeLog(data: LifeData): LogSummary {
  const days = [...new Set([...Object.keys(data.doChecks), ...Object.keys(data.dontChecks)])].sort();
  return {
    habits: data.dos.length + data.donts.length,
    loggedDays: days.length,
    firstDay: days[0] ?? null,
    lastDay: days[days.length - 1] ?? null,
    todos: data.todos.length,
    goals: data.goals.length,
    journalDays: Object.keys(data.journals).length,
    programStart: data.programStart,
    programDays: data.programDays,
  };
}

/**
 * "Add what's missing": keep everything that is in the app now and add whatever the backup has that the app does not.
 * If both have a value for the same thing, the app's current value wins. The current program dates are kept.
 */
export function mergeBackup(current: LifeData, backup: LifeData): LifeData {
  const merged = mergeLifeData(createBlank(current.programStart), current, backup);
  return parseLifeData({ ...merged, programStart: current.programStart, programDays: current.programDays });
}
