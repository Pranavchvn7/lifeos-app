import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { isValidTimeZone, parseTime } from "./reminder-schedule";

/** Save the reminder settings on the server so scheduled push reminders know when to send. */
export const saveReminderPrefs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
    if (
      typeof body.enabled !== "boolean" ||
      typeof body.weekly !== "boolean" ||
      typeof body.time !== "string" ||
      parseTime(body.time) === null ||
      !isValidTimeZone(body.tz)
    ) {
      throw new Error("Invalid request");
    }
    return { enabled: body.enabled, weekly: body.weekly, time: body.time, tz: body.tz };
  })
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { saveReminderPrefs: save } = await import("./reminder-store.server");
    const { getSql } = await import("@/lib/db");
    await save(await getSql(), context.userId, data);
    return { ok: true };
  });

/** Keep the saved time zone right when the phone travels. Does nothing if no reminder settings exist yet. */
export const updateReminderTimezone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const tz = (input as { tz?: unknown } | null)?.tz;
    if (!isValidTimeZone(tz)) throw new Error("Invalid request");
    return { tz };
  })
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { updateTimezone } = await import("./reminder-store.server");
    const { getSql } = await import("@/lib/db");
    await updateTimezone(await getSql(), context.userId, data.tz);
    return { ok: true };
  });
