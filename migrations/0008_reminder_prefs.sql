-- Reminder settings kept on the server so scheduled push reminders can be sent while the app is closed.
-- One row per user. `last_daily` / `last_weekly` hold the local date (YYYY-MM-DD) of the last reminder sent, so each is sent once a day.
create table if not exists reminder_prefs (
  user_id text primary key,
  enabled boolean not null default false,
  remind_at text not null default '20:00',
  weekly boolean not null default true,
  tz text not null default 'UTC',
  last_daily text not null default '',
  last_weekly text not null default '',
  updated_at timestamptz not null default now()
);
