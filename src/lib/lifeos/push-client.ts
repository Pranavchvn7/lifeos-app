import { getPushStatus, removePushSubscription, savePushSubscription } from "./push.functions";

/** Can this browser do push notifications, and if not, why not? */
export type PushSupport = "ok" | "unsupported" | "needs-install-ios";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ios =
    /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // iPhones only allow push for a web app that was added to the Home Screen.
  if (ios && !standalone) return "needs-install-ios";
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window ? "ok" : "unsupported";
}

export async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

function keyToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), "=").replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

export type EnableResult = "enabled" | "denied" | "not-configured" | "limit" | "failed";

/** Ask for permission (must be called from a tap), subscribe this device, and tell the server about it. */
export async function enablePush(): Promise<EnableResult> {
  try {
    const status = await getPushStatus();
    if (!status.configured || !status.publicKey) return "not-configured";
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") return "denied";
    const registration = (await registerWorker()) ?? undefined;
    const ready = registration ? await navigator.serviceWorker.ready : undefined;
    if (!ready) return "failed";
    const subscription =
      (await ready.pushManager.getSubscription()) ??
      (await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(status.publicKey) }));
    const json = subscription.toJSON();
    const result = await savePushSubscription({
      data: { endpoint: subscription.endpoint, keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" } },
    });
    if (!result.ok) {
      await subscription.unsubscribe().catch(() => undefined);
      return "limit";
    }
    return "enabled";
  } catch {
    return "failed";
  }
}

export async function disablePush(): Promise<boolean> {
  try {
    const subscription = await currentSubscription();
    if (!subscription) return true;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe().catch(() => undefined);
    await removePushSubscription({ data: { endpoint } });
    return true;
  } catch {
    return false;
  }
}
