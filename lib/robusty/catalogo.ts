/**
 * Catálogo Oficial de Produtos, Veículos, Acessórios e Preços — Robusty
 * Baseado no Catálogo FEV/2026.
 *
 * COMO EDITAR OU ATUALIZAR PREÇOS:
 * - Cada produto tem seu preço declarado em centavos (`price_cents`) e em reais (`price_reais`).
 * - Exemplo: R$ 2.600,00 -> price_cents: 260000.
 * - Para alterar um preço, adicione ou modifique o valor diretamente na tabela do veículo ou acessório correspondente abaixo.
 * - Para adicionar um novo acessório ou modelo a um veículo, basta incluir o item no array do veículo desejado.
 */

export interface OpcaoCatalogo {
  value: string;
  label: string;
  price_cents: number;
  medidas?: string;
  descricao?: string;
}

export interface VeiculoConfig {
  value: string;
  label: string;
  modelos: OpcaoCatalogo[];
  acessorios: OpcaoCatalogo[];
  custo_instalacao_padrao_cents: number;
}

// -----------------------------------------------------------------------------
// SERVIÇOS E INSTALAÇÃO GERAL (Valores em centavos)
// -----------------------------------------------------------------------------
export const SERVICOS_ROBUSTY = {
  instalacao_simples_cents: 20000, // R$ 200,00 (Fiorino, Doblò e padrão de oficina)
  instalacao_rebite_cents: 34000, // R$ 340,00 (Com forração)
  instalacao_toldo_leroy_cents: 17000, // R$ 170,00
  corte_climatizador_cents: 14000, // R$ 140,00
  zincagem_cents: 39000, // R$ 390,00 (até 30kg)
};

// -----------------------------------------------------------------------------
// CATÁLOGO DE VEÍCULOS, BAGAGEIROS E ACESSÓRIOS
// -----------------------------------------------------------------------------
export const CATALOGO_VEICULOS: Record<string, VeiculoConfig> = {
  kombi: {
    value: "kombi",
    label: "Volkswagen Kombi",
    custo_instalacao_padrao_cents: 20000,
    modelos: [
      {
        value: "mx_100",
        label: "MX 100 (Sem aba)",
        price_cents: 222000, // R$ 2.220,00
        medidas: "3,30m X 1,28m x 0,30m",
      },
      {
        value: "mx_100_plus",
        label: "MX 100 Plus (Aba dupla)",
        price_cents: 260000, // R$ 2.600,00
        medidas: "3,30m X 1,28m x 0,38m",
      },
      {
        value: "mx_200_plus",
        label: "MX 200 Plus (Aba lateral)",
        price_cents: 260000, // R$ 2.600,00
        medidas: "3,30m X 1,28m x 0,38m",
      },
      {
        value: "mx_80_plus",
        label: "MX 80 Plus (2,20m)",
        price_cents: 230000, // R$ 2.300,00
        medidas: "2,20m X 1,28m x 0,38m",
      },
      {
        value: "mx_50_plus",
        label: "MX 50 Plus s/ madeira (1,00m)",
        price_cents: 172000, // R$ 1.720,00
        medidas: "1,00m x 1,30m x 0,40m",
      },
    ],
    acessorios: [
      { value: "escada", label: "Escada removível", price_cents: 62000 },
      { value: "deck_completo", label: "Deck completo (para MX 100 / 200)", price_cents: 196000 },
      { value: "meio_deck", label: "Meio deck (para MX 100 / 200)", price_cents: 108000 },
      { value: "deck_mx80", label: "Deck para MX 80 Plus", price_cents: 157000 },
      { value: "deck_mx50", label: "Deck para MX 50 Plus", price_cents: 73000 },
      { value: "deck_escada", label: "Deck nos degraus da escada", price_cents: 20000 },
      { value: "suporte_estepe", label: "Suporte para estepe", price_cents: 38000 },
      { value: "base_toldo", label: "Base para toldo", price_cents: 33000 },
      { value: "base_toldo_leroy", label: "Base para toldo (Leroy)", price_cents: 37000 },
      { value: "barra_placa_solar", label: "Barra para placa solar (Par)", price_cents: 34000 },
      { value: "par_ventosas", label: "Par de ventosas", price_cents: 9000 },
      { value: "haste_fixacao", label: "Haste de fixação unitária", price_cents: 4500 },
      { value: "kit_hastes", label: "Kit com 8 pares de hastes de fixação", price_cents: 34000 },
      { value: "kit_fixacao_escada", label: "Kit de fixação para escada", price_cents: 10000 },
    ],
  },

  kangoo: {
    value: "kangoo",
    label: "Renault Kangoo",
    custo_instalacao_padrao_cents: 20000,
    modelos: [
      {
        value: "kx_100",
        label: "KX 100 (Aba dupla)",
        price_cents: 210000, // R$ 2.100,00
        medidas: "1,95m X 1,12m x 0,10m",
      },
      {
        value: "kx_200",
        label: "KX 200 (Aba lateral)",
        price_cents: 210000, // R$ 2.100,00
        medidas: "1,95m X 1,12m x 0,10m",
      },
    ],
    acessorios: [
      { value: "base_toldo", label: "Base para toldo", price_cents: 33000 },
      { value: "suporte_estepe", label: "Suporte para estepe", price_cents: 38000 },
    ],
  },

  kangoo_nova: {
    value: "kangoo_nova",
    label: "Renault Kangoo Nova",
    custo_instalacao_padrao_cents: 20000,
    modelos: [
      {
        value: "kx_200_nova",
        label: "KX 200 Nova (Aba lateral)",
        price_cents: 230000, // R$ 2.300,00
        medidas: "2,00m x 1,17m x 0,10m",
      },
    ],
    acessorios: [
      { value: "base_toldo", label: "Base para toldo", price_cents: 33000 },
    ],
  },

  fiorino: {
    value: "fiorino",
    label: "Fiat Fiorino",
    custo_instalacao_padrao_cents: 20000, // R$ 200,00 especificado no catálogo
    modelos: [
      {
        value: "fx_100",
        label: "FX 100 (Aba dupla)",
        price_cents: 220000, // R$ 2.200,00
        medidas: "1,80m X 1,25m x 0,10m",
      },
      {
        value: "fx_200",
        label: "FX 200 (Aba lateral - compatível c/ rolete)",
        price_cents: 220000, // R$ 2.200,00
        medidas: "1,80m X 1,25m x 0,10m",
      },
    ],
    acessorios: [
      { value: "base_toldo", label: "Base para toldo", price_cents: 33000 },
      { value: "suporte_estepe", label: "Suporte para estepe", price_cents: 38000 },
    ],
  },

  doblo_cargo: {
    value: "doblo_cargo",
    label: "Fiat Doblò Cargo",
    custo_instalacao_padrao_cents: 20000, // R$ 200,00 especificado no catálogo
    modelos: [
      {
        value: "dx_100",
        label: "DX 100",
        price_cents: 230000, // R$ 2.300,00
        medidas: "2,00m x 1,32m x 0,10m",
      },
      {
        value: "dx_200",
        label: "DX 200",
        price_cents: 230000, // R$ 2.300,00
        medidas: "2,00m x 1,32m x 0,10m",
      },
    ],
    acessorios: [
      { value: "base_toldo", label: "Base para toldo", price_cents: 33000 },
      { value: "suporte_estepe", label: "Suporte para estepe", price_cents: 38000 },
    ],
  },

  jumpy: {
    value: "jumpy",
    label: "Citroën Jumpy",
    custo_instalacao_padrao_cents: 20000,
    modelos: [
      {
        value: "mx_120",
        label: "MX 120 (2,65m)",
        price_cents: 268000, // R$ 2.680,00
        medidas: "2,65m X 1,30m x 0,16m",
      },
      {
        value: "aba_dupla",
        label: "Aba Dupla (2,65m)",
        price_cents: 297000, // R$ 2.970,00
        medidas: "2,65m X 1,30m x 0,16m",
      },
      {
        value: "extreme",
        label: "Extreme (3,30m)",
        price_cents: 347000, // R$ 3.470,00
        medidas: "3,30m X 1,30m x 0,16m",
      },
    ],
    acessorios: [
      { value: "escada", label: "Escada", price_cents: 73000 },
      { value: "deck_completo", label: "Deck de madeira", price_cents: 196000 },
      { value: "deck_escada", label: "Deck nos degraus da escada", price_cents: 34000 },
      { value: "suporte_escada_rolete", label: "Suporte para escada c/ guia de rolete", price_cents: 37000 },
      { value: "base_toldo", label: "Base para toldo", price_cents: 33000 },
    ],
  },

  expert: {
    value: "expert",
    label: "Peugeot Expert",
    custo_instalacao_padrao_cents: 20000,
    modelos: [
      {
        value: "mx_120",
        label: "MX 120 (2,65m)",
        price_cents: 268000,
        medidas: "2,65m X 1,30m x 0,16m",
      },
      {
        value: "aba_dupla",
        label: "Aba Dupla (2,65m)",
        price_cents: 297000,
        medidas: "2,65m X 1,30m x 0,16m",
      },
      {
        value: "extreme",
        label: "Extreme (3,30m)",
        price_cents: 347000,
        medidas: "3,30m X 1,30m x 0,16m",
      },
    ],
    acessorios: [
      { value: "escada", label: "Escada", price_cents: 73000 },
      { value: "deck_completo", label: "Deck de madeira", price_cents: 196000 },
      { value: "deck_escada", label: "Deck nos degraus da escada", price_cents: 34000 },
      { value: "suporte_escada_rolete", label: "Suporte para escada c/ guia de rolete", price_cents: 37000 },
      { value: "base_toldo", label: "Base para toldo", price_cents: 33000 },
    ],
  },

  scudo: {
    value: "scudo",
    label: "Fiat Scudo",
    custo_instalacao_padrao_cents: 20000,
    modelos: [
      {
        value: "mx_120",
        label: "MX 120 (2,65m)",
        price_cents: 268000,
        medidas: "2,65m X 1,30m x 0,16m",
      },
      {
        value: "aba_dupla",
        label: "Aba Dupla (2,65m)",
        price_cents: 297000,
        medidas: "2,65m X 1,30m x 0,16m",
      },
      {
        value: "extreme",
        label: "Extreme (3,30m)",
        price_cents: 347000,
        medidas: "3,30m X 1,30m x 0,16m",
      },
    ],
    acessorios: [
      { value: "escada", label: "Escada", price_cents: 73000 },
      { value: "deck_completo", label: "Deck de madeira", price_cents: 196000 },
      { value: "deck_escada", label: "Deck nos degraus da escada", price_cents: 34000 },
      { value: "suporte_escada_rolete", label: "Suporte para escada c/ guia de rolete", price_cents: 37000 },
      { value: "base_toldo", label: "Base para toldo", price_cents: 33000 },
    ],
  },

  ducato_max_cargo: {
    value: "ducato_max_cargo",
    label: "Fiat Ducato Max Cargo",
    custo_instalacao_padrao_cents: 20000,
    modelos: [
      {
        value: "ducato_aba_lateral",
        label: "Ducato Aba Lateral (3,65m x 1,70m)",
        price_cents: 482000, // R$ 4.820,00
        medidas: "3,65m x 1,70m x 0,10m",
      },
    ],
    acessorios: [
      { value: "base_toldo", label: "Base para toldo", price_cents: 33000 },
    ],
  },

  saveiro_cs: {
    value: "saveiro_cs",
    label: "Volkswagen Saveiro - Cabine simples",
    custo_instalacao_padrao_cents: 20000,
    modelos: [
      {
        value: "saveiro_cs",
        label: "Bagageiro Saveiro Cabine Simples",
        price_cents: 390000, // R$ 3.900,00
      },
    ],
    acessorios: [
      { value: "guia_rolete", label: "Guia de rolete", price_cents: 78000 }, // R$ 780,00
      { value: "base_toldo", label: "Base para toldo", price_cents: 33000 },
    ],
  },

  saveiro_cd: {
    value: "saveiro_cd",
    label: "Volkswagen Saveiro - Cabine dupla",
    custo_instalacao_padrao_cents: 20000,
    modelos: [
      {
        value: "saveiro_cd",
        label: "Bagageiro Saveiro Cabine Dupla",
        price_cents: 350000, // R$ 3.500,00
      },
    ],
    acessorios: [
      { value: "guia_rolete", label: "Guia de rolete", price_cents: 78000 },
      { value: "base_toldo", label: "Base para toldo", price_cents: 33000 },
    ],
  },

  outro_nao_identificado: {
    value: "outro_nao_identificado",
    label: "Outro / Não identificado",
    custo_instalacao_padrao_cents: 20000,
    modelos: [
      { value: "outro_a_definir", label: "Modelo a definir", price_cents: 0 },
    ],
    acessorios: [
      { value: "outro", label: "Outro acessório", price_cents: 0 },
    ],
  },
};

// -----------------------------------------------------------------------------
// FUNÇÕES DE BUSCA E FILTRAGEM DINÂMICA
// -----------------------------------------------------------------------------

/**
 * Retorna a lista de modelos de bagageiro permitidos para o veículo especificado.
 * Se o veículo não for informado ou for inválido, retorna todos os modelos disponíveis.
 */
export function obterModelosPorVeiculo(veiculoKey?: string | null): OpcaoCatalogo[] {
  if (!veiculoKey || !(veiculoKey in CATALOGO_VEICULOS)) {
    // Retorna todos os modelos sem duplicidade
    const todos: OpcaoCatalogo[] = [];
    const seen = new Set<string>();
    for (const v of Object.values(CATALOGO_VEICULOS)) {
      for (const m of v.modelos) {
        if (!seen.has(m.value)) {
          seen.add(m.value);
          todos.push(m);
        }
      }
    }
    return todos;
  }

  return CATALOGO_VEICULOS[veiculoKey]!.modelos;
}

/**
 * Retorna a lista de acessórios adicionais permitidos para o veículo especificado com rótulos limpos.
 * Se o veículo não for informado, retorna todos os acessórios possíveis.
 */
export function obterAcessoriosPorVeiculo(veiculoKey?: string | null): OpcaoCatalogo[] {
  if (!veiculoKey || !(veiculoKey in CATALOGO_VEICULOS)) {
    const todos: OpcaoCatalogo[] = [];
    const seen = new Set<string>();
    for (const v of Object.values(CATALOGO_VEICULOS)) {
      for (const a of v.acessorios) {
        if (!seen.has(a.value)) {
          seen.add(a.value);
          todos.push(a);
        }
      }
    }
    return todos;
  }

  return CATALOGO_VEICULOS[veiculoKey]!.acessorios;
}

/**
 * Estrutura detalhada do orçamento calculado do lead/pedido.
 */
export interface ResumoOrcamentoRobusty {
  veiculo: { key: string; label: string } | null;
  bagageiro: { key: string; label: string; price_cents: number } | null;
  acessorios: Array<{ key: string; label: string; price_cents: number }>;
  instalacao: { label: string; price_cents: number } | null;
  frete_cents: number;
  total_produtos_cents: number;
  total_servicos_cents: number;
  total_geral_cents: number;
}

/**
 * Calcula os totais do projeto em centavos a partir dos campos do lead/pedido.
 */
export function calcularOrcamentoProjeto(
  customFields?: Record<string, unknown> | null,
): ResumoOrcamentoRobusty {
  const cf = customFields ?? {};
  const veiculoKey = typeof cf.veiculo === "string" ? cf.veiculo : null;
  const veiculoConfig = veiculoKey && veiculoKey in CATALOGO_VEICULOS ? CATALOGO_VEICULOS[veiculoKey] : null;

  // 1. Bagageiro selecionado
  const modeloKey = typeof cf.modelo_bagageiro === "string" ? cf.modelo_bagageiro : null;
  let bagageiro: ResumoOrcamentoRobusty["bagageiro"] = null;
  if (modeloKey) {
    // Buscar no veículo selecionado ou no catálogo geral
    const modelosPossiveis = veiculoConfig ? veiculoConfig.modelos : obterModelosPorVeiculo(null);
    const encontrado = modelosPossiveis.find((m) => m.value === modeloKey);
    if (encontrado) {
      bagageiro = {
        key: encontrado.value,
        label: encontrado.label,
        price_cents: encontrado.price_cents,
      };
    }
  }

  // 2. Acessórios selecionados
  const acessoriosKeys = Array.isArray(cf.acessorios_adicionais)
    ? (cf.acessorios_adicionais as string[])
    : typeof cf.acessorios_adicionais === "string" && cf.acessorios_adicionais
      ? [cf.acessorios_adicionais]
      : [];

  const acessorios: ResumoOrcamentoRobusty["acessorios"] = [];
  const acessoriosPossiveis = veiculoConfig ? veiculoConfig.acessorios : obterAcessoriosPorVeiculo(null);

  const ALIASES_ACESSORIOS: Record<string, string> = {
    escada_kombi: "escada",
    escada_jumpy_expert_scudo: "escada",
    guia_rolete_saveiro: "guia_rolete",
  };

  for (const aKey of acessoriosKeys) {
    const keyNormalizada = ALIASES_ACESSORIOS[aKey] ?? aKey;
    const encontrado = acessoriosPossiveis.find((a) => a.value === keyNormalizada || a.value === aKey);
    if (encontrado) {
      acessorios.push({
        key: encontrado.value,
        label: encontrado.label,
        price_cents: encontrado.price_cents,
      });
    }
  }

  // 3. Modalidade (Instalação ou Transportadora)
  const modalidade = (typeof cf.modalidade_pretendida === "string"
    ? cf.modalidade_pretendida
    : typeof cf.modalidade_entrega === "string"
      ? cf.modalidade_entrega
      : "") as string;

  let instalacao: ResumoOrcamentoRobusty["instalacao"] = null;
  let frete_cents = 0;

  if (modalidade === "instalacao_loja") {
    const custoInstalacao = veiculoConfig?.custo_instalacao_padrao_cents ?? SERVICOS_ROBUSTY.instalacao_simples_cents;
    instalacao = {
      label: `Instalação Presencial (${veiculoConfig?.label ?? "Oficina SP"})`,
      price_cents: custoInstalacao,
    };
  } else if (modalidade === "transportadora") {
    if (typeof cf.valor_frete === "number") {
      frete_cents = Math.round(cf.valor_frete);
    } else if (typeof cf.valor_frete === "string" && cf.valor_frete.trim()) {
      const num = Number(cf.valor_frete.replace(",", "."));
      if (!Number.isNaN(num)) {
        frete_cents = Math.round(num * 100);
      }
    }
  }

  const total_produtos_cents =
    (bagageiro?.price_cents ?? 0) +
    acessorios.reduce((acc, curr) => acc + curr.price_cents, 0);

  const total_servicos_cents = (instalacao?.price_cents ?? 0) + frete_cents;

  const total_geral_cents = total_produtos_cents + total_servicos_cents;

  return {
    veiculo: veiculoConfig ? { key: veiculoConfig.value, label: veiculoConfig.label } : null,
    bagageiro,
    acessorios,
    instalacao,
    frete_cents,
    total_produtos_cents,
    total_servicos_cents,
    total_geral_cents,
  };
}
