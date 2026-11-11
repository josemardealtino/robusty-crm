import { describe, expect, it } from "vitest";

import { mesclarCamposDoPerfil } from "@/lib/leads/campos-do-perfil";
import { gerarResumoProdutosDoPedido, montarCamposDoPedido } from "@/lib/leads/criar-pedido-do-lead";
import { calcularOrcamentoProjeto } from "@/lib/robusty/catalogo";
import { camposVisiveis } from "@/lib/schemas/mostrar-quando";

describe("Persistência de campos no perfil do lead e conversão para Pedido", () => {
  it("mantém visíveis campos já preenchidos mesmo quando possuem condição mostrar_quando inativa", () => {
    const definicoes = [
      {
        key: "modalidade_pretendida",
        label: "Modalidade pretendida",
        type: "select" as const,
      },
      {
        key: "cep",
        label: "CEP",
        type: "text" as const,
        mostrar_quando: { campo: "modalidade_pretendida", operador: "igual" as const, valor: "transportadora" },
      },
      {
        key: "valor_frete",
        label: "Valor do frete",
        type: "currency" as const,
        mostrar_quando: { campo: "modalidade_pretendida", operador: "igual" as const, valor: "transportadora" },
      },
    ];

    // CEP foi preenchido, mas modalidade mudou para "a_definir" e valor_frete continua vazio
    const valores = {
      modalidade_pretendida: "a_definir",
      cep: "03525-150",
    };

    const mesclados = mesclarCamposDoPerfil(definicoes, valores);
    const visiveis = camposVisiveis(mesclados, valores);

    expect(visiveis.map((c) => c.key)).toEqual(["modalidade_pretendida", "cep"]);
  });

  it("exibe no funil de Pedidos todos os campos comerciais herdados e preenchidos no funil de Leads", () => {
    const definicoesFunilPedidos = [
      { key: "referencia_venda", label: "Referência da venda", type: "text" as const },
      { key: "modalidade_entrega", label: "Modalidade de entrega", type: "select" as const },
    ];

    const valoresNoPedido = {
      referencia_venda: "ROB-2026-000010",
      modalidade_entrega: "transportadora",
      produto: "bagageiro",
      veiculo: "kombi",
      ano_versao: "2012 Standard",
      modelo_bagageiro: "mx_100_plus",
      acessorios_adicionais: ["escada_kombi", "deck_completo"],
      forma_pagamento: "pix",
      status_pagamento: "confirmado",
      lead_origem_id: "11111111-2222-3333-4444-555555555555",
    };

    const mesclados = mesclarCamposDoPerfil(definicoesFunilPedidos, valoresNoPedido);
    const chaves = mesclados.map((c) => c.key);

    expect(chaves).toContain("referencia_venda");
    expect(chaves).toContain("modalidade_entrega");
    expect(chaves).toContain("produto");
    expect(chaves).toContain("veiculo");
    expect(chaves).toContain("ano_versao");
    expect(chaves).toContain("modelo_bagageiro");
    expect(chaves).toContain("acessorios_adicionais");
    expect(chaves).toContain("forma_pagamento");
    expect(chaves).toContain("status_pagamento");
    // Chave interna de vínculo não vira input solto
    expect(chaves).not.toContain("lead_origem_id");
  });

  it("montarCamposDoPedido copia integralmente os dados do Lead e mapeia os campos operacionais do Pedido", () => {
    const lead = {
      id: "aaaa1111-bbbb-2222-cccc-333333333333",
      pipeline_id: "9f77c2ce-08cc-4ac7-a2f0-48f4ce9d8732",
      commercial_id: "ROB-2026-000042",
      custom_fields: {
        produto: "bagageiro",
        veiculo: "kombi",
        ano_versao: "2013 Motorhome",
        modelo_bagageiro: "mx_100_plus",
        acessorios_adicionais: ["escada_kombi", "deck_completo"],
        detalhes_da_necessidade: "Cliente precisa de corte para climatizador traseiro.",
        modalidade_pretendida: "transportadora",
        cep: "80010-000",
        tipo_precificacao: "tabelado",
        valor_frete: 280,
        forma_pagamento: "pix",
        status_pagamento: "confirmado",
      },
    };

    const camposPedido = montarCamposDoPedido(lead);

    expect(camposPedido.lead_origem_id).toBe(lead.id);
    expect(camposPedido.pipeline_origem_id).toBe(lead.pipeline_id);
    expect(camposPedido.referencia_venda).toBe("ROB-2026-000042");
    expect(camposPedido.modalidade_entrega).toBe("transportadora");
    expect(camposPedido.cep_entrega).toBe("80010-000");
    expect(camposPedido.observacoes_operacionais).toBe(
      "Cliente precisa de corte para climatizador traseiro.",
    );
    expect(camposPedido.produtos_servicos_pedido).toBe(
      "Produto: Bagageiro | Modelo: MX 100 Plus | Veículo: Volkswagen Kombi (2013 Motorhome) | Acessórios adicionais: Escada removível Kombi, Deck completo",
    );
    // Todos os campos originais permanecem preservados
    expect(camposPedido.produto).toBe("bagageiro");
    expect(camposPedido.veiculo).toBe("kombi");
    expect(camposPedido.valor_frete).toBe(280);
    expect(camposPedido.forma_pagamento).toBe("pix");
  });

  it("gerarResumoProdutosDoPedido formata corretamente itens e acessórios", () => {
    const resumo = gerarResumoProdutosDoPedido({
      produto: "bagageiro",
      modelo_bagageiro: "fx_200",
      veiculo: "fiorino",
      ano_versao: "2022 Endurance",
      acessorios_adicionais: ["suporte_escada_rolete"],
    });

    expect(resumo).toBe(
      "Produto: Bagageiro | Modelo: FX 200 | Veículo: Fiat Fiorino (2022 Endurance) | Acessórios adicionais: Suporte de escada com guia de rolete",
    );
  });

  it("monta endereco_entrega completo a partir de campos desmembrados", () => {
    const lead = {
      id: "aaaa1111-bbbb-2222-cccc-333333333333",
      pipeline_id: "9f77c2ce-08cc-4ac7-a2f0-48f4ce9d8732",
      commercial_id: "ROB-2026-000042",
      custom_fields: {
        endereco: "Rua das Flores",
        numero: "123",
        complemento: "Galpão A",
        bairro: "Centro",
        cidade: "São Paulo",
        estado: "SP",
      },
    };

    const campos = montarCamposDoPedido(lead);
    expect(campos.endereco_entrega).toBe("Rua das Flores, nº 123, Galpão A, Centro, São Paulo/SP");
  });

  it("calcula orçamento com fallback para modelos ou acessórios do catálogo geral", () => {
    const orcamento = calcularOrcamentoProjeto({
      veiculo: "saveiro",
      modelo_bagageiro: "aba_dupla",
      tipo_precificacao: "tabelado",
      acessorios_adicionais: ["par_ventosas"],
    });

    expect(orcamento.bagageiro).not.toBeNull();
    expect(orcamento.bagageiro?.key).toBe("aba_dupla");
    expect(orcamento.acessorios.length).toBeGreaterThanOrEqual(1);
    expect(orcamento.total_geral_cents).toBeGreaterThan(0);
  });
});
