import type { SupabaseClient } from "@supabase/supabase-js";
import { CAMPOS_CONHECIDOS_DO_PERFIL } from "@/lib/leads/campos-do-perfil";
import { logger } from "@/lib/logger";

interface SincronizarInput {
  leadId: string;
  organizationId: string;
}

export interface ResultadoSincronizacaoAgenda {
  ok: boolean;
  synced: boolean;
  appointmentId?: string;
  error?: string;
}

function rotulo(campo: string, valor: unknown): string {
  const def = CAMPOS_CONHECIDOS_DO_PERFIL[campo];
  if (Array.isArray(valor)) {
    return valor
      .map((item) => rotulo(campo, item))
      .filter((s) => s.length > 0)
      .join(", ");
  }
  if (typeof valor !== "string") return valor != null ? String(valor) : "";
  const texto = valor.trim();
  if (!texto) return "";
  const opcao = def?.options?.find((o) => o.value === texto);
  return opcao?.label ?? texto;
}

/**
 * Converte data (YYYY-MM-DD) e hora (HH:mm) para Date no fuso de São Paulo (UTC-3)
 */
function parseDataHoraSaoPaulo(dataStr: string, horaStr: string): Date | null {
  const matchData = dataStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const matchHora = horaStr.trim().match(/^(\d{2}):(\d{2})$/);
  if (!matchData || !matchHora) return null;

  const iso = `${dataStr.trim()}T${horaStr.trim()}:00-03:00`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * Sincroniza automaticamente os campos de modalidade, data e horário do lead/pedido
 * com a tabela `calendar_appointments` do DeskcommCRM.
 */
export async function sincronizarLeadComAgenda(
  supabase: SupabaseClient,
  input: SincronizarInput,
): Promise<ResultadoSincronizacaoAgenda> {
  const { leadId, organizationId } = input;

  try {
    // 1. Carregar lead atualizado
    const { data: lead, error: errLead } = await supabase
      .from("crm_leads")
      .select("id, title, commercial_id, contact_id, custom_fields, organization_id")
      .eq("organization_id", organizationId)
      .eq("id", leadId)
      .maybeSingle();

    if (errLead || !lead) {
      return { ok: false, synced: false, error: "Lead não encontrado para sincronização de agenda" };
    }

    const cf = (lead.custom_fields && typeof lead.custom_fields === "object"
      ? (lead.custom_fields as Record<string, unknown>)
      : {}) as Record<string, unknown>;

    const modalidade = (cf.modalidade_entrega || cf.modalidade_pretendida) as string | undefined;

    let dataStr: string | null = null;
    let horaStr: string | null = null;
    let eventTypeSlug: "instalacao-loja" | "coleta-transportadora" | null = null;
    let duracaoMinutos = 60;
    let tipoOperacaoTitulo = "";

    if (modalidade === "transportadora") {
      dataStr = typeof cf.data_coleta_despacho === "string" ? cf.data_coleta_despacho : null;
      horaStr = typeof cf.horario_coleta_despacho === "string" ? cf.horario_coleta_despacho : null;
      eventTypeSlug = "coleta-transportadora";
      duracaoMinutos = 30;
      tipoOperacaoTitulo = "Coleta Transportadora";
    } else if (modalidade === "instalacao_loja") {
      dataStr = typeof cf.data_instalacao === "string" ? cf.data_instalacao : null;
      horaStr = typeof cf.horario_instalacao === "string" ? cf.horario_instalacao : null;
      eventTypeSlug = "instalacao-loja";
      duracaoMinutos = 60;
      tipoOperacaoTitulo = "Instalação na Loja";
    }

    // Localizar appointment vinculado existente
    let existingAppointmentId: string | null =
      typeof cf.appointment_id === "string" ? cf.appointment_id : null;

    if (!existingAppointmentId) {
      const { data: link } = await supabase
        .from("crm_lead_links")
        .select("target_id")
        .eq("organization_id", organizationId)
        .eq("lead_id", leadId)
        .eq("target_kind", "appointment")
        .limit(1)
        .maybeSingle();
      if (link?.target_id) {
        existingAppointmentId = link.target_id as string;
      }
    }

    // Se faltar data, hora ou modalidade: se já existia compromisso, cancela
    if (!dataStr || !horaStr || !eventTypeSlug) {
      if (existingAppointmentId) {
        await supabase
          .from("calendar_appointments")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancellation_reason: "Agendamento desmarcado ou modalidade alterada no CRM",
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", organizationId)
          .eq("id", existingAppointmentId);
      }
      return { ok: true, synced: false };
    }

    const startDate = parseDataHoraSaoPaulo(dataStr, horaStr);
    if (!startDate) {
      return { ok: false, synced: false, error: "Formato de data ou hora inválido" };
    }

    const endDate = new Date(startDate.getTime() + duracaoMinutos * 60 * 1000);

    // Buscar tipo de evento no banco
    const { data: eventType } = await supabase
      .from("calendar_event_types")
      .select("id, name, location_kind, location_details")
      .eq("organization_id", organizationId)
      .eq("slug", eventTypeSlug)
      .maybeSingle();

    // Buscar contato para obter telefone / nome se houver
    let contatoNome = "";
    let contatoTelefone = "";
    if (lead.contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("name, phone, whatsapp")
        .eq("organization_id", organizationId)
        .eq("id", lead.contact_id)
        .maybeSingle();
      if (contact) {
        contatoNome = contact.name || "";
        contatoTelefone = contact.phone || contact.whatsapp || "";
      }
    }

    const commId = lead.commercial_id ? `[${lead.commercial_id}] ` : "";
    const titulo = `${commId}${tipoOperacaoTitulo}: ${lead.title}`;

    // Montar descrição rica com dados do negócio/pedido para a loja
    const linhasDescricao: string[] = [
      `📋 ID COMERCIAL: ${lead.commercial_id || "Não informado"}`,
      `👤 CLIENTE: ${lead.title}${contatoNome && contatoNome !== lead.title ? ` (${contatoNome})` : ""}`,
    ];

    if (contatoTelefone) {
      linhasDescricao.push(`📞 TELEFONE / WHATSAPP: ${contatoTelefone}`);
    }

    linhasDescricao.push(
      `🚚 MODALIDADE: ${modalidade === "transportadora" ? "Transportadora (Despacho/Coleta)" : "Instalação Presencial na Loja SP"}`,
    );

    const veiculo = rotulo("veiculo", cf.veiculo);
    const anoVersao = typeof cf.ano_versao === "string" ? cf.ano_versao.trim() : "";
    if (veiculo || anoVersao) {
      linhasDescricao.push(`🚗 VEÍCULO: ${veiculo}${anoVersao ? ` (${anoVersao})` : ""}`);
    }

    const produto = rotulo("produto", cf.produto);
    const modeloBagageiro = rotulo("modelo_bagageiro", cf.modelo_bagageiro);
    if (produto || modeloBagageiro) {
      linhasDescricao.push(
        `📦 PRODUTO / MODELO: ${produto || ""}${modeloBagageiro ? ` - ${modeloBagageiro}` : ""}`,
      );
    }

    const acessorios = rotulo("acessorios_adicionais", cf.acessorios_adicionais);
    if (acessorios) {
      linhasDescricao.push(`🔧 ACESSÓRIOS ADICIONAIS: ${acessorios}`);
    }

    if (modalidade === "instalacao_loja") {
      const localResp =
        typeof cf.local_responsavel_instalacao === "string"
          ? cf.local_responsavel_instalacao.trim()
          : "";
      linhasDescricao.push(
        `📍 LOCAL: ${eventType?.location_details || "Oficina Robusty - Rua Dante Marteletti, 122"}`,
      );
      if (localResp) {
        linhasDescricao.push(`👨‍🔧 RESPONSÁVEL / BOX: ${localResp}`);
      }
    } else if (modalidade === "transportadora") {
      const transp = typeof cf.transportadora === "string" ? cf.transportadora.trim() : "";
      const rastreio =
        typeof cf.codigo_rastreamento === "string" ? cf.codigo_rastreamento.trim() : "";
      const cep = typeof cf.cep_entrega === "string" ? cf.cep_entrega : (cf.cep as string);
      const endereco = typeof cf.endereco_entrega === "string" ? cf.endereco_entrega.trim() : "";

      if (transp) linhasDescricao.push(`🚛 TRANSPORTADORA: ${transp}`);
      if (rastreio) linhasDescricao.push(`🔎 CÓDIGO RASTREIO: ${rastreio}`);
      if (cep) linhasDescricao.push(`📮 CEP: ${cep}`);
      if (endereco) linhasDescricao.push(`🏠 ENDEREÇO DE ENTREGA: ${endereco}`);
    }

    const obs =
      typeof cf.observacoes_operacionais === "string"
        ? cf.observacoes_operacionais.trim()
        : typeof cf.detalhes_da_necessidade === "string"
          ? cf.detalhes_da_necessidade.trim()
          : "";
    if (obs) {
      linhasDescricao.push(`📝 OBSERVAÇÕES: ${obs}`);
    }

    const descricaoCompleta = linhasDescricao.join("\n");

    const appointmentPayload = {
      organization_id: organizationId,
      event_type_id: eventType?.id ?? null,
      title: titulo,
      description: descricaoCompleta,
      notes: descricaoCompleta,
      starts_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
      time_zone: "America/Sao_Paulo",
      status: "confirmed",
      location_kind: eventType?.location_kind ?? "in_person",
      location_details: eventType?.location_details ?? null,
      contact_id: lead.contact_id ?? null,
      created_by_kind: "system",
      source: "ui",
      updated_at: new Date().toISOString(),
    };

    let appointmentIdFinal = existingAppointmentId;

    if (existingAppointmentId) {
      // Atualizar compromisso existente
      const { error: errUpd } = await supabase
        .from("calendar_appointments")
        .update(appointmentPayload)
        .eq("organization_id", organizationId)
        .eq("id", existingAppointmentId);

      if (errUpd) {
        logger.error("Erro ao atualizar compromisso de agenda", { error: errUpd.message, leadId });
        return { ok: false, synced: false, error: errUpd.message };
      }
    } else {
      // Criar novo compromisso
      const { data: novoApp, error: errIns } = await supabase
        .from("calendar_appointments")
        .insert({
          ...appointmentPayload,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (errIns || !novoApp) {
        logger.error("Erro ao criar compromisso de agenda", {
          error: errIns?.message,
          leadId,
        });
        return { ok: false, synced: false, error: errIns?.message ?? "Falha ao criar agendamento" };
      }

      appointmentIdFinal = novoApp.id;

      // Criar vínculo polimórfico em crm_lead_links
      await supabase.from("crm_lead_links").insert({
        organization_id: organizationId,
        lead_id: leadId,
        target_id: novoApp.id,
        target_kind: "appointment",
        link_kind: "appointment",
        metadata: {
          modalidade,
          data: dataStr,
          hora: horaStr,
        },
      });

      // Salvar appointment_id nos custom_fields do lead
      await supabase
        .from("crm_leads")
        .update({
          custom_fields: {
            ...cf,
            appointment_id: novoApp.id,
          },
        })
        .eq("organization_id", organizationId)
        .eq("id", leadId);
    }

    return { ok: true, synced: true, appointmentId: appointmentIdFinal ?? undefined };
  } catch (e) {
    logger.error("Exceção ao sincronizar lead com a agenda", { error: (e as Error).message, leadId });
    return { ok: false, synced: false, error: (e as Error).message };
  }
}
