import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  localizarUsuarioIgor,
  sincronizarEspelhoLeadPedido,
} from "@/lib/leads/espelhamento-lead-pedido";

vi.mock("@/lib/agenda/sincronizacao-lead-pedido", () => ({
  sincronizarLeadComAgenda: vi.fn().mockResolvedValue({ ok: true }),
}));

describe("Espelhamento bidirecional e atribuição operacional Lead ↔ Pedido", () => {
  const ORG_ID = "org-robusty-123";
  const NORLANDO_ID = "user-norlando-vendas";
  const IGOR_ID = "user-igor-operacional";
  const STAGE_LEADS_ID = "stage-leads-qualificacao";
  const STAGE_PEDIDOS_ID = "stage-pedidos-recebido";

  it("localizarUsuarioIgor identifica Igor como responsável operacional nos membros ativos", async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "user_organizations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [
                    { user_id: NORLANDO_ID, role: "manager" },
                    { user_id: IGOR_ID, role: "manager" },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      }),
      auth: {
        admin: {
          getUserById: vi.fn().mockImplementation(async (userId: string) => {
            if (userId === NORLANDO_ID) {
              return {
                data: {
                  user: {
                    email: "norlando@ironparts.com.br",
                    user_metadata: { full_name: "Norlando Vendas" },
                  },
                },
              };
            }
            if (userId === IGOR_ID) {
              return {
                data: {
                  user: {
                    email: "igor@grupomixfer.com.br",
                    user_metadata: { full_name: "Igor Operações" },
                  },
                },
              };
            }
            return { data: { user: null } };
          }),
        },
      },
    } as unknown as SupabaseClient;

    const igorFound = await localizarUsuarioIgor(mockSupabase, ORG_ID);
    expect(igorFound).toBe(IGOR_ID);
  });

  it("sincroniza alterações do Lead para o Pedido mantendo donos e etapas independentes", async () => {
    const LEAD_ID = "lead-origem-001";
    const PEDIDO_ID = "pedido-gerado-001";

    const leadMock = {
      id: LEAD_ID,
      organization_id: ORG_ID,
      pipeline_id: "pipeline-leads",
      stage_id: STAGE_LEADS_ID,
      owner_user_id: NORLANDO_ID,
      owner_kind: "user",
      commercial_id: "ROB-2026-000088",
      title: "Jorge Batista - Kombi Clipper",
      description: "Cliente deseja bagageiro com instalação",
      value_cents: 380000,
      currency: "BRL",
      tags: ["quente", "whatsapp"],
      contact_id: "contato-jorge",
      custom_fields: {
        pedido_gerado_id: PEDIDO_ID,
        pedido_pipeline_id: "pipeline-pedidos",
        veiculo: "kombi",
        modelo_bagageiro: "mx_100_plus",
        modalidade_pretendida: "instalacao_loja",
        cep: "03525-150",
      },
    };

    const pedidoMock = {
      id: PEDIDO_ID,
      organization_id: ORG_ID,
      pipeline_id: "pipeline-pedidos",
      stage_id: STAGE_PEDIDOS_ID,
      owner_user_id: null, // Ainda sem dono
      commercial_id: "ROB-2026-000088",
      title: "Antigo",
      tags: ["operacional"],
      custom_fields: {
        lead_origem_id: LEAD_ID,
        pipeline_origem_id: "pipeline-leads",
        codigo_rastreamento: "BR-RASTREIO-EXISTENTE",
      },
    };

    let pedidoAtualizado: Record<string, unknown> | null = null;
    let leadAtualizado: Record<string, unknown> | null = null;

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "user_organizations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ user_id: IGOR_ID, role: "manager" }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "crm_leads") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col: string, _val: string) => ({
                eq: vi.fn().mockImplementation((_col2: string, val2: string) => ({
                  maybeSingle: vi.fn().mockImplementation(async () => {
                    if (val2 === LEAD_ID) return { data: leadMock, error: null };
                    if (val2 === PEDIDO_ID) return { data: pedidoMock, error: null };
                    return { data: null, error: null };
                  }),
                })),
              })),
            }),
            update: vi.fn().mockImplementation((patch: Record<string, unknown>) => ({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation(async (_col: string, id: string) => {
                  if (id === PEDIDO_ID) pedidoAtualizado = patch;
                  if (id === LEAD_ID) leadAtualizado = patch;
                  return { error: null };
                }),
              }),
            })),
          };
        }
        if (table === "events") {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      }),
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { email: "igor@grupomixfer.com.br" } },
          }),
        },
      },
    } as unknown as SupabaseClient;

    const resultado = await sincronizarEspelhoLeadPedido(mockSupabase, {
      leadId: LEAD_ID,
      organizationId: ORG_ID,
    });

    expect(resultado.ok).toBe(true);
    expect(resultado.synced).toBe(true);
    expect(resultado.parId).toBe(PEDIDO_ID);

    // Pedido recebeu os dados comerciais atualizados do Lead
    expect(pedidoAtualizado).not.toBeNull();
    expect(pedidoAtualizado?.title).toBe("Jorge Batista - Kombi Clipper");
    expect(pedidoAtualizado?.value_cents).toBe(380000);
    expect(pedidoAtualizado?.contact_id).toBe("contato-jorge");

    // Igor foi atribuído como responsável operacional no Pedido
    expect(pedidoAtualizado?.owner_user_id).toBe(IGOR_ID);
    expect(pedidoAtualizado?.owner_kind).toBe("user");

    // As tags foram unificadas sem duplicidade
    expect(pedidoAtualizado?.tags).toEqual(expect.arrayContaining(["quente", "whatsapp", "operacional"]));

    // Campos do Lead foram espelhados no Pedido
    const cfPedido = pedidoAtualizado?.custom_fields as Record<string, unknown>;
    expect(cfPedido.veiculo).toBe("kombi");
    expect(cfPedido.modelo_bagageiro).toBe("mx_100_plus");
    expect(cfPedido.modalidade_entrega).toBe("instalacao_loja");

    // O código de rastreamento pré-existente no Pedido NÃO foi apagado
    expect(cfPedido.codigo_rastreamento).toBe("BR-RASTREIO-EXISTENTE");

    // O código de rastreamento foi espelhado de volta para o Lead
    const cfLead = leadAtualizado?.custom_fields as Record<string, unknown>;
    expect(cfLead.codigo_rastreamento).toBe("BR-RASTREIO-EXISTENTE");
  });

  it("sincroniza alterações do Pedido para o Lead preservando o responsável Norlando no Lead", async () => {
    const LEAD_ID = "lead-origem-002";
    const PEDIDO_ID = "pedido-gerado-002";

    const leadMock = {
      id: LEAD_ID,
      organization_id: ORG_ID,
      pipeline_id: "pipeline-leads",
      stage_id: STAGE_LEADS_ID,
      owner_user_id: NORLANDO_ID,
      owner_kind: "user",
      commercial_id: "ROB-2026-000099",
      title: "Marcos Lima",
      value_cents: 250000,
      currency: "BRL",
      tags: ["leads"],
      custom_fields: {
        pedido_gerado_id: PEDIDO_ID,
        veiculo: "saveiro",
      },
    };

    const pedidoMock = {
      id: PEDIDO_ID,
      organization_id: ORG_ID,
      pipeline_id: "pipeline-pedidos",
      stage_id: "stage-pedidos-despachado",
      owner_user_id: IGOR_ID,
      owner_kind: "user",
      commercial_id: "ROB-2026-000099",
      title: "Marcos Lima - Despachado",
      tags: ["leads", "despachado"],
      custom_fields: {
        lead_origem_id: LEAD_ID,
        veiculo: "saveiro",
        codigo_rastreamento: "ROB-TRANS-987654",
        status_nota_fiscal: "emitida",
        numero_nota_fiscal: "NF-001234",
        data_coleta_despacho: "2026-11-20",
      },
    };

    let leadAtualizado: Record<string, unknown> | null = null;

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "user_organizations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ user_id: IGOR_ID, role: "manager" }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "crm_leads") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col: string, _val: string) => ({
                eq: vi.fn().mockImplementation((_col2: string, val2: string) => ({
                  maybeSingle: vi.fn().mockImplementation(async () => {
                    if (val2 === PEDIDO_ID) return { data: pedidoMock, error: null };
                    if (val2 === LEAD_ID) return { data: leadMock, error: null };
                    return { data: null, error: null };
                  }),
                })),
              })),
            }),
            update: vi.fn().mockImplementation((patch: Record<string, unknown>) => ({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockImplementation(async (_col: string, id: string) => {
                  if (id === LEAD_ID) leadAtualizado = patch;
                  return { error: null };
                }),
              }),
            })),
          };
        }
        if (table === "events") {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      }),
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { email: "igor@grupomixfer.com.br" } },
          }),
        },
      },
    } as unknown as SupabaseClient;

    // Disparando sincronização a partir do Pedido
    const resultado = await sincronizarEspelhoLeadPedido(mockSupabase, {
      leadId: PEDIDO_ID,
      organizationId: ORG_ID,
    });

    expect(resultado.ok).toBe(true);
    expect(resultado.synced).toBe(true);
    expect(resultado.parId).toBe(LEAD_ID);

    // O Lead de origem recebeu o espelho dos dados operacionais preenchidos pelo Igor
    expect(leadAtualizado).not.toBeNull();
    const cfLead = leadAtualizado?.custom_fields as Record<string, unknown>;
    expect(cfLead.codigo_rastreamento).toBe("ROB-TRANS-987654");
    expect(cfLead.status_nota_fiscal).toBe("emitida");
    expect(cfLead.numero_nota_fiscal).toBe("NF-001234");
    expect(cfLead.data_coleta_despacho).toBe("2026-11-20");

    // O Lead NÃO teve seu responsável alterado para o Igor (Norlando continua dono no comercial)
    expect(leadAtualizado?.owner_user_id).toBeUndefined();
  });
});
