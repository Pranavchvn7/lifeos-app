import type { Sql } from "../db";
import { readLifeLogRow as readRow } from "./life-log.server";
import { listSubscriptions, pruneEndpoint, type StoredSubscription } from "./push-store.server";
import type { PushMessage, SendOutcome } from "./push-send.server";
import { decideReminders, localParts, parseTime, SEND_WINDOW_MINUTES, type ReminderKind } from "./reminder-schedule";
import { listCandidates, markSent } from "./reminder-store.server";
import { buildScores } from "./score";
import { parseLifeData } from "./validate";
import { isReviewDone, reviewWeekFor } from "./weekly";

export type Sender = (sub: StoredSubscription, message: PushMessage) => Promise<SendOutcome>;

const MESSAGES: Record<ReminderKind, PushMessage> = {
  daily: { title: "LifeOS", body: "Time to log your day in LifeOS.", tag: "lifeos-daily" },
  weekly: { title: "LifeOS weekly review", body: "Your weekly review is ready. Take two minutes to reflect.", tag: "lifeos-weekly" },
};

export type RunResult = { checked: number; due: number; sent: number };

/**
 * Send every reminder that is due right now. Called every ~10 minutes by the scheduler.
 * A reminder counts as sent (and is not repeated today) once at least one of the user's devices accepted it.
 */
export async function runDueReminders(sql: Sql, now: Date, send: Sender): Promise<RunResult> {
  const result: RunResult = { checked: 0, due: 0, sent: 0 };
  for (const user of await listCandidates(sql)) {
    result.checked += 1;
    const parts = localParts(now, user.tz);
    const at = parseTime(user.time);
    if (!parts || at === null) continue;
    if (parts.minutes < at || parts.minutes >= at + SEND_WINDOW_MINUTES) continue; // cheap check before reading the log

    const row = await readRow(sql, user.userId);
    let needsLog = false;
    let reviewPending = false;
    if (row) {
      try {
        const data = parseLifeData(JSON.parse(row.payload) as unknown);
        const todayScore = buildScores(data, parts.date).find((d) => d.date === parts.date);
        needsLog = data.dos.length + data.donts.length > 0 && !!todayScore && !todayScore.rest && !todayScore.filled;
        const monday = reviewWeekFor(parts.date);
        reviewPending = monday !== null && !isReviewDone(data.weeklyReviews[monday]);
      } catch {
        continue; // an unreadable log: send nothing rather than guess
      }
    }

    const kinds = decideReminders({
      prefs: { enabled: true, time: user.time, weekly: user.weekly, lastDaily: user.lastDaily, lastWeekly: user.lastWeekly },
      parts,
      needsLog,
      reviewPending,
    });
    if (kinds.length === 0) continue;
    result.due += kinds.length;

    const devices = await listSubscriptions(sql, user.userId);
    for (const kind of kinds) {
      let delivered = false;
      for (const device of devices) {
        const outcome = await send(device, MESSAGES[kind]);
        if (outcome === "ok") delivered = true;
        else if (outcome === "gone") await pruneEndpoint(sql, device.endpoint);
      }
      if (delivered) {
        await markSent(sql, user.userId, kind, parts.date);
        result.sent += 1;
      }
    }
  }
  return result;
}
