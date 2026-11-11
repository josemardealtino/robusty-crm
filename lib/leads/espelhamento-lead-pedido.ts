import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { valorEstaPreenchido } from "./campos-do-perfil";
import { gerarResumoProdutosDoPedido } from "./criar-pedido-do-lead";
import { sincronizarLeadComAgenda } from "@/lib/agenda/sincronizacao-lead-pedido";

interface SincronizarEspelhoInput {
  leadId: string;
  organizationId: string;
}

export interface ResultadoEspelhamento {
  ok: boolean;
  synced: boolean;
  parId?: string;
  error?: string;
}

/**
 * Localiza o user_id do Igor (responsável operacional pelo funil de Pedidos)
 * dentro dos membros ativos da organização.
 */
export async function localizarUsuarioIgor(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  try {
    const { data: members, error } = await supabase
      .from("user_organizations")
      .select("user_id, role")
      .eq("organization_id", organizationId)
      .is("revoked_at", null);

    if (error || !members || members.length === 0) return null;

    const adminAuth = (
      supabase as unknown as {
        auth?: {
          admin?: {
            getUserById?: (id: string) => Promise<{
              data: {
                user?: {
                  email?: string;
                  user_metadata?: Record<string, unknown>;
                };
              };
            }>;
          };
        };
      }
    ).auth?.admin;

    if (adminAuth?.getUserById) {
      for (const m of members) {
        try {
          const { data: userRes } = await adminAuth.getUserById(m.user_id);
          const email = userRes?.user?.email?.toLowerCase() ?? "";
          const fullName = String(userRes?.user?.user_metadata?.full_name ?? "").toLowerCase();
          if (
            email === "igor@grupomixfer.com.br" ||
            email.includes("igor@") ||
            fullName.includes("igor")
          ) {
            return m.user_id;
          }
        } catch {
          // Em mock ou falha pontual de rede, ignora e tenta o próximo
        }
      }
    }
  } catch {
    // Fallback silencioso
  }
  return null;
}

/**
 * Sincroniza de forma bidirecional e automática as informações entre o par
 * Lead (funil de Leads / comercial) e Pedido (funil de Pedidos / operacional).
 *
 * Garante que quando o Norlando atualiza dados comerciais no Lead, o Igor veja
 * imediatamente o espelho atualizado no Pedido, e quando o Igor atualiza dados
 * logísticos, de nota fiscal ou agendamento no Pedido, o Norlando também veja
 * o espelho atualizado no Lead.
 *
 * Cada card mantém sua própria etapa (`stage_id`) e seu próprio responsável
 * (`owner_user_id`): Norlando no comercial (Leads) e Igor no operacional (Pedidos).
 */
export async function sincronizarEspelhoLeadPedido(
  supabase: SupabaseClient,
  input: SincronizarEspelhoInput,
): Promise<ResultadoEspelhamento> {
  const { leadId, organizationId } = input;

  try {
    // 1. Carregar registro atual
    const { data: atual, error: errAtual } = await supabase
      .from("crm_leads")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", leadId)
      .maybeSingle();

    if (errAtual || !atual) {
      return { ok: false, synced: false, error: "Registro não encontrado para espelhamento" };
    }

    const cfAtual = (atual.custom_fields && typeof atual.custom_fields === "object"
      ? (atual.custom_fields as Record<string, unknown>)
      : {}) as Record<string, unknown>;

    let parId: string | null = null;
    let ehOrigem = false;

    // Se este registro possui pedido_gerado_id -> ele é o Lead de origem
    if (typeof cfAtual.pedido_gerado_id === "string" && cfAtual.pedido_gerado_id) {
      parId = cfAtual.pedido_gerado_id;
      ehOrigem = true;
    }
    // Se este registro possui lead_origem_id -> ele é o Pedido
    else if (typeof cfAtual.lead_origem_id === "string" && cfAtual.lead_origem_id) {
      parId = cfAtual.lead_origem_id;
      ehOrigem = false;
    }

    // Fallbacks para identificar o card irmão por commercial_id ou por busca reversa
    if (!parId && atual.commercial_id) {
      const { data: porCodigo } = await supabase
        .from("crm_leads")
        .select("id, custom_fields")
        .eq("organization_id", organizationId)
        .eq("commercial_id", atual.commercial_id)
        .neq("id", leadId)
        .limit(1)
        .maybeSingle();

      if (porCodigo) {
        parId = porCodigo.id as string;
        ehOrigem = typeof cfAtual.pedido_gerado_id === "string" || !cfAtual.lead_origem_id;
      }
    }

    if (!parId) {
      // Tentar busca reversa por custom_fields
      const { data: porVinculo } = await supabase
        .from("crm_leads")
        .select("id, custom_fields")
        .eq("organization_id", organizationId)
        .or(`custom_fields->>lead_origem_id.eq.${leadId},custom_fields->>pedido_gerado_id.eq.${leadId}`)
        .limit(1)
        .maybeSingle();

      if (porVinculo) {
        parId = porVinculo.id as string;
        const cfPar = (porVinculo.custom_fields as Record<string, unknown> | null) ?? {};
        ehOrigem = cfPar.lead_origem_id === leadId;
      }
    }

    if (!parId) {
      // Não possui card espelho no outro funil (ex: lead que ainda não gerou pedido)
      return { ok: true, synced: false };
    }

    // 2. Carregar o card par
    const { data: par, error: errPar } = await supabase
      .from("crm_leads")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", parId)
      .maybeSingle();

    if (errPar || !par) {
      return { ok: false, synced: false, error: "Card irmão não encontrado" };
    }

    const cfPar = (par.custom_fields && typeof par.custom_fields === "object"
      ? (par.custom_fields as Record<string, unknown>)
      : {}) as Record<string, unknown>;

    // 3. Montar custom_fields mesclados mantendo os vínculos estruturados
    const chavesParaCopiar = [
      "veiculo",
      "ano_versao",
      "produto",
      "modelo_bagageiro",
      "tipo_de_acessorio",
      "acessorios_adicionais",
      "tipo_precificacao",
      "status_cotacao",
      "valor_frete",
      "forma_pagamento",
      "status_pagamento",
      "modalidade_pretendida",
      "modalidade_entrega",
      "cep",
      "cep_entrega",
      "endereco",
      "numero",
      "complemento",
      "bairro",
      "cidade",
      "estado",
      "endereco_entrega",
      "transportadora",
      "codigo_rastreamento",
      "previsao_entrega",
      "data_coleta_despacho",
      "horario_coleta_despacho",
      "data_instalacao",
      "horario_instalacao",
      "local_responsavel_instalacao",
      "confirmacao_entrega_instalacao",
      "status_nota_fiscal",
      "numero_nota_fiscal",
      "detalhes_da_necessidade",
      "observacoes_operacionais",
      "valor_desconto",
      "tipo_desconto",
      "produtos_servicos_pedido",
    ];

    const cfMescladoNoPar: Record<string, unknown> = { ...cfPar };
    const cfMescladoNoAtual: Record<string, unknown> = { ...cfAtual };

    // Harmonizar sinônimos no registro atual antes de propagar alterações
    if (valorEstaPreenchido(cfAtual.modalidade_pretendida)) {
      cfAtual.modalidade_entrega = cfAtual.modalidade_pretendida;
    } else if (valorEstaPreenchido(cfAtual.modalidade_entrega)) {
      cfAtual.modalidade_pretendida = cfAtual.modalidade_entrega;
    }
    if (valorEstaPreenchido(cfAtual.cep)) {
      cfAtual.cep_entrega = cfAtual.cep;
    } else if (valorEstaPreenchido(cfAtual.cep_entrega)) {
      cfAtual.cep = cfAtual.cep_entrega;
    }

    for (const k of chavesParaCopiar) {
      const vAtual = cfAtual[k];
      const vPar = cfPar[k];
      const atualPreenchido = valorEstaPreenchido(vAtual);
      const parPreenchido = valorEstaPreenchido(vPar);

      if (atualPreenchido) {
        cfMescladoNoPar[k] = vAtual;
      } else if (parPreenchido) {
        cfMescladoNoAtual[k] = vPar;
      }
    }

    // Harmonizar chaves sinônimas em ambos os cards
    const harmonizarSinonimos = (alvo: Record<string, unknown>) => {
      if (valorEstaPreenchido(alvo.modalidade_entrega) && !valorEstaPreenchido(alvo.modalidade_pretendida)) {
        alvo.modalidade_pretendida = alvo.modalidade_entrega;
      } else if (valorEstaPreenchido(alvo.modalidade_pretendida) && !valorEstaPreenchido(alvo.modalidade_entrega)) {
        alvo.modalidade_entrega = alvo.modalidade_pretendida;
      }

      if (valorEstaPreenchido(alvo.cep_entrega) && !valorEstaPreenchido(alvo.cep)) {
        alvo.cep = alvo.cep_entrega;
      } else if (valorEstaPreenchido(alvo.cep) && !valorEstaPreenchido(alvo.cep_entrega)) {
        alvo.cep_entrega = alvo.cep;
      }

      if (valorEstaPreenchido(alvo.observacoes_operacionais) && !valorEstaPreenchido(alvo.detalhes_da_necessidade)) {
        alvo.detalhes_da_necessidade = alvo.observacoes_operacionais;
      } else if (valorEstaPreenchido(alvo.detalhes_da_necessidade) && !valorEstaPreenchido(alvo.observacoes_operacionais)) {
        alvo.observacoes_operacionais = alvo.detalhes_da_necessidade;
      }

      // Se não possui endereco_entrega mas tem os campos desmembrados, compor
      if (!valorEstaPreenchido(alvo.endereco_entrega)) {
        const partes: string[] = [];
        if (valorEstaPreenchido(alvo.endereco)) partes.push(String(alvo.endereco).trim());
        if (valorEstaPreenchido(alvo.numero)) partes.push(`nº ${alvo.numero}`);
        if (valorEstaPreenchido(alvo.complemento)) partes.push(String(alvo.complemento).trim());
        if (valorEstaPreenchido(alvo.bairro)) partes.push(String(alvo.bairro).trim());
        if (valorEstaPreenchido(alvo.cidade)) {
          const cidUf = valorEstaPreenchido(alvo.estado) ? `${alvo.cidade}/${alvo.estado}` : String(alvo.cidade);
          partes.push(cidUf);
        }
        if (partes.length > 0) {
          alvo.endereco_entrega = partes.join(", ");
        }
      }

      // Garantir resumo de produtos/serviços
      if (!valorEstaPreenchido(alvo.produtos_servicos_pedido)) {
        const resumo = gerarResumoProdutosDoPedido(alvo);
        if (resumo) alvo.produtos_servicos_pedido = resumo;
      }
    };

    harmonizarSinonimos(cfMescladoNoPar);
    harmonizarSinonimos(cfMescladoNoAtual);

    // Garantir integridade dos vínculos
    if (ehOrigem) {
      // O atual é o Lead de origem; o par é o Pedido
      cfMescladoNoPar.lead_origem_id = atual.id;
      cfMescladoNoPar.pipeline_origem_id = atual.pipeline_id;
      delete cfMescladoNoPar.pedido_gerado_id;
      delete cfMescladoNoPar.pedido_pipeline_id;

      cfMescladoNoAtual.pedido_gerado_id = par.id;
      cfMescladoNoAtual.pedido_pipeline_id = par.pipeline_id;
    } else {
      // O atual é o Pedido; o par é o Lead de origem
      cfMescladoNoPar.pedido_gerado_id = atual.id;
      cfMescladoNoPar.pedido_pipeline_id = atual.pipeline_id;
      delete cfMescladoNoPar.lead_origem_id;
      delete cfMescladoNoPar.pipeline_origem_id;

      cfMescladoNoAtual.lead_origem_id = par.id;
      cfMescladoNoAtual.pipeline_origem_id = par.pipeline_id;
    }

    // 4. Unificar tags sem duplicidade
    const tagsAtuais = (atual.tags as string[] | null) ?? [];
    const tagsPar = (par.tags as string[] | null) ?? [];
    const tagsUnificadas = Array.from(new Set([...tagsAtuais, ...tagsPar]));

    // 5. Verificar atribuição do Igor no card de Pedido
    const igorUserId = await localizarUsuarioIgor(supabase, organizationId);

    const patchPar: Record<string, unknown> = {
      title: atual.title as string,
      description: (atual.description as string | null) ?? (par.description as string | null) ?? null,
      value_cents: (atual.value_cents as number | null) ?? (par.value_cents as number | null) ?? null,
      currency: (atual.currency as string | null) ?? (par.currency as string | null) ?? "BRL",
      tags: tagsUnificadas,
      contact_id: (atual.contact_id as string | null) ?? (par.contact_id as string | null) ?? null,
      custom_fields: cfMescladoNoPar,
      updated_at: new Date().toISOString(),
    };

    // Se o par for o Pedido e não possuir responsável definido, atribuir ao Igor
    if (ehOrigem && !par.owner_user_id && igorUserId) {
      patchPar.owner_user_id = igorUserId;
      patchPar.owner_kind = "user";
      patchPar.assigned_at = new Date().toISOString();
    }

    // Atualizar o card par
    const { error: updErr } = await supabase
      .from("crm_leads")
      .update(patchPar)
      .eq("organization_id", organizationId)
      .eq("id", parId);

    if (updErr) {
      logger.error("[sincronizarEspelhoLeadPedido] Erro ao sincronizar card espelho", {
        leadId,
        parId,
        error: updErr.message,
      });
      return { ok: false, synced: false, error: updErr.message };
    }

    // Se o atual for o Pedido e não possuir responsável, atribuir ao Igor
    const patchAtual: Record<string, unknown> = {
      custom_fields: cfMescladoNoAtual,
      tags: tagsUnificadas,
    };
    if (!ehOrigem && !atual.owner_user_id && igorUserId) {
      patchAtual.owner_user_id = igorUserId;
      patchAtual.owner_kind = "user";
      patchAtual.assigned_at = new Date().toISOString();
    }

    await supabase
      .from("crm_leads")
      .update(patchAtual)
      .eq("organization_id", organizationId)
      .eq("id", leadId);

    // 6. Atualizar agendamento na agenda se houver datas de instalação ou despacho
    await sincronizarLeadComAgenda(supabase, {
      leadId: parId,
      organizationId,
    });
    await sincronizarLeadComAgenda(supabase, {
      leadId,
      organizationId,
    });

    return { ok: true, synced: true, parId };
  } catch (err) {
    logger.error("[sincronizarEspelhoLeadPedido] Exceção ao sincronizar espelho", {
      leadId,
      error: (err as Error).message,
    });
    return { ok: false, synced: false, error: (err as Error).message };
  }
}
