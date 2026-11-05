-- manifest: permite que o pedido gerado preserve o mesmo commercial_id (ROB-YYYY-XXXXXX) do lead de origem garantindo unicidade por funil (organization_id, pipeline_id, commercial_id)

drop index if exists public.uniq_crm_leads_org_commercial_id;

create unique index if not exists uniq_crm_leads_org_pipeline_commercial_id
  on public.crm_leads (organization_id, pipeline_id, commercial_id)
  where commercial_id is not null;
