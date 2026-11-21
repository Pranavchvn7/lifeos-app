-- Optimistic locking for the habit log: every save must name the version it was based on, so one device can
-- never silently overwrite changes made on another. Existing rows start at version 0.
alter table life_logs add column if not exists version integer not null default 0;
