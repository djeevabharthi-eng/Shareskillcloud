-- Run once in Supabase > SQL Editor.
-- Stores the app's data (profiles, requests, messages, sessions...) durably.
create table if not exists public.app_state (
  key        text primary key,
  value      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- RLS on, no policies: browsers/anon keys can NOT read this table.
-- Only your server (using the service_role key) can.
alter table public.app_state enable row level security;
