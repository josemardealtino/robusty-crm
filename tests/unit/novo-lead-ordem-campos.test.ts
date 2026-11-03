import { describe, expect, it } from "vitest";
import {
  CAMPOS_PADRAO_DISPONIVEIS,
  obterListaOrdenadaDeCampos,
} from "@/app/app/settings/tenant/pipelines/_new-lead-form";
import type { CustomFieldDef } from "@/lib/schemas/settings";

describe("obterListaOrdenadaDeCampos", () => {
  const camposPersonalizadosMock: CustomFieldDef[] = [
    { key: "produto", label: "Produto de Interesse", type: "text" },
    { key: "veiculo", label: "Veículo", type: "text" },
  ];

  it("retorna lista padrão quando não há configuração salva previamente", () => {
    const lista = obterListaOrdenadaDeCampos(null, camposPersonalizadosMock);

    // Campos padrão aparecem primeiro
    expect(lista.length).toBe(CAMPOS_PADRAO_DISPONIVEIS.length + 2);
    expect(lista[0]?.key).toBe("contact");
    expect(lista[1]?.key).toBe("title");
    expect(lista[2]?.key).toBe("stage_id");

    // Campos personalizados são anexados ao final
    const custom1 = lista.find((c) => c.key === "produto");
    const custom2 = lista.find((c) => c.key === "veiculo");
    expect(custom1).toBeDefined();
    expect(custom1?.is_standard).toBe(false);
    expect(custom2).toBeDefined();
    expect(custom2?.is_standard).toBe(false);
  });

  it("respeita a ordem exata customizada pelo usuário", () => {
    // Usuário colocou 'produto' no topo, depois 'value', depois 'title'
    const salvo = [
      { key: "produto", label: "Produto de Interesse", visible: true, is_standard: false },
      { key: "value", label: "Valor da Venda", visible: true, is_standard: true },
      { key: "title", label: "Título do Negócio", visible: false, is_standard: true },
    ];

    const lista = obterListaOrdenadaDeCampos(salvo, camposPersonalizadosMock);

    expect(lista[0]?.key).toBe("produto");
    expect(lista[0]?.visible).toBe(true);

    expect(lista[1]?.key).toBe("value");
    expect(lista[1]?.visible).toBe(true);

    expect(lista[2]?.key).toBe("title");
    expect(lista[2]?.visible).toBe(false);

    // Os outros campos padrão não configurados aparecem depois sem perder integridade
    const chaves = lista.map((c) => c.key);
    expect(chaves).toContain("contact");
    expect(chaves).toContain("stage_id");
    expect(chaves).toContain("veiculo");
  });

  it("preserva visibilidade customizada e adiciona novos campos ao final", () => {
    const salvo = [
      { key: "contact", label: "Contato", visible: true, is_standard: true },
      { key: "description", label: "Descrição", visible: false, is_standard: true },
    ];

    const novosCamposPersonalizados: CustomFieldDef[] = [
      { key: "campo_novo", label: "Novo Campo", type: "text" },
    ];

    const lista = obterListaOrdenadaDeCampos(salvo, novosCamposPersonalizados);

    expect(lista[0]?.key).toBe("contact");
    expect(lista[0]?.visible).toBe(true);

    expect(lista[1]?.key).toBe("description");
    expect(lista[1]?.visible).toBe(false);

    // O novo campo está presente ao final
    const novo = lista.find((c) => c.key === "campo_novo");
    expect(novo).toBeDefined();
    expect(novo?.visible).toBe(false);
  });
});
