import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { isAllowedPushEndpoint, parseSubscriptionInput } from "./push-endpoint";

export type PushStatus = { configured: boolean; publicKey: string | null; devices: number };
export type TestPushResult = {
  status: "sent" | "not-configured" | "no-device" | "too-soon" | "failed";
  sent: number;
  failed: number;
};

export const getPushStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PushStatus> => {
    const { vapidConfig } = await import("./push-send.server");
    const { countSubscriptions } = await import("./push-store.server");
    const { getSql } = await import("@/lib/db");
    const config = vapidConfig();
    return {
      configured: config !== null,
      publicKey: config?.publicKey ?? null,
      devices: await countSubscriptions(await getSql(), context.userId),
    };
  });

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parseSubscriptionInput(input))
  .handler(async ({ context, data }): Promise<{ ok: true } | { ok: false; reason: "limit" }> => {
    const { saveSubscription } = await import("./push-store.server");
    const { getSql } = await import("@/lib/db");
    return saveSubscription(await getSql(), context.userId, data, () => crypto.randomUUID());
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const endpoint = (input as { endpoint?: unknown } | null)?.endpoint;
    if (typeof endpoint !== "string" || !isAllowedPushEndpoint(endpoint)) throw new Error("Invalid request");
    return { endpoint };
  })
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { removeSubscription } = await import("./push-store.server");
    const { getSql } = await import("@/lib/db");
    await removeSubscription(await getSql(), context.userId, data.endpoint);
    return { ok: true };
  });

/** Send "This is a test notification" to every device of the signed-in user (once per 30 seconds). */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<TestPushResult> => {
    const { vapidConfig, sendPush } = await import("./push-send.server");
    const { claimTestSlot, listSubscriptions, pruneEndpoint } = await import("./push-store.server");
    const { getSql } = await import("@/lib/db");
    const config = vapidConfig();
    if (!config) return { status: "not-configured", sent: 0, failed: 0 };
    const sql = await getSql();
    const devices = await listSubscriptions(sql, context.userId);
    if (devices.length === 0) return { status: "no-device", sent: 0, failed: 0 };
    if (!(await claimTestSlot(sql, context.userId))) return { status: "too-soon", sent: 0, failed: 0 };
    let sent = 0;
    let failed = 0;
    for (const device of devices) {
      const outcome = await sendPush(device, { title: "LifeOS", body: "This is a test notification.", tag: "lifeos-test" }, config);
      if (outcome === "ok") sent += 1;
      else {
        failed += 1;
        if (outcome === "gone") await pruneEndpoint(sql, device.endpoint);
      }
    }
    return { status: sent > 0 ? "sent" : "failed", sent, failed };
  });
