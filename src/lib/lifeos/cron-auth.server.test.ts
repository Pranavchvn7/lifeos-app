import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkCronAuth } from "./cron-auth.server";

const SECRET = "s".repeat(40);

describe("checkCronAuth", () => {
  it("accepts the right secret", () => {
    assert.equal(checkCronAuth(`Bearer ${SECRET}`, SECRET), "ok");
  });
  it("denies a wrong, missing or malformed secret", () => {
    for (const header of [`Bearer ${SECRET}x`, `Bearer ${"t".repeat(40)}`, "Bearer ", SECRET, `bearer ${SECRET}`, "Basic abc", "", null]) {
      assert.equal(checkCronAuth(header, SECRET), "denied", String(header));
    }
  });
  it("stays closed when the secret is not set or too short", () => {
    assert.equal(checkCronAuth(`Bearer ${SECRET}`, undefined), "not-configured");
    assert.equal(checkCronAuth(`Bearer ${SECRET}`, ""), "not-configured");
    assert.equal(checkCronAuth("Bearer short", "short"), "not-configured");
  });
});
