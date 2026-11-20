-- Sign-in / sign-up rate-limit counters shared by every server instance (Better Auth, rateLimit.storage = "database").
-- One row per "client address + path". Better Auth prunes expired rows itself. The camelCase column must stay quoted.
create table if not exists "rateLimit" (
  "id" text not null primary key,
  "key" text not null unique,
  "count" integer not null,
  "lastRequest" bigint not null
);
