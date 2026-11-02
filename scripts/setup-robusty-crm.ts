import { Client } from "pg";

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("Falta SUPABASE_DB_URL no .env.local");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Conectado ao Supabase.");

  // 1. Busca a organização Robusty
  const orgRes = await client.query(`SELECT id, display_name FROM public.organizations WHERE slug = 'robusty' OR display_name = 'Robusty' LIMIT 1`);
  if (!orgRes.rows.length) {
    console.error("Organização Robusty não encontrada.");
    process.exit(1);
  }
  const orgId = orgRes.rows[0].id;
  console.log(`Organização encontrada: ${orgRes.rows[0].display_name} (${orgId})`);

  // 2. Busca ou cria o pipeline padrão
  const existingPipe = await client.query(`SELECT id, name, slug FROM public.crm_pipelines WHERE organization_id = $1 AND is_default = true LIMIT 1`, [orgId]);

  let pipelineId: string;
  const vocabulary = {
    lead: "Cliente",
    lead_plural: "Clientes",
    deal: "Pedido",
    deal_plural: "Pedidos",
    won: "Vendido / Instalado",
    lost: "Cancelado / Perdido",
    stage: "Etapa",
    stage_plural: "Etapas",
  };

  if (existingPipe.rows.length > 0) {
    pipelineId = existingPipe.rows[0].id;
    console.log(`Atualizando pipeline existente "${existingPipe.rows[0].name}" (${pipelineId})...`);
    await client.query(`
      UPDATE public.crm_pipelines 
      SET name = 'Funil Comercial Robusty',
          slug = 'vendas-robusty',
          description = 'Funil comercial padrão para atendimento a utilitários e motorhomes',
          vocabulary = $2,
          updated_at = now()
      WHERE id = $1
    `, [pipelineId, JSON.stringify(vocabulary)]);
  } else {
    const res = await client.query(`
      INSERT INTO public.crm_pipelines (organization_id, name, slug, description, is_default, position, vocabulary)
      VALUES ($1, 'Funil Comercial Robusty', 'vendas-robusty', 'Funil comercial padrão para atendimento a utilitários e motorhomes', true, 1000, $2)
      RETURNING id;
    `, [orgId, JSON.stringify(vocabulary)]);
    pipelineId = res.rows[0].id;
  }

  console.log(`Pipeline configurado: ${pipelineId}`);

  // 3. Limpa ou atualiza etapas existentes desse pipeline
  // Deleta etapas antigas default para recriar as etapas canônicas da Robusty
  await client.query(`DELETE FROM public.crm_stages WHERE pipeline_id = $1`, [pipelineId]);
  console.log("Etapas antigas limpas para criação do fluxo Robusty.");

  // 4. Etapas do Funil Robusty
  const etapas = [
    { name: "1. Entrada de Leads", slug: "entrada-leads", pos: 1000, color: "#3b82f6", requires_human: false },
    { name: "2. Qualificação & Triagem", slug: "qualificacao", pos: 2000, color: "#06b6d4", requires_human: false },
    { name: "3. Orçamento Enviado", slug: "orcamento-enviado", pos: 3000, color: "#8b5cf6", requires_human: false },
    { name: "4. Cotação Especial (Igor)", slug: "cotacao-igor", pos: 4000, color: "#f59e0b", requires_human: true },
    { name: "5. Aguardando Pagamento", slug: "aguardando-pagamento", pos: 5000, color: "#eab308", requires_human: false },
    { name: "6. Expedição / Transportadora", slug: "expedicao-transporte", pos: 6000, color: "#10b981", requires_human: true },
    { name: "7. Agendado na Loja SP", slug: "agendado-instalacao", pos: 7000, color: "#14b8a6", requires_human: true },
    { name: "8. Concluído / Ganho", slug: "concluido-ganho", pos: 8000, color: "#22c55e", requires_human: false, is_won: true },
    { name: "Perdido", slug: "perdido", pos: 9000, color: "#ef4444", requires_human: false, is_lost: true },
  ];

  for (const e of etapas) {
    await client.query(`
      INSERT INTO public.crm_stages (
        organization_id, pipeline_id, name, slug, position, color, requires_human, is_won, is_lost
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      );
    `, [
      orgId,
      pipelineId,
      e.name,
      e.slug,
      e.pos,
      e.color,
      e.requires_human ?? false,
      e.is_won ?? false,
      e.is_lost ?? false,
    ]);
    console.log(`  ✓ Etapa criada: ${e.name} (${e.slug})`);
  }

  console.log("✅ Funil Comercial da Robusty configurado com sucesso!");
  await client.end();
}

main().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});
