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

## Recheck for v1.1.0 (sync safety)
1. **Secrets:** no new variables or secrets; gitleaks and `.gitignore` unchanged.
2. **Personal data:** the conflict reply contains only the signed-in user's own log. No new third parties, no new logging.
3. **Pre-deploy:** one new migration (`0005`, `add column if not exists`, safe to re-run, applied on staging first). Responses stay `no-store`, which now matters because the foreground refresh reads the log with a GET request.
4. **Deep audit:** the user id still comes only from the verified session (no IDOR). `baseVersion` must be a non-negative integer or the request is refused. SQL is parameterised. A stale save writes nothing. The retry loop is capped at 4 attempts.
5. **Attacker's view:** an attacker cannot read or overwrite another account's log by guessing versions, because every query is also keyed by the session's user id. Repeated saves are the same abuse surface as before.

## Recheck for v1.2.0 (recurring to-dos)
1. **Secrets:** nothing new.
2. **Personal data:** the new fields (`repeat`, `spawned`) live inside the same private log. Not part of the public share view (to-dos are stripped there). The export gains a "Repeats" column in your own download only.
3. **Pre-deploy:** no new endpoints, headers or migrations.
4. **Deep audit:** the server validates `repeat` against a fixed list and `spawned` as a short id; anything else is dropped. The 500-task limit also stops a repeating task from creating tasks without end.
5. **Attacker's view:** no new input reaches the server except those two validated fields; no new abuse path beyond saving the log, which was already limited per user.

## Recheck for v1.3.0 (streak freeze)
1. **Secrets:** nothing new.
2. **Personal data:** one new field (`freezeDays`, a list of dates) inside the same private log; it is also kept in the public share summary only so the shared streak matches yours (dates only, no text).
3. **Pre-deploy:** no new endpoints, headers, variables or migrations.
4. **Deep audit:** the server accepts `freezeDays` only as ISO-date keys with the value `true`, at most 400 entries; anything else is refused. The "2 per 30 days" rule is enforced in the app only; a modified client could store more freezes, which only affects that user's own stats.
5. **Attacker's view:** no other user's data is reachable through this field; nothing is rendered as HTML.

## Recheck for v1.4.0 (safer backup and restore)
1. **Secrets:** nothing new. (A backup file contains your own log; keep it private like any export.)
2. **Personal data:** the safety copy stays in the same private database row (never in the browser's storage, so nothing is left behind on a shared device) and is deleted with the account. Backups are read in the browser only; the file is never uploaded as a file.
3. **Pre-deploy:** one migration (`0006`, `add column if not exists`, applied on staging first). New server functions need a signed-in session and use `no-store` responses.
4. **Deep audit:** a backup goes through the same strict validation as every save (key allow-lists, length limits, 2 MB), plus a 5 MB file limit and plain error messages. The user id still comes only from the session. SQL is parameterised. Backup labels (`exportedAt`, `appVersion`) are only shown if they match a fixed pattern and are rendered as text.
5. **Attacker's view:** a malicious backup file can only change the importing user's own data, and the preview plus the safety copy make a wrong or hostile file easy to undo. No file content is ever rendered as HTML.

## Recheck for v1.5.0 (phone push notifications, part 1)
1. **Secrets:** a new secret appears: the VAPID private key. It lives only in Vercel's environment variables (never in the repository, the browser or a log); `.env.example` has placeholders and `docs/PUSH-SETUP.md` says to use a separate pair for staging and production. Gitleaks still runs on every push.
2. **Personal data:** a push subscription (push-service address plus two encryption keys) is stored per device, tied to the user, deleted with the account or when the device is turned off or reported gone. The notification text is generic; it contains no habit or journal data.
3. **Pre-deploy:** one new migration (`0007`, `create table if not exists`). New server functions need a signed-in session and return `no-store`. The service worker file is served with `Cache-Control: no-cache`; the existing CSP already allows it (`worker-src` falls back to `script-src 'self'`).
4. **Deep audit:** the main risk of this feature is **SSRF**: the server sends a request to the address each device registers, so a signed-in user could try to register an internal address. Fixed by an allow-list of the real push services (Google FCM, Mozilla, Apple, Windows) checked when saving AND again right before sending; https only, no credentials, no custom ports, no IP addresses. Tested with look-alike hosts, `169.254.169.254`, `localhost` and private ranges. Keys are format-checked, devices per account are capped at 10, and test pushes are limited to one per 30 seconds per user. SQL is parameterised. Only the owner can remove their own device.
5. **Attacker's view:** the service worker opens only the app's own home page (never an address from the message), truncates the message text and caches nothing. A stolen subscription cannot be used without the server's private key; a stolen private key would allow fake notifications, so rotate it (generate new keys, update Vercel, redeploy) if it is ever exposed.

## Recheck for v1.6.0 (scheduled reminders, import message fix)
1. **Secrets:** a second secret, `CRON_SECRET`, lives only in Vercel (Production) and GitHub Actions secrets; never in the repository or logs. The workflow does not print it. `.env.example` has a placeholder. Gitleaks still runs on every push.
2. **Personal data:** the server now stores the reminder time, the on/off choices and the time zone (no habit data). A reminder run reads a user's log only to decide whether to nudge; the notification text is generic and the endpoint answers with counts only.
3. **Pre-deploy:** one migration (`0008`, `create table if not exists`). The new endpoint is closed (503) when `CRON_SECRET` is missing or shorter than 32 characters, returns `no-store`, and logs only an error name on failure.
4. **Deep audit:** the cron endpoint accepts POST only and compares the secret in constant time (both sides hashed first), so it cannot be timed or brute-forced cheaply; without the secret it does nothing. Settings are validated (boolean flags, HH:MM, a real time zone name up to 64 characters). All queries are parameterised and keyed by the session's user id. At most 500 users are processed per run. A reminder counts as sent only after a device accepted it, so a failed send is retried, never silently dropped or repeated.
5. **Attacker's view:** guessing or replaying the endpoint without the secret yields only 401. A leaked secret would let someone trigger reminder runs early, but a user still receives at most one daily and one weekly push per day (dates are recorded), and no data is returned; rotate it by changing both copies. The import message fix changes only what is displayed.
