import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { APP_VERSION } from "./version.ts";

it("APP_VERSION matches package.json and the newest CHANGELOG entry", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  assert.equal(APP_VERSION, pkg.version);
  const changelog = readFileSync("CHANGELOG.md", "utf8");
  assert.match(changelog, new RegExp(`^## v${APP_VERSION.replaceAll(".", "\\.")} `, "m"));
});
