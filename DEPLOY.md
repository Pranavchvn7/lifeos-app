# Deploying LifeOS (Vercel + Neon)

The complete, ordered, security-checked procedure is in **[docs/SETUP-FROM-SCRATCH.md](docs/SETUP-FROM-SCRATCH.md)**.
This page is the short reference.

## Environment variables (Vercel → Project → Settings → Environment Variables)
| Name | Production | Preview (staging) | Notes |
|---|---|---|---|
| `DATABASE_URL` | production Neon string | **staging** Neon string (a different database) | must include `sslmode=require`; Production refuses to start without it |
| `BETTER_AUTH_SECRET` | random 32+ chars | a **different** random value | Production refuses to start without it |
| `BETTER_AUTH_URL` | `https://<your-app>.vercel.app` (no trailing `/`) | leave unset | the site's own address |
| `AUTH_RATE_LIMIT` | **never set** | `off` | lets automated tests create accounts quickly; ignored in production even if set |
| `TRUSTED_ORIGINS` | optional: your custom domain(s), comma-separated | — | only needed once you add a custom domain |

Production trusts only its own addresses. Preview deployments also accept `*.vercel.app`, because their addresses change.

## What the build does
`npm run build` builds the site, then applies any new files in `migrations/` to `DATABASE_URL` (creating the tables on the first deploy).

## Checks after a deploy
- `/api/auth/diagnostics` shows only yes/no flags, `"database": "connected"` and `"databasePooled": true` (Neon pooled connection string).
- Sign up, sign out, sign in, delete the test account.
- The automated e2e tests report on the commit (`e2e / smoke (preview)` / `(production)`).
