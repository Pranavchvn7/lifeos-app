import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, navIdForPath } from "./nav-items";

describe("navIdForPath", () => {
  it("maps each address to its section", () => {
    assert.equal(navIdForPath("/"), "today");
    assert.equal(navIdForPath("/todo"), "todo");
    assert.equal(navIdForPath("/board"), "board");
    assert.equal(navIdForPath("/journal"), "journal");
    assert.equal(navIdForPath("/goals"), "goals");
    assert.equal(navIdForPath("/settings"), "settings");
  });
  it("ignores a trailing slash and covers sub-pages", () => {
    assert.equal(navIdForPath("/settings/"), "settings");
    assert.equal(navIdForPath("/goals/abc"), "goals");
  });
  it("falls back to Today for anything unknown", () => {
    assert.equal(navIdForPath("/nope"), "today");
    assert.equal(navIdForPath("/todox"), "today");
  });
});

describe("NAV_ITEMS", () => {
  it("has unique ids and addresses, Today first", () => {
    assert.equal(new Set(NAV_ITEMS.map((i) => i.id)).size, NAV_ITEMS.length);
    assert.equal(new Set(NAV_ITEMS.map((i) => i.to)).size, NAV_ITEMS.length);
    assert.equal(NAV_ITEMS[0]?.id, "today");
  });
});
