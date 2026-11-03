# LifeOS — set up everything from scratch, securely

One ordered checklist: accounts, database, two repositories, Vercel, the test pipeline, and every security measure.
Do the phases **in order**. Each phase ends with a **✔ Check** — don't move on until it passes.
Menu names are from memory; GitHub, Vercel and Neon rename things now and then — look for the closest label.

**Time:** about 3–4 hours the first time. You can stop at the end of any phase.

---

## The three rules that keep this safe
1. **Never delete the old setup until the new one is green (Phase 9).** Deleting early means no way back.
2. **Secrets go only into the three settings pages** (Neon, Vercel, GitHub Secrets). Never into chat, a repo file, a screenshot, or an email. If you ever paste one somewhere by accident, replace it ("rotate" it) at once.
3. **Change one thing at a time.** The pipeline tells you what broke only if you changed one thing.

## What you will have at the end
```
You → pull request ──► Vercel builds a PREVIEW (staging database, private)
                              │ deploy succeeds
                              ▼
               app repo trigger ──► e2e repo runs smoke tests in a real browser
                              │ writes "e2e / smoke (preview)" onto the pull request
                              ▼
        merge allowed only if green ──► Vercel builds PRODUCTION (production database)
                              │
                              ▼
               e2e smoke (production) + nightly full regression + failure emails
```

## Packages I give you
| File | Goes to | Contains |
|---|---|---|
| `lifeos-app-clean.zip` | app repo, **first upload** | your app (same features as before) + the security fixes + Dependabot, secret scan, `SECURITY.md`; no personal spreadsheet, no scaffold leftovers, no old address |
| `lifeos-e2e-clean.zip` | e2e repo, **first upload** | the whole test framework (92 tests), secret-scan workflow, `SECURITY.md` |
| `app-patch-1-csp-hsts.zip` | later pull request (Phase 8b) | stricter browser security headers (+ a matching e2e test update) |
| `app-patch-2-auth-upgrade.zip` | later pull request (Phase 8b) | removes the unused Grok login, upgrades better-auth to 1.7.14 (fixes the Dependabot alerts) |
| This guide | — | every step |

---

# Phase 0 — Before you delete anything (15 min)

1. ~~Save the app source for me~~ **Done** — the ZIP of the old repo was received and the clean package was built from it.
   *Still keep the old repo until Phase 9.5:* it is your only backup of the app.
2. **Save your own data.** In the live app: Settings → Export → JSON (and Excel if you like). Keep the files on your computer. You can import them into the new app later (Settings → Import).
3. **Do not delete** the old GitHub repos, Vercel projects or Neon databases yet.
4. Open a password manager (or a notes app protected by a password) for the secrets you'll create. A paper notebook in a drawer also works.

✔ **Check:** the ZIP is sent, and your exports are saved.

---

# Phase 1 — Accounts and two-factor (20 min)

| Account | Do this |
|---|---|
| **GitHub** | Profile photo → Settings → **Password and authentication** → turn on two-factor (authenticator app or a passkey). Download the **recovery codes** and store them offline. |
| **Vercel** | Account → Settings → **Authentication**: add a passkey or authenticator app. If you sign in "with GitHub", GitHub's two-factor protects it — still save recovery info. |
| **Neon** | Account settings → **Security**: turn on two-factor. If you sign in with Google/GitHub, enable two-factor on *that* account. |

Also: make sure the email address on each account is one you read daily (alerts go there).

✔ **Check:** each of the three accounts shows two-factor as enabled.

---

# Phase 2 — Databases on Neon (20 min)

**Goal:** two completely separate databases — *production* (real users) and *staging* (test accounts the pipeline creates and deletes).

1. Neon console → **New project**. Name it `lifeos-prod`. Pick the region nearest you.
2. Create a second project `lifeos-staging` the same way.
   *Why two projects instead of two branches:* branches share the same login role/password by default, so a leaked staging password could open production. Two projects share nothing.
   *If your plan only allows one project:* use a second **branch** and create a **separate role** for it (Roles → New role), and use that role's connection string for staging.
3. In each project: **Dashboard → Connect** → choose the **pooled connection** → copy the connection string. It looks like `postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/dbname?sslmode=require`.
4. Check that the string contains `sslmode=require` (encrypted connection). If not, add `?sslmode=require` at the end.
5. Paste each string into your password manager, labelled **PROD DATABASE_URL** and **STAGING DATABASE_URL**. Don't put them anywhere else yet.
6. In each project, check Settings for **IP Allow** — leave it off (Vercel's addresses change), the password is what protects the database.

The tables are created automatically by the app's first deployment — you don't create them by hand.

✔ **Check:** two projects exist; both strings end in `sslmode=require`; they are different.

---

# Phase 3 — GitHub: two repositories and their protection (45 min)

## 3.1 Understand one limit of the free GitHub plan
- **Secret scanning, push protection and branch protection are free only on PUBLIC repositories.** On private repos they need a paid plan.
- **Dependabot alerts** and **Actions** work on both.
- So: start **private** while you set up (nothing secret is in the packages — I scan them — and the Secret-scan workflow checks every upload), then switch to **public** at Phase 8 and turn the protections on *before* your first real change.
- If you prefer to stay private, buy GitHub Pro (branch protection) and accept that push protection won't exist; the Secret-scan workflow still runs.

## 3.2 Create the repositories
1. GitHub → **New repository** → name `lifeos-app` → **Private** → *no* README/license (empty).
2. Again → `lifeos-e2e-tests`, private, empty.
   (Different names from the old repos avoid mix-ups. If you reuse the old names, delete the old repos first — not recommended yet.)

## 3.3 Settings to switch on in BOTH repos (Settings → …)
| Where | Setting | Value |
|---|---|---|
| **Advanced Security** (or Code security) | Dependency graph | On |
| | **Dependabot alerts** | On |
| | **Dependabot security updates** | On |
| | Private vulnerability reporting | On |
| | Secret scanning / Push protection | On if offered (public repos); otherwise do it at Phase 8 |
| **Actions → General** | **Workflow permissions** | **Read repository contents** (not "read and write") |
| | Fork pull request workflows | **Require approval for all outside collaborators** |
| | Actions permissions | "Allow all actions" is fine; stricter: GitHub-owned actions plus `gitleaks/gitleaks-action` (the only outside action the workflows use) |
| **Code security → Dependabot** | Version updates | Config files come in the packages (`.github/dependabot.yml`) |

## 3.4 Upload the code
Unzip the package on your computer. **Show hidden files first** — the `.github` and `.gitignore` entries are hidden by default (Mac Finder: `Cmd+Shift+.`; Windows Explorer: View → Show → Hidden items).
GitHub's web uploader accepts **at most 100 files per upload**, so upload in batches. Each time: repo page → **Add file → Upload files** → drag the items → commit directly to `main`.

| Repo | Batch 1 | Batch 2 |
|---|---|---|
| **App** (139 files) | the whole `src` folder (78 files) | everything else: `scripts`, `docs`, `migrations`, `public`, `server`, `.github` and every file in the top folder (61 files) |
| **E2E** (60 files) | the whole `src` and `tests` folders (41 files) | everything else: `docs`, `.github`, `scripts` and the top-folder files (19 files) |

Rules: upload **only** files from my zips. Never upload a `.env` file, a screenshot of a settings page, or anything containing a password. After each batch, open the repo and check that `.github/workflows` and `.gitignore` are there.

## 3.5 Create the lock file for the e2e repo (once)
A lock file pins the exact version of every library, which blocks surprise (or poisoned) updates.
1. e2e repo → green **Code** button → **Codespaces** → **Create codespace on main**.
2. In the terminal that opens: `npm install` → then `git add package-lock.json && git commit -m "Add lock file" && git push`.
3. Close the codespace (it stops by itself). *(The app repo already has its own lock file.)*

✔ **Check:** both repos show all their files; Actions tab → **Secret scan** ran green on both; Security tab → Dependabot may list alerts for `better-auth` and `zod` — expected, they are fixed in Phase 8b (don't dismiss them yet).

---

# Phase 4 — Vercel project (30 min)

1. Vercel → **Add New → Project** → import `lifeos-app`. Framework preset: leave auto-detected. Don't override the build command.
2. **Before pressing Deploy**, open **Environment Variables** and add these. Tick the environment checkboxes exactly as shown.

| Name | Value | Production | Preview | Development |
|---|---|:--:|:--:|:--:|
| `DATABASE_URL` | **PROD** string from Phase 2 | ✔ | — | — |
| `DATABASE_URL` | **STAGING** string from Phase 2 | — | ✔ | — |
| `BETTER_AUTH_SECRET` | random value **A** (below) | ✔ | — | — |
| `BETTER_AUTH_SECRET` | a **different** random value **B** | — | ✔ | — |
| `BETTER_AUTH_URL` | `https://<your-project>.vercel.app` (your production address, no trailing `/`) | ✔ | — | — |
| `AUTH_RATE_LIMIT` | `off` | — | ✔ | — |

- **Generating A and B:** open any browser → F12 → **Console** → paste `Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')` → Enter. Run it twice. It runs on your own computer — nothing is sent anywhere. Save both in the password manager.
- Use Vercel's **Sensitive** toggle on `DATABASE_URL` and `BETTER_AUTH_SECRET` if shown: the value can never be read back from the dashboard (you can still replace it).
- **Never** set `AUTH_RATE_LIMIT=off` on Production. (The code also ignores it there, as a safety net.)
- **Production address:** the project name you choose decides it (`<name>.vercel.app`). After the first deploy, Settings → Domains shows the real address; if it differs from what you put in `BETTER_AUTH_URL`, correct the variable and redeploy.
- Optional custom domain later: add it under Domains, then add `TRUSTED_ORIGINS=https://yourdomain.com` (Production).
3. Press **Deploy**.

## 4.1 Protect the preview deployments (new — recommended)
Previews have the sign-in rate limit switched off, so they should not be open to the world.
1. Project → Settings → **Deployment Protection** → **Vercel Authentication** → On, applied to **Preview deployments** (keep Production public).
2. On the same page → **Protection Bypass for Automation** → create a secret → copy it into the password manager as **VERCEL BYPASS**. The e2e pipeline uses it to get in (Phase 6).

## 4.2 Optional: a firewall rule for sign-in
Project → **Firewall** → add a rule: *If request path starts with `/api/auth/` → Rate limit → 20 requests per minute per IP.* This adds a limit that works across all server instances (the app's built-in limit counts per instance). Availability depends on your Vercel plan — skip if it's not offered.

✔ **Check:** the deployment succeeds (green). If the build fails, open its **Build Logs** and send me the red lines.

---

# Phase 5 — Test the new production site by hand (15 min)

Open `https://<your-project>.vercel.app` and check each item:
1. `/api/auth/diagnostics` → shows only true/false flags and `"database": "connected"`, `"authTablesComplete": true`, **`"databasePooled": true`** (if it says `false`, you pasted Neon's *direct* connection string — switch to the pooled one, Phase 2 step 3). **No** connection string or host name anywhere.
2. Create an account → you land in the app. Sign out → you return to the login page. Sign in again.
3. DevTools (F12) → **Application → Cookies**: the session cookie (`__Host-grok-auth.session_token`) has **HttpOnly ✔, Secure ✔, SameSite Lax**.
4. DevTools → **Network** → click the page's first request → **Response headers** include `x-content-type-options: nosniff` and `x-frame-options: DENY`.
5. Visit `/.env`, `/.git/config`, `/package.json` → none shows a file (a "not found" or the normal page is fine).
6. Settings → Delete account → confirm the account is gone (this also tests data deletion).

✔ **Check:** all six pass. (Item 5 and the headers are re-tested automatically later.)

---

# Phase 6 — Connect the app repo and the e2e repo (45 min)

## 6.1 Create two access tokens (fine-grained, with an expiry)
GitHub → profile photo → Settings → **Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.

| Token name | Repository access | Permission | Expiry | Saved as |
|---|---|---|---|---|
| `lifeos-dispatch` | **Only** `lifeos-e2e-tests` | Contents: **Read and write** | 90 days | secret `E2E_DISPATCH_TOKEN` in the **app** repo |
| `lifeos-status` | **Only** `lifeos-app` | Commit statuses: **Read and write** | 90 days | secret `APP_STATUS_TOKEN` in the **e2e** repo |

Put a reminder in your calendar for day 80 to replace both (see Maintenance).

## 6.2 App repo — Settings → Secrets and variables → Actions
| Type | Name | Value |
|---|---|---|
| Secret | `E2E_DISPATCH_TOKEN` | the `lifeos-dispatch` token |
| Variable | `E2E_REPO` | `<your-username>/lifeos-e2e-tests` |
| Variable | `E2E_PROD_URL` | `https://<your-project>.vercel.app` (**stable** production address, no trailing `/`) |
| Variable | `E2E_ON_PREVIEW` | `true` |

The workflow file `.github/workflows/trigger-e2e.yml` is already in `lifeos-app-clean.zip`.

## 6.3 E2E repo — Settings → Secrets and variables → Actions
| Type | Name | Value |
|---|---|---|
| Secret | `APP_STATUS_TOKEN` | the `lifeos-status` token |
| Secret | `VERCEL_BYPASS_SECRET` | the bypass secret from 4.1 |
| Variable | `E2E_BASE_URL` | `https://<your-project>.vercel.app` |
| Variable | `E2E_NIGHTLY_URL` | same address (nightly full run) |

(`ALLURE_PAGES` stays unset.)

## 6.4 First run by hand
e2e repo → **Actions → E2E tests → Run workflow** → suite `smoke` → Run.
✔ **Check:** green. If it fails at "Check the target URL", the variable is wrong; at "Wait until the site answers", tell me the error line.

---

# Phase 7 — Prove the whole chain with a dry-run pull request (30 min)

1. App repo → edit `README.md` on a **new branch** (the editor offers "Create a new branch") → open a pull request.
2. Vercel builds a preview → the app repo's **Actions** shows "Trigger e2e" → the e2e repo's Actions starts a run → after ~3 minutes the pull request shows **`e2e / smoke (preview)`** green with numbers.
3. Merge. Vercel deploys production → **`e2e / smoke (production)`** appears on the commit.

✔ **Check:** both statuses appeared. (If nothing appears, the two usual causes are a missing/expired token or `E2E_REPO` typed wrong — send me the "Trigger e2e" log.)

---

# Phase 8 — Lock the gates (30 min)

## 8.1 Switch both repos to public (if you chose this route)
Settings → General → bottom **Danger Zone → Change visibility → Public**. Before you do, re-read the file list of each repo once: nothing personal.
Then immediately enable **Secret scanning** and **Push protection** (Settings → Advanced Security).

## 8.2 Branch protection on `main` — app repo
Settings → **Rules → Rulesets → New branch ruleset**:
- Target: default branch.
- ✔ Restrict deletions · ✔ Block force pushes · ✔ Require a pull request before merging (0 approvals is fine when you work alone)
- ✔ **Require status checks to pass** → add **`e2e / smoke (preview)`** (it only appears in the list after Phase 7 ran once)
- Bypass list: leave empty. (If the pipeline itself ever breaks and blocks you, temporarily set the ruleset to "Disabled", fix, re-enable.)

## 8.3 Branch protection — e2e repo
Same ruleset; required checks: **`Smoke (desktop + mobile)`** and **`Scan for committed secrets`**.

## 8.4 Failure emails
GitHub → Settings → **Notifications → System → Actions**: notify by **Email**, tick **Send notifications for failed workflows only**.
**Test:** e2e repo → Actions → E2E tests → Run workflow → *Site to test* = `http://not-secure` → Run. It turns red within seconds and you get an email within minutes. (Nightly alerts go to whoever last edited the `cron:` line of `e2e.yml` — you.)

✔ **Check:** a pull request without the green `e2e / smoke (preview)` has a disabled Merge button; the test email arrived.

---

# Phase 8b — Hardening pull requests (one at a time, each through the gate)

Both changes are riskier than the rest because **I could not build the app in my workspace**: the preview build and the e2e gate are the real test. That is why they come *after* the pipeline works, one per pull request, so a failure points at exactly one change. Each zip has its own `README-PATCH-…md`.

| Order | Zip | What to do | If it fails |
|---|---|---|---|
| 1 | `app-patch-1-csp-hsts.zip` | New branch → replace `vercel.json` → pull request → wait for green → merge → upload the e2e file from the zip | open the preview, F12 → Console, send me the "Refused to…" lines; revert the pull request |
| 2 | `app-patch-2-auth-upgrade.zip` | New branch → upload 7 files, delete 6 files, refresh the lock file in a Codespace (steps in the zip's README) → pull request → green → merge | send me the red `error` box from Vercel **Build Logs**; revert the pull request |

After patch 2 merges, Dependabot's critical and high alerts should close by themselves (give it up to a day). Then sign in once on production and run the e2e **regression** suite.
Do **not** start patch 2 before patch 1 is merged and green.

---

# Phase 9 — Security acceptance tests (30 min) — then retire the old setup

## 9.1 Run the security suites
e2e repo → Actions → E2E tests → Run workflow → suite `regression` → Run (about 8–10 minutes). This includes the 25+ API and security tests: sensitive files not served, malformed requests give clean errors, headers present, cookies locked down, data endpoints refuse strangers, XSS names stay text, share links leak nothing.
✔ All green. (If one fails, send me its message; the guide `docs/API-AND-SECURITY-TESTS.md` explains the likely causes.)

## 9.2 Check the rate limit in both environments
Actions → E2E tests → Run workflow, suite **`ratelimit`**:
- `base_url` = your **production** address, `expect_rate_limit` = **on** → it must pass (you see a `429` among the statuses).
- Then a **preview** address (copy one from a pull request's Vercel comment), `expect_rate_limit` = **off** → it must pass.
Note: a passing "on" result still only proves the limit exists; the app's built-in counter works per server instance, so the optional firewall rule (4.2) is the stronger guard.

## 9.3 Dependabot
App repo → Security → **Dependabot**: no open critical/high alerts. If there are, send me the list; don't merge an upgrade before it passes the preview gate.

## 9.4 Walk through the five prompts
Go through **Appendix C**: every one of the five checks has a "where it's covered" and "how to verify" line.

## 9.5 Retire the old setup — in this order
1. Old **Vercel** project → Settings → Advanced → **Delete Project**.
2. Old **Neon** project → Settings → **Delete project**.
3. Old **GitHub** repos → Settings → Danger Zone → **Delete this repository** (this also removes the personal spreadsheet that sat in the old history).
4. GitHub → Developer settings → **delete the old tokens** (`E2E_DISPATCH_TOKEN` / `APP_STATUS_TOKEN` from the old setup).
5. Anywhere you saved the old `BETTER_AUTH_SECRET` or database string: delete it.

✔ **Check:** the new pipeline still works after the old one is gone (do one more tiny pull request).

---

# Maintenance (put these in your calendar)
| When | What |
|---|---|
| Weekly | Merge Dependabot pull requests **only when `e2e / smoke (preview)` is green** |
| Every 80 days | Replace both access tokens (create new → update the secret → delete the old one) |
| After every real feature | Ask me to **re-run the five-check security review** (Appendix C) — new code means new attack paths |
| Every few months | Run the manual `ratelimit` check again; open `/api/auth/diagnostics` |
| If you ever paste a secret somewhere by mistake | **Replace it immediately** (new database password in Neon / new secret in Vercel), then redeploy |

---

# Appendix A — every secret and variable
| Where | Name | Kind | Value comes from | Scope |
|---|---|---|---|---|
| Vercel | `DATABASE_URL` | secret | Neon prod string | Production only |
| Vercel | `DATABASE_URL` | secret | Neon staging string | Preview only |
| Vercel | `BETTER_AUTH_SECRET` | secret | random value A | Production only |
| Vercel | `BETTER_AUTH_SECRET` | secret | random value B (different) | Preview only |
| Vercel | `BETTER_AUTH_URL` | plain | production address | Production only |
| Vercel | `AUTH_RATE_LIMIT` | plain | `off` | Preview only — **never Production** |
| Vercel | `TRUSTED_ORIGINS` | plain | custom domain(s), comma-separated | Production, only if you add a domain |
| App repo | `E2E_DISPATCH_TOKEN` | secret | fine-grained token, e2e repo only | — |
| App repo | `E2E_REPO`, `E2E_PROD_URL`, `E2E_ON_PREVIEW` | variables | as in 6.2 | — |
| E2E repo | `APP_STATUS_TOKEN` | secret | fine-grained token, app repo only | — |
| E2E repo | `VERCEL_BYPASS_SECRET` | secret | Vercel automation bypass | — |
| E2E repo | `E2E_BASE_URL`, `E2E_NIGHTLY_URL` | variables | production address | — |

# Appendix B — security measures and where each one lives
| # | Measure | Phase | Verified by |
|---|---|---|---|
| 1 | Two-factor on GitHub, Vercel, Neon | 1 | each shows "enabled" |
| 2 | Separate production and staging databases | 2, 4 | Phase 4 table; staging has only `lifeos-e2e+…` users |
| 3 | Different `BETTER_AUTH_SECRET` per environment | 4 | Phase 4 table |
| 4 | Database over TLS (`sslmode=require`) | 2 | string check |
| 5 | Dependabot alerts + security updates | 3.3, 9.3 | Security tab |
| 6 | Secret scanning + push protection (public repos) | 3, 8.1 | Settings → Advanced Security |
| 7 | Second secret scanner in CI (Gitleaks) | 3.4 | "Secret scan" workflow green |
| 8 | Least-privilege Actions token + approval for outside PRs | 3.3 | Actions → General |
| 9 | Fine-grained, single-repo tokens with expiry | 6.1 | tokens page shows expiry |
| 10 | Branch protection with required e2e gate | 8.2–8.3 | Merge button disabled on red |
| 11 | Preview deployments behind Vercel Authentication | 4.1 | preview link asks to log in |
| 12 | Sign-in rate limit on, per environment | 9.2 | `ratelimit` suite |
| 13 | Optional firewall rate limit | 4.2 | Vercel Firewall page |
| 14 | Production trusts only its own origin; production refuses to start without its secret or database | code | Phase 5 sign-in; API/security tests |
| 14b | Content-Security-Policy + HSTS; unused broker login removed; better-auth 1.7.14 | 8b | header test; Dependabot alerts close |
| 15 | Error screens/APIs never show internals | code | error-probe tests |
| 16 | Diagnostics page shows yes/no only | code | `diagnostics.api` test |
| 17 | Security headers | code | header test, Phase 5 item 4 |
| 18 | Cookies HttpOnly/Secure/SameSite, logout kills token | code | `session.spec` |
| 19 | No file/secret exposure (`/.env`, `/.git`, …) | code | exposure tests |
| 20 | Private data only via owner session; cross-site blocked | code | `data-access.spec` |
| 21 | Share link strips private text; XSS-safe names | code | `share-link.spec` |
| 22 | Failure emails + nightly regression | 8.4 | test email |
| 23 | Token rotation, weekly Dependabot, re-run five checks | Maintenance | calendar |
| 24 | Old setup retired, old tokens deleted | 9.5 | — |

# Appendix C — the five checks (from "5 Security Checks Before You Launch Your App")
| Check | What it asks | Covered by | How to verify |
|---|---|---|---|
| **1 Secrets** | no secret literals; env vars only; no secrets behind browser-visible prefixes; `.env` ignored + `.env.example`; none in logs/responses; rotate if ever committed | code scan (none found); Phase 4 env vars; `.gitignore`; Gitleaks + GitHub scanning; `diagnostics` test; Phase 3.5/9.5 | Secret-scan green; Vercel env list; only `VITE_AUTH_ENABLED` / `VITE_STUN_URLS` are browser-visible and non-secret |
| **2 Personal data** | map data flow; clean logs; third parties; password hashing; cookie flags; filtered responses; deletion | data-flow table in `docs/SECURITY-AUDIT.md` (own database; Google Fonts only); passwords are hashed by the auth library; cookie test; share link stripping; Delete-account button | Phase 5 items 3 and 6; `session.spec`; `share-link.spec` |
| **3 Pre-deploy** | required env vars; no debug/test endpoints; generic errors; security headers; auth rate limits; no wide-open CORS; database TLS | Phase 4 vars; error handling + diagnostics fix; `vercel.json` headers; Better Auth limits + firewall rule; same-origin only (no CORS headers); Phase 2 TLS | exposure + header tests; `ratelimit` suite |
| **4 Deep audit** (auth/logic) | route auth; no IDOR; reset tokens; token handling; server-side logic; parameterised SQL; XSS; uploads | every server function derives the user from the session (no id in requests); no password reset or payments exist yet; server-side session revocation on logout; no file uploads (imports parse in the browser) | `data-access.spec`; `session.spec`; XSS test |
| **5 Attacker's view** | ID tampering; login bypass; privilege escalation; abuse limits; injection; exposed internals; business logic | owner-scoped data; refusal without session and from other sites; no roles exist; rate limits; XSS and malformed-input tests; 15 sensitive paths probed | full `regression` run (Phase 9.1) |
*Re-run all five after every feature; tell me and I will do it with you.* AI review is not a substitute for a human security review if the app ever handles real money or sensitive data at scale.

# Appendix D — if something goes wrong
| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails on Vercel | package or code error | send the red lines from **Build Logs** |
| Sign-in says "address isn't trusted" | `BETTER_AUTH_URL` doesn't match the address you opened | correct the variable (Production), redeploy |
| Nothing appears on the pull request | token missing/expired, `E2E_REPO` typo | check 6.1–6.3; read the "Trigger e2e" log |
| Smoke fails with `429` | too many sign-ups from the runner | the tests retry automatically; if repeated, confirm `AUTH_RATE_LIMIT=off` is on Preview |
| "Wait until the site answers" fails | preview is protected and bypass secret is missing | add `VERCEL_BYPASS_SECRET` (6.3) |
| Merge button stuck grey | required status not green | open the run; fix; or temporarily disable the ruleset |
| You pasted a secret somewhere | exposure | replace the secret at its source immediately, redeploy, then tell me |

# What I could not verify for you
I cannot open your GitHub, Vercel or Neon settings, nor run the app from my workspace. Menu names, plan limits (rulesets, secret scanning, firewall rules) and the exact Vercel/Neon screens may differ — if a step doesn't match, send a screenshot with passwords hidden and I will adjust it.
