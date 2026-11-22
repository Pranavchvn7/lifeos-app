import type { Sql } from "../db";

export type LifeLogRow = { payload: string; version: number };

export type WriteResult =
  | { ok: true; version: number }
  /** Someone else saved first. `current` is what the server holds now (null if the log is gone). */
  | { ok: false; current: LifeLogRow | null };

export async function readLifeLogRow(sql: Sql, userId: string): Promise<LifeLogRow | null> {
  const rows = await sql<LifeLogRow>`select payload, version from life_logs where user_id = ${userId}`;
  return rows[0] ?? null;
}

/**
 * Save only if the stored version still equals `baseVersion` (the version this device last read). Otherwise
 * nothing is written and the current server copy is returned so the caller can merge and retry.
 */
export async function writeLifeLogRow(
  sql: Sql,
  userId: string,
  payload: string,
  baseVersion: number,
): Promise<WriteResult> {
  const updated = await sql<{ version: number }>`
    update life_logs set payload = ${payload}, version = version + 1, updated_at = now()
    where user_id = ${userId} and version = ${baseVersion}
    returning version
  `;
  if (updated[0]) return { ok: true, version: updated[0].version };

  if (baseVersion === 0) {
    const inserted = await sql<{ version: number }>`
      insert into life_logs (user_id, payload, version, updated_at)
      values (${userId}, ${payload}, 1, now())
      on conflict (user_id) do nothing
      returning version
    `;
    if (inserted[0]) return { ok: true, version: inserted[0].version };
  }
  return { ok: false, current: await readLifeLogRow(sql, userId) };
}

/** Keep a copy of the log as it was before an import. Returns false when there is no saved log to attach it to. */
export async function stashPreviousRow(sql: Sql, userId: string, payload: string): Promise<boolean> {
  const rows = await sql<{ user_id: string }>`
    update life_logs set previous_payload = ${payload}, previous_at = now()
    where user_id = ${userId}
    returning user_id
  `;
  return rows.length > 0;
}

export async function readPreviousInfo(sql: Sql, userId: string): Promise<{ at: string | null }> {
  const rows = await sql<{ at: Date | string | null }>`
    select previous_at as at from life_logs where user_id = ${userId} and previous_payload is not null
  `;
  const at = rows[0]?.at;
  return { at: at ? new Date(at).toISOString() : null };
}

export async function readPreviousPayload(sql: Sql, userId: string): Promise<string | null> {
  const rows = await sql<{ payload: string | null }>`
    select previous_payload as payload from life_logs where user_id = ${userId}
  `;
  return rows[0]?.payload ?? null;
}
