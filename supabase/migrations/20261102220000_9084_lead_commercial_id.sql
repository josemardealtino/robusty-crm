-- manifest: cria identificador unico comercial para leads (ex: ROB-2026-000001) com gerador atomico via sequence e trigger no insert

create sequence if not exists public.seq_crm_leads_commercial_id start 1;

alter table public.crm_leads
  add column if not exists commercial_id text;

create unique index if not exists uniq_crm_leads_org_commercial_id
  on public.crm_leads (organization_id, commercial_id)
  where commercial_id is not null;

create or replace function public.fn_generate_lead_commercial_id()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_seq bigint;
  v_year text;
begin
  if new.commercial_id is null or trim(new.commercial_id) = '' then
    v_seq := nextval('public.seq_crm_leads_commercial_id');
    v_year := to_char(coalesce(new.created_at, now()), 'YYYY');
    new.commercial_id := 'ROB-' || v_year || '-' || lpad(v_seq::text, 6, '0');
  end if;
  return new;
end;
$$;

revoke execute on function public.fn_generate_lead_commercial_id() from public, anon;
grant  execute on function public.fn_generate_lead_commercial_id() to authenticated, service_role;

drop trigger if exists trg_generate_lead_commercial_id on public.crm_leads;
create trigger trg_generate_lead_commercial_id
  before insert on public.crm_leads
  for each row execute function public.fn_generate_lead_commercial_id();
