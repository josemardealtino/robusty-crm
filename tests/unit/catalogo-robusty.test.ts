import { describe, expect, it } from "vitest";
import {
  obterModelosPorVeiculo,
  obterAcessoriosPorVeiculo,
  calcularOrcamentoProjeto,
  CATALOGO_VEICULOS,
} from "@/lib/robusty/catalogo";

describe("Catálogo Oficial Robusty — Filtragem em Cascata e Cálculo de Preços", () => {
  it("Retorna apenas os modelos compatíveis com Kombi", () => {
    const modelosKombi = obterModelosPorVeiculo("kombi");
    const values = modelosKombi.map((m) => m.value);

    expect(values).toContain("mx_100");
    expect(values).toContain("mx_100_plus");
    expect(values).toContain("mx_200_plus");
    expect(values).toContain("mx_80_plus");
    expect(values).toContain("mx_50_plus");

    // Não deve conter modelos de outros veículos
    expect(values).not.toContain("kx_100");
    expect(values).not.toContain("fx_100");
    expect(values).not.toContain("saveiro_cs");
  });

  it("Retorna apenas acessórios compatíveis com Kombi com rótulos limpos", () => {
    const acessoriosKombi = obterAcessoriosPorVeiculo("kombi", "mx_100");
    const values = acessoriosKombi.map((a) => a.value);

    expect(values).toContain("escada");
    expect(values).toContain("deck_completo");
    expect(values).toContain("suporte_estepe");

    // Não deve conter acessórios exclusivos de outros veículos
    expect(values).not.toContain("guia_rolete");
    expect(values).not.toContain("suporte_escada_rolete");
  });

  it("Filtra decks de madeira da Kombi estritamente de acordo com o modelo do bagageiro", () => {
    // Quando seleciona MX 100: deve mostrar deck_completo e meio_deck, mas NÃO deck_mx80 nem deck_mx50
    const acessoriosMx100 = obterAcessoriosPorVeiculo("kombi", "mx_100").map((a) => a.value);
    expect(acessoriosMx100).toContain("deck_completo");
    expect(acessoriosMx100).toContain("meio_deck");
    expect(acessoriosMx100).not.toContain("deck_mx80");
    expect(acessoriosMx100).not.toContain("deck_mx50");
    expect(acessoriosMx100).toContain("escada"); // universal

    // Quando seleciona MX 80 Plus: deve mostrar deck_mx80, mas NÃO deck_completo nem deck_mx50
    const acessoriosMx80 = obterAcessoriosPorVeiculo("kombi", "mx_80_plus").map((a) => a.value);
    expect(acessoriosMx80).toContain("deck_mx80");
    expect(acessoriosMx80).not.toContain("deck_completo");
    expect(acessoriosMx80).not.toContain("meio_deck");
    expect(acessoriosMx80).not.toContain("deck_mx50");

    // Quando seleciona MX 50 Plus: deve mostrar deck_mx50
    const acessoriosMx50 = obterAcessoriosPorVeiculo("kombi", "mx_50_plus").map((a) => a.value);
    expect(acessoriosMx50).toContain("deck_mx50");
    expect(acessoriosMx50).not.toContain("deck_completo");
    expect(acessoriosMx50).not.toContain("deck_mx80");

    // Sem modelo selecionado: não polui a lista com decks específicos
    const acessoriosSemModelo = obterAcessoriosPorVeiculo("kombi", null).map((a) => a.value);
    expect(acessoriosSemModelo).not.toContain("deck_completo");
    expect(acessoriosSemModelo).not.toContain("deck_mx80");
    expect(acessoriosSemModelo).toContain("escada");
  });

  it("Retorna modelos e acessórios exclusivos da Saveiro", () => {
    const modelosSaveiro = obterModelosPorVeiculo("saveiro_cs");
    expect(modelosSaveiro.map((m) => m.value)).toEqual(["saveiro_cs"]);

    const acessoriosSaveiro = obterAcessoriosPorVeiculo("saveiro_cs");
    expect(acessoriosSaveiro.map((a) => a.value)).toContain("guia_rolete");
  });

  it("Calcula corretamente o orçamento para Kombi + MX 100 Plus + Escada + Instalação", () => {
    const customFields = {
      veiculo: "kombi",
      modelo_bagageiro: "mx_100_plus", // R$ 2.600,00 -> 260000 cents
      acessorios_adicionais: ["escada"], // R$ 620,00 -> 62000 cents
      modalidade_pretendida: "instalacao_loja", // R$ 200,00 -> 20000 cents
    };

    const orcamento = calcularOrcamentoProjeto(customFields);

    expect(orcamento.veiculo?.key).toBe("kombi");
    expect(orcamento.bagageiro?.price_cents).toBe(260000);
    expect(orcamento.acessorios).toHaveLength(1);
    expect(orcamento.acessorios[0]?.price_cents).toBe(62000);
    expect(orcamento.instalacao?.price_cents).toBe(20000);
    expect(orcamento.total_produtos_cents).toBe(322000); // 2600 + 620 = 3220
    expect(orcamento.total_geral_cents).toBe(342000); // 3220 + 200 = 3420 (R$ 3.420,00)
  });

  it("Calcula frete corretamente na modalidade transportadora", () => {
    const customFields = {
      veiculo: "fiorino",
      modelo_bagageiro: "fx_100", // R$ 2.200,00
      modalidade_pretendida: "transportadora",
      valor_frete: 18000, // R$ 180,00 em centavos
    };

    const orcamento = calcularOrcamentoProjeto(customFields);

    expect(orcamento.bagageiro?.price_cents).toBe(220000);
    expect(orcamento.frete_cents).toBe(18000);
    expect(orcamento.instalacao).toBeNull();
    expect(orcamento.total_geral_cents).toBe(238000); // R$ 2.380,00
  });
});
