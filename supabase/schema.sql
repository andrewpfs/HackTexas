-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Each trip is stored as one JSON document so the app's Trip type maps directly.

create table if not exists public.trips (
  id text primary key,
  invite_code text not null unique,
  data jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The app only talks to this table from server code using the service role key.
-- Row level security with no policies blocks the public anon key entirely.
alter table public.trips enable row level security;
