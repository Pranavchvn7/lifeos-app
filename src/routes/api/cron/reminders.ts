import { createFileRoute } from "@tanstack/react-router";

/**
 * Called every ~10 minutes by the GitHub Actions schedule (.github/workflows/reminders.yml).
 * Sends the scheduled push reminders that are due. Closed unless CRON_SECRET is set; answers only counts, never user data.
 */
function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function handle(request: Request): Promise<Response> {
  const { checkCronAuth } = await import("@/lib/lifeos/cron-auth.server");
  const verdict = checkCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (verdict === "not-configured") return reply(503, { ok: false, error: "not configured" });
  if (verdict === "denied") return reply(401, { ok: false, error: "unauthorized" });
  try {
    const { vapidConfig, sendPush } = await import("@/lib/lifeos/push-send.server");
    const { runDueReminders } = await import("@/lib/lifeos/reminder-run.server");
    const { getSql } = await import("@/lib/db");
    const config = vapidConfig();
    if (!config) return reply(503, { ok: false, error: "push not configured" });
    const result = await runDueReminders(await getSql(), new Date(), (sub, message) => sendPush(sub, message, config));
    return reply(200, { ok: true, ...result });
  } catch (error) {
    console.error("[reminders] run failed:", error instanceof Error ? error.name : "unknown error");
    return reply(500, { ok: false, error: "failed" });
  }
}

export const Route = createFileRoute("/api/cron/reminders")({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
