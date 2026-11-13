-- Instagram integration for HortiFruti PDV. Execute in Supabase SQL Editor.
-- Access tokens and Meta secrets are never stored in these tables.
create table if not exists public.instagram_conversas (
 id uuid primary key default gen_random_uuid(), ig_conversation_id text unique,
 participante_ig_id text, nome_participante text, ultima_mensagem_em timestamptz,
 status text not null default 'aberta' check(status in ('aberta','aguardando','encerrada')),
 atendente text not null default 'jessica', criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now()
);
create table if not exists public.instagram_mensagens (
 id uuid primary key default gen_random_uuid(), mensagem_ig_id text unique,
 conversa_id uuid references public.instagram_conversas(id) on delete cascade,
 direcao text not null check(direcao in ('entrada','saida')), tipo text not null default 'texto',
 texto text, anexo_url text, remetente_ig_id text, enviado_por uuid references auth.users(id),
 status text not null default 'recebida' check(status in ('recebida','enviada','falhou')),
 criado_em timestamptz not null default now(), payload jsonb not null default '{}'::jsonb
);
create table if not exists public.instagram_eventos (
 id bigint generated always as identity primary key, evento_id text unique,
 objeto text not null, campo text, payload jsonb not null,
 processado boolean not null default false, recebido_em timestamptz not null default now()
);
create table if not exists public.instagram_comentarios (
 id uuid primary key default gen_random_uuid(), comentario_ig_id text unique not null,
 midia_ig_id text, autor_ig_id text, texto text, respondido boolean not null default false,
 resposta text, criado_em timestamptz not null default now(), payload jsonb not null default '{}'::jsonb
);
create table if not exists public.instagram_publicacoes (
 id uuid primary key default gen_random_uuid(),
 tipo text not null check(tipo in ('IMAGE','VIDEO','REELS','CAROUSEL_ALBUM')),
 legenda text, url_midia text not null,
 status text not null default 'rascunho' check(status in ('rascunho','publicando','publicado','falhou')),
 id_container text, id_publicacao text, agendado_para timestamptz, publicado_em timestamptz,
 erro text, criado_por uuid references auth.users(id), criado_em timestamptz not null default now()
);
create index if not exists instagram_mensagens_conversa_idx on public.instagram_mensagens(conversa_id,criado_em);
create index if not exists instagram_conversas_atualizacao_idx on public.instagram_conversas(atualizado_em desc);
create index if not exists instagram_publicacoes_agenda_idx on public.instagram_publicacoes(agendado_para) where status='rascunho';
alter table public.instagram_conversas enable row level security;
alter table public.instagram_mensagens enable row level security;
alter table public.instagram_eventos enable row level security;
alter table public.instagram_comentarios enable row level security;
alter table public.instagram_publicacoes enable row level security;

drop policy if exists "Gerente consulta conversas Instagram" on public.instagram_conversas;
create policy "Gerente consulta conversas Instagram" on public.instagram_conversas for select to authenticated
using(exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.papel='gerente' and p.ativo=true));
drop policy if exists "Gerente atualiza conversas Instagram" on public.instagram_conversas;
create policy "Gerente atualiza conversas Instagram" on public.instagram_conversas for update to authenticated
using(exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.papel='gerente' and p.ativo=true))
with check(exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.papel='gerente' and p.ativo=true));
drop policy if exists "Gerente consulta mensagens Instagram" on public.instagram_mensagens;
create policy "Gerente consulta mensagens Instagram" on public.instagram_mensagens for select to authenticated
using(exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.papel='gerente' and p.ativo=true));
drop policy if exists "Gerente consulta eventos Instagram" on public.instagram_eventos;
create policy "Gerente consulta eventos Instagram" on public.instagram_eventos for select to authenticated
using(exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.papel='gerente' and p.ativo=true));
drop policy if exists "Gerente consulta comentarios Instagram" on public.instagram_comentarios;
create policy "Gerente consulta comentarios Instagram" on public.instagram_comentarios for select to authenticated
using(exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.papel='gerente' and p.ativo=true));
drop policy if exists "Gerente consulta publicacoes Instagram" on public.instagram_publicacoes;
create policy "Gerente consulta publicacoes Instagram" on public.instagram_publicacoes for select to authenticated
using(exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.papel='gerente' and p.ativo=true));
drop policy if exists "Gerente cria publicacoes Instagram" on public.instagram_publicacoes;
create policy "Gerente cria publicacoes Instagram" on public.instagram_publicacoes for insert to authenticated
with check(criado_por=(select auth.uid()) and exists(select 1 from public.perfis p where p.id=(select auth.uid()) and p.papel='gerente' and p.ativo=true));
-- Writes to inbox/events/comments are server-only via Edge Functions.
