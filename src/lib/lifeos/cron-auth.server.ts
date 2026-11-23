import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The scheduler proves who it is with a shared secret in the `Authorization: Bearer ...` header.
 * "not-configured" means CRON_SECRET is missing or too short, so the endpoint stays closed.
 */
export function checkCronAuth(header: string | null, secret: string | undefined): "ok" | "denied" | "not-configured" {
  const expected = secret?.trim();
  if (!expected || expected.length < 32) return "not-configured";
  const match = /^Bearer (.+)$/.exec(header ?? "");
  if (!match) return "denied";
  // Hash both sides so the comparison always takes the same time, whatever the length of what was sent.
  const sent = createHash("sha256").update(match[1] as string).digest();
  const wanted = createHash("sha256").update(expected).digest();
  return timingSafeEqual(sent, wanted) ? "ok" : "denied";
}
