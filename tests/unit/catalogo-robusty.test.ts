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
    const acessoriosKombi = obterAcessoriosPorVeiculo("kombi");
    const values = acessoriosKombi.map((a) => a.value);

    expect(values).toContain("escada");
    expect(values).toContain("deck_completo");
    expect(values).toContain("suporte_estepe");

    // Não deve conter acessórios exclusivos de outros veículos
    expect(values).not.toContain("guia_rolete");
    expect(values).not.toContain("suporte_escada_rolete");
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
