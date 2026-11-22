-- Web push subscriptions: one row per browser/phone a user has allowed notifications on.
-- `endpoint` is the push service address for that browser; `p256dh` and `auth` are the keys used to encrypt messages for it.
create table if not exists push_subscriptions (
  id text primary key,
  user_id text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_test_at timestamptz
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);
