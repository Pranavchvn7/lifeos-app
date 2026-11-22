import type { Sql } from "../db";
import type { PushSubscriptionInput } from "./push-endpoint";

export const MAX_DEVICES_PER_USER = 10;
export const TEST_COOLDOWN_SECONDS = 30;

export type StoredSubscription = { id: string; endpoint: string; p256dh: string; auth: string };

/** Save (or refresh) a device. An endpoint belongs to one browser, so signing in as someone else on it moves it. */
export async function saveSubscription(
  sql: Sql,
  userId: string,
  sub: PushSubscriptionInput,
  newId: () => string,
): Promise<{ ok: true } | { ok: false; reason: "limit" }> {
  const existing = await sql<{ n: number }>`
    select count(*)::int as n from push_subscriptions where user_id = ${userId} and endpoint <> ${sub.endpoint}
  `;
  if ((existing[0]?.n ?? 0) >= MAX_DEVICES_PER_USER) return { ok: false, reason: "limit" };
  await sql`
    insert into push_subscriptions (id, user_id, endpoint, p256dh, auth)
    values (${newId()}, ${userId}, ${sub.endpoint}, ${sub.p256dh}, ${sub.auth})
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
  `;
  return { ok: true };
}

export async function listSubscriptions(sql: Sql, userId: string): Promise<StoredSubscription[]> {
  return sql<StoredSubscription>`
    select id, endpoint, p256dh, auth from push_subscriptions where user_id = ${userId} order by created_at
  `;
}

export async function countSubscriptions(sql: Sql, userId: string): Promise<number> {
  const rows = await sql<{ n: number }>`select count(*)::int as n from push_subscriptions where user_id = ${userId}`;
  return rows[0]?.n ?? 0;
}

/** Remove one of the user's own devices. */
export async function removeSubscription(sql: Sql, userId: string, endpoint: string): Promise<void> {
  await sql`delete from push_subscriptions where user_id = ${userId} and endpoint = ${endpoint}`;
}

/** The push service said this device is gone for good (404/410): forget it. */
export async function pruneEndpoint(sql: Sql, endpoint: string): Promise<void> {
  await sql`delete from push_subscriptions where endpoint = ${endpoint}`;
}

export async function removeAllForUser(sql: Sql, userId: string): Promise<void> {
  await sql`delete from push_subscriptions where user_id = ${userId}`;
}

/** Allow one test notification per user every 30 seconds. Returns false when it is too soon. */
export async function claimTestSlot(sql: Sql, userId: string): Promise<boolean> {
  const rows = await sql<{ id: string }>`
    update push_subscriptions set last_test_at = now()
    where user_id = ${userId}
      and not exists (
        select 1 from push_subscriptions
        where user_id = ${userId} and last_test_at > now() - make_interval(secs => ${TEST_COOLDOWN_SECONDS})
      )
    returning id
  `;
  return rows.length > 0;
}
