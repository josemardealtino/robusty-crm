import type { CustomFieldDef, CustomFieldType } from "@/components/contacts/CustomFieldsEditor";

/**
 * Chaves de controle interno gravadas em `custom_fields` que não devem ser
 * renderizadas como inputs soltos no formulário (são exibidas no banner de
 * vínculo Lead ↔ Pedido no topo do dossiê).
 */
export const CHAVES_INTERNAS_DO_SISTEMA = new Set([
  "lead_origem_id",
  "pipeline_origem_id",
  "pedido_gerado_id",
  "pedido_pipeline_id",
  "meta_lead_submitted",
  "valor_desconto",
  "tipo_desconto",
  "detalhes_da_necessidade",
  // Chaves sinônimas e legadas que NÃO devem aparecer duplicadas no formulário:
  "modalidade_entrega",
  "cep_entrega",
  "endereco_entrega",
  "referencia_venda",
  "produtos_servicos_pedido",
  "observacoes_operacionais",
]);

/**
 * Catálogo consolidado de campos conhecidos entre os funis (Leads e Pedidos).
 * Garante que quando um Lead é convertido em Pedido (ou movido entre funis),
 * todos os campos preenchidos anteriormente mantenham seus rótulos, opções e
 * formatação originais no perfil do lead/pedido.
 */
export const CAMPOS_CONHECIDOS_DO_PERFIL: Record<string, CustomFieldDef> = {
  produto: {
    key: "produto",
    label: "Produto",
    type: "select",
    options: [
      { value: "bagageiro", label: "Bagageiro" },
      { value: "escada", label: "Escada" },
      { value: "deck_meio_deck", label: "Deck / Meio deck" },
      { value: "suporte", label: "Suporte" },
      { value: "fixacao_ventosas", label: "Fixação / Ventosas" },
      { value: "outros_acessorios", label: "Outros acessórios" },
      { value: "servico", label: "Serviço" },
      { value: "a_definir", label: "A definir" },
    ],
  },
  tipo_de_acessorio: {
    key: "tipo_de_acessorio",
    label: "Tipo de acessório",
    type: "select",
    options: [
      { value: "escada", label: "Escada" },
      { value: "deck", label: "Deck de madeira" },
      { value: "suporte_estepe", label: "Suporte de estepe" },
      { value: "base_toldo", label: "Base de toldo" },
      { value: "ventosas_hastes", label: "Ventosas e hastes de fixação" },
      { value: "guia_rolete", label: "Guia de rolete" },
      { value: "outro", label: "Outro acessório" },
    ],
  },
  veiculo: {
    key: "veiculo",
    label: "Veículo",
    type: "searchable_select",
    allow_new: false,
    options: [
      { value: "kombi", label: "Volkswagen Kombi" },
      { value: "kangoo", label: "Renault Kangoo" },
      { value: "kangoo_nova", label: "Renault Kangoo Nova" },
      { value: "fiorino", label: "Fiat Fiorino" },
      { value: "ducato_max_cargo", label: "Fiat Ducato Max Cargo" },
      { value: "doblo_cargo", label: "Fiat Doblò Cargo" },
      { value: "jumpy", label: "Citroën Jumpy" },
      { value: "expert", label: "Peugeot Expert" },
      { value: "scudo", label: "Fiat Scudo" },
      { value: "saveiro_cs", label: "Volkswagen Saveiro - Cabine simples" },
      { value: "saveiro_cd", label: "Volkswagen Saveiro - Cabine dupla" },
      { value: "outro_nao_identificado", label: "Outro / Não identificado" },
    ],
  },
  ano_versao: {
    key: "ano_versao",
    label: "Ano / versão",
    type: "text",
  },
  modelo_bagageiro: {
    key: "modelo_bagageiro",
    label: "Modelo do bagageiro",
    type: "searchable_select",
    allow_new: true,
    options: [
      { value: "mx_100", label: "MX 100" },
      { value: "mx_100_plus", label: "MX 100 Plus" },
      { value: "mx_200_plus", label: "MX 200 Plus" },
      { value: "mx_80_plus", label: "MX 80 Plus" },
      { value: "mx_50_plus", label: "MX 50 Plus" },
      { value: "kx_100", label: "KX 100" },
      { value: "kx_200", label: "KX 200" },
      { value: "kx_200_nova", label: "KX 200 Nova" },
      { value: "fx_100", label: "FX 100" },
      { value: "fx_200", label: "FX 200" },
      { value: "dx_100", label: "DX 100" },
      { value: "dx_200", label: "DX 200" },
      { value: "mx_120", label: "MX 120" },
      { value: "aba_dupla", label: "Aba dupla" },
      { value: "extreme", label: "Extreme" },
      { value: "outro_a_definir", label: "Outro / A definir" },
    ],
  },
  acessorios_adicionais: {
    key: "acessorios_adicionais",
    label: "Acessórios adicionais",
    type: "searchable_select",
    multiple: true,
    allow_new: true,
    options: [
      { value: "escada_kombi", label: "Escada removível Kombi" },
      { value: "escada_jumpy_expert_scudo", label: "Escada Jumpy / Expert / Scudo" },
      { value: "deck_completo", label: "Deck completo" },
      { value: "meio_deck", label: "Meio deck" },
      { value: "deck_escada", label: "Deck para escada" },
      { value: "suporte_estepe", label: "Suporte de estepe" },
      { value: "base_toldo", label: "Base para toldo" },
      { value: "base_toldo_leroy", label: "Base para toldo Leroy" },
      { value: "suporte_escada_rolete", label: "Suporte de escada com guia de rolete" },
      { value: "par_ventosas", label: "Par de ventosas" },
      { value: "haste_fixacao", label: "Haste de fixação" },
      { value: "kit_hastes", label: "Kit de hastes" },
      { value: "kit_fixacao_escada", label: "Kit de fixação para escada" },
      { value: "barra_placa_solar", label: "Barra para placa solar" },
      { value: "guia_rolete_saveiro", label: "Guia de rolete Saveiro" },
      { value: "instalacao_simples", label: "Instalação" },
      { value: "instalacao_rebite", label: "Instalação com rebite" },
      { value: "corte_climatizador", label: "Corte para climatizador" },
    ],
  },
  detalhes_da_necessidade: {
    key: "detalhes_da_necessidade",
    label: "Detalhes da necessidade",
    type: "textarea",
  },
  modalidade_pretendida: {
    key: "modalidade_pretendida",
    label: "Modalidade pretendida",
    type: "select",
    options: [
      { value: "transportadora", label: "Entrega" },
      { value: "instalacao_loja", label: "Instalação na loja" },
      { value: "a_definir", label: "A definir" },
    ],
  },
  cep: {
    key: "cep",
    label: "CEP",
    type: "text",
    padrao: "^\\d{5}-?\\d{3}$",
    mensagem_padrao: "Digite o CEP com 8 dígitos, ex: 03525-150",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "transportadora" },
  },
  endereco: {
    key: "endereco",
    label: "Endereço",
    type: "text",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "transportadora" },
  },
  numero: {
    key: "numero",
    label: "Número",
    type: "text",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "transportadora" },
  },
  complemento: {
    key: "complemento",
    label: "Complemento",
    type: "text",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "transportadora" },
  },
  bairro: {
    key: "bairro",
    label: "Bairro",
    type: "text",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "transportadora" },
  },
  cidade: {
    key: "cidade",
    label: "Cidade",
    type: "text",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "transportadora" },
  },
  estado: {
    key: "estado",
    label: "Estado (UF)",
    type: "text",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "transportadora" },
  },
  tipo_precificacao: {
    key: "tipo_precificacao",
    label: "Tipo de precificação",
    type: "select",
    options: [
      { value: "tabelado", label: "Tabelado" },
      { value: "cotacao_especial", label: "Cotação especial" },
    ],
  },
  status_cotacao: {
    key: "status_cotacao",
    label: "Status da cotação",
    type: "select",
    options: [
      { value: "nao_necessaria", label: "Não necessária" },
      { value: "pendente", label: "Pendente" },
      { value: "em_andamento", label: "Em andamento" },
      { value: "concluida", label: "Concluída" },
    ],
    mostrar_quando: { campo: "tipo_precificacao", operador: "igual", valor: "cotacao_especial" },
  },
  valor_frete: {
    key: "valor_frete",
    label: "Valor do frete",
    type: "currency",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "transportadora" },
  },
  forma_pagamento: {
    key: "forma_pagamento",
    label: "Forma de pagamento",
    type: "select",
    options: [
      { value: "pix", label: "Pix" },
      { value: "cartao", label: "Cartão" },
      { value: "transferencia", label: "Transferência" },
      { value: "outro", label: "Outro" },
    ],
  },
  status_pagamento: {
    key: "status_pagamento",
    label: "Status do pagamento",
    type: "select",
    options: [
      { value: "pendente", label: "Pendente" },
      { value: "em_conferencia", label: "Em conferência" },
      { value: "confirmado", label: "Confirmado" },
      { value: "nao_aprovado", label: "Não aprovado" },
    ],
  },
  referencia_venda: {
    key: "referencia_venda",
    label: "Referência da venda / ID da oportunidade",
    type: "text",
  },
  modalidade_entrega: {
    key: "modalidade_entrega",
    label: "Modalidade de entrega",
    type: "select",
    options: [
      { value: "transportadora", label: "Entrega" },
      { value: "instalacao_loja", label: "Instalação na loja" },
    ],
  },
  produtos_servicos_pedido: {
    key: "produtos_servicos_pedido",
    label: "Produtos / serviços do pedido",
    type: "textarea",
  },
  status_nota_fiscal: {
    key: "status_nota_fiscal",
    label: "Status da nota fiscal",
    type: "select",
    options: [
      { value: "pendente_emissao", label: "Pendente de emissão" },
      { value: "emitida", label: "Emitida" },
      { value: "enviada_ao_cliente", label: "Enviada ao cliente" },
      { value: "nao_se_aplica", label: "Não se aplica" },
    ],
  },
  numero_nota_fiscal: {
    key: "numero_nota_fiscal",
    label: "Número da nota fiscal",
    type: "text",
    mostrar_quando: { campo: "status_nota_fiscal", operador: "igual", valor: "emitida" },
  },
  observacoes_operacionais: {
    key: "observacoes_operacionais",
    label: "Observações operacionais",
    type: "textarea",
  },
  data_conclusao: {
    key: "data_conclusao",
    label: "Data de conclusão",
    type: "date",
  },
  cep_entrega: {
    key: "cep_entrega",
    label: "CEP de entrega",
    type: "text",
    padrao: "^\\d{5}-?\\d{3}$",
    mensagem_padrao: "Digite o CEP com 8 dígitos, ex: 03525-150",
    mostrar_quando: { campo: "modalidade_entrega", operador: "igual", valor: "transportadora" },
  },
  endereco_entrega: {
    key: "endereco_entrega",
    label: "Endereço de entrega",
    type: "textarea",
    mostrar_quando: { campo: "modalidade_entrega", operador: "igual", valor: "transportadora" },
  },
  transportadora: {
    key: "transportadora",
    label: "Transportadora",
    type: "text",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "transportadora" },
  },
  data_coleta_despacho: {
    key: "data_coleta_despacho",
    label: "Data de coleta / despacho",
    type: "date",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "transportadora" },
  },
  horario_coleta_despacho: {
    key: "horario_coleta_despacho",
    label: "Horário da coleta / despacho",
    type: "time",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "transportadora" },
  },
  previsao_entrega: {
    key: "previsao_entrega",
    label: "Previsão/data de entrega",
    type: "date",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "transportadora" },
  },
  codigo_rastreamento: {
    key: "codigo_rastreamento",
    label: "Código/link de rastreamento",
    type: "text",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "transportadora" },
  },
  data_instalacao: {
    key: "data_instalacao",
    label: "Data da instalação",
    type: "date",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "instalacao_loja" },
  },
  horario_instalacao: {
    key: "horario_instalacao",
    label: "Horário da instalação",
    type: "time",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "instalacao_loja" },
  },
  local_responsavel_instalacao: {
    key: "local_responsavel_instalacao",
    label: "Local e responsável pela instalação",
    type: "text",
    mostrar_quando: { campo: "modalidade_pretendida", operador: "igual", valor: "instalacao_loja" },
  },
  confirmacao_entrega_instalacao: {
    key: "confirmacao_entrega_instalacao",
    label: "Confirmação de entrega/instalação",
    type: "select",
    options: [
      { value: "pendente", label: "Pendente" },
      { value: "confirmado_pelo_cliente", label: "Confirmado pelo cliente" },
      { value: "comprovante_anexado", label: "Comprovante anexado" },
      { value: "instalacao_concluida_na_loja", label: "Instalação concluída na loja" },
    ],
  },
};

export function valorEstaPreenchido(valor: unknown): boolean {
  if (valor === undefined || valor === null) return false;
  if (typeof valor === "string") return valor.trim().length > 0;
  if (Array.isArray(valor)) return valor.length > 0;
  if (typeof valor === "number") return Number.isFinite(valor);
  return true;
}

function formatarRotuloDeChave(chave: string): string {
  const texto = chave.replace(/_/g, " ").trim();
  if (!texto) return chave;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function inferirTipoDoValor(valor: unknown): CustomFieldType {
  if (typeof valor === "boolean") return "boolean";
  if (typeof valor === "number") return "number";
  if (Array.isArray(valor)) {
    return "searchable_select";
  }
  if (typeof valor === "string" && valor.length > 100) return "textarea";
  return "text";
}

/**
 * Ordem canônica completa dos campos do ciclo de vida Robusty.
 * Garante que em qualquer dos dois funis (Leads ou Pedidos) a equipe veja
 * exatamente os mesmos campos na mesma ordem estruturada.
 */
export const ORDEM_CAMPOS_CICLO_ROBUSTY: string[] = [
  // ─── 1. DOSSIÊ COMERCIAL / QUALIFICAÇÃO (ORDEM EXATA DO FUNIL DE LEADS) ───
  "veiculo",
  "ano_versao",
  "produto",
  "modelo_bagageiro",
  "tipo_de_acessorio",
  "acessorios_adicionais",
  "tipo_precificacao",
  "status_cotacao",
  "modalidade_pretendida",
  "cep",
  "endereco",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "estado",
  "valor_frete",
  "forma_pagamento",
  "status_pagamento",

  // ─── 2. DOSSIÊ OPERACIONAL / PEDIDOS (NO FINAL, COM REGRAS REATIVAS) ──────
  "transportadora",
  "codigo_rastreamento",
  "data_coleta_despacho",
  "horario_coleta_despacho",
  "previsao_entrega",
  "data_instalacao",
  "horario_instalacao",
  "local_responsavel_instalacao",
  "status_nota_fiscal",
  "numero_nota_fiscal",
  "confirmacao_entrega_instalacao",
  "data_conclusao",
];

/**
 * Mescla as definições de campos do funil atual com quaisquer campos já
 * preenchidos no registro (vindos de outras etapas ou de outro funil, como na
 * conversão Lead → Pedido).
 *
 * Regras:
 * 1. O dossiê do lead é ÚNICO entre comercial (Leads) e operacional (Pedidos):
 *    No funil de Pedidos, a esteira comercial de qualificação é exibida com a
 *    mesma ordem e regras do funil de Leads, e os campos exclusivos de Pedidos
 *    aparecem ordenadamente ao final.
 * 2. As regras de visibilidade dinâmica (`mostrar_quando`) são preservadas
 *    intactas para que a alternância entre "Instalação na loja" e "Entrega"
 *    oculte e exiba os campos dependentes reativamente na tela.
 * 3. Chaves sinônimas e de controle interno (`cep_entrega`, `modalidade_entrega`, etc.)
 *    são filtradas para evitar campos duplicados na interface.
 */
export function mesclarCamposDoPerfil(
  definicoesDoFunil: readonly CustomFieldDef[],
  valoresAtuais: Record<string, unknown> | null | undefined,
): CustomFieldDef[] {
  const valores = { ...(valoresAtuais ?? {}) };

  // Harmonização de chaves sinônimas na leitura
  if (valorEstaPreenchido(valores.modalidade_entrega) && !valorEstaPreenchido(valores.modalidade_pretendida)) {
    valores.modalidade_pretendida = valores.modalidade_entrega;
  } else if (valorEstaPreenchido(valores.modalidade_pretendida) && !valorEstaPreenchido(valores.modalidade_entrega)) {
    valores.modalidade_entrega = valores.modalidade_pretendida;
  }
  if (valorEstaPreenchido(valores.cep_entrega) && !valorEstaPreenchido(valores.cep)) {
    valores.cep = valores.cep_entrega;
  } else if (valorEstaPreenchido(valores.cep) && !valorEstaPreenchido(valores.cep_entrega)) {
    valores.cep_entrega = valores.cep;
  }

  const mapaDefinicoesDoFunil = new Map<string, CustomFieldDef>();
  for (const def of definicoesDoFunil) {
    if (!CHAVES_INTERNAS_DO_SISTEMA.has(def.key)) {
      mapaDefinicoesDoFunil.set(def.key, def);
    }
  }

  const ehNegocioRobusty =
    mapaDefinicoesDoFunil.has("veiculo") ||
    mapaDefinicoesDoFunil.has("transportadora") ||
    mapaDefinicoesDoFunil.has("data_conclusao") ||
    definicoesDoFunil.some(
      (d) =>
        d.key === "modalidade_entrega" ||
        d.key === "produtos_servicos_pedido" ||
        d.key === "referencia_venda",
    ) ||
    valorEstaPreenchido(valores.veiculo) ||
    valorEstaPreenchido(valores.lead_origem_id) ||
    valorEstaPreenchido(valores.pedido_gerado_id) ||
    valorEstaPreenchido(valores.referencia_venda);

  if (ehNegocioRobusty) {
    const resultado: CustomFieldDef[] = [];
    const chavesAdicionadas = new Set<string>();

    // 1. Injeta os campos canônicos na ordem exata da esteira Robusty
    for (const chave of ORDEM_CAMPOS_CICLO_ROBUSTY) {
      if (CHAVES_INTERNAS_DO_SISTEMA.has(chave)) continue;
      const defDoFunil = mapaDefinicoesDoFunil.get(chave);
      const defConhecida = CAMPOS_CONHECIDOS_DO_PERFIL[chave];

      // A definição canônica é a base de integridade (rótulo, tipo e mostrar_quando),
      // herdando obrigatoriedade da etapa se o funil a tiver configurado
      const defFinal: CustomFieldDef | undefined = defConhecida
        ? {
            ...defConhecida,
            ...(defDoFunil?.required !== undefined ? { required: defDoFunil.required } : {}),
          }
        : defDoFunil;

      if (defFinal) {
        resultado.push(defFinal);
        chavesAdicionadas.add(chave);
      }
    }

    // 2. Inclui campos adicionais configurados no funil que não pertençam ao ciclo padrão
    for (const [chave, def] of mapaDefinicoesDoFunil.entries()) {
      if (!chavesAdicionadas.has(chave) && !CHAVES_INTERNAS_DO_SISTEMA.has(chave)) {
        resultado.push(def);
        chavesAdicionadas.add(chave);
      }
    }

    // 3. Inclui quaisquer outros campos preenchidos que não estavam nas definições
    for (const chave of Object.keys(valores)) {
      if (chavesAdicionadas.has(chave) || CHAVES_INTERNAS_DO_SISTEMA.has(chave)) continue;
      const valor = valores[chave];
      if (!valorEstaPreenchido(valor)) continue;

      const conhecido = CAMPOS_CONHECIDOS_DO_PERFIL[chave];
      if (conhecido) {
        resultado.push(conhecido);
      } else {
        const tipo = inferirTipoDoValor(valor);
        resultado.push({
          key: chave,
          label: formatarRotuloDeChave(chave),
          type: tipo,
          ...(tipo === "searchable_select" ? { multiple: true, allow_new: true, options: [] } : {}),
        });
      }
      chavesAdicionadas.add(chave);
    }

    return resultado;
  }

  // Se não for negócio Robusty, fluxo genérico mantendo todas as definições do funil
  const resultadoGenerico: CustomFieldDef[] = [];
  const chavesAdicionadas = new Set<string>();

  for (const def of definicoesDoFunil) {
    if (!CHAVES_INTERNAS_DO_SISTEMA.has(def.key)) {
      resultadoGenerico.push(def);
      chavesAdicionadas.add(def.key);
    }
  }

  for (const chave of Object.keys(valores)) {
    if (chavesAdicionadas.has(chave) || CHAVES_INTERNAS_DO_SISTEMA.has(chave)) continue;
    const valor = valores[chave];
    if (!valorEstaPreenchido(valor)) continue;

    const conhecido = CAMPOS_CONHECIDOS_DO_PERFIL[chave];
    if (conhecido) {
      resultadoGenerico.push(conhecido);
    } else {
      const tipo = inferirTipoDoValor(valor);
      resultadoGenerico.push({
        key: chave,
        label: formatarRotuloDeChave(chave),
        type: tipo,
      });
    }
    chavesAdicionadas.add(chave);
  }

  return resultadoGenerico;
}
