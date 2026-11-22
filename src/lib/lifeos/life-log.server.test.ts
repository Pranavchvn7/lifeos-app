import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { readLifeLogRow, writeLifeLogRow } from "./life-log.server.ts";

// Real Postgres (PGlite) with the real migrations, so the SQL is tested as it will run in production.
let sql: Parameters<typeof readLifeLogRow>[0];

before(async () => {
  const pg = new PGlite({ parsers: { 20: Number } });
  await pg.exec(readFileSync("migrations/0002_lifeos.sql", "utf8"));
  await pg.exec(readFileSync("migrations/0005_life_log_version.sql", "utf8"));
  const run = async (text: string, params: unknown[] = []) => (await pg.query(text, params)).rows;
  const tag = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run(text, values);
  }) as unknown as typeof sql;
  (tag as unknown as { query: typeof run }).query = run;
  sql = tag;
});

describe("writeLifeLogRow", () => {
  it("creates the first version of a new log", async () => {
    const res = await writeLifeLogRow(sql, "u1", '{"n":1}', 0);
    assert.deepEqual(res, { ok: true, version: 1 });
    assert.deepEqual(await readLifeLogRow(sql, "u1"), { payload: '{"n":1}', version: 1 });
  });

  it("saves when the base version is current and bumps the version", async () => {
    const res = await writeLifeLogRow(sql, "u1", '{"n":2}', 1);
    assert.deepEqual(res, { ok: true, version: 2 });
  });

  it("refuses a stale save and returns the current copy, writing nothing", async () => {
    const res = await writeLifeLogRow(sql, "u1", '{"n":"stale"}', 1);
    assert.deepEqual(res, { ok: false, current: { payload: '{"n":2}', version: 2 } });
    assert.equal((await readLifeLogRow(sql, "u1"))?.payload, '{"n":2}');
  });

  it("refuses a 'first save' when a log already exists", async () => {
    const res = await writeLifeLogRow(sql, "u1", '{"n":"fresh device"}', 0);
    assert.equal(res.ok, false);
    assert.equal((await readLifeLogRow(sql, "u1"))?.version, 2);
  });

  it("treats an old row without a version (version 0) as saveable at base 0", async () => {
    await sql`insert into life_logs (user_id, payload) values (${"legacy"}, ${'{"old":true}'})`;
    const res = await writeLifeLogRow(sql, "legacy", '{"old":false}', 0);
    assert.deepEqual(res, { ok: true, version: 1 });
  });

  it("keeps users separate", async () => {
    await writeLifeLogRow(sql, "u2", '{"u":2}', 0);
    assert.equal((await readLifeLogRow(sql, "u1"))?.payload, '{"n":2}');
    assert.equal((await readLifeLogRow(sql, "u2"))?.payload, '{"u":2}');
  });

  it("reports a missing log as a conflict when a later version was expected", async () => {
    assert.deepEqual(await writeLifeLogRow(sql, "nobody", "{}", 5), { ok: false, current: null });
  });
});
