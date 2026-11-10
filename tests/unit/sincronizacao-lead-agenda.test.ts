import { describe, expect, it, vi } from "vitest";
import { sincronizarLeadComAgenda } from "@/lib/agenda/sincronizacao-lead-pedido";

describe("Sincronização de Lead/Pedido com a Agenda Robusty", () => {
  it("Cria compromisso no calendário para instalação presencial na loja", async () => {
    let insertedAppointment: any = null;
    let insertedLink: any = null;

    const mockSupabase: any = {
      from: vi.fn((table: string) => {
        if (table === "crm_leads") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "lead-111",
                title: "Carlos Silva",
                commercial_id: "ROB-2026-000001",
                contact_id: null,
                custom_fields: {
                  modalidade_pretendida: "instalacao_loja",
                  data_instalacao: "2026-11-25",
                  horario_instalacao: "09:30",
                  veiculo: "kombi",
                  ano_versao: "2021",
                  modelo_bagageiro: "mx_100_plus",
                  acessorios_adicionais: ["escada_removivel_kombi"],
                  local_responsavel_instalacao: "Box 1 - Mecânico Marcos",
                },
              },
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
          };
        }
        if (table === "crm_lead_links") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockImplementation((payload) => {
              insertedLink = payload;
              return Promise.resolve({ error: null });
            }),
          };
        }
        if (table === "calendar_event_types") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "type-inst-123",
                name: "Instalação na Loja (Oficina SP)",
                location_kind: "in_person",
                location_details: "Rua Dante Marteletti, 122",
              },
              error: null,
            }),
          };
        }
        if (table === "calendar_appointments") {
          return {
            insert: vi.fn().mockImplementation((payload) => {
              insertedAppointment = { id: "app-999", ...payload };
              return {
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: { id: "app-999" },
                  error: null,
                }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    };

    const res = await sincronizarLeadComAgenda(mockSupabase, {
      leadId: "lead-111",
      organizationId: "org-robusty-1",
    });

    expect(res.ok).toBe(true);
    expect(res.synced).toBe(true);
    expect(res.appointmentId).toBe("app-999");

    expect(insertedAppointment).toBeTruthy();
    expect(insertedAppointment?.title).toBe("[ROB-2026-000001] Instalação na Loja: Carlos Silva");
    expect(insertedAppointment?.time_zone).toBe("America/Sao_Paulo");
    expect(insertedAppointment?.status).toBe("confirmed");
    expect(insertedAppointment?.description).toContain("ROB-2026-000001");
    expect(insertedAppointment?.description).toContain("Carlos Silva");
    expect(insertedAppointment?.description).toContain("Box 1 - Mecânico Marcos");

    expect(insertedLink).toBeTruthy();
    expect(insertedLink?.lead_id).toBe("lead-111");
    expect(insertedLink?.target_id).toBe("app-999");
  });

  it("Cria compromisso para coleta de transportadora quando modalidade for transportadora", async () => {
    let insertedAppointment: any = null;

    const mockSupabase: any = {
      from: vi.fn((table: string) => {
        if (table === "crm_leads") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "lead-222",
                title: "Transportes Rápidos Ltda",
                commercial_id: "ROB-2026-000002",
                contact_id: null,
                custom_fields: {
                  modalidade_entrega: "transportadora",
                  data_coleta_despacho: "2026-11-26",
                  horario_coleta_despacho: "15:00",
                  transportadora: "Braspress",
                  cep_entrega: "03525-150",
                  endereco_entrega: "Av. Paulista, 1000",
                },
              },
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
          };
        }
        if (table === "crm_lead_links") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === "calendar_event_types") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "type-transp-456",
                name: "Coleta Transportadora",
                location_kind: "in_person",
                location_details: "Expedição",
              },
              error: null,
            }),
          };
        }
        if (table === "calendar_appointments") {
          return {
            insert: vi.fn().mockImplementation((payload) => {
              insertedAppointment = { id: "app-777", ...payload };
              return {
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: { id: "app-777" },
                  error: null,
                }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    };

    const res = await sincronizarLeadComAgenda(mockSupabase, {
      leadId: "lead-222",
      organizationId: "org-robusty-1",
    });

    expect(res.ok).toBe(true);
    expect(res.synced).toBe(true);
    expect(insertedAppointment?.title).toBe(
      "[ROB-2026-000002] Coleta Transportadora: Transportes Rápidos Ltda",
    );
    expect(insertedAppointment?.description).toContain("Braspress");
    expect(insertedAppointment?.description).toContain("03525-150");
  });

  it("Cancela agendamento existente caso data ou hora sejam desmarcadas", async () => {
    let updatedPayload: any = null;

    const mockSupabase: any = {
      from: vi.fn((table: string) => {
        if (table === "crm_leads") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "lead-333",
                title: "Cliente Sem Data",
                commercial_id: "ROB-2026-000003",
                custom_fields: {
                  modalidade_pretendida: "instalacao_loja",
                  appointment_id: "app-old-111",
                },
              },
              error: null,
            }),
          };
        }
        if (table === "calendar_appointments") {
          return {
            update: vi.fn().mockImplementation((payload) => {
              updatedPayload = payload;
              return {
                eq: vi.fn().mockReturnThis(),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        };
      }),
    };

    const res = await sincronizarLeadComAgenda(mockSupabase, {
      leadId: "lead-333",
      organizationId: "org-robusty-1",
    });

    expect(res.ok).toBe(true);
    expect(res.synced).toBe(false);
    expect(updatedPayload).toBeTruthy();
    expect(updatedPayload?.status).toBe("cancelled");
  });
});
