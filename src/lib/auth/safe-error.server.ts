/**
 * Server-only. Server functions return the text of any error they throw to the browser. Errors from the database
 * driver can contain the database host, user name or table names, so they are replaced with a generic message here
 * and the full error goes to the server log (Vercel > Logs) instead.
 *
 * Our own messages ("Invalid link.", "That log is too large to save.", "Unauthorized") are left untouched.
 */
const GENERIC = "Something went wrong on the server. Please try again.";

const LOOKS_INTERNAL =
  /(postgres|neon|pg_|econn|enotfound|eai_again|etimedout|password authentication|connection|certificate|ssl|relation ".*" does not exist|column ".*"|syntax error|database_url|secret)/i;

export function sanitizeServerError(err: unknown): unknown {
  if (!(err instanceof Error)) return err; // redirects and similar control objects pass through
  const status = (err as { status?: unknown }).status;
  if (typeof status === "number") return err; // deliberate HTTP-style errors (401, 403…) keep their message
  const hasDriverCode = typeof (err as { code?: unknown }).code === "string";
  if (!hasDriverCode && !LOOKS_INTERNAL.test(err.message)) return err;
  console.error("[server-fn] error hidden from the browser:", err);
  return new Error(GENERIC);
}
