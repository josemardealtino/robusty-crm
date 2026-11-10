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

const JORNADA_ROBUSTY = {
  timezone: "America/Sao_Paulo",
  windows: [
    { dow: 1, start: "08:00", end: "18:00" }, // Segunda-feira
    { dow: 2, start: "08:00", end: "18:00" }, // Terça-feira
    { dow: 3, start: "08:00", end: "18:00" }, // Quarta-feira
    { dow: 4, start: "08:00", end: "18:00" }, // Quinta-feira
    { dow: 5, start: "08:00", end: "18:00" }, // Sexta-feira
    { dow: 6, start: "08:00", end: "16:00" }, // Sábado
  ],
};

const ENDERECO_LOJA_ROBUSTY =
  "Rua Dante Marteletti, 122 - Jardim Maringá, São Paulo - SP, CEP 03525-150";

async function main() {
  console.log("=== CONFIGURAÇÃO DO MÓDULO DE AGENDA ROBUSTY ===");

  // 1. Obter organização Robusty
  const { data: org, error: errOrg } = await sb
    .from("organizations")
    .select("id, legal_name, display_name, settings")
    .limit(1)
    .single();

  if (errOrg || !org) throw new Error("Organização não encontrada: " + JSON.stringify(errOrg));
  console.log(`Organização: ${org.display_name || org.legal_name} (${org.id})`);

  // 2. Atualizar settings da organização com a jornada da agenda
  const nextSettings = {
    ...(org.settings && typeof org.settings === "object" ? org.settings : {}),
    agenda: {
      horarios_atendimento: JORNADA_ROBUSTY,
      endereco_loja: ENDERECO_LOJA_ROBUSTY,
    },
  };

  const { error: errUpdOrg } = await sb
    .from("organizations")
    .update({ settings: nextSettings })
    .eq("id", org.id);

  if (errUpdOrg) throw new Error("Erro ao atualizar settings da org: " + JSON.stringify(errUpdOrg));
  console.log("-> Settings da agenda atualizados na organização.");

  // 3. Garantir os Tipos de Agendamento em calendar_event_types
  const tiposDef = [
    {
      name: "Instalação na Loja (Oficina SP)",
      slug: "instalacao-loja",
      category: "outro",
      duration_minutes: 60,
      location_kind: "in_person",
      location_details: ENDERECO_LOJA_ROBUSTY,
      is_active: true,
      position: 100,
    },
    {
      name: "Coleta Transportadora",
      slug: "coleta-transportadora",
      category: "outro",
      duration_minutes: 30,
      location_kind: "in_person",
      location_details: "Expedição Robusty (Oficina SP)",
      is_active: true,
      position: 200,
    },
  ];

  for (const t of tiposDef) {
    const { data: existing } = await sb
      .from("calendar_event_types")
      .select("id")
      .eq("organization_id", org.id)
      .eq("slug", t.slug)
      .maybeSingle();

    if (existing) {
      console.log(`Atualizando tipo de evento [${t.name}] (${existing.id})...`);
      await sb
        .from("calendar_event_types")
        .update({
          name: t.name,
          category: t.category,
          duration_minutes: t.duration_minutes,
          location_kind: t.location_kind,
          location_details: t.location_details,
          is_active: t.is_active,
          position: t.position,
        })
        .eq("id", existing.id);
    } else {
      console.log(`Criando tipo de evento [${t.name}]...`);
      await sb.from("calendar_event_types").insert({
        organization_id: org.id,
        name: t.name,
        slug: t.slug,
        category: t.category,
        duration_minutes: t.duration_minutes,
        location_kind: t.location_kind,
        location_details: t.location_details,
        is_active: t.is_active,
        position: t.position,
      });
    }
  }

  // 4. Configurar jornada em attendant_availability para os membros da organização
  const { data: members, error: errMem } = await sb
    .from("user_organizations")
    .select("user_id, role")
    .eq("organization_id", org.id);

  if (errMem) throw new Error("Erro ao buscar membros: " + JSON.stringify(errMem));
  console.log(`Membros encontrados na organização: ${members?.length || 0}`);

  for (const m of members || []) {
    const { data: existingAvail } = await sb
      .from("attendant_availability")
      .select("id")
      .eq("organization_id", org.id)
      .eq("user_id", m.user_id)
      .maybeSingle();

    if (existingAvail) {
      await sb
        .from("attendant_availability")
        .update({
          is_available: true,
          schedule: JORNADA_ROBUSTY,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAvail.id);
      console.log(` -> Disponibilidade atualizada para usuário ${m.user_id}`);
    } else {
      await sb.from("attendant_availability").insert({
        organization_id: org.id,
        user_id: m.user_id,
        is_available: true,
        capacity: 5,
        schedule: JORNADA_ROBUSTY,
      });
      console.log(` -> Disponibilidade criada para usuário ${m.user_id}`);
    }
  }

  console.log("=== SETUP DA AGENDA CONCLUÍDO COM SUCESSO! ===");
}

main().catch((err) => {
  console.error("Erro no setup da agenda:", err);
  process.exit(1);
});
