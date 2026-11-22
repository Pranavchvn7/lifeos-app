import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAllowedPushEndpoint, parseSubscriptionInput } from "./push-endpoint";

const P256DH = "B".repeat(87);
const AUTH = "a".repeat(22);

describe("isAllowedPushEndpoint", () => {
  it("accepts the real browser push services", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc123",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/QGxyz",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      assert.equal(isAllowedPushEndpoint(url), true, url);
    }
  });

  it("refuses everything else, including look-alikes and internal addresses", () => {
    for (const url of [
      "http://fcm.googleapis.com/fcm/send/abc", // not https
      "https://evil.com/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.com/x",
      "https://evil.com#fcm.googleapis.com",
      "https://user:pw@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://push.apple.com/x", // the suffix needs a sub-domain
      "https://notify.windows.com/x",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/x",
      "https://10.0.0.5/x",
      "ftp://fcm.googleapis.com/x",
      "javascript:alert(1)",
      "not a url",
      "",
    ]) {
      assert.equal(isAllowedPushEndpoint(url), false, url);
    }
  });

  it("refuses very long addresses", () => {
    assert.equal(isAllowedPushEndpoint(`https://fcm.googleapis.com/${"a".repeat(2100)}`), false);
  });
});

describe("parseSubscriptionInput", () => {
  const good = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: P256DH, auth: AUTH } };

  it("accepts what a browser produces", () => {
    assert.deepEqual(parseSubscriptionInput(good), { endpoint: good.endpoint, p256dh: P256DH, auth: AUTH });
  });

  it("refuses missing or malformed parts", () => {
    const bad: unknown[] = [
      null,
      "x",
      {},
      { ...good, endpoint: "https://evil.com/x" },
      { ...good, keys: {} },
      { ...good, keys: { p256dh: "short", auth: AUTH } },
      { ...good, keys: { p256dh: P256DH, auth: "short" } },
      { ...good, keys: { p256dh: `${"B".repeat(86)}!`, auth: AUTH } },
      { ...good, keys: { p256dh: P256DH, auth: `${"a".repeat(21)}<` } },
    ];
    for (const input of bad) assert.throws(() => parseSubscriptionInput(input), /Invalid subscription/);
  });
});
