import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { createBlank } from "./model";
import { parseLifeData } from "./validate";
import { writeLifeLogRow } from "./life-log.server";
import { saveSubscription } from "./push-store.server";
import { listCandidates, markSent, saveReminderPrefs, updateTimezone } from "./reminder-store.server";
import { runDueReminders } from "./reminder-run.server";
import type { PushMessage, SendOutcome } from "./push-send.server";

// Real Postgres (PGlite) with the real migrations, so the SQL runs as it will in production.
let sql: Parameters<typeof listCandidates>[0];
let n = 0;
const newId = () => `id${++n}`;
const ep = (name: string) => `https://fcm.googleapis.com/fcm/send/${name}`;
const device = (endpoint: string) => ({ endpoint, p256dh: "B".repeat(87), auth: "a".repeat(22) });

before(async () => {
  const pg = new PGlite({ parsers: { 20: Number } });
  for (const file of ["0002_lifeos", "0005_life_log_version", "0007_push_subscriptions", "0008_reminder_prefs"]) {
    await pg.exec(readFileSync(`migrations/${file}.sql`, "utf8"));
  }
  const run = async (text: string, params: unknown[] = []) => (await pg.query(text, params)).rows;
  const tag = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run(text, values);
  }) as unknown as typeof sql;
  (tag as unknown as { query: typeof run }).query = run;
  sql = tag;
});

async function setup(userId: string, opts: { loggedOn?: string; time?: string; tz?: string; weekly?: boolean; enabled?: boolean; devices?: number }) {
  const data = parseLifeData({ ...createBlank("2026-11-16"), dos: [{ id: "a", label: "Walk" }], donts: [] });
  if (opts.loggedOn) data.doChecks[opts.loggedOn] = { a: { done: true, notes: "" } };
  await writeLifeLogRow(sql, userId, JSON.stringify(data), 0);
  for (let i = 0; i < (opts.devices ?? 1); i += 1) await saveSubscription(sql, userId, device(ep(`${userId}-${i}`)), newId);
  await saveReminderPrefs(sql, userId, {
    enabled: opts.enabled ?? true,
    time: opts.time ?? "20:00",
    weekly: opts.weekly ?? true,
    tz: opts.tz ?? "Asia/Kolkata",
  });
}

function recorder(outcome: SendOutcome = "ok") {
  const sent: { endpoint: string; message: PushMessage }[] = [];
  return { sent, send: async (sub: { endpoint: string }, message: PushMessage) => (sent.push({ endpoint: sub.endpoint, message }), outcome) };
}

// 2026-11-24 is a Tuesday (no weekly review due). 15:00 UTC = 20:30 in India.
const TUE_2030_IST = new Date("2026-11-24T15:00:00Z");
// 2026-11-23 is a Monday: the catch-up day for last week's review.
const MON_2030_IST = new Date("2026-11-23T15:00:00Z");

describe("runDueReminders", () => {
  it("sends the daily reminder once, then not again the same day", async () => {
    await setup("alice", {});
    const r = recorder();
    const first = await runDueReminders(sql, TUE_2030_IST, r.send);
    const mine = r.sent.filter((s) => s.endpoint.includes("alice"));
    assert.equal(mine.length, 1);
    assert.equal(mine[0]?.message.tag, "lifeos-daily");
    assert.equal(first.sent >= 1, true);

    const again = recorder();
    await runDueReminders(sql, new Date("2026-11-24T15:10:00Z"), again.send);
    assert.equal(again.sent.filter((s) => s.endpoint.includes("alice")).length, 0);
  });

  it("sends nothing to someone who already logged today", async () => {
    await setup("bob", { loggedOn: "2026-11-24" });
    const r = recorder();
    await runDueReminders(sql, TUE_2030_IST, r.send);
    assert.equal(r.sent.filter((s) => s.endpoint.includes("bob")).length, 0);
  });

  it("waits for the chosen time and respects the time zone", async () => {
    await setup("carol", { time: "21:00" });
    const r = recorder();
    await runDueReminders(sql, TUE_2030_IST, r.send); // 20:30 IST, before 21:00
    assert.equal(r.sent.filter((s) => s.endpoint.includes("carol")).length, 0);
    await runDueReminders(sql, new Date("2026-11-24T15:45:00Z"), r.send); // 21:15 IST
    assert.equal(r.sent.filter((s) => s.endpoint.includes("carol")).length, 1);
  });

  it("sends nothing when reminders are off, or when the user has no device", async () => {
    await setup("dave", { enabled: false });
    await setup("erin", { devices: 0 });
    const r = recorder();
    await runDueReminders(sql, TUE_2030_IST, r.send);
    assert.equal(r.sent.filter((s) => /dave|erin/.test(s.endpoint)).length, 0);
  });

  it("sends the daily and the weekly reminder on a Monday when nothing is logged", async () => {
    await setup("zoe", {});
    const r = recorder();
    await runDueReminders(sql, MON_2030_IST, r.send);
    const tags = r.sent.filter((s) => s.endpoint.includes("zoe")).map((s) => s.message.tag).sort();
    assert.deepEqual(tags, ["lifeos-daily", "lifeos-weekly"]);
  });

  it("sends the weekly review reminder alone on a Monday catch-up when today is logged", async () => {
    await setup("frank", { loggedOn: "2026-11-23" }); // logged today, so only the weekly review is due
    const r = recorder();
    await runDueReminders(sql, MON_2030_IST, r.send);
    const mine = r.sent.filter((s) => s.endpoint.includes("frank"));
    assert.equal(mine.length, 1);
    assert.equal(mine[0]?.message.tag, "lifeos-weekly");
  });

  it("sends to every device, and keeps retrying if no device accepted it", async () => {
    await setup("gina", { devices: 2 });
    const failing = recorder("error");
    await runDueReminders(sql, TUE_2030_IST, failing.send);
    assert.equal(failing.sent.filter((s) => s.endpoint.includes("gina")).length, 2);
    const working = recorder();
    await runDueReminders(sql, new Date("2026-11-24T15:10:00Z"), working.send); // not marked sent, so it tries again
    assert.equal(working.sent.filter((s) => s.endpoint.includes("gina")).length, 2);
  });

  it("forgets a device the push service says is gone", async () => {
    await setup("hank", {});
    const gone = recorder("gone");
    await runDueReminders(sql, TUE_2030_IST, gone.send);
    const rows = await sql<{ n: number }>`select count(*)::int as n from push_subscriptions where user_id = ${"hank"}`;
    assert.equal(rows[0]?.n, 0);
  });
});

describe("reminder settings storage", () => {
  it("saves settings, keeps the last-sent dates when they change, and updates the time zone", async () => {
    await saveReminderPrefs(sql, "ivy", { enabled: true, time: "08:00", weekly: false, tz: "UTC" });
    await markSent(sql, "ivy", "daily", "2026-11-22");
    await saveReminderPrefs(sql, "ivy", { enabled: true, time: "09:30", weekly: true, tz: "UTC" });
    await updateTimezone(sql, "ivy", "Europe/London");
    await updateTimezone(sql, "nobody-has-settings", "Europe/London"); // does nothing, creates nothing
    const row = (await sql<{ time: string; weekly: boolean; tz: string; last_daily: string }>`
      select remind_at as time, weekly, tz, last_daily from reminder_prefs where user_id = ${"ivy"}
    `)[0];
    assert.deepEqual(row, { time: "09:30", weekly: true, tz: "Europe/London", last_daily: "2026-11-22" });
    const none = await sql<{ n: number }>`select count(*)::int as n from reminder_prefs where user_id = ${"nobody-has-settings"}`;
    assert.equal(none[0]?.n, 0);
  });
});
