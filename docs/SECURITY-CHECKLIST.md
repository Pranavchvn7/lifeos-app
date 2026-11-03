# Security checklist — what is in place, what is added, what is planned

Reviewed against the fresh build (first-commit package) for two outside checklists: **TanStack Start / Better Auth / Neon** (document 1) and **Prisma on Neon** (document 2).
Legend: ✅ in place and verified in the code · 🧪 added now, with an automatic test · 🔜 planned (which step) · ➖ not applicable (why) · ⚙ a setting only you can switch on (guide phase).

## Document 1 — TanStack Start + Better Auth + Neon
| # | Check | Status | Evidence / what to do |
|---|---|---|---|
| 1.1 | Every data server function re-checks the session | ✅ | 6 of 7 server functions use `authMiddleware` (save log, load log, create/revoke/read share link, delete account). The 7th, `getSharedProgress`, is the deliberate public share view; it only accepts a token of the right shape. Tested by `data-access.spec` |
| 1.2 | The user id is never sent from the screen | ✅ | No server function has an id input — inputs are the log data, a display name or a share token. The user comes from the verified session (`context.userId`) |
| 1.3 | Server-only code and secrets are not bundled into browser code | ✅ + 🧪 | Database code is loaded inside the handlers (`await import("@/lib/db")`), `pg` only in server files; only `VITE_AUTH_ENABLED` and `VITE_STUN_URLS` are browser-visible (neither is secret). **New test** scans every JavaScript file the site sends for connection strings / secret names and checks that no source map is published |
| 2.1 | Production can never lose its sign-in rate limit | ✅ (tightened now) | The limit is switched off only when **both** `AUTH_RATE_LIMIT=off` **and** the platform reports exactly `VERCEL_ENV=preview`. Before this review the second key was "anything but production"; it is now an explicit opt-in, so an unexpected or missing value keeps the limit ON. The same opt-in now controls the wider "trust any `*.vercel.app`" setting. Setting `AUTH_RATE_LIMIT=off` on Production does nothing |
| 2.2 | Better still: keep the limit ON in staging and let only the tests bypass it with a secret header | 🔜 Patch 3 (after Patch 2) | Stronger because a public preview URL would never run without a limit. Deferred on purpose: it needs Better Auth's per-request rule API, which changes in the 1.7 upgrade, and I cannot test it in my workspace — it will go through the preview gate as its own pull request. **Interim protection:** previews sit behind Vercel Authentication (guide 4.1) and the switch is preview-only |
| 3.1 | Connect through Neon's pooled endpoint | ✅ + 🧪 | Guide Phase 2 step 3 says "pooled connection". **New:** `/api/auth/diagnostics` now shows `"databasePooled": true/false` (yes/no only, never the address), checked in guide Phase 5 |
| 3.2 | Use `@neondatabase/serverless` instead of TCP `pg` | ➖ for now | The app uses `pg` against the pooled endpoint (Neon supports this). Each warm server instance keeps one small pool, reused across requests, so many users do not mean many direct database connections. Revisit if you reach hundreds of simultaneous users |
| 3.3 | Cache the database client globally | ✅ | The pool is created once per instance and stored on `globalThis` |
| 4.1 | Share links use unguessable ids | ✅ | 24 random bytes (192 bits) from the secure random generator, format-checked; a new link replaces the old one |
| 4.2 | Ownership is enforced in the database | ✅ | Writes are keyed by the session user (`on conflict (user_id)`, `where user_id = …`); the public read is by token only; revoking deletes the row so the link dies at once. (`is_public` does not exist — a link either exists or it doesn't) |
| 4.3 | Only the needed fields leave the server | ✅ | The share view returns the name and a stripped copy: no notes, journal text, one-liners, reflections, to-dos or weekly reviews, and no user id or email. `share-link.spec` checks the raw server responses, not just the screen |
| 5.1 | A test that calls a write without the session cookie | 🧪 | **New:** records the app's own save request, replays it with no cookie, and again with the owner's cookie but "from another website"; both must be refused. (The test asserts "refused", not an exact 401, because the framework reports it as an error status) |
| 5.2 | A test where user A tries to affect user B | 🧪 | No endpoint accepts a user id, so "delete B while signed in as A" cannot even be expressed. **New test** covers the real risk: two accounts in two browsers each save a unique text — neither ever sees the other's on screen or in any server response |

## Document 2 — Prisma on Neon
Prisma is **not used** here: the app talks to Postgres with `pg` and parameterised SQL, and the code in that document is not applied. Its principles map as follows.
| # | Check | Status | Evidence |
|---|---|---|---|
| P1 | Pooled Neon URL | ✅ + 🧪 | same as 3.1 |
| P2 | Neon driver adapter for the ORM | ➖ | no ORM |
| P3 | Cache one database client for the whole process | ✅ | same as 3.3 |
| P4 | Writes must match the owner, not just the record id | ✅ | In this app a write cannot name a record at all: the row is chosen by the session user (`life_logs`/`share_links` are keyed by `user_id`), so the "change the log id in the request" attack has nothing to change |
| P5 | Select only the fields you need | ✅ | Every query names its columns (no `select *` in code — only in comments); the share view is stripped as in 4.3 |
| P6 | No query built from strings | ✅ | All SQL goes through tagged templates / `$1` parameters. If you ever adopt Prisma, use the same rules |

## Planned work, in order
| Step | What | Where |
|---|---|---|
| Phase 8b, PR 1 | Content-Security-Policy + HSTS headers | `app-patch-1-csp-hsts.zip` |
| Phase 8b, PR 2 | Remove the unused Grok login; better-auth 1.6 → 1.7.14 (closes the Dependabot alerts) | `app-patch-2-auth-upgrade.zip` |
| Patch 3 (not built yet) | Rate limit ON in staging, bypassed by a secret test header | after Patch 2 is live |
| Optional | Rate-limit counters in the database (shared across instances) or a Vercel Firewall rule | guide 4.2 |
| Optional | Stricter CSP with nonces; remove unused scaffold code (`src/lib/multiplayer`, parts of `src/lib/app-data`) | later cleanup |
| Every feature | Re-run the five-check security review | on request |

## Settings only you can switch on (guide)
Two-factor on GitHub, Vercel, Neon (Phase 1) · separate production/staging databases and secrets (Phases 2, 4) · Dependabot alerts + security updates, secret scanning, push protection (Phase 3, 8.1) · branch protection with the required `e2e / smoke (preview)` check (Phase 8) · access tokens with expiry (Phase 6.1) · Vercel Authentication on previews (Phase 4.1).

## Where the two documents were not exact
- **2:** the document warns against an "opt-out" flag. Ours was already a two-key switch that production ignores; this review made it stricter (preview only).
- **3:** serverless instances share one pool each, not one connection per request; the pooled endpoint is the standard fix and is what the guide uses.
- **4:** there is no `/api/share/<id>` and no sequential id: the link is the random token itself.
- **Prisma document:** describes a different data layer than the one in this app; only its principles apply.
