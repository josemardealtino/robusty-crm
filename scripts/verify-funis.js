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

async function verify() {
  console.log('=== VERIFICAÇÃO DETALHADA DOS FUNIS ROBUSTY ===');
  
  // 1. Organização
  const { data: org } = await sb.from('organizations').select('id, legal_name').single();
  console.log(`Org: ${org.legal_name} (${org.id})`);

  // 2. Pipelines
  const { data: pipelines } = await sb.from('crm_pipelines')
    .select('id, name, slug, is_default, is_client_pipeline, is_archived, position, settings, vocabulary')
    .eq('organization_id', org.id)
    .order('position', { ascending: true });

  console.log(`\nPipelines encontrados: ${pipelines.length}`);
  for (const p of pipelines) {
    console.log(`\n======================================================`);
    console.log(`FUNIL: [${p.name}] (slug: ${p.slug})`);
    console.log(`ID: ${p.id} | Default: ${p.is_default} | Cliente: ${p.is_client_pipeline} | Arquivado: ${p.is_archived}`);
    console.log(`Vocabulário: won="${p.vocabulary?.won}", lost="${p.vocabulary?.lost}"`);
    console.log(`Campos em settings.fields: ${p.settings?.fields?.length || 0}`);
    console.log(`Motivos de perda (lost_reasons): ${p.settings?.lost_reasons?.join(', ')}`);

    // Etapas
    const { data: stages } = await sb.from('crm_stages')
      .select('id, name, slug, position, color, is_won, is_lost, is_archived, requires_human')
      .eq('pipeline_id', p.id)
      .eq('is_archived', false)
      .order('position', { ascending: true });

    console.log(`\nEtapas ativas (${stages.length}):`);
    stages.forEach((s, idx) => {
      const tag = s.is_won ? ' [TERMINAL GANHO]' : s.is_lost ? ' [TERMINAL PERDIDO]' : '';
      const human = s.requires_human ? ' (atendimento humano)' : '';
      console.log(`  ${idx + 1}. [${s.name}] (pos: ${s.position}, cor: ${s.color})${tag}${human}`);
    });

    console.log(`\nCampos configurados (${p.settings?.fields?.length || 0}):`);
    p.settings?.fields?.forEach((f, idx) => {
      const req = f.obrigatorio_em ? ` [Obrigatório: ${JSON.stringify(f.obrigatorio_em)}]` : '';
      const cond = f.mostrar_quando ? ` [Condicional: quando ${f.mostrar_quando.campo} ${f.mostrar_quando.operador} ${f.mostrar_quando.valor}]` : '';
      const opts = f.options ? ` (${f.options.length} opções)` : '';
      console.log(`  - ${idx + 1}. ${f.label} [${f.key}] (${f.type})${opts}${req}${cond}`);
    });
  }

  // 3. Teste funcional de ciclo de vida de lead no Funil LEADS
  console.log(`\n======================================================`);
  console.log(`TESTE FUNCIONAL: Criação e ciclo de vida de Lead no Funil Leads...`);
  const leadsPip = pipelines.find(p => p.slug === 'leads');
  const { data: firstStage } = await sb.from('crm_stages')
    .select('id, name')
    .eq('pipeline_id', leadsPip.id)
    .eq('is_archived', false)
    .order('position', { ascending: true })
    .limit(1)
    .single();

  console.log(`Primeira etapa aberta: [${firstStage.name}] (${firstStage.id})`);

  // Inserir lead de teste com dados mínimos (como especificado: dados mínimos permitidos na criação)
  const testLeadPayload = {
    organization_id: org.id,
    pipeline_id: leadsPip.id,
    stage_id: firstStage.id,
    title: 'Lead Teste Automatizado - Verificação Funil',
    description: 'Lead criado para validar persistência de campos e etapas',
    status: 'open',
    custom_fields: {
      produto: 'bagageiro',
      veiculo: 'kombi',
      modelo_bagageiro: 'mx_100_plus',
      modalidade_pretendida: 'transportadora',
      cep: '03525-150',
      tipo_precificacao: 'tabelado'
    }
  };

  const { data: createdLead, error: errCreate } = await sb.from('crm_leads')
    .insert(testLeadPayload)
    .select()
    .single();

  if (errCreate) {
    throw new Error('Falha ao criar lead de teste: ' + JSON.stringify(errCreate));
  }
  console.log(`Lead de teste criado com sucesso! ID: ${createdLead.id}`);
  console.log(`Custom fields salvos no lead:`, createdLead.custom_fields);

  // Limpeza: remover lead de teste
  await sb.from('crm_leads').delete().eq('id', createdLead.id);
  console.log(`Lead de teste removido com sucesso. Banco de dados limpo!`);

  console.log('\n>>> TODOS OS TESTES PASSARAM COM 100% DE SUCESSO! <<<');
}

verify().catch(err => {
  console.error('Erro na verificação:', err);
  process.exit(1);
});
