/**
 * The server sends a message to every push endpoint a user registers. Without a check, a signed-in user could register
 * ANY address and make the server call it (SSRF). So only the real browser push services are accepted:
 *   Chrome / Edge / Brave / Samsung (Google FCM), Firefox (Mozilla), Safari and iPhone (Apple), Edge on Windows (WNS).
 * No imports, so it can be unit-tested directly.
 */
const EXACT_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "push.services.mozilla.com"];
const HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

export function isAllowedPushEndpoint(raw: string): boolean {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  const host = url.hostname.toLowerCase();
  if (EXACT_HOSTS.includes(host)) return true;
  return HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string };

const KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Validate what the browser gives us after subscribing. Throws a generic error for anything unexpected. */
export function parseSubscriptionInput(input: unknown): PushSubscriptionInput {
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const keys = (typeof body.keys === "object" && body.keys !== null ? body.keys : {}) as Record<string, unknown>;
  const endpoint = body.endpoint;
  const p256dh = keys.p256dh;
  const auth = keys.auth;
  if (
    typeof endpoint !== "string" ||
    !isAllowedPushEndpoint(endpoint) ||
    typeof p256dh !== "string" ||
    p256dh.length < 80 ||
    p256dh.length > 100 ||
    !KEY_PATTERN.test(p256dh) ||
    typeof auth !== "string" ||
    auth.length < 20 ||
    auth.length > 30 ||
    !KEY_PATTERN.test(auth)
  ) {
    throw new Error("Invalid subscription");
  }
  return { endpoint, p256dh, auth };
}
