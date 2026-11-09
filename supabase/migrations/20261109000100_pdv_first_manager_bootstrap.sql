create table if not exists public.pdv_bootstrap_control (
  id boolean primary key default true check (id = true),
  status text not null check (status in ('creating','complete')),
  created_at timestamptz not null default now()
);
alter table public.pdv_bootstrap_control enable row level security;
revoke all on public.pdv_bootstrap_control from anon, authenticated;
grant all on public.pdv_bootstrap_control to service_role;

create or replace function public.pdv_claim_first_manager()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if exists (select 1 from public.pdv_bootstrap_control) then return false; end if;
  if exists (select 1 from auth.users) or exists (select 1 from public.perfis) then return false; end if;
  insert into public.pdv_bootstrap_control(id,status) values (true,'creating')
  on conflict (id) do nothing;
  return found;
end;
$$;

create or replace function public.pdv_finish_first_manager()
returns void language sql security definer
set search_path = pg_catalog, public
as $$ update public.pdv_bootstrap_control set status='complete' where id=true and status='creating'; $$;

create or replace function public.pdv_release_first_manager()
returns void language sql security definer
set search_path = pg_catalog, public
as $$ delete from public.pdv_bootstrap_control where id=true and status='creating'; $$;

revoke all on function public.pdv_claim_first_manager() from public, anon, authenticated;
revoke all on function public.pdv_finish_first_manager() from public, anon, authenticated;
revoke all on function public.pdv_release_first_manager() from public, anon, authenticated;
grant execute on function public.pdv_claim_first_manager() to service_role;
grant execute on function public.pdv_finish_first_manager() to service_role;
grant execute on function public.pdv_release_first_manager() to service_role;