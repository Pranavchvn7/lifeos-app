import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createECDH, randomBytes } from "node:crypto";
import { generateRequestDetails, generateVAPIDKeys } from "web-push";
import { sendPush } from "./push-send.server";

// A subscription like a browser creates: a P-256 public key and a 16-byte auth secret, both base64url.
function fakeBrowserKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") };
}

describe("web push request", () => {
  it("builds a signed (VAPID), encrypted request for a real push service address", () => {
    const vapid = generateVAPIDKeys();
    const keys = fakeBrowserKeys();
    const endpoint = "https://fcm.googleapis.com/fcm/send/abc123";
    const details = generateRequestDetails({ endpoint, keys }, JSON.stringify({ title: "LifeOS", body: "hi" }), {
      vapidDetails: { subject: "mailto:me@example.com", publicKey: vapid.publicKey, privateKey: vapid.privateKey },
      TTL: 3600,
    });
    assert.equal(details.endpoint, endpoint);
    assert.equal(details.method, "POST");
    assert.match(String(details.headers.Authorization), /^vapid t=.+, k=.+/);
    assert.equal(details.headers["Content-Encoding"], "aes128gcm");
    assert.equal(String(details.headers.TTL), "3600");
    assert.ok(Buffer.isBuffer(details.body));
    assert.ok(!details.body.toString("utf8").includes("LifeOS")); // the message is encrypted
  });
});

describe("sendPush safety", () => {
  it("never calls an address that is not a real push service", async () => {
    const config = { publicKey: "x", privateKey: "y", subject: "mailto:me@example.com" };
    const outcome = await sendPush(
      { id: "1", endpoint: "https://169.254.169.254/latest/meta-data", p256dh: "B".repeat(87), auth: "a".repeat(22) },
      { title: "t", body: "b" },
      config,
    );
    assert.equal(outcome, "gone"); // refused before any network call
  });
});
