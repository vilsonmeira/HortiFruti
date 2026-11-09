-- HortiFruti PDV — cancelamento auditável com autorização de gerente
-- Execute este arquivo no Supabase SQL Editor do projeto.
-- Não armazena senhas: a autorização usa Supabase Auth + public.perfis.

create table if not exists public.pdv_vendas (
  id uuid primary key default gen_random_uuid(),
  venda_local_id text unique,
  data_venda timestamptz not null default now(),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  desconto numeric(12,2) not null default 0 check (desconto >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  forma_pagamento text not null,
  status text not null default 'finalizada' check (status in ('finalizada','cancelada')),
  criada_por uuid references auth.users(id),
  cancelada_em timestamptz,
  cancelada_por uuid references auth.users(id),
  motivo_cancelamento text
);

create table if not exists public.pdv_venda_itens (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.pdv_vendas(id) on delete restrict,
  item_local_id text,
  produto_id text,
  nome_produto text not null,
  emoji text,
  quantidade numeric(12,3) not null check (quantidade > 0),
  unidade text not null,
  preco_unitario numeric(12,2) not null check (preco_unitario >= 0),
  total_item numeric(12,2) not null check (total_item >= 0),
  status text not null default 'ativo' check (status in ('ativo','cancelado')),
  cancelado_em timestamptz,
  cancelado_por uuid references auth.users(id),
  motivo_cancelamento text
);

create table if not exists public.pdv_cancelamentos (
  id bigint generated always as identity primary key,
  venda_id uuid not null references public.pdv_vendas(id) on delete restrict,
  item_id uuid references public.pdv_venda_itens(id) on delete restrict,
  tipo text not null check (tipo in ('produto','cupom')),
  motivo text not null,
  valor_cancelado numeric(12,2) not null default 0,
  gerente_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now()
);

create index if not exists pdv_venda_itens_venda_id_idx on public.pdv_venda_itens(venda_id);
create index if not exists pdv_cancelamentos_venda_id_idx on public.pdv_cancelamentos(venda_id);

alter table public.pdv_vendas enable row level security;
alter table public.pdv_venda_itens enable row level security;
alter table public.pdv_cancelamentos enable row level security;

drop policy if exists "PDV usuarios autenticados consultam vendas" on public.pdv_vendas;
create policy "PDV usuarios autenticados consultam vendas"
on public.pdv_vendas for select to authenticated using (true);

drop policy if exists "PDV usuarios autenticados consultam itens" on public.pdv_venda_itens;
create policy "PDV usuarios autenticados consultam itens"
on public.pdv_venda_itens for select to authenticated using (true);

drop policy if exists "Somente gerente consulta auditoria" on public.pdv_cancelamentos;
create policy "Somente gerente consulta auditoria"
on public.pdv_cancelamentos for select to authenticated
using (exists (
  select 1 from public.perfis p
  where p.id = auth.uid() and p.papel = 'gerente'
));

create or replace function public.pdv_cancelar_item(
  p_item_id uuid,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.pdv_venda_itens%rowtype;
  v_venda public.pdv_vendas%rowtype;
begin
  if v_uid is null then raise exception 'Faça login para continuar.'; end if;
  if not exists (select 1 from public.perfis where id = v_uid and papel = 'gerente') then
    raise exception 'Apenas gerente pode cancelar produtos.';
  end if;
  if length(trim(coalesce(p_motivo,''))) < 3 then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  select * into v_item from public.pdv_venda_itens where id = p_item_id for update;
  if not found then raise exception 'Produto da venda não encontrado.'; end if;
  if v_item.status <> 'ativo' then raise exception 'Este produto já foi cancelado.'; end if;

  select * into v_venda from public.pdv_vendas where id = v_item.venda_id for update;
  if v_venda.status <> 'finalizada' then raise exception 'O cupom não está ativo.'; end if;

  update public.pdv_venda_itens
  set status = 'cancelado', cancelado_em = now(), cancelado_por = v_uid,
      motivo_cancelamento = trim(p_motivo)
  where id = p_item_id;

  update public.pdv_vendas
  set subtotal = greatest(0, subtotal - v_item.total_item),
      total = greatest(0, total - v_item.total_item)
  where id = v_venda.id;

  insert into public.pdv_cancelamentos(venda_id,item_id,tipo,motivo,valor_cancelado,gerente_id)
  values(v_venda.id,p_item_id,'produto',trim(p_motivo),v_item.total_item,v_uid);

  return jsonb_build_object('ok',true,'venda_id',v_venda.id,'valor_cancelado',v_item.total_item);
end;
$$;

create or replace function public.pdv_cancelar_cupom(
  p_venda_id uuid,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_venda public.pdv_vendas%rowtype;
begin
  if v_uid is null then raise exception 'Faça login para continuar.'; end if;
  if not exists (select 1 from public.perfis where id = v_uid and papel = 'gerente') then
    raise exception 'Apenas gerente pode cancelar cupons.';
  end if;
  if length(trim(coalesce(p_motivo,''))) < 3 then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  select * into v_venda from public.pdv_vendas where id = p_venda_id for update;
  if not found then raise exception 'Venda não encontrada.'; end if;
  if v_venda.status <> 'finalizada' then raise exception 'Este cupom já foi cancelado.'; end if;

  update public.pdv_vendas
  set status = 'cancelada', cancelada_em = now(), cancelada_por = v_uid,
      motivo_cancelamento = trim(p_motivo), total = 0
  where id = p_venda_id;

  update public.pdv_venda_itens
  set status = 'cancelado', cancelado_em = now(), cancelado_por = v_uid,
      motivo_cancelamento = trim(p_motivo)
  where venda_id = p_venda_id and status = 'ativo';

  insert into public.pdv_cancelamentos(venda_id,tipo,motivo,valor_cancelado,gerente_id)
  values(p_venda_id,'cupom',trim(p_motivo),v_venda.total,v_uid);

  return jsonb_build_object('ok',true,'venda_id',p_venda_id,'valor_cancelado',v_venda.total);
end;
$$;

revoke all on function public.pdv_cancelar_item(uuid,text) from public;
revoke all on function public.pdv_cancelar_cupom(uuid,text) from public;
grant execute on function public.pdv_cancelar_item(uuid,text) to authenticated;
grant execute on function public.pdv_cancelar_cupom(uuid,text) to authenticated;
