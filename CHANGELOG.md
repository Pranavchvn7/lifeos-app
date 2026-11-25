# Changelog

Versions are numbered `major.minor.patch`. The version also shows at the bottom of Account & settings.

## v2.2.0 - 2026-11-25 - Habits tab and habit dashboards
Third release of the daily-planner update series.
- **Habits tab** (new, next to Today in the navigation). Each habit with its current streak and its last seven days. Tap one to open it.
- **A dashboard for each habit:**
  - a month calendar: tap a day to mark it (or change its amount) and add a note to it; days before the habit started or after today cannot be edited;
  - stats: days kept (or total amount for amount habits), completion, current and best streak, and the average per day for amount habits;
  - charts: this month, the last 12 weeks, completion by week, and the streak over the last 90 days;
  - every note the habit has, newest first.
- Streak rules are the same as on Today and the Board: a missed day breaks a streak; days that do not apply (not scheduled, frozen, before the start date) and today before it is logged do not.
- The chart pieces the Board uses now live in one shared place. The Board looks and works the same.
- No data change and no database change: backups made before this version restore as before.
- Unit tests added for day states, streaks, stats, the weekly and monthly series and the calendar layout.

## v2.1.0 - 2026-11-23 - Amount habits and start dates
Second release of the daily-planner update series.
- **Amount habits.** A do can now be measured: "Read - pages", "Water - glasses", "Run - km". In Settings -> Habits, tick
  "Track an amount", give a unit and (optionally) a daily target. On the Today screen the habit shows a number you can type,
  - / + buttons and a progress bar. It counts as done when you reach the daily target (or anything above zero if there is no target).
  Tapping the tick fills in the target; tapping it again clears the amount.
- **Each habit has its own start date.** New habits count from the day you add them, so adding a habit no longer makes
  earlier days look missed. Habits you already have are unchanged. Change it under the habit's schedule: **Counts from**.
- Existing habits can be turned into amount habits (and back) from their schedule panel. Changing a target applies to days you log from now on.
- Export: the Habit log sheet has Amount and Unit columns, the Habits sheet has Unit, Daily target and Counts from (added at the end).
  A shared progress link never includes the amounts.
- No database change; backups made before this version restore as before. Unit tests added for the rules, the store and the saved format.

## v2.0.0 - 2026-11-23 - New app shell and Settings page
First release of the big "daily planner" update (plan: v2.0 shell, v2.1 amount habits, v2.2 habit dashboards, v2.3 timer,
v2.4 date notes, v2.5 tasks and shopping lists, v2.6 goal tracker, v2.7 achievements, v2.8 daily planner without the 90-day timeline).
- **Settings is now a full page** (it was a popup): Account & settings, with a back arrow. It has its own address (`/settings`).
- **Every section has its own address and works with the browser's back button:** Today `/`, To-do `/todo`, Board `/board`,
  Journal `/journal`, Goals `/goals`, Settings `/settings`. Reloading a page keeps you on it.
- **New phone navigation:** one bottom bar that scrolls sideways. The section you are in is highlighted and scrolled into view,
  the next item is always partly visible, soft edges with arrows show that there is more on that side, and the first time
  you see it the bar nudges itself to show it can be swiped. Settings is now in the bar too.
- Desktop: the sidebar is unchanged in look; the Settings link highlights when you are on that page.
- No data change and no database change. Same features, same data.
- Automated tests: every test id the smoke tests use was kept (navigation items, tab markers, settings button, settings page container, back button).

## v1.6.0 - 2026-11-23 - Scheduled reminder pushes (part 2) and import message fix
- **Your daily reminder and the weekly review now arrive as push notifications**, even when LifeOS is closed, at about the
  time you chose (up to ~10 minutes late). They are skipped if you have already logged your day, sent once a day, and never
  sent late at night after an outage (3-hour window). Times follow your phone's time zone, which is kept up to date.
- Your reminder settings are now also saved on the server (new migration `0008_reminder_prefs.sql`). The settings of the
  device you changed last are used.
- If push is on for a device, the app no longer shows a second, local notification at the same time.
- A GitHub Actions schedule (`.github/workflows/reminders.yml`, every 10 minutes) calls a protected endpoint
  (`/api/cron/reminders`) that needs a secret (`CRON_SECRET`); until it is set up, nothing is sent and nothing breaks. See `docs/PUSH-SETUP.md`.
- **Bug fix:** importing a file that is not a LifeOS backup now shows a clear message right under the Import button
  (before, the message appeared at the top of the settings window, out of sight).
- Changelog dates for v1.4.0 and v1.5.0 corrected.

## v1.5.0 - 2026-11-23 - Phone notifications (part 1: the plumbing)
- **Reminders -> Phone notifications.** Turn on push notifications for this phone or browser; they can arrive even when
  LifeOS is closed. **Send a test push** shows it works. Turn them off per device at any time.
- On iPhone this works only once LifeOS is added to the Home Screen (iOS 16.4 or newer); the screen explains this.
- Safe by design: only the real browser push services are accepted as destinations (Google, Mozilla, Apple, Windows), at most
  10 devices per account, test pushes limited to one per 30 seconds, and devices are deleted with the account.
- The app needs three server settings before this works (VAPID keys, see `docs/PUSH-SETUP.md`). Until they are set, the screen says push is not set up and nothing else changes.
- New migration `0007_push_subscriptions.sql`. New dependency: `web-push`. New file `public/sw.js` (the service worker; it only shows notifications).
- Not in this version: the scheduled daily/weekly reminder pushes. They come in v1.6.0.

## v1.4.0 - 2026-11-23 - Safer backup and restore
- **Import backup now shows a preview first.** After you choose a file you see what is in the app now next to what is
  in the backup (habits, logged days and their dates, to-dos, goals, journal days, program), and nothing changes until you choose.
- Two ways to restore: **Replace everything with this backup**, or **Add what's missing (keep my data)**, which keeps
  everything you have and adds only what the backup has that you do not (if both have the same thing, yours wins).
- **Undo.** Before any import, a safety copy of your current data is saved on the server. A toast offers Undo for 12 seconds,
  and **Undo last import** stays in the Export section until the next import. If the safety copy cannot be saved, nothing is changed.
- Clear messages for a wrong file (not JSON, not a LifeOS backup, too large). Backups now also record the date and
  LifeOS version they were made with; older backup files still restore.
- New migration `0006_previous_log.sql` (two columns for the safety copy). Unit tests run through `tsx`, so more of the app's code can be tested.
- E2E note: the existing "JSON backup restores the log" test must now click **Replace everything with this backup** after choosing the file (updated test included in the e2e patch).

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
