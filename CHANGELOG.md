# Changelog

Versions are numbered `major.minor.patch`. The version also shows at the bottom of Account & settings.

## v1.1.0 - 2026-11-21 - Sync safety
- Saving can no longer overwrite changes made on another device. Every save names the version it is based on;
  if the server has a newer one, the two copies are merged (different days, habits, to-dos, journal fields are all kept;
  the same value changed on both devices keeps the one on the device you are using).
- The app now checks for changes from your other devices when you return to it, so a phone app left open for days
  does not work from stale data.
- New migration `0005_life_log_version.sql` (adds a version number to the saved log).
- Added unit tests for the merge and for the versioned save on a real Postgres engine.

## v1.0.0 - 2026-11-21 - Baseline
- Cleanup and security hardening, installs as LifeOS with its own logo, soft and friendly design.
