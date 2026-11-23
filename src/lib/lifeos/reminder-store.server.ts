import type { Sql } from "../db";
import type { ReminderKind } from "./reminder-schedule";

export type ReminderPrefsInput = { enabled: boolean; time: string; weekly: boolean; tz: string };

export type Candidate = {
  userId: string;
  time: string;
  weekly: boolean;
  tz: string;
  lastDaily: string;
  lastWeekly: string;
};

/** Save the user's reminder settings (the last sent dates are kept). */
export async function saveReminderPrefs(sql: Sql, userId: string, prefs: ReminderPrefsInput): Promise<void> {
  await sql`
    insert into reminder_prefs (user_id, enabled, remind_at, weekly, tz, updated_at)
    values (${userId}, ${prefs.enabled}, ${prefs.time}, ${prefs.weekly}, ${prefs.tz}, now())
    on conflict (user_id) do update set
      enabled = excluded.enabled, remind_at = excluded.remind_at, weekly = excluded.weekly, tz = excluded.tz, updated_at = now()
  `;
}

/** The phone's time zone can change (travel); update it for users who already have settings. */
export async function updateTimezone(sql: Sql, userId: string, tz: string): Promise<void> {
  await sql`update reminder_prefs set tz = ${tz} where user_id = ${userId} and tz <> ${tz}`;
}

/** Users who want reminders and have at least one push device. */
export async function listCandidates(sql: Sql, limit = 500): Promise<Candidate[]> {
  return sql<Candidate>`
    select p.user_id as "userId", p.remind_at as "time", p.weekly, p.tz,
           p.last_daily as "lastDaily", p.last_weekly as "lastWeekly"
    from reminder_prefs p
    where p.enabled and exists (select 1 from push_subscriptions s where s.user_id = p.user_id)
    order by p.user_id
    limit ${limit}
  `;
}

export async function markSent(sql: Sql, userId: string, kind: ReminderKind, localDate: string): Promise<void> {
  if (kind === "daily") await sql`update reminder_prefs set last_daily = ${localDate} where user_id = ${userId}`;
  else await sql`update reminder_prefs set last_weekly = ${localDate} where user_id = ${userId}`;
}

export async function removeReminderPrefs(sql: Sql, userId: string): Promise<void> {
  await sql`delete from reminder_prefs where user_id = ${userId}`;
}
