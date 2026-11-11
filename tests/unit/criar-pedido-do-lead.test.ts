import { describe, expect, it } from "vitest";

import { mesclarCamposDoPerfil } from "@/lib/leads/campos-do-perfil";
import { gerarResumoProdutosDoPedido, montarCamposDoPedido } from "@/lib/leads/criar-pedido-do-lead";
import { calcularOrcamentoProjeto } from "@/lib/robusty/catalogo";
import { camposVisiveis } from "@/lib/schemas/mostrar-quando";

describe("Persistência de campos no perfil do lead e conversão para Pedido", () => {
  it("preserva mostrar_quando reativo: oculta campos de entrega quando modalidade for instalacao_loja e exibe quando transportadora", () => {
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
      {
        key: "data_instalacao",
        label: "Data da instalação",
        type: "date" as const,
        mostrar_quando: { campo: "modalidade_pretendida", operador: "igual" as const, valor: "instalacao_loja" },
      },
    ];

    // 1. Quando modalidade for instalacao_loja, CEP e valor_frete ficam ocultos e data_instalacao fica visível
    const valoresLoja = {
      modalidade_pretendida: "instalacao_loja",
      cep: "03525-150",
    };
    const mescladosLoja = mesclarCamposDoPerfil(definicoes, valoresLoja);
    const visiveisLoja = camposVisiveis(mescladosLoja, valoresLoja);
    expect(visiveisLoja.map((c) => c.key)).toEqual(["modalidade_pretendida", "data_instalacao"]);

    // 2. Quando modalidade for transportadora, CEP e valor_frete ficam visíveis e data_instalacao fica oculta
    const valoresEntrega = {
      modalidade_pretendida: "transportadora",
      cep: "03525-150",
    };
    const mescladosEntrega = mesclarCamposDoPerfil(definicoes, valoresEntrega);
    const visiveisEntrega = camposVisiveis(mescladosEntrega, valoresEntrega);
    expect(visiveisEntrega.map((c) => c.key)).toEqual([
      "modalidade_pretendida",
      "cep",
      "valor_frete",
    ]);
  });

  it("exibe no funil de Pedidos a mesma esteira comercial do funil de Leads e campos operacionais ao final sem duplicidades", () => {
    const definicoesFunilPedidos = [
      { key: "modalidade_entrega", label: "Modalidade de entrega", type: "select" as const },
      { key: "cep_entrega", label: "CEP de entrega", type: "text" as const },
      { key: "transportadora", label: "Transportadora", type: "text" as const },
      { key: "data_conclusao", label: "Data de conclusão", type: "date" as const },
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

    // Campos comerciais do funil de Leads presentes
    expect(chaves).toContain("veiculo");
    expect(chaves).toContain("ano_versao");
    expect(chaves).toContain("produto");
    expect(chaves).toContain("modelo_bagageiro");
    expect(chaves).toContain("acessorios_adicionais");
    expect(chaves).toContain("modalidade_pretendida");
    expect(chaves).toContain("cep");
    expect(chaves).toContain("forma_pagamento");
    expect(chaves).toContain("status_pagamento");

    // Campos operacionais presentes
    expect(chaves).toContain("transportadora");
    expect(chaves).toContain("data_conclusao");

    // Veículo (comercial) vem antes de transportadora e data_conclusao (operacional)
    expect(chaves.indexOf("veiculo")).toBeLessThan(chaves.indexOf("transportadora"));
    expect(chaves.indexOf("modalidade_pretendida")).toBeLessThan(chaves.indexOf("data_conclusao"));

    // Chaves sinônimas e redundantes legadas NÃO poluem o formulário
    expect(chaves).not.toContain("modalidade_entrega");
    expect(chaves).not.toContain("cep_entrega");
    expect(chaves).not.toContain("referencia_venda");
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
