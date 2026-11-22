import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  MAX_DEVICES_PER_USER,
  claimTestSlot,
  countSubscriptions,
  listSubscriptions,
  pruneEndpoint,
  removeAllForUser,
  removeSubscription,
  saveSubscription,
} from "./push-store.server";

// Real Postgres (PGlite) with the real migration, so the SQL is tested as it will run in production.
let sql: Parameters<typeof countSubscriptions>[0];
let n = 0;
const newId = () => `id${++n}`;
const sub = (endpoint: string) => ({ endpoint, p256dh: "B".repeat(87), auth: "a".repeat(22) });
const ep = (name: string) => `https://fcm.googleapis.com/fcm/send/${name}`;

before(async () => {
  const pg = new PGlite({ parsers: { 20: Number } });
  await pg.exec(readFileSync("migrations/0007_push_subscriptions.sql", "utf8"));
  const run = async (text: string, params: unknown[] = []) => (await pg.query(text, params)).rows;
  const tag = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run(text, values);
  }) as unknown as typeof sql;
  (tag as unknown as { query: typeof run }).query = run;
  sql = tag;
});

describe("push subscriptions", () => {
  it("saves and lists a device", async () => {
    assert.deepEqual(await saveSubscription(sql, "u1", sub(ep("a")), newId), { ok: true });
    const list = await listSubscriptions(sql, "u1");
    assert.equal(list.length, 1);
    assert.equal(list[0]?.endpoint, ep("a"));
  });

  it("saving the same device again does not duplicate it", async () => {
    await saveSubscription(sql, "u1", sub(ep("a")), newId);
    assert.equal(await countSubscriptions(sql, "u1"), 1);
  });

  it("keeps users separate and moves a device to whoever signs in on it", async () => {
    await saveSubscription(sql, "u2", sub(ep("b")), newId);
    assert.equal(await countSubscriptions(sql, "u2"), 1);
    assert.equal(await countSubscriptions(sql, "u1"), 1);
    await saveSubscription(sql, "u2", sub(ep("a")), newId); // same browser, new account
    assert.equal(await countSubscriptions(sql, "u1"), 0);
    assert.equal(await countSubscriptions(sql, "u2"), 2);
  });

  it("limits the number of devices per user but still lets an existing one refresh", async () => {
    for (let i = 0; i < MAX_DEVICES_PER_USER; i += 1) {
      assert.equal((await saveSubscription(sql, "u3", sub(ep(`d${i}`)), newId)).ok, true);
    }
    assert.deepEqual(await saveSubscription(sql, "u3", sub(ep("one-too-many")), newId), { ok: false, reason: "limit" });
    assert.deepEqual(await saveSubscription(sql, "u3", sub(ep("d0")), newId), { ok: true });
  });

  it("removes only the user's own device", async () => {
    await removeSubscription(sql, "u1", ep("d1")); // belongs to u3, so nothing happens
    assert.equal(await countSubscriptions(sql, "u3"), MAX_DEVICES_PER_USER);
    await removeSubscription(sql, "u3", ep("d1"));
    assert.equal(await countSubscriptions(sql, "u3"), MAX_DEVICES_PER_USER - 1);
  });

  it("forgets a device the push service reports gone, and can clear a whole user", async () => {
    await pruneEndpoint(sql, ep("d2"));
    assert.equal(await countSubscriptions(sql, "u3"), MAX_DEVICES_PER_USER - 2);
    await removeAllForUser(sql, "u3");
    assert.equal(await countSubscriptions(sql, "u3"), 0);
  });
});

describe("test notification limit", () => {
  it("allows one test, then refuses until the cooldown passes", async () => {
    await saveSubscription(sql, "u4", sub(ep("t1")), newId);
    await saveSubscription(sql, "u4", sub(ep("t2")), newId);
    assert.equal(await claimTestSlot(sql, "u4"), true);
    assert.equal(await claimTestSlot(sql, "u4"), false);
  });

  it("does not let one user's test block another's", async () => {
    await saveSubscription(sql, "u5", sub(ep("t3")), newId);
    assert.equal(await claimTestSlot(sql, "u5"), true);
  });

  it("returns false for a user with no devices", async () => {
    assert.equal(await claimTestSlot(sql, "nobody"), false);
  });
});
