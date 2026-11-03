const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('=== SETUP FUNIS ROBUSTY (LEADS & PEDIDOS) ===');
  console.log('Project URL:', env.NEXT_PUBLIC_SUPABASE_URL);

  // 1. Obter organização Robusty
  const { data: orgs, error: eOrg } = await sb.from('organizations').select('id, legal_name, slug');
  if (eOrg || !orgs || orgs.length === 0) {
    throw new Error('Organização não encontrada: ' + JSON.stringify(eOrg));
  }
  const org = orgs[0];
  console.log(`Organização ativa: [${org.legal_name}] (id: ${org.id}, slug: ${org.slug})`);

  // 2. Verificar leads existentes no banco
  const { data: leads, error: eLeads } = await sb.from('crm_leads').select('id, title, pipeline_id').eq('organization_id', org.id);
  if (eLeads) {
    throw new Error('Erro ao verificar leads: ' + JSON.stringify(eLeads));
  }
  console.log(`Total de leads existentes na organização: ${leads.length}`);

  // 3. Obter pipelines existentes
  const { data: existingPipelines, error: ePip } = await sb.from('crm_pipelines').select('*').eq('organization_id', org.id);
  if (ePip) {
    throw new Error('Erro ao buscar pipelines: ' + JSON.stringify(ePip));
  }
  console.log(`Pipelines existentes: ${existingPipelines.map(p => `${p.name} (slug: ${p.slug}, default: ${p.is_default})`).join(', ')}`);

  // ==========================================
  // 4. FUNIL 1: LEADS (Comercial)
  // ==========================================
  console.log('\n--- 4. Configurando Funil LEADS ---');
  let leadsPipeline = existingPipelines.find(p => p.slug === 'leads' || (p.is_default && p.name.includes('Leads')));

  const leadsPipelinePayload = {
    organization_id: org.id,
    name: 'Leads',
    slug: 'leads',
    description: 'Funil comercial de atendimento, qualificação, orçamento e fechamento de vendas',
    is_default: true,
    is_archived: false,
    is_client_pipeline: false,
    position: 1000,
    vocabulary: {
      lead: 'Lead',
      deal: 'Oportunidade',
      won: 'Venda ganha',
      lost: 'Venda perdida',
      stage: 'Etapa',
      lead_plural: 'Leads',
      deal_plural: 'Oportunidades',
      stage_plural: 'Etapas'
    }
  };

  if (!leadsPipeline) {
    // Se o funil default existente for o antigo ('vendas-robusty' / 'Funil Comercial Robusty'), reaproveitamos o registro ou criamos novo
    const oldDefault = existingPipelines.find(p => p.is_default);
    if (oldDefault && leads.filter(l => l.pipeline_id === oldDefault.id).length === 0) {
      console.log(`Atualizando funil padrão antigo id=${oldDefault.id} para se tornar o Funil 'Leads'...`);
      const { data: upd, error: errUpd } = await sb.from('crm_pipelines')
        .update(leadsPipelinePayload)
        .eq('id', oldDefault.id)
        .select()
        .single();
      if (errUpd) throw new Error('Erro ao atualizar funil leads: ' + JSON.stringify(errUpd));
      leadsPipeline = upd;
    } else {
      console.log("Inserindo novo funil 'Leads'...");
      const { data: ins, error: errIns } = await sb.from('crm_pipelines')
        .insert(leadsPipelinePayload)
        .select()
        .single();
      if (errIns) throw new Error('Erro ao criar funil leads: ' + JSON.stringify(errIns));
      leadsPipeline = ins;
    }
  } else {
    console.log(`Atualizando funil existente 'Leads' (id: ${leadsPipeline.id})...`);
    const { data: upd, error: errUpd } = await sb.from('crm_pipelines')
      .update(leadsPipelinePayload)
      .eq('id', leadsPipeline.id)
      .select()
      .single();
    if (errUpd) throw new Error('Erro ao atualizar funil leads: ' + JSON.stringify(errUpd));
    leadsPipeline = upd;
  }
  console.log(`Funil Leads pronto (id: ${leadsPipeline.id})`);

  // Etapas de Leads (9 etapas abertas + 1 perdida = 10 etapas no total)
  const leadsStagesDef = [
    { name: 'Novo lead', slug: 'novo-lead', position: 1000, color: '#3b82f6', is_won: false, is_lost: false, requires_human: false },
    { name: 'Em qualificação', slug: 'em-qualificacao', position: 2000, color: '#6366f1', is_won: false, is_lost: false, requires_human: false },
    { name: 'Aguardando atendimento comercial', slug: 'aguardando-atendimento', position: 3000, color: '#8b5cf6', is_won: false, is_lost: false, requires_human: true },
    { name: 'Aguardando cotação', slug: 'aguardando-cotacao', position: 4000, color: '#ec4899', is_won: false, is_lost: false, requires_human: false },
    { name: 'Preparação do orçamento', slug: 'preparacao-orcamento', position: 5000, color: '#f97316', is_won: false, is_lost: false, requires_human: false },
    { name: 'Orçamento enviado', slug: 'orcamento-enviado', position: 6000, color: '#eab308', is_won: false, is_lost: false, requires_human: false },
    { name: 'Em negociação', slug: 'em-negociacao', position: 7000, color: '#14b8a6', is_won: false, is_lost: false, requires_human: false },
    { name: 'Aguardando pagamento', slug: 'aguardando-pagamento', position: 8000, color: '#06b6d4', is_won: false, is_lost: false, requires_human: false },
    { name: 'Venda ganha', slug: 'venda-ganha', position: 9000, color: '#22c55e', is_won: true, is_lost: false, requires_human: false },
    { name: 'Venda perdida', slug: 'venda-perdida', position: 10000, color: '#ef4444', is_won: false, is_lost: true, requires_human: false },
  ];

  // Buscar etapas atuais do funil de Leads
  const { data: currentLeadsStages } = await sb.from('crm_stages').select('*').eq('pipeline_id', leadsPipeline.id);
  const leadsStageMap = new Map(); // slug -> stage object

  // Mapear etapa won e lost existentes para evitar colisão na constraint UNIQUE
  let existingWonStage = currentLeadsStages?.find(s => s.is_won);
  let existingLostStage = currentLeadsStages?.find(s => s.is_lost);

  for (const stg of leadsStagesDef) {
    let targetStage = null;
    if (stg.is_won && existingWonStage) {
      targetStage = existingWonStage;
      existingWonStage = null; // consumido
    } else if (stg.is_lost && existingLostStage) {
      targetStage = existingLostStage;
      existingLostStage = null; // consumido
    } else {
      targetStage = currentLeadsStages?.find(s => s.slug === stg.slug || s.name === stg.name);
    }

    if (targetStage) {
      const { data: updStg, error: eUpdStg } = await sb.from('crm_stages').update({
        name: stg.name,
        slug: stg.slug,
        position: stg.position,
        color: stg.color,
        is_won: stg.is_won,
        is_lost: stg.is_lost,
        is_archived: false,
        requires_human: stg.requires_human
      }).eq('id', targetStage.id).select().single();
      if (eUpdStg) throw new Error(`Erro ao atualizar etapa [${stg.name}]: ` + JSON.stringify(eUpdStg));
      leadsStageMap.set(stg.slug, updStg);
    } else {
      const { data: insStg, error: eInsStg } = await sb.from('crm_stages').insert({
        organization_id: org.id,
        pipeline_id: leadsPipeline.id,
        name: stg.name,
        slug: stg.slug,
        position: stg.position,
        color: stg.color,
        is_won: stg.is_won,
        is_lost: stg.is_lost,
        is_archived: false,
        requires_human: stg.requires_human
      }).select().single();
      if (eInsStg) throw new Error(`Erro ao criar etapa [${stg.name}]: ` + JSON.stringify(eInsStg));
      leadsStageMap.set(stg.slug, insStg);
    }
  }

  // Desativar / arquivar etapas velhas que não pertencem ao novo funil
  const slugsDoNovoFunil = new Set(leadsStagesDef.map(s => s.slug));
  for (const oldStg of currentLeadsStages || []) {
    if (!slugsDoNovoFunil.has(oldStg.slug)) {
      console.log(`Arquivando etapa antiga [${oldStg.name}] (id: ${oldStg.id})...`);
      await sb.from('crm_stages').update({ is_archived: true }).eq('id', oldStg.id);
    }
  }

  const orcamentoEnviadoStageId = leadsStageMap.get('orcamento-enviado')?.id;
  const aguardandoPagamentoStageId = leadsStageMap.get('aguardando-pagamento')?.id;
  const vendaGanhaStageId = leadsStageMap.get('venda-ganha')?.id;
  const vendaPerdidaStageId = leadsStageMap.get('venda-perdida')?.id;

  // Campos Customizados de Leads
  const leadsFieldsDef = [
    {
      key: 'produto',
      label: 'Produto',
      type: 'select',
      options: [
        { value: 'bagageiro', label: 'Bagageiro' },
        { value: 'escada', label: 'Escada' },
        { value: 'deck_meio_deck', label: 'Deck / Meio deck' },
        { value: 'suporte', label: 'Suporte' },
        { value: 'fixacao_ventosas', label: 'Fixação / Ventosas' },
        { value: 'outros_acessorios', label: 'Outros acessórios' },
        { value: 'servico', label: 'Serviço' },
        { value: 'a_definir', label: 'A definir' }
      ],
      obrigatorio_em: orcamentoEnviadoStageId ? { etapas: [orcamentoEnviadoStageId] } : undefined
    },
    {
      key: 'tipo_de_acessorio',
      label: 'Tipo de acessório',
      type: 'select',
      options: [
        { value: 'escada', label: 'Escada' },
        { value: 'deck', label: 'Deck de madeira' },
        { value: 'suporte_estepe', label: 'Suporte de estepe' },
        { value: 'base_toldo', label: 'Base de toldo' },
        { value: 'ventosas_hastes', label: 'Ventosas e hastes de fixação' },
        { value: 'guia_rolete', label: 'Guia de rolete' },
        { value: 'outro', label: 'Outro acessório' }
      ],
      mostrar_quando: { campo: 'produto', operador: 'igual', valor: 'outros_acessorios' }
    },
    {
      key: 'veiculo',
      label: 'Veículo',
      type: 'searchable_select',
      allow_new: false,
      options: [
        { value: 'kombi', label: 'Volkswagen Kombi' },
        { value: 'kangoo', label: 'Renault Kangoo' },
        { value: 'kangoo_nova', label: 'Renault Kangoo Nova' },
        { value: 'fiorino', label: 'Fiat Fiorino' },
        { value: 'ducato_max_cargo', label: 'Fiat Ducato Max Cargo' },
        { value: 'doblo_cargo', label: 'Fiat Doblò Cargo' },
        { value: 'jumpy', label: 'Citroën Jumpy' },
        { value: 'expert', label: 'Peugeot Expert' },
        { value: 'scudo', label: 'Fiat Scudo' },
        { value: 'saveiro_cs', label: 'Volkswagen Saveiro - Cabine simples' },
        { value: 'saveiro_cd', label: 'Volkswagen Saveiro - Cabine dupla' },
        { value: 'outro_nao_identificado', label: 'Outro / Não identificado' }
      ]
    },
    {
      key: 'ano_versao',
      label: 'Ano / versão',
      type: 'text'
    },
    {
      key: 'modelo_bagageiro',
      label: 'Modelo do bagageiro',
      type: 'searchable_select',
      allow_new: true,
      options: [
        { value: 'mx_100', label: 'MX 100' },
        { value: 'mx_100_plus', label: 'MX 100 Plus' },
        { value: 'mx_200_plus', label: 'MX 200 Plus' },
        { value: 'mx_80_plus', label: 'MX 80 Plus' },
        { value: 'mx_50_plus', label: 'MX 50 Plus' },
        { value: 'kx_100', label: 'KX 100' },
        { value: 'kx_200', label: 'KX 200' },
        { value: 'kx_200_nova', label: 'KX 200 Nova' },
        { value: 'fx_100', label: 'FX 100' },
        { value: 'fx_200', label: 'FX 200' },
        { value: 'dx_100', label: 'DX 100' },
        { value: 'dx_200', label: 'DX 200' },
        { value: 'mx_120', label: 'MX 120' },
        { value: 'aba_dupla', label: 'Aba dupla' },
        { value: 'extreme', label: 'Extreme' },
        { value: 'outro_a_definir', label: 'Outro / A definir' }
      ],
      mostrar_quando: { campo: 'produto', operador: 'igual', valor: 'bagageiro' }
    },
    {
      key: 'acessorios_adicionais',
      label: 'Acessórios adicionais',
      type: 'searchable_select',
      multiple: true,
      allow_new: true,
      options: [
        { value: 'escada_kombi', label: 'Escada removível Kombi' },
        { value: 'escada_jumpy_expert_scudo', label: 'Escada Jumpy / Expert / Scudo' },
        { value: 'deck_completo', label: 'Deck completo' },
        { value: 'meio_deck', label: 'Meio deck' },
        { value: 'deck_escada', label: 'Deck para escada' },
        { value: 'suporte_estepe', label: 'Suporte de estepe' },
        { value: 'base_toldo', label: 'Base para toldo' },
        { value: 'base_toldo_leroy', label: 'Base para toldo Leroy' },
        { value: 'suporte_escada_rolete', label: 'Suporte de escada com guia de rolete' },
        { value: 'par_ventosas', label: 'Par de ventosas' },
        { value: 'haste_fixacao', label: 'Haste de fixação' },
        { value: 'kit_hastes', label: 'Kit de hastes' },
        { value: 'kit_fixacao_escada', label: 'Kit de fixação para escada' },
        { value: 'barra_placa_solar', label: 'Barra para placa solar' },
        { value: 'guia_rolete_saveiro', label: 'Guia de rolete Saveiro' },
        { value: 'instalacao_simples', label: 'Instalação' },
        { value: 'instalacao_rebite', label: 'Instalação com rebite' },
        { value: 'corte_climatizador', label: 'Corte para climatizador' }
      ]
    },
    {
      key: 'detalhes_da_necessidade',
      label: 'Detalhes da necessidade',
      type: 'textarea'
    },
    {
      key: 'modalidade_pretendida',
      label: 'Modalidade pretendida',
      type: 'select',
      options: [
        { value: 'transportadora', label: 'Transportadora' },
        { value: 'instalacao_loja', label: 'Instalação na loja' },
        { value: 'a_definir', label: 'A definir' }
      ]
    },
    {
      key: 'cep',
      label: 'CEP',
      type: 'text',
      padrao: '^\\d{5}-?\\d{3}$',
      mensagem_padrao: 'Digite o CEP com 8 dígitos, ex: 03525-150',
      mostrar_quando: { campo: 'modalidade_pretendida', operador: 'igual', valor: 'transportadora' }
    },
    {
      key: 'tipo_precificacao',
      label: 'Tipo de precificação',
      type: 'select',
      options: [
        { value: 'tabelado', label: 'Tabelado' },
        { value: 'cotacao_especial', label: 'Cotação especial' }
      ],
      obrigatorio_em: orcamentoEnviadoStageId ? { etapas: [orcamentoEnviadoStageId] } : undefined
    },
    {
      key: 'status_cotacao',
      label: 'Status da cotação',
      type: 'select',
      options: [
        { value: 'nao_necessaria', label: 'Não necessária' },
        { value: 'pendente', label: 'Pendente' },
        { value: 'em_andamento', label: 'Em andamento' },
        { value: 'concluida', label: 'Concluída' }
      ],
      mostrar_quando: { campo: 'tipo_precificacao', operador: 'igual', valor: 'cotacao_especial' }
    },
    {
      key: 'valor_frete',
      label: 'Valor do frete',
      type: 'currency',
      mostrar_quando: { campo: 'modalidade_pretendida', operador: 'igual', valor: 'transportadora' }
    },
    {
      key: 'forma_pagamento',
      label: 'Forma de pagamento',
      type: 'select',
      options: [
        { value: 'pix', label: 'Pix' },
        { value: 'cartao', label: 'Cartão' },
        { value: 'transferencia', label: 'Transferência' },
        { value: 'outro', label: 'Outro' }
      ],
      obrigatorio_em: { ao_ganhar: true }
    },
    {
      key: 'status_pagamento',
      label: 'Status do pagamento',
      type: 'select',
      options: [
        { value: 'pendente', label: 'Pendente' },
        { value: 'em_conferencia', label: 'Em conferência' },
        { value: 'confirmado', label: 'Confirmado' },
        { value: 'nao_aprovado', label: 'Não aprovado' }
      ],
      obrigatorio_em: { ao_ganhar: true }
    },
    {
      key: 'motivo_ganho',
      label: 'Motivo de ganho',
      type: 'select',
      options: [
        { value: 'atendimento_rapido', label: 'Atendimento rápido' },
        { value: 'qualidade_resistencia', label: 'Qualidade e resistência do produto' },
        { value: 'preco_condicoes', label: 'Preço e condições de pagamento' },
        { value: 'pronta_entrega_instalacao', label: 'Disponibilidade / Instalação na loja' },
        { value: 'indicacao_reputacao', label: 'Indicação / Reputação da marca' },
        { value: 'outro', label: 'Outro motivo' }
      ]
    }
  ];

  const leadsLostReasons = [
    'Preço',
    'Concorrente',
    'Incompatibilidade',
    'Desistência',
    'Sem retorno',
    'Prazo',
    'Frete',
    'Indisponível',
    'Outros'
  ];

  // Atualizar settings de Leads
  const leadsSettings = {
    ...(leadsPipeline.settings || {}),
    fields: leadsFieldsDef,
    lost_reasons: leadsLostReasons
  };

  const { error: errUpdLeadsSet } = await sb.from('crm_pipelines')
    .update({ settings: leadsSettings })
    .eq('id', leadsPipeline.id);
  if (errUpdLeadsSet) throw new Error('Erro ao salvar settings de Leads: ' + JSON.stringify(errUpdLeadsSet));
  console.log(`Settings e campos de Leads salvos com sucesso (${leadsFieldsDef.length} campos configurados)`);

  // ==========================================
  // 5. FUNIL 2: PEDIDOS (Operação / Entrega / Instalação)
  // ==========================================
  console.log('\n--- 5. Configurando Funil PEDIDOS ---');
  let pedidosPipeline = existingPipelines.find(p => p.slug === 'pedidos' || p.name.toLowerCase() === 'pedidos');

  const pedidosPipelinePayload = {
    organization_id: org.id,
    name: 'Pedidos',
    slug: 'pedidos',
    description: 'Funil operacional para execução da venda, preparação, expedição por transportadora ou instalação na loja',
    is_default: false,
    is_archived: false,
    is_client_pipeline: true,
    position: 2000,
    vocabulary: {
      lead: 'Cliente',
      deal: 'Pedido',
      won: 'Pedido concluído',
      lost: 'Pedido cancelado',
      stage: 'Etapa operacional',
      lead_plural: 'Clientes',
      deal_plural: 'Pedidos',
      stage_plural: 'Etapas operacionais'
    }
  };

  if (!pedidosPipeline) {
    console.log("Inserindo novo funil 'Pedidos'...");
    const { data: insPed, error: eInsPed } = await sb.from('crm_pipelines')
      .insert(pedidosPipelinePayload)
      .select()
      .single();
    if (eInsPed) throw new Error('Erro ao criar funil pedidos: ' + JSON.stringify(eInsPed));
    pedidosPipeline = insPed;
  } else {
    console.log(`Atualizando funil existente 'Pedidos' (id: ${pedidosPipeline.id})...`);
    const { data: updPed, error: eUpdPed } = await sb.from('crm_pipelines')
      .update(pedidosPipelinePayload)
      .eq('id', pedidosPipeline.id)
      .select()
      .single();
    if (eUpdPed) throw new Error('Erro ao atualizar funil pedidos: ' + JSON.stringify(eUpdPed));
    pedidosPipeline = updPed;
  }
  console.log(`Funil Pedidos pronto (id: ${pedidosPipeline.id})`);

  // Etapas de Pedidos (8 etapas abertas/conclusão + 1 cancelada = 9 etapas)
  const pedidosStagesDef = [
    { name: 'Pedido recebido', slug: 'pedido-recebido', position: 1000, color: '#3b82f6', is_won: false, is_lost: false },
    { name: 'Modalidade definida', slug: 'modalidade-definida', position: 2000, color: '#6366f1', is_won: false, is_lost: false },
    { name: 'Aguardando preparação', slug: 'aguardando-preparacao', position: 3000, color: '#8b5cf6', is_won: false, is_lost: false },
    { name: 'Em preparação', slug: 'em-preparacao', position: 4000, color: '#ec4899', is_won: false, is_lost: false },
    { name: 'Aguardando entrega ou instalação', slug: 'aguardando-entrega-instalacao', position: 5000, color: '#f97316', is_won: false, is_lost: false },
    { name: 'Em entrega ou instalação', slug: 'em-entrega-instalacao', position: 6000, color: '#eab308', is_won: false, is_lost: false },
    { name: 'Aguardando finalização', slug: 'aguardando-finalizacao', position: 7000, color: '#14b8a6', is_won: false, is_lost: false },
    { name: 'Pedido concluído', slug: 'pedido-concluido', position: 8000, color: '#22c55e', is_won: true, is_lost: false },
    { name: 'Pedido cancelado', slug: 'pedido-cancelado', position: 9000, color: '#ef4444', is_won: false, is_lost: true },
  ];

  const { data: currentPedidosStages } = await sb.from('crm_stages').select('*').eq('pipeline_id', pedidosPipeline.id);
  const pedidosStageMap = new Map();

  let existingPedWonStage = currentPedidosStages?.find(s => s.is_won);
  let existingPedLostStage = currentPedidosStages?.find(s => s.is_lost);

  for (const stg of pedidosStagesDef) {
    let targetStage = null;
    if (stg.is_won && existingPedWonStage) {
      targetStage = existingPedWonStage;
      existingPedWonStage = null;
    } else if (stg.is_lost && existingPedLostStage) {
      targetStage = existingPedLostStage;
      existingPedLostStage = null;
    } else {
      targetStage = currentPedidosStages?.find(s => s.slug === stg.slug || s.name === stg.name);
    }

    if (targetStage) {
      const { data: updStg, error: eUpdStg } = await sb.from('crm_stages').update({
        name: stg.name,
        slug: stg.slug,
        position: stg.position,
        color: stg.color,
        is_won: stg.is_won,
        is_lost: stg.is_lost,
        is_archived: false,
        requires_human: false
      }).eq('id', targetStage.id).select().single();
      if (eUpdStg) throw new Error(`Erro ao atualizar etapa de Pedidos [${stg.name}]: ` + JSON.stringify(eUpdStg));
      pedidosStageMap.set(stg.slug, updStg);
    } else {
      const { data: insStg, error: eInsStg } = await sb.from('crm_stages').insert({
        organization_id: org.id,
        pipeline_id: pedidosPipeline.id,
        name: stg.name,
        slug: stg.slug,
        position: stg.position,
        color: stg.color,
        is_won: stg.is_won,
        is_lost: stg.is_lost,
        is_archived: false,
        requires_human: false
      }).select().single();
      if (eInsStg) throw new Error(`Erro ao criar etapa de Pedidos [${stg.name}]: ` + JSON.stringify(eInsStg));
      pedidosStageMap.set(stg.slug, insStg);
    }
  }

  const modalidadeDefinidaStageId = pedidosStageMap.get('modalidade-definida')?.id;
  const pedidoConcluidoStageId = pedidosStageMap.get('pedido-concluido')?.id;

  // Campos Customizados de Pedidos
  const pedidosFieldsDef = [
    {
      key: 'referencia_venda',
      label: 'Referência da venda / ID da oportunidade',
      type: 'text'
    },
    {
      key: 'modalidade_entrega',
      label: 'Modalidade de entrega',
      type: 'select',
      options: [
        { value: 'transportadora', label: 'Transportadora' },
        { value: 'instalacao_loja', label: 'Instalação na loja' }
      ],
      obrigatorio_em: modalidadeDefinidaStageId ? { etapas: [modalidadeDefinidaStageId] } : undefined
    },
    {
      key: 'produtos_servicos_pedido',
      label: 'Produtos / serviços do pedido',
      type: 'textarea'
    },
    {
      key: 'status_nota_fiscal',
      label: 'Status da nota fiscal',
      type: 'select',
      options: [
        { value: 'pendente_emissao', label: 'Pendente de emissão' },
        { value: 'emitida', label: 'Emitida' },
        { value: 'enviada_ao_cliente', label: 'Enviada ao cliente' },
        { value: 'nao_se_aplica', label: 'Não se aplica' }
      ]
    },
    {
      key: 'numero_nota_fiscal',
      label: 'Número da nota fiscal',
      type: 'text',
      mostrar_quando: { campo: 'status_nota_fiscal', operador: 'igual', valor: 'emitida' }
    },
    {
      key: 'observacoes_operacionais',
      label: 'Observações operacionais',
      type: 'textarea'
    },
    {
      key: 'data_conclusao',
      label: 'Data de conclusão',
      type: 'date',
      obrigatorio_em: { ao_ganhar: true }
    },
    // Condicionais de Transportadora:
    {
      key: 'cep_entrega',
      label: 'CEP de entrega',
      type: 'text',
      padrao: '^\\d{5}-?\\d{3}$',
      mensagem_padrao: 'Digite o CEP com 8 dígitos, ex: 03525-150',
      mostrar_quando: { campo: 'modalidade_entrega', operador: 'igual', valor: 'transportadora' }
    },
    {
      key: 'endereco_entrega',
      label: 'Endereço de entrega',
      type: 'textarea',
      mostrar_quando: { campo: 'modalidade_entrega', operador: 'igual', valor: 'transportadora' }
    },
    {
      key: 'transportadora',
      label: 'Transportadora',
      type: 'text',
      mostrar_quando: { campo: 'modalidade_entrega', operador: 'igual', valor: 'transportadora' }
    },
    {
      key: 'data_coleta_despacho',
      label: 'Data de coleta / despacho',
      type: 'date',
      mostrar_quando: { campo: 'modalidade_entrega', operador: 'igual', valor: 'transportadora' }
    },
    {
      key: 'previsao_entrega',
      label: 'Previsão/data de entrega',
      type: 'date',
      mostrar_quando: { campo: 'modalidade_entrega', operador: 'igual', valor: 'transportadora' }
    },
    {
      key: 'codigo_rastreamento',
      label: 'Código/link de rastreamento',
      type: 'text',
      mostrar_quando: { campo: 'modalidade_entrega', operador: 'igual', valor: 'transportadora' }
    },
    // Condicionais de Instalação na loja:
    {
      key: 'data_instalacao',
      label: 'Data da instalação',
      type: 'date',
      mostrar_quando: { campo: 'modalidade_entrega', operador: 'igual', valor: 'instalacao_loja' }
    },
    {
      key: 'horario_instalacao',
      label: 'Horário da instalação',
      type: 'text',
      mostrar_quando: { campo: 'modalidade_entrega', operador: 'igual', valor: 'instalacao_loja' }
    },
    {
      key: 'local_responsavel_instalacao',
      label: 'Local e responsável pela instalação',
      type: 'text',
      mostrar_quando: { campo: 'modalidade_entrega', operador: 'igual', valor: 'instalacao_loja' }
    },
    {
      key: 'confirmacao_entrega_instalacao',
      label: 'Confirmação de entrega/instalação',
      type: 'select',
      options: [
        { value: 'pendente', label: 'Pendente' },
        { value: 'confirmado_pelo_cliente', label: 'Confirmado pelo cliente' },
        { value: 'comprovante_anexado', label: 'Comprovante anexado' },
        { value: 'instalacao_concluida_na_loja', label: 'Instalação concluída na loja' }
      ],
      obrigatorio_em: { ao_ganhar: true }
    }
  ];

  const pedidosLostReasons = [
    'Desistência do cliente',
    'Problema na transportadora / avaria',
    'Incompatibilidade identificada na montagem',
    'Cancelamento de pagamento',
    'Outros'
  ];

  const pedidosSettings = {
    ...(pedidosPipeline.settings || {}),
    fields: pedidosFieldsDef,
    lost_reasons: pedidosLostReasons
  };

  const { error: errUpdPedSet } = await sb.from('crm_pipelines')
    .update({ settings: pedidosSettings })
    .eq('id', pedidosPipeline.id);
  if (errUpdPedSet) throw new Error('Erro ao salvar settings de Pedidos: ' + JSON.stringify(errUpdPedSet));
  console.log(`Settings e campos de Pedidos salvos com sucesso (${pedidosFieldsDef.length} campos configurados)`);

  console.log('\n=== CONFIGURAÇÃO CONCLUÍDA COM SUCESSO! ===');
  console.log(`- Funil 1: ${leadsPipeline.name} (id: ${leadsPipeline.id}, slug: ${leadsPipeline.slug}, etapas: ${leadsStagesDef.length}, campos: ${leadsFieldsDef.length})`);
  console.log(`- Funil 2: ${pedidosPipeline.name} (id: ${pedidosPipeline.id}, slug: ${pedidosPipeline.slug}, etapas: ${pedidosStagesDef.length}, campos: ${pedidosFieldsDef.length})`);
}

main().catch(err => {
  console.error('Falha no setup de funis:', err);
  process.exit(1);
});
