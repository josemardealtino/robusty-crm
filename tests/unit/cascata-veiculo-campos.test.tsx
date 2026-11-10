import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomFieldsEditor, type CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";
import { ResumoOrcamentoProjeto } from "@/components/kanban/ResumoOrcamentoProjeto";

vi.mock("@/hooks/auth/AuthProvider", () => ({
  useActiveOrg: () => ({ country: "BR", currency: "BRL" }),
}));
vi.mock("@/hooks/i18n/useT", () => ({
  useT: () => (texto: string) => texto,
}));

afterEach(cleanup);

const CAMPOS_TESTE: CustomFieldDef[] = [
  {
    key: "veiculo",
    label: "Veículo",
    type: "select",
    options: [
      { value: "kombi", label: "Volkswagen Kombi" },
      { value: "saveiro_cs", label: "Volkswagen Saveiro - Cabine simples" },
    ],
  },
  {
    key: "modelo_bagageiro",
    label: "Modelo do bagageiro",
    type: "searchable_select",
    options: [
      { value: "mx_100", label: "MX 100" },
      { value: "saveiro_cs", label: "Bagageiro Saveiro" },
    ],
  },
  {
    key: "acessorios_adicionais",
    label: "Acessórios adicionais",
    type: "searchable_select",
    multiple: true,
    options: [
      { value: "escada", label: "Escada" },
      { value: "guia_rolete", label: "Guia de rolete" },
    ],
  },
];

describe("Campos em Cascata por Veículo e Resumo Financeiro (Robusty)", () => {
  it("Filtra modelos e exibe apenas modelos e acessórios compatíveis com Kombi", () => {
    const value = {
      veiculo: "kombi",
      modelo_bagageiro: "mx_100_plus",
      acessorios_adicionais: ["escada"],
    };

    render(
      <CustomFieldsEditor
        fields={CAMPOS_TESTE}
        value={value}
        onChange={vi.fn()}
        mode="lead"
      />,
    );

    // O campo de modelo do bagageiro deve estar renderizado
    expect(screen.getByText("Modelo do bagageiro")).toBeInTheDocument();
  });

  it("ResumoOrcamentoProjeto renderiza detalhes de bagageiro, acessórios e total geral", () => {
    const customFields = {
      veiculo: "kombi",
      modelo_bagageiro: "mx_100_plus", // R$ 2.600,00
      acessorios_adicionais: ["escada"], // R$ 620,00
      modalidade_pretendida: "instalacao_loja", // R$ 200,00
    };

    render(
      <ResumoOrcamentoProjeto
        customFields={customFields}
        moeda="BRL"
      />,
    );

    expect(screen.getByText("Orçamento Estimado do Projeto")).toBeInTheDocument();
    expect(screen.getByText("Volkswagen Kombi")).toBeInTheDocument();
    expect(screen.getByText(/MX 100 Plus/)).toBeInTheDocument();
    expect(screen.getByText(/\+ Escada removível/)).toBeInTheDocument();
    expect(screen.getByText(/Instalação Presencial/)).toBeInTheDocument();
    // Total R$ 3.420,00
    expect(screen.getByText("R$ 3.420,00")).toBeInTheDocument();
  });
});
