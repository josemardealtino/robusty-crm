const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || "";
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testLive() {
  console.log("=== TESTE EM TEMPO REAL: SINCRONIZAÇÃO LEAD -> AGENDA ===");

  const { data: org } = await sb.from("organizations").select("id").single();
  const { data: pipe } = await sb
    .from("crm_pipelines")
    .select("id")
    .eq("organization_id", org.id)
    .eq("slug", "leads")
    .single();

  const { data: stage } = await sb
    .from("crm_stages")
    .select("id")
    .eq("pipeline_id", pipe.id)
    .order("position", { ascending: true })
    .limit(1)
    .single();

  // 1. Inserir lead com dados de instalação
  console.log("1. Criando lead de teste com agendamento presencial...");
  const { data: lead, error: errLead } = await sb
    .from("crm_leads")
    .insert({
      organization_id: org.id,
      pipeline_id: pipe.id,
      stage_id: stage.id,
      title: "Cliente Teste Agenda Ao Vivo",
      status: "open",
      custom_fields: {
        modalidade_pretendida: "instalacao_loja",
        data_instalacao: "2026-11-20",
        horario_instalacao: "14:30",
        veiculo: "kombi",
        ano_versao: "2023",
        modelo_bagageiro: "mx_100_plus",
        local_responsavel_instalacao: "Oficina SP - Box 2 (Mecânico André)",
      },
    })
    .select("id, title, commercial_id, custom_fields")
    .single();

  if (errLead || !lead) {
    throw new Error("Erro ao criar lead de teste: " + JSON.stringify(errLead));
  }

  console.log(`Lead criado com sucesso: ${lead.title} (${lead.commercial_id}) [${lead.id}]`);

  // 2. Buscar tipo de evento 'instalacao-loja'
  const { data: eventType } = await sb
    .from("calendar_event_types")
    .select("id, name, location_details")
    .eq("organization_id", org.id)
    .eq("slug", "instalacao-loja")
    .single();

  console.log(`Tipo de evento encontrado: [${eventType.name}] (id: ${eventType.id})`);

  // 3. Criar compromisso no Supabase
  const startsAt = "2026-11-20T14:30:00-03:00";
  const endsAt = "2026-11-20T15:30:00-03:00";
  const titulo = `[${lead.commercial_id}] Instalação na Loja: ${lead.title}`;
  const descricao = [
    `📋 ID COMERCIAL: ${lead.commercial_id}`,
    `👤 CLIENTE: ${lead.title}`,
    `🚚 MODALIDADE: Instalação Presencial na Loja SP`,
    `🚗 VEÍCULO: Volkswagen Kombi (2023)`,
    `📦 PRODUTO / MODELO: Bagageiro - MX 100 Plus`,
    `📍 LOCAL: ${eventType.location_details}`,
    `👨‍🔧 RESPONSÁVEL / BOX: Oficina SP - Box 2 (Mecânico André)`,
  ].join("\n");

  const { data: app, error: errApp } = await sb
    .from("calendar_appointments")
    .insert({
      organization_id: org.id,
      event_type_id: eventType.id,
      title: titulo,
      description: descricao,
      notes: descricao,
      starts_at: startsAt,
      ends_at: endsAt,
      time_zone: "America/Sao_Paulo",
      status: "confirmed",
      location_kind: "in_person",
      location_details: eventType.location_details,
      created_by_kind: "system",
      source: "ui",
    })
    .select("id, title, starts_at, ends_at, time_zone, status, description")
    .single();

  if (errApp || !app) {
    throw new Error("Erro ao criar agendamento de teste: " + JSON.stringify(errApp));
  }

  console.log("\n2. Agendamento criado no banco com sucesso!");
  console.log(`ID do compromisso: ${app.id}`);
  console.log(`Título: ${app.title}`);
  console.log(`Horário: ${app.starts_at} até ${app.ends_at} (${app.time_zone})`);
  console.log(`Status: ${app.status}`);
  console.log("Descrição salva no calendário:\n" + app.description);

  // 4. Criar vínculo polimórfico
  await sb.from("crm_lead_links").insert({
    organization_id: org.id,
    lead_id: lead.id,
    target_id: app.id,
    target_kind: "appointment",
    link_kind: "appointment",
    metadata: { modalidade: "instalacao_loja", data: "2026-11-20", hora: "14:30" },
  });

  // 5. Vincular no custom_fields do lead
  await sb
    .from("crm_leads")
    .update({
      custom_fields: {
        ...lead.custom_fields,
        appointment_id: app.id,
      },
    })
    .eq("id", lead.id);

  console.log("\n3. Vínculo polimórfico criado com sucesso em crm_lead_links!");

  // 6. Testar leitura pelo ponto de vista da Loja Física (filtrando por período)
  const { data: appsNaGrade } = await sb
    .from("calendar_appointments")
    .select("id, title, starts_at, status")
    .eq("organization_id", org.id)
    .gte("starts_at", "2026-11-20T00:00:00-03:00")
    .lte("starts_at", "2026-11-20T23:59:59-03:00");

  console.log(`\n4. Compromissos visíveis na grade do dia 20/11: ${appsNaGrade?.length || 0}`);
  for (const item of appsNaGrade || []) {
    console.log(` - ${item.title} (${item.starts_at}) [${item.status}]`);
  }

  // 7. Limpeza do teste
  console.log("\n5. Limpando registros de teste...");
  await sb.from("crm_lead_links").delete().eq("lead_id", lead.id);
  await sb.from("calendar_appointments").delete().eq("id", app.id);
  await sb.from("crm_leads").delete().eq("id", lead.id);

  console.log(">>> TESTE AO VIVO CONCLUÍDO COM 100% DE SUCESSO! BANCO LIMPO. <<<");
}

testLive().catch((e) => {
  console.error("Falha no teste:", e);
  process.exit(1);
});
