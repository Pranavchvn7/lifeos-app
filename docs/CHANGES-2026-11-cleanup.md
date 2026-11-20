# Cleanup and hardening, November 2026

Removed (nothing in the running app imported any of it): `src/lib/app-data/`, `src/lib/multiplayer/`, the sandbox preview bridge
(`src/lib/preview-host-bridge.ts`, `src/lib/preview-embedder-origin.ts`, `src/components/preview-host-bridge.tsx`), the Grok builder scripts
(`brand-check`, `browser-smoke*`, `browser-guard`, `preview*`, `write-atomic` and their tests), the unused `jose` dependency, `preview:restart`/`preview:stop` scripts.

Kept on purpose: `public/__grok/`, `server/middleware/grok-pwa.ts`, `scripts/grok-pwa-*.mjs`, the PWA plugin in `vite.config.ts`. They serve the web manifest and the
home-screen install page. The session cookie names also keep their historical `grok-auth` prefix (renaming signs everyone out and breaks the e2e session test).

Moved: the two `grok-pwa-*` files that sat in the repository root were newer versions meant for `scripts/`; they replaced the older copies there.

Tests: 100 unit tests pass (5 tests that only described the original scaffold were deleted; 6 were made independent of `site.json`).
Added: `.gitignore`, `.env.example`, `.github/workflows/ci.yml` (types, lint, tests, audit), `migrations/0004_rate_limit.sql`, extra headers in `vercel.json`, a regenerated `package-lock.json` (`npm ci` works again), README links fixed.
