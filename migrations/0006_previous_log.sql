-- One "before the last import" copy of the log per user, so a restore can be undone. Overwritten by the next import.
alter table life_logs add column if not exists previous_payload text;
alter table life_logs add column if not exists previous_at timestamptz;
