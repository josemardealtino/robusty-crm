import { beforeEach, describe, expect, it, vi } from "vitest";

const cena = vi.hoisted(() => ({
  usuario: null as { id: string } | null,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: cena.usuario } }) },
  }),
}));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: async () => "pt-BR" }));
vi.mock("@/lib/branding/saida", () => ({ marcaDaSaida: async () => ({ nome: "Marca da Revenda" }) }));

import HomePage from "./page";

beforeEach(() => {
  cena.usuario = null;
});

describe("/ — a página inicial", () => {
  it("sem sessão: redireciona para /login", async () => {
    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("com sessão: segue direto para o painel /app", async () => {
    cena.usuario = { id: "11111111-1111-4111-8111-111111111111" };
    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/app");
  });
});
