import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/**
 * Safe setup check: open https://<your-site>/api/auth/diagnostics
 * Reports which settings are present (never their values) and whether the
 * database is reachable with the auth tables created. Yes/no answers only;
 * the reason for a failure goes to the server logs, not to this public page.
 */
async function diagnostics(): Promise<Response> {
  const has = (k: string) => Boolean(process.env[k]?.trim());
  const report: Record<string, unknown> = {
    DATABASE_URL: has("DATABASE_URL"),
    BETTER_AUTH_SECRET: has("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: has("BETTER_AUTH_URL"),
    onVercel: has("VERCEL"),
    // true when DATABASE_URL points at Neon's pooled endpoint (the host contains "-pooler"); only the yes/no is shown
    databasePooled: /-pooler\./i.test(process.env.DATABASE_URL ?? ""),
  };
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_name in ('user','session','account','verification')",
    );
    report.database = "connected";
    report.authTablesComplete = rows.length === 4;
  } catch (err) {
    // This page is public, so it must not echo the driver's message (it can contain the database host or user name).
    console.error("[diagnostics] database check failed:", err);
    report.database = "FAILED";
    report.hint = "See the function logs in the Vercel dashboard for the reason.";
  }
  return new Response(JSON.stringify(report, null, 2), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) =>
        new URL(request.url).pathname === "/api/auth/diagnostics"
          ? diagnostics()
          : auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
