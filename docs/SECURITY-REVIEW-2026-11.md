# Security review, November 2026 (the 5 checks)

Scope: the whole repository as uploaded (`lifeos-app-main.zip`), plus the full git history (42 commits) and the e2e repository,
to make sure no change breaks the merge gate. An AI review does not replace a human one for apps handling real money or sensitive data at scale.

## Check 1: secret leaks
- **Found:** no secrets in the code, config or any of the 42 commits (only placeholders in docs and one test fixture). Secrets are read from environment variables only; nothing sensitive sits behind a `VITE_` prefix. But the repository had **no `.gitignore`** and no `.env.example`, so a stray `.env` or `node_modules` could be committed by accident.
- **Fixed:** added `.gitignore` (ignores `.env*`, build output, dependencies) and `.env.example` (placeholders only). Gitleaks keeps running on every push.

## Check 2: personal data flow
- **Found:** the app collects an email, a display name, a password (hashed by Better Auth, scrypt) and the habit log. Data goes to Neon (your database) and nowhere else. The only third party the browser talks to is **Google Fonts**, which therefore sees visitors' IP addresses. The session cookie is `__Host-`, Secure, HttpOnly, SameSite=Lax. Nothing personal is kept in localStorage. Errors are generic. The public share view strips private text. Account deletion exists.
- **Not changed:** self-hosting the fonts (would also let the CSP drop two Google hosts). It changes how every page looks, so it should be its own PR checked on the staging preview.

## Check 3: pre-deploy production audit
- **Found, already fine:** production refuses to start without the secret and the database; security headers (nosniff, DENY, HSTS 1 year, CSP, Referrer/Permissions policy); no CORS headers (same-origin only); generic errors.
- **Found, weak:** sign-in rate-limit counters were kept in each server instance's memory, so an attacker spread across Vercel instances got more guesses than intended.
- **Fixed:**
  - Counters now live in the database (`migrations/0004_rate_limit.sql`, Better Auth `rateLimit.storage = "database"`). Sign-in is limited to **5 attempts per minute per IP**. Tested against a real Postgres: attempts 1-5 answered 401, attempt 6 answered 429, and the block survived a server restart (proof the counter is shared, not in memory).
  - Staging is unchanged: the limit is still switched off only with `AUTH_RATE_LIMIT=off` **and** `VERCEL_ENV=preview`.
  - Added `Cache-Control: no-store` on `/api/*` and `/_serverFn/*` and `Cross-Origin-Opener-Policy: same-origin`.
  - A loud log line if `DATABASE_URL` has no `sslmode=require` on Vercel (the connection must be encrypted).
- **Kept on purpose:** `/api/auth/diagnostics` is public but only returns yes/no flags; the e2e health check and the CI wait step depend on it.
- **Accepted risk:** the CSP still allows `'unsafe-inline'` scripts, which the framework's page hydration needs. Removing it needs nonces (a separate project).

## Check 4: deep audit of auth and logic
- **Found:** every data server function runs behind `authMiddleware` and takes the user id from the verified session, never from the request, so there is no IDOR. The only public function is the share view, which accepts a 24-byte random token of the right shape. Input is validated by an allow-list (`parseLifeData`) with size limits. SQL is parameterised. There is no `dangerouslySetInnerHTML`, `eval` or similar. CSV export already neutralises formula cells; the Excel export writes text cells. No payments, uploads or password reset exist yet.
- **Fixed:** nothing needed. `npm audit` reports 0 vulnerabilities. The unused `jose` dependency was removed to shrink the supply chain.
- **Open item (not security, but matters):** autosave replaces the whole log. A stale tab or second device can overwrite newer data. Candidate for the next PR (version check on save).

## Check 5: attacker's perspective
- **Found:** share tokens cannot be guessed; only the owner can create or revoke them. `/.env`, `/.git`, `package.json` and similar are not served (the e2e `exposure` tests assert this). There are no admin panels or Swagger pages. The old sandbox preview message listener could never be reached (framing is blocked by `frame-ancestors 'none'`) but was unneeded code.
- **Fixed:** removed the unused preview bridge and the other unused sandbox code (see CHANGES).
- **Re-run this review after every major feature** (forgot-password especially: single-use, 15-minute, hashed tokens, no account enumeration).
