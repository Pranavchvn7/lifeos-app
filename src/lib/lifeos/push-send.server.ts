import { sendNotification } from "web-push";
import { env } from "@/lib/env.server";
import { isAllowedPushEndpoint } from "./push-endpoint";
import type { StoredSubscription } from "./push-store.server";

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

/** The three VAPID settings from the environment, or null if push is not set up on this server. */
export function vapidConfig(): VapidConfig | null {
  const publicKey = env("VAPID_PUBLIC_KEY")?.trim();
  const privateKey = env("VAPID_PRIVATE_KEY")?.trim();
  const subject = env("VAPID_SUBJECT")?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) return null;
  return { publicKey, privateKey, subject };
}

export type PushMessage = { title: string; body: string; tag?: string };
export type SendOutcome = "ok" | "gone" | "error";

/** Send one notification. "gone" means the device no longer exists and should be forgotten. */
export async function sendPush(sub: StoredSubscription, message: PushMessage, config: VapidConfig): Promise<SendOutcome> {
  if (!isAllowedPushEndpoint(sub.endpoint)) return "gone"; // never call an address that is not a real push service
  try {
    await sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(message),
      {
        vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
        TTL: 3600,
        timeout: 8000,
      },
    );
    return "ok";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "error";
  }
}
