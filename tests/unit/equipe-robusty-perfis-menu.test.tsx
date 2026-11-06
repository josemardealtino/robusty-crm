import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { Sidebar } from "@/components/shell/Sidebar";
import type { ActiveOrg, AuthUser } from "@/lib/auth/types";
import type { InterfaceSettings } from "@/lib/navigation/interface";

const authRef: { user: Pick<AuthUser, "is_platform_admin">; activeOrg: ActiveOrg | null } = {
  user: { is_platform_admin: false },
  activeOrg: null,
};

vi.mock("@/hooks/auth/AuthProvider", () => ({
  useAuth: () => authRef,
  usePermission: () => false,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ prefetch: vi.fn() }),
  usePathname: () => "/app/inbox",
}));
vi.mock("@/components/connections/ConnectionHealthDot", () => ({
  ConnectionHealthDot: () => null,
}));
vi.mock("@/components/shell/ContadorDeCasos", () => ({
  ContadorDeCasos: () => null,
}));
vi.mock("@/components/shell/ContadorDaFila", () => ({
  ContadorDaFila: () => null,
}));
vi.mock("@/app/actions/shell/toggleSidebar", () => ({
  toggleSidebar: vi.fn(),
}));
vi.mock("@/components/shell/VersionFooter", () => ({
  VersionFooter: () => null,
}));

export const PERFIS_ROBUSTY: Record<
  "admin_ti" | "joao_ricardo" | "norlando" | "igor",
  {
    role: ActiveOrg["role"];
    isPlatformAdmin: boolean;
    interface_settings: InterfaceSettings;
  }
> = {
  admin_ti: {
    role: "admin",
    isPlatformAdmin: true,
    interface_settings: { preset: "completa" },
  },
  joao_ricardo: {
    role: "admin",
    isPlatformAdmin: false,
    interface_settings: {
      preset: "completa",
      destinos: [
        "/app/inbox",
        "/app/radar",
        "/app/agenda",
        "/app/templates",
        "/app/kanban",
        "/app/contacts",
        "/app/tasks",
        "/app/ai/agents",
        "/app/ai/followups",
        "/app/ai/cases",
        "/app/connections",
      ],
    },
  },
  norlando: {
    role: "manager",
    isPlatformAdmin: false,
    interface_settings: {
      preset: "completa",
      destinos: [
        "/app/inbox",
        "/app/radar",
        "/app/agenda",
        "/app/templates",
        "/app/kanban",
        "/app/contacts",
        "/app/tasks",
      ],
    },
  },
  igor: {
    role: "manager",
    isPlatformAdmin: false,
    interface_settings: {
      preset: "completa",
      destinos: [
        "/app/inbox",
        "/app/agenda",
        "/app/kanban",
        "/app/contacts",
        "/app/tasks",
      ],
    },
  },
};

function configurarPerfil(chave: keyof typeof PERFIS_ROBUSTY) {
  const perfil = PERFIS_ROBUSTY[chave];
  authRef.user = { is_platform_admin: perfil.isPlatformAdmin };
  authRef.activeOrg = {
    orgId: "23533966-6d2f-42fd-898a-6318e9e1549c",
    name: "Robusty",
    role: perfil.role,
    interface_settings: perfil.interface_settings,
  };
}

afterEach(cleanup);

describe("Perfis de acesso e visualização da equipe Robusty", () => {
  it("Administrador (ti@grupomixfer.com.br) vê todos os grupos, Análise, Configurações e Ajuda", () => {
    configurarPerfil("admin_ti");
    render(<Sidebar collapsed={false} />);

    const titulos = screen.getAllByRole("heading").map((el) => el.textContent?.trim());
    expect(titulos).toEqual(["Atendimento", "CRM", "Agente de IA", "Canais", "Análise"]);
    expect(screen.getByRole("link", { name: /Configurações/ })).toHaveAttribute(
      "href",
      "/app/settings",
    );
    expect(screen.getByRole("link", { name: /Ajuda/ })).toHaveAttribute("href", "/app/ajuda");
  });

  it("João Ricardo / Dono (joaoricardo@grupomixfer.com.br) vê Atendimento, CRM, IA e Canais, sem Análise, Configurações ou Ajuda", () => {
    configurarPerfil("joao_ricardo");
    render(<Sidebar collapsed={false} />);

    const titulos = screen.getAllByRole("heading").map((el) => el.textContent?.trim());
    expect(titulos).toEqual(["Atendimento", "CRM", "Agente de IA", "Canais"]);
    expect(titulos).not.toContain("Análise");

    expect(screen.queryByRole("link", { name: /Configurações/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Ajuda/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Desempenho/ })).toBeNull();

    expect(screen.getByRole("link", { name: /Inbox/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Funis/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Agentes/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Conexões/ })).toBeTruthy();
  });

  it("Norlando (norlando@ironparts.com.br) vê apenas Atendimento e CRM comerciais", () => {
    configurarPerfil("norlando");
    render(<Sidebar collapsed={false} />);

    const titulos = screen.getAllByRole("heading").map((el) => el.textContent?.trim());
    expect(titulos).toEqual(["Atendimento", "CRM"]);

    expect(screen.getByRole("link", { name: /Inbox/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Radar/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Agenda/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Respostas rápidas/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Funis/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Contatos/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Tarefas/ })).toBeTruthy();

    expect(screen.queryByRole("link", { name: /Configurações/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Ajuda/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Agentes/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Conexões/ })).toBeNull();
  });

  it("Igor (igor@grupomixfer.com.br) vê apenas o operacional de Cotações, Pedidos, Logística e Agenda", () => {
    configurarPerfil("igor");
    render(<Sidebar collapsed={false} />);

    const titulos = screen.getAllByRole("heading").map((el) => el.textContent?.trim());
    expect(titulos).toEqual(["Atendimento", "CRM"]);

    expect(screen.getByRole("link", { name: /Inbox/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Agenda/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Funis/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Contatos/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Tarefas/ })).toBeTruthy();

    expect(screen.queryByRole("link", { name: /Radar/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Respostas rápidas/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Configurações/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Ajuda/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Agentes/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Conexões/ })).toBeNull();
  });
});
