/**
 * Self-hosted Better Auth for THIS app (server-only).
 *
 * Pre-wired for live preview + deploy — do not rewrite this file. To enable
 * local email/password, flip the flag in `./email-password` only (see auth skill).
 *
 * The app runs its own Better Auth at `/api/auth/*`, so the session cookie stays
 * on this app's own origin. Sign-in federates to the shared **Grok auth broker**
 * (`GROK_AUTH_ISSUER`) via the `genericOAuth` plugin — the broker brokers the
 * upstream sign-in methods (Google, X, …) and holds their shared secrets; this
 * app only holds its own client id/secret and names the upstream it wants via
 * each provider's `idp` hint.
 *
 * Tri-mode:
 *   - Deployed: the deployer injects a per-app `GROK_AUTH_*` + `BETTER_AUTH_URL`
 *     + `DATABASE_URL`, so real federated auth is persisted in Postgres.
 *   - Sandbox live preview: no injection -> falls back to the shared **preview
 *     client** (`./preview`) and derives the preview's `https://*.grok-sandbox.com`
 *     origin from the request, so real sign-in works (no demo users). Sessions
 *     and identities persist in the embedded PGLite DB (same DB as app data);
 *     the process restart wipes both. Live-preview iframe clients use a bearer
 *     token (partitioned cookies) — see `client.ts`.
 *   - Off (`VITE_AUTH_ENABLED=false`, the shipped default): no providers;
 *     `requireUserId` resolves a dev user with no database configured, and
 *     throws fail-closed once `DATABASE_URL` is set (see `verify.server.ts`).
 *
 * NEVER import this from client code — it pulls in `pg` + the preview secret +
 * server-only Better Auth internals. The client uses `@/lib/auth/client`;
 * components read the user via `@/lib/auth/use-current-user`; server functions get
 * a verified id via `@/lib/auth/middleware`.
 */
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { emailAndPasswordEnabled } from "./email-password";
import { pgliteDialect } from "./pglite-dialect";

// Kick (and share) PGLite bootstrap as soon as the auth server module loads.
void ensureDbReady();

/**
 * Preview secret must outlive module reloads: PGLite (and its session rows) is
 * stored on `globalThis`, so an HMR re-eval of this file must NOT mint a new
 * signing secret or every existing session becomes invalid mid-dev. Process
 * restart clears both the secret and PGLite together.
 */
const globalAuthRef = globalThis as typeof globalThis & {
  __grokAuthPreviewSecret__?: string;
};
function previewAuthSecret(): string {
  globalAuthRef.__grokAuthPreviewSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthRef.__grokAuthPreviewSecret__;
}

/** Read an env var, treating empty/whitespace as unset. */
const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

// Explicit off-switch. The deployer sets `VITE_AUTH_ENABLED=true` when it
// provisions auth; set it to "false" to force auth off everywhere (dev user).
const authDisabled = env("VITE_AUTH_ENABLED") === "false";

/** True when sign-in is on (the default). Only `VITE_AUTH_ENABLED=false` turns it off. */
export const authConfigured = !authDisabled;

// This app's own Better Auth origin. When deployed the deployer injects the
// public URL. In the sandbox live preview there's no fixed URL (each preview gets
// a dynamic `*.grok-sandbox.com` host), so we hand Better Auth a dynamic baseURL:
// it derives the origin per-request from the (proxied) host, validated against the
// preview allowlist, which makes the OAuth `redirect_uri` the concrete preview URL
// the broker's preview client accepts.
// ── Public hosting (Vercel, custom domains, other platforms) ────────────────
// Origins this deployment is reachable at. Without these, Better Auth rejects
// sign-up/sign-in POSTs with "Invalid origin" (shown in the UI as "Sign-in was
// blocked by the browser origin"). Sources, in priority order:
//   BETTER_AUTH_URL                – your canonical public URL (recommended)
//   APP_URL / NEXT_PUBLIC_APP_URL  – alternative names
//   VERCEL_PROJECT_PRODUCTION_URL  – auto-set by Vercel (production domain)
//   VERCEL_URL / VERCEL_BRANCH_URL – auto-set by Vercel (per-deployment hosts)
//   TRUSTED_ORIGINS                – comma-separated extras (custom domains)
const toOrigin = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return undefined;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProto).origin;
  } catch {
    return undefined;
  }
};

const configuredOrigin =
  toOrigin(env("BETTER_AUTH_URL")) ??
  toOrigin(env("APP_URL")) ??
  toOrigin(env("NEXT_PUBLIC_APP_URL"));
const vercelOrigins = [
  toOrigin(env("VERCEL_PROJECT_PRODUCTION_URL")),
  toOrigin(env("VERCEL_BRANCH_URL")),
  toOrigin(env("VERCEL_URL")),
].filter((v): v is string => Boolean(v));
const extraOrigins = (env("TRUSTED_ORIGINS") ?? "")
  .split(",")
  .map((v) => toOrigin(v))
  .filter((v): v is string => Boolean(v));

const onVercel = Boolean(env("VERCEL")) || vercelOrigins.length > 0;
// Production trusts only this site's own addresses. Staging previews (every Vercel "Preview" deployment) also accept
// *.vercel.app, because their addresses change with every deployment; they hold test data only.
// This is an explicit opt-in for previews ("=== preview"), not "anything that is not production": an unexpected or
// missing VERCEL_ENV therefore keeps the strict settings.
const trustAnyVercelApp = onVercel && env("VERCEL_ENV") === "preview";
const explicitBaseURL = configuredOrigin ?? vercelOrigins[0];

// Local `npm run dev` (port 8080 contract). Browsers may send Origin as any of
// these for the same server — trusting only `localhost` rejects `127.0.0.1` and
// breaks email/password with "Invalid origin".
const LOCAL_DEV_ORIGINS: string[] = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
];

// Hosts (no scheme) derived from every known public origin, so the dynamic
// baseURL also resolves for preview deployments and custom domains.
const publicHosts = [configuredOrigin, ...vercelOrigins, ...extraOrigins]
  .filter((v): v is string => Boolean(v))
  .map((o) => new URL(o).host);

// When deployed on a public platform we use a dynamic baseURL so the correct
// origin is derived from the request host (validated against an allowlist).
// This makes sign-up work on production, preview and custom domains alike.
const baseURL = onVercel || configuredOrigin
  ? {
      allowedHosts: [
        ...new Set([
          ...publicHosts,
          ...(trustAnyVercelApp ? ["*.vercel.app"] : []),
          ...(onVercel ? [] : ["localhost", "127.0.0.1", "[::1]"]),
        ]),
      ],
      protocol: "auto" as const,
      fallback: explicitBaseURL ?? "http://localhost:8080",
    }
  : {
      // Local development (no public URL configured).
      allowedHosts: ["localhost", "127.0.0.1", "[::1]"],
      // `auto` → trust both http:// and https:// expansions of allowedHosts
      // (preview is https; local dev is http).
      protocol: "auto" as const,
      fallback: "http://localhost:8080",
    };

// Origins Better Auth accepts on credentialed POSTs (sign-up/sign-in, etc.).
// Missing entries here surface as FORBIDDEN "Invalid origin".
const trustedOrigins: string[] = [
  ...new Set([
    ...(configuredOrigin ? [configuredOrigin] : []),
    ...vercelOrigins,
    ...extraOrigins,
    // Any *.vercel.app address, but only outside production (see trustAnyVercelApp above).
    ...(trustAnyVercelApp ? ["*.vercel.app", "https://*.vercel.app"] : []),
    // Local development addresses are not trusted on a deployed site.
    ...(onVercel ? [] : LOCAL_DEV_ORIGINS),
  ]),
];

const databaseUrl = env("DATABASE_URL");

// Real Postgres when `DATABASE_URL` is set (deployed apps), else the app's
// embedded PGLite (preview) via a Kysely dialect — so Better Auth persists to the
// SAME DB as app data, including email/password users. Both use the Better Auth
// schema from `migrations/auth/0001_auth.sql`, copied into `migrations/` when
// the app turns sign-in on.
const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

/** Session token cookie name — also read by the live-preview popup completion page. */
export const SESSION_TOKEN_COOKIE = "__Host-grok-auth.session_token";

// A production site must never start without its secret or its database: it would silently use a throw-away
// secret / in-memory database. Fail loudly instead (previews only log a warning).
const isProductionDeploy = env("VERCEL_ENV") === "production";
if (onVercel && !env("BETTER_AUTH_SECRET")) {
  const message =
    "[auth] BETTER_AUTH_SECRET is not set. Sessions will break across serverless " +
    "instances. Add a random 32+ char value in Vercel > Settings > Environment Variables.";
  if (isProductionDeploy) throw new Error(message);
  console.error(message);
}
if (onVercel && !databaseUrl) {
  const message =
    "[auth] DATABASE_URL is not set. Accounts cannot persist on Vercel with the " +
    "in-memory fallback database. Add a Postgres (e.g. Neon) connection string.";
  if (isProductionDeploy) throw new Error(message);
  console.error(message);
}

export const auth = betterAuth({
  baseURL,
  // Deployed apps inject BETTER_AUTH_SECRET. Preview: process-stable secret on
  // globalThis so HMR doesn't invalidate PGLite-backed sessions (see above).
  secret: env("BETTER_AUTH_SECRET") ?? previewAuthSecret(),
  database,

  // CSRF / origin check for credentialed auth POSTs (email sign-up/sign-in, …).
  // See `trustedOrigins` construction above — must cover live preview hosts AND
  // local loopback variants, or clients get "Invalid origin".
  trustedOrigins,

  // Cache the session in the short-lived signed `session_data` cookie so reads
  // (incl. the client's `/get-session`) skip the DB — this shrinks the "loading"
  // window and reduces auth flicker. See the `auth` skill for the full
  // flicker-prevention guidance (gate on `isPending`; SSR the session).
  session: { cookieCache: { enabled: true, maxAge: 300 } },

  // Local email/password — toggled only via `./email-password` (not a plugin).
  ...(emailAndPasswordEnabled ? { emailAndPassword: { enabled: true } } : {}),

  // Staging (Vercel "Preview") deployments may switch the sign-in/sign-up rate limit off, so automated end-to-end
  // tests can create many throw-away accounts quickly. Two keys are needed: AUTH_RATE_LIMIT=off AND the platform
  // reporting exactly VERCEL_ENV=preview. Production (or any other / missing value) always keeps the limit on,
  // even if AUTH_RATE_LIMIT=off is set there by mistake.
  ...(env("AUTH_RATE_LIMIT") === "off" && env("VERCEL_ENV") === "preview"
    ? { rateLimit: { enabled: false } }
    : {}),

  // `__Host-` prefixed cookies: the browser REFUSES any same-named cookie that
  // carries a `Domain` attribute, so a sibling `*.grok.me` app cannot "toss" a
  // `Domain=.grok.me` session cookie onto this app. `__Host-` requires Secure +
  // Path=/ + no Domain; Better Auth otherwise uses `__Secure-` (which permits
  // Domain), so we drop its auto prefix (`useSecureCookies: false`) and set
  // Secure + the names ourselves. (Browsers allow Secure cookies on
  // `http://localhost`, so local dev still works.)
  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
    cookies: {
      session_token: { name: SESSION_TOKEN_COOKIE },
      session_data: { name: "__Host-grok-auth.session_data" },
      account_data: { name: "__Host-grok-auth.account_data" },
      dont_remember: { name: "__Host-grok-auth.dont_remember" },
    },
  },

  plugins: [
    // Bridges Better Auth's Set-Cookie into TanStack Start responses. MUST be
    // last so it runs after every other plugin's hooks.
    tanstackStartCookies(),
  ],
});

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}

