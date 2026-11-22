# Changelog

Versions are numbered `major.minor.patch`. The version also shows at the bottom of Account & settings.

## v1.3.0 - 2026-11-23 - Streak freeze
- A missed or bad day can be frozen with **Freeze this day** (Today screen, under the score). A frozen day does not break
  your streak and is left out of your averages, exactly like a rest day. It shows as "Frozen day" and as "Frozen" in the export.
- You get 2 freezes in each 30-day block of your program (days 1-30, 31-60, ...), so they cannot all be used at once.
  Unfreeze a day to get the freeze back. Future days and days outside the program cannot be frozen, and neither can a good day.
- Per-habit streaks and consistency percentages also skip frozen days.
- No database change (the freezes are stored inside your log). Unit tests added for the freeze rules.
- Note: the 2-per-block limit is checked in the app, not on the server. It is a personal discipline aid, not a security control.

## v1.2.0 - 2026-11-23 - Recurring to-dos
- To-dos can repeat: every day, weekdays, every week or every month. Pick **Repeat** when adding a task, or change it
  in the task's details.
- Completing a repeating task keeps it in Completed and adds the next one. Finishing an overdue daily task today
  schedules tomorrow's, not a second one for today. Reopening a completed task removes the next one it created
  (if you have not touched it).
- Deleting a repeating task stops the repeat.
- The Excel/CSV export has a new last column, **Repeats**.
- Known limit: if the same repeating task is completed on two devices before they sync, the next occurrence can
  appear twice; delete the extra one.
- No database change. Unit tests added for the date rules and the complete/reopen logic.

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
