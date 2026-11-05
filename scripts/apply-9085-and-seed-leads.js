const { createClient } = require("@supabase/supabase-js");
const { Client } = require("pg");
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

async function run() {
  console.log("=== 1. APLICANDO MIGRATION 9085 NO BANCO SUPABASE ===");
  const pgClient = new Client({
    connectionString: env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();
  try {
    await pgClient.query(`
      drop index if exists public.uniq_crm_leads_org_commercial_id;
      create unique index if not exists uniq_crm_leads_org_pipeline_commercial_id
        on public.crm_leads (organization_id, pipeline_id, commercial_id)
        where commercial_id is not null;
    `);
    console.log("Índice uniq_crm_leads_org_pipeline_commercial_id aplicado com sucesso!");
  } finally {
    await pgClient.end();
  }

  console.log("\n=== 2. POPULANDO 5 LEADS DE TESTE NA ETAPA 1 DO FUNIL LEADS ===");
  const { data: org } = await sb
    .from("organizations")
    .select("id, legal_name")
    .limit(1)
    .single();
  if (!org) throw new Error("Organização não encontrada.");

  const { data: leadsPipeline } = await sb
    .from("crm_pipelines")
    .select("id, name")
    .eq("organization_id", org.id)
    .eq("slug", "leads")
    .single();
  if (!leadsPipeline) throw new Error("Funil Leads não encontrado.");

  const { data: firstStage } = await sb
    .from("crm_stages")
    .select("id, name")
    .eq("organization_id", org.id)
    .eq("pipeline_id", leadsPipeline.id)
    .eq("is_archived", false)
    .order("position", { ascending: true })
    .limit(1)
    .single();
  if (!firstStage) throw new Error("Etapa inicial Novo lead não encontrada.");

  console.log(`Organização: ${org.legal_name} (${org.id})`);
  console.log(`Funil: ${leadsPipeline.name} (${leadsPipeline.id})`);
  console.log(`Etapa 1: ${firstStage.name} (${firstStage.id})`);

  const fakeLeads = [
    {
      contact: {
        name: "Carlos Eduardo Mendes",
        phone_number: "+5511987651001",
        email: "carlos.mendes.kombi@exemplo.com.br",
      },
      lead: {
        title: "Carlos Mendes — Kombi Motorhome (Bagageiro MX 100 Plus + Deck)",
        description:
          "Cliente montando Kombi Motorhome 2012. Quer bagageiro MX 100 Plus com deck completo de madeira, escada lateral removível e corte para climatizador traseiro.",
        value_cents: 429000,
        tags: ["motorhome", "kombi"],
        position_in_stage: 1000,
        custom_fields: {
          produto: "bagageiro",
          veiculo: "kombi",
          ano_versao: "2012 Standard 1.4 Flex",
          modelo_bagageiro: "mx_100_plus",
          acessorios_adicionais: ["escada_kombi", "deck_completo", "corte_climatizador"],
          detalhes_da_necessidade:
            "Precisa de corte para climatizador Resfriar na traseira e barra frontal para placa solar de 150W.",
          modalidade_pretendida: "instalacao_loja",
          tipo_precificacao: "tabelado",
          forma_pagamento: "pix",
          status_pagamento: "pendente",
        },
      },
    },
    {
      contact: {
        name: "Marcos Silva (Frota Rápido Silva)",
        phone_number: "+5511987651002",
        email: "compras@rapidosilva.com.br",
      },
      lead: {
        title: "Marcos Silva — Fiat Fiorino (Bagageiro FX 200 + Rolete)",
        description:
          "Empresa de manutenção elétrica. Precisa de bagageiro reforçado FX 200 com suporte de escada e guia de rolete para Fiorino 2023.",
        value_cents: 198000,
        tags: ["frota", "fiorino"],
        position_in_stage: 2000,
        custom_fields: {
          produto: "bagageiro",
          veiculo: "fiorino",
          ano_versao: "2023 Endurance 1.4",
          modelo_bagageiro: "fx_200",
          acessorios_adicionais: ["suporte_escada_rolete", "instalacao_simples"],
          detalhes_da_necessidade:
            "Carrega duas escadas extensíveis de fibra no dia a dia. Prefere agendar instalação na loja em SP na sexta-feira.",
          modalidade_pretendida: "instalacao_loja",
          tipo_precificacao: "tabelado",
          forma_pagamento: "cartao",
          status_pagamento: "pendente",
        },
      },
    },
    {
      contact: {
        name: "Roberto Almeida",
        phone_number: "+5541991234003",
        email: "roberto.almeida.cwb@exemplo.com.br",
      },
      lead: {
        title: "Roberto Almeida — Renault Kangoo (Bagageiro KX 200 - Envio PR)",
        description:
          "Cliente de Curitiba/PR solicitando bagageiro KX 200 para Renault Kangoo com envio via transportadora.",
        value_cents: 185000,
        tags: ["transportadora", "kangoo"],
        position_in_stage: 3000,
        custom_fields: {
          produto: "bagageiro",
          veiculo: "kangoo",
          ano_versao: "2018 Express 1.6",
          modelo_bagageiro: "kx_200",
          acessorios_adicionais: ["par_ventosas", "kit_hastes"],
          detalhes_da_necessidade:
            "Envio para Curitiba/PR. Cliente pediu cotação de transportadora com entrega comercial.",
          modalidade_pretendida: "transportadora",
          cep: "80010-000",
          valor_frete: 245,
          tipo_precificacao: "tabelado",
          forma_pagamento: "pix",
          status_pagamento: "pendente",
        },
      },
    },
    {
      contact: {
        name: "Fernanda Costa (Climatização FC)",
        phone_number: "+5519998765004",
        email: "fernanda@climatizacaofc.com.br",
      },
      lead: {
        title: "Fernanda Costa — Citroën Jumpy (Bagageiro Extreme + Escada)",
        description:
          "Bagageiro linha Extreme com escada traseira para Citroën Jumpy 2024. Projeto especial com suporte lateral para tubulação de cobre.",
        value_cents: 365000,
        tags: ["jumpy", "projeto-especial"],
        position_in_stage: 4000,
        custom_fields: {
          produto: "bagageiro",
          veiculo: "jumpy",
          ano_versao: "2024 Cargo 1.5 Turbo Diesel",
          modelo_bagageiro: "extreme",
          acessorios_adicionais: ["escada_jumpy_expert_scudo", "instalacao_simples"],
          detalhes_da_necessidade:
            "Solicitou avaliação de suporte extra lateral para tubo de PVC de 3 metros (cotação especial).",
          modalidade_pretendida: "instalacao_loja",
          tipo_precificacao: "cotacao_especial",
          status_cotacao: "pendente",
          forma_pagamento: "transferencia",
          status_pagamento: "pendente",
        },
      },
    },
    {
      contact: {
        name: "Jorge Batista",
        phone_number: "+5531996543005",
        email: "jorge.batista.bh@exemplo.com.br",
      },
      lead: {
        title: "Jorge Batista — VW Saveiro CD (Bagageiro Aba Dupla + Guia Rolete)",
        description:
          "Saveiro Cabine Dupla 2021. Cliente de Belo Horizonte/MG quer bagageiro Aba Dupla com guia de rolete e fixação por ventosas.",
        value_cents: 215000,
        tags: ["saveiro", "transportadora"],
        position_in_stage: 5000,
        custom_fields: {
          produto: "bagageiro",
          veiculo: "saveiro_cd",
          ano_versao: "2021 Robust Cabine Dupla",
          modelo_bagageiro: "aba_dupla",
          acessorios_adicionais: ["guia_rolete_saveiro", "par_ventosas", "kit_hastes"],
          detalhes_da_necessidade:
            "Envio por transportadora para Belo Horizonte/MG. Não quer furar o teto da Saveiro (fixação por ventosas e hastes).",
          modalidade_pretendida: "transportadora",
          cep: "30140-071",
          valor_frete: 210,
          tipo_precificacao: "tabelado",
          forma_pagamento: "cartao",
          status_pagamento: "pendente",
        },
      },
    },
  ];

  const criados = [];

  for (const item of fakeLeads) {
    // 1. Garantir contato de forma idempotente pelo telefone
    let { data: contact } = await sb
      .from("contacts")
      .select("id, name, phone_number")
      .eq("organization_id", org.id)
      .eq("phone_number", item.contact.phone_number)
      .maybeSingle();

    if (!contact) {
      const { data: newContact, error: errContact } = await sb
        .from("contacts")
        .insert({
          organization_id: org.id,
          name: item.contact.name,
          phone_number: item.contact.phone_number,
          email: item.contact.email,
        })
        .select("id, name, phone_number")
        .single();
      if (errContact) throw new Error("Erro ao criar contato: " + JSON.stringify(errContact));
      contact = newContact;
    }

    // 2. Verificar se já existe o lead com esse título no funil Leads
    const { data: existingLead } = await sb
      .from("crm_leads")
      .select("id, commercial_id, title, stage_id")
      .eq("organization_id", org.id)
      .eq("pipeline_id", leadsPipeline.id)
      .eq("title", item.lead.title)
      .maybeSingle();

    if (existingLead) {
      console.log(
        `Lead já existente: [${existingLead.commercial_id}] ${existingLead.title} (id: ${existingLead.id})`,
      );
      criados.push(existingLead);
      continue;
    }

    const { data: newLead, error: errLead } = await sb
      .from("crm_leads")
      .insert({
        organization_id: org.id,
        pipeline_id: leadsPipeline.id,
        stage_id: firstStage.id,
        contact_id: contact.id,
        title: item.lead.title,
        description: item.lead.description,
        value_cents: item.lead.value_cents,
        currency: "BRL",
        tags: item.lead.tags,
        source: "manual",
        status: "open",
        position_in_stage: item.lead.position_in_stage,
        custom_fields: item.lead.custom_fields,
      })
      .select("id, commercial_id, title, stage_id")
      .single();

    if (errLead) throw new Error("Erro ao criar lead: " + JSON.stringify(errLead));
    console.log(`Lead criado: [${newLead.commercial_id}] ${newLead.title} (id: ${newLead.id})`);
    criados.push(newLead);
  }

  console.log(`\nTotal de leads prontos na Etapa 1 (${firstStage.name}): ${criados.length}`);
}

run().catch((err) => {
  console.error("Erro na execução:", err);
  process.exit(1);
});
