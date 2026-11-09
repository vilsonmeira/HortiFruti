-- HortiFruti PDV — hardening de segurança e desempenho
-- Aplicado ao projeto Supabase vcyneajmmwvvnefqompe em 2026-11-09.
-- Não remove tabelas nem dados. Requer Supabase Auth e public.perfis.

create or replace function public.hortifruti_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = (select auth.uid())
      and p.papel = 'gerente'
      and p.ativo is true
  );
$$;
revoke all on function public.hortifruti_is_admin() from public;
grant execute on function public.hortifruti_is_admin() to anon, authenticated;

drop policy if exists "PDV operador cria suas vendas" on public.pdv_vendas;
create policy "PDV operador cria suas vendas"
on public.pdv_vendas for insert to authenticated
with check (
  criada_por = (select auth.uid())
  and exists (
    select 1 from public.perfis p
    where p.id = (select auth.uid()) and p.ativo is true
      and p.papel in ('gerente','operador')
  )
);

drop policy if exists "PDV operador inclui itens na propria venda" on public.pdv_venda_itens;
create policy "PDV operador inclui itens na propria venda"
on public.pdv_venda_itens for insert to authenticated
with check (
  exists (
    select 1 from public.pdv_vendas v
    where v.id = venda_id and v.criada_por = (select auth.uid())
      and v.status = 'finalizada'
  )
  and exists (
    select 1 from public.perfis p
    where p.id = (select auth.uid()) and p.ativo is true
      and p.papel in ('gerente','operador')
  )
);

drop policy if exists "PDV gerente atualiza vendas" on public.pdv_vendas;
create policy "PDV gerente atualiza vendas"
on public.pdv_vendas for update to authenticated
using (public.hortifruti_is_admin())
with check (public.hortifruti_is_admin());

drop policy if exists "PDV gerente atualiza itens" on public.pdv_venda_itens;
create policy "PDV gerente atualiza itens"
on public.pdv_venda_itens for update to authenticated
using (public.hortifruti_is_admin())
with check (public.hortifruti_is_admin());

drop policy if exists "PDV gerente registra cancelamentos" on public.pdv_cancelamentos;
create policy "PDV gerente registra cancelamentos"
on public.pdv_cancelamentos for insert to authenticated
with check (gerente_id = (select auth.uid()) and public.hortifruti_is_admin());

revoke all on table public.pdv_vendas from anon;
revoke all on table public.pdv_venda_itens from anon;
revoke all on table public.pdv_cancelamentos from anon;
grant select, insert, update on table public.pdv_vendas to authenticated;
grant select, insert, update on table public.pdv_venda_itens to authenticated;
grant select, insert on table public.pdv_cancelamentos to authenticated;
revoke delete on table public.pdv_vendas, public.pdv_venda_itens, public.pdv_cancelamentos from authenticated;

create or replace function public.pdv_cancelar_item(p_item_id uuid, p_motivo text)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_item public.pdv_venda_itens%rowtype;
  v_venda public.pdv_vendas%rowtype;
begin
  if v_uid is null then raise exception 'Faça login para continuar.'; end if;
  if not public.hortifruti_is_admin() then raise exception 'Apenas gerente pode cancelar produtos.'; end if;
  if length(trim(coalesce(p_motivo,''))) < 3 then raise exception 'Informe o motivo do cancelamento.'; end if;
  select * into v_item from public.pdv_venda_itens where id = p_item_id for update;
  if not found then raise exception 'Produto da venda não encontrado.'; end if;
  if v_item.status <> 'ativo' then raise exception 'Este produto já foi cancelado.'; end if;
  select * into v_venda from public.pdv_vendas where id = v_item.venda_id for update;
  if not found or v_venda.status <> 'finalizada' then raise exception 'O cupom não está ativo.'; end if;
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

create or replace function public.pdv_cancelar_cupom(p_venda_id uuid, p_motivo text)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_venda public.pdv_vendas%rowtype;
begin
  if v_uid is null then raise exception 'Faça login para continuar.'; end if;
  if not public.hortifruti_is_admin() then raise exception 'Apenas gerente pode cancelar cupons.'; end if;
  if length(trim(coalesce(p_motivo,''))) < 3 then raise exception 'Informe o motivo do cancelamento.'; end if;
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

revoke all on function public.pdv_cancelar_item(uuid,text) from public, anon;
revoke all on function public.pdv_cancelar_cupom(uuid,text) from public, anon;
grant execute on function public.pdv_cancelar_item(uuid,text) to authenticated;
grant execute on function public.pdv_cancelar_cupom(uuid,text) to authenticated;

revoke all on table public."Dalva", public."Vilson", public."Usuários" from public, anon, authenticated;

drop policy if exists "Consultar próprio perfil" on public.perfis;
drop policy if exists "Usuario pode visualizar seu perfil" on public.perfis;
drop policy if exists "usuarios_consultam_proprio_perfil" on public.perfis;
create policy "perfis_select_proprio"
on public.perfis for select to authenticated
using (id = (select auth.uid()));

drop policy if exists "Somente gerente consulta auditoria" on public.pdv_cancelamentos;
create policy "Somente gerente consulta auditoria"
on public.pdv_cancelamentos for select to authenticated
using (exists (
  select 1 from public.perfis p
  where p.id = (select auth.uid()) and p.papel = 'gerente' and p.ativo is true
));

create index if not exists customer_order_items_product_id_idx on public.customer_order_items(product_id);
create index if not exists pdv_cancelamentos_gerente_id_idx on public.pdv_cancelamentos(gerente_id);
create index if not exists pdv_cancelamentos_item_id_idx on public.pdv_cancelamentos(item_id);
create index if not exists pdv_venda_itens_cancelado_por_idx on public.pdv_venda_itens(cancelado_por);
create index if not exists pdv_vendas_cancelada_por_idx on public.pdv_vendas(cancelada_por);
create index if not exists pdv_vendas_criada_por_idx on public.pdv_vendas(criada_por);
