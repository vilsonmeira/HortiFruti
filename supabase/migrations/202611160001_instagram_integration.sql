-- Instagram integration for Hortifruti Jardim Celeste
create table if not exists public.instagram_integrations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  instagram_user_id text not null,
  username text,
  access_token_ciphertext text not null,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);
create table if not exists public.instagram_oauth_states (
  state text primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists public.instagram_inbox (
  id bigserial primary key,
  instagram_user_id text not null,
  sender_id text,
  sender_username text,
  message_id text unique,
  message_text text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  handled_at timestamptz
);
create table if not exists public.instagram_publications (
  id bigserial primary key,
  instagram_media_id text unique,
  caption text not null,
  media_url text not null,
  status text not null default 'queued' check (status in ('queued','published','failed')),
  error text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
alter table public.instagram_integrations enable row level security;
alter table public.instagram_oauth_states enable row level security;
alter table public.instagram_inbox enable row level security;
alter table public.instagram_publications enable row level security;
revoke all on public.instagram_integrations, public.instagram_oauth_states, public.instagram_inbox, public.instagram_publications from anon, authenticated;
grant all on public.instagram_integrations, public.instagram_oauth_states, public.instagram_inbox, public.instagram_publications to service_role;
grant usage, select on sequence public.instagram_inbox_id_seq, public.instagram_publications_id_seq to service_role;
