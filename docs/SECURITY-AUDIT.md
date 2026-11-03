# LifeOS security audit — findings and fixes

Scope: the app source as of version 4.3 plus these fixes (this repository's first commit already contains them). The audit read every file and ran pattern searches; it did **not** send live requests to the site and did **not** see the Git history or the GitHub / Vercel / Neon settings (see "What only you can check").

## Summary
| # | Area | Result | Status |
|---|---|---|---|
| 1 | API keys / secrets in code | No real secret found. One public scaffold value (see 1) | OK, explained |
| 2 | Dot-files and personal files | A personal spreadsheet sits in the project folder; ignored by Git, but its history must be checked | **You check** |
| 3 | Where user data goes | Own database only (+ Google Fonts); private text never leaves via share links | OK |
| 4 | Error screens leaking internals | **3 leaks found** (error page, sign-in message, diagnostics page) + database errors on the wire | **Fixed** |
| 5 | Sign-up / sign-in rate limit | Production ON but weak on serverless; staging OFF by design, cannot be switched off in production | **Check + optional upgrade** |
| 6 | Attacker's view of endpoints | **Any `*.vercel.app` site was a trusted origin in production**; no security headers | **Fixed** |

## 1. API keys and secrets in code
- Searched for AWS/Google/Stripe/Slack/Anthropic key shapes, private-key blocks, `ghp_`/`github_pat_` tokens, database URLs with passwords, JWTs and 64-character hex strings. **Nothing real.**
- Every `process.env` read was listed. Only `VITE_AUTH_ENABLED` and `VITE_STUN_URLS` reach the browser (they are `VITE_`-prefixed on purpose); neither is secret. The real secrets (`DATABASE_URL`, `BETTER_AUTH_SECRET`) are read server-side only and live in Vercel's settings.
- **One 64-character value** in `src/lib/auth/preview.ts` (`PREVIEW_CLIENT_SECRET`). It is the Grok scaffold's *shared, public* "live preview" client, limited to `*.grok-sandbox.com`, and the auth provider stores only its hash. **Do not delete it**: the app's sign-in check uses it as a fallback, so removing it would sign everyone out. Low risk; leave it.
- `.env.example` contains placeholders only (`user:password@host`, `replace-with-…`).

## 2. Dot-files and exposed files
Found in the project folder: `.env.example` (safe), `.gitignore`, `.prettierrc`, `.grok/` (scaffold tooling, ignored), `.tanstack/` (ignored), `.node_modules.lock` (scaffold leftover — now ignored), `AGENTS.md` (scaffold notes; harmless but noise in a public repo), and **`a personal spreadsheet`** (your personal data).
- `attachments/` is in `.gitignore`, so it is not uploaded **unless it was committed before the rule existed**. Check the history (commands below). If it is there, the file is public even though it is no longer in the folder.
- Added to `.gitignore`: `.node_modules.lock`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.sqlite`, `*.db`.
- New automated test: 15 sensitive addresses (`/.env`, `/.git/config`, `/package.json`, `/src/lib/auth/server.ts`, `/migrations/…`, the spreadsheet, …) must not be downloadable from the live site.

**Check your Git history** (needs a copy of the repo on any computer, or GitHub's search):
```
git clone https://github.com/Pranavchvn7/LifeOS.git && cd LifeOS
git log --all --oneline -- attachments .env .env.local          # any commits touching them?
git log --all -p -S"postgresql://" --oneline | head             # a database URL ever committed?
git log --all -p -S"BETTER_AUTH_SECRET=" --oneline | head
```
If any of those print something: **rotate** the secret first (new database password in Neon, new `BETTER_AUTH_SECRET` in Vercel — all users are signed out, which is fine), *then* clean the history. Rotating matters more than cleaning, because anyone may already have copied it.

## 3. Where user data goes
| Data | Where it goes | Exposure |
|---|---|---|
| Name, email, password | Neon database (`user`, `account`; password stored as a hash, never plain) | Server only |
| Habits, notes, journal, goals, to-dos | Neon `life_logs.payload` (one JSON text per user) | Readable only with the owner's session; every query is scoped by the session's user id, never by an id the browser sends |
| Share link | Neon `share_links` (random 24-byte token) | Public, read-only; the server **removes** notes, journal, one-liners, reflections, to-dos and weekly reviews before sending |
| Theme, reminder time, "badges already seen" | Browser `localStorage` | No private text |
| Exports (Excel/CSV/JSON) | Built in the browser and saved to the visitor's computer | Never sent to a server |
| Fonts | Google Fonts (visitors' IP addresses reach Google) | Privacy note only; self-hosting the fonts would remove it |
| Logs | Vercel function logs (errors only) | No user text is logged |
No analytics, tracking, or other third-party scripts exist in the code.
**Not encrypted by the app**: journal text sits as plain JSON in the database (Neon encrypts the disk). Fine for a habit tracker; if you ever store sensitive health or finance notes, add app-level encryption.

## 4. Error screens that exposed internals — FIXED
| Leak | Why it mattered | Fix |
|---|---|---|
| "Something went wrong" page printed the raw error text | A database failure message can include the database host or user name | Shows a generic message; the real text only appears in local development |
| Sign-in/sign-up showed "Server said: <raw text>" for unknown errors | Same | Removed; rate limiting now has its own clear message ("Too many attempts… (429)") |
| Public `/api/auth/diagnostics` returned the database's error message and the list of table names | Anyone could read it | Yes/no flags only; the reason goes to the Vercel logs |
| Server functions send error text to the browser | A database error could travel to anyone triggering it | New safety net (`safe-error.server.ts`): errors that look like database/connection problems are replaced with a generic message and logged in full; your own messages ("Unauthorized", "Invalid link.") are unchanged |
Automated tests now probe 5 malformed requests (non-JSON, wrong types, a 500 KB name, bad URL escape, unknown address) and require a clean 4xx with no stack trace or connection string.

## 5. Sign-up / sign-in rate limit
| Environment | Setting | Reality |
|---|---|---|
| **Production** | On (Better Auth default in production mode, about 3 attempts per 10 seconds per IP for sign-in/sign-up) | Counts are kept **in each server instance's memory**. Vercel runs many short-lived instances, so the limit is *partly* effective: an attacker who is spread across instances gets more tries than intended |
| **Staging preview** | Off, because `AUTH_RATE_LIMIT=off` in the Preview environment (lets the e2e tests create accounts) | Intended. The code refuses this switch when `VERCEL_ENV=production`, even if it is set there by mistake |
**Measure it, don't trust it.** New manual check: Actions → E2E tests → Run workflow → `suite = ratelimit`, `expect_rate_limit = on` with the production address, then again with `off` and a preview address. It sends 15 wrong sign-ins for a non-existent email and reports the statuses it got.
**Stronger option (not applied, needs staging first):** store the counters in the database so every instance shares them. In `server.ts`, `rateLimit: { enabled: true, storage: "database" }` plus a `rateLimit` table (generate its exact SQL with `npx @better-auth/cli generate`). I did not apply it blind: a wrong table definition would break every sign-in.

## 6. The attacker's view
Checked by reading each server function and route:
- **Changing ids in requests (IDOR):** every server function takes the user from the verified session, never from the request. There is no "user id" field to tamper with. ✔
- **Calling data endpoints without logging in / from another website:** refused (session check + cross-site guard). Covered by a test from the previous step. ✔
- **Guessing share links:** 24 random bytes — not guessable; format is validated; revoke/regenerate kills the old link. ✔
- **Oversized or malformed saves:** capped at 2 MB, lists and text clipped. ✔
- **Which sites may call the sign-in API: FOUND AND FIXED.** In production the app trusted *every* `*.vercel.app` address (anyone can register one), plus the Grok sandbox hosts and `localhost`. Now production trusts only its own addresses; staging previews keep the wildcard because their addresses change every deployment.
- **Missing browser protections: FIXED.** `vercel.json` now sends `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (no clickjacking), `Referrer-Policy`, `Permissions-Policy`. Vercel already adds HSTS on its domains. A Content-Security-Policy is the next step, but only as *report-only* first, because the theme script and chart styles are inline.
- **Accepted trade-offs:** sign-up says "already exists" (email enumeration, standard for sign-up forms); no email verification; password minimum is 8 characters.

## What changed (files)
`src/lib/error-component.tsx`, `src/routes/login.tsx`, `src/routes/api/auth/$.ts`, `src/lib/auth/server.ts`, `src/lib/auth/middleware.ts`, new `src/lib/auth/safe-error.server.ts`, `vercel.json`, `.gitignore`, this document.
These could not be built in the sandbox (no installed packages): each file passed a syntax check only. **Your preview build and the smoke gate are the real test** — so deliver them through a pull request.

## Rollout, and how to undo it
1. Pull request with the app files → wait for `e2e / smoke (preview)` to turn green → merge.
2. After the production deploy: sign in once at `https://YOUR-APP.vercel.app`, then run the e2e **regression** suite by hand.
3. **If sign-in fails in production** with "address isn't trusted": set `TRUSTED_ORIGINS` in Vercel to the address you are using (comma-separated for several), or revert the pull request. Production trusts only `BETTER_AUTH_URL`, Vercel's production address and the deployment's own address.

## What only you can check
Two-factor on GitHub / Vercel / Neon; branch protection and secret scanning + push protection on both repos; Dependabot alerts on; access tokens with expiry dates; the Preview environment points at the **staging** database; `BETTER_AUTH_SECRET` differs between Production and Preview; the Git-history commands in section 2.
