"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { loadAuthUser, mfaEmDivida, resolveActiveOrg } from "@/lib/auth/server";
import { roleAtLeast } from "@/lib/auth/types";
import { supportWriteError } from "@/lib/impersonate/support";
import { posicaoDeEntradaNaEtapa } from "@/lib/kanban/entrada-na-etapa";
import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import { montarCamposDoPedido } from "@/lib/leads/criar-pedido-do-lead";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

const rascunhoSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().nullable().optional(),
  value_cents: z.number().int().nonnegative().nullable().optional(),
  recurring_value_cents: z.number().int().nonnegative().nullable().optional(),
  recurring_period: z.string().nullable().optional(),
  recurring_months: z.number().int().positive().nullable().optional(),
  expected_close_date: z.string().nullable().optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

const entradaSchema = z.object({
  leadId: z.string().uuid(),
  currentDraft: rascunhoSchema.optional(),
});

export type EntradaCriarPedidoDoLead = z.infer<typeof entradaSchema>;

export type ResultadoCriarPedidoDoLead =
  | {
      ok: true;
      alreadyExists: boolean;
      orderId: string;
      pipelineId: string;
      stageId: string;
      commercialId: string | null;
    }
  | {
      ok: false;
      error: string;
    };

export async function createOrderFromLead(
  input: EntradaCriarPedidoDoLead,
): Promise<ResultadoCriarPedidoDoLead> {
  const parsed = entradaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos para criar o pedido." };
  }

  const user = await loadAuthUser();
  if (!user) return { ok: false, error: "Sessão expirada. Faça login novamente." };
  if (supportWriteError(user.support)) {
    return { ok: false, error: "Modo de suporte somente leitura não permite criar pedidos." };
  }
  const org = await resolveActiveOrg(user);
  if (!org) return { ok: false, error: "Organização ativa não encontrada." };
  if (!user.is_platform_admin && !roleAtLeast(org.role, "agent")) {
    return { ok: false, error: "Sem permissão para criar pedidos." };
  }
  if (await mfaEmDivida()) {
    return { ok: false, error: "Verificação em duas etapas pendente." };
  }

  const requestId = randomUUID();
  const admin = createAdminClient();
  const { leadId, currentDraft } = parsed.data;

  // 1. Carregar lead de origem garantindo isolamento multi-tenant
  const { data: leadRow, error: leadErr } = await admin
    .from("crm_leads")
    .select("*")
    .eq("organization_id", org.orgId)
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr || !leadRow) {
    return { ok: false, error: "Lead de origem não encontrado." };
  }

  // 2. Se houver rascunho editado na tela no momento do clique, persistir primeiro no Lead de origem
  const customFieldsMesclados: Record<string, unknown> = {
    ...((leadRow.custom_fields as Record<string, unknown> | null) ?? {}),
    ...(currentDraft?.custom_fields ?? {}),
  };

  const patchOrigem: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    custom_fields: customFieldsMesclados,
  };
  if (currentDraft?.title && currentDraft.title.trim().length >= 2) {
    patchOrigem.title = currentDraft.title.trim();
  }
  if (currentDraft?.description !== undefined) {
    patchOrigem.description = currentDraft.description;
  }
  if (currentDraft?.value_cents !== undefined) {
    patchOrigem.value_cents = currentDraft.value_cents;
  }
  if (currentDraft?.recurring_value_cents !== undefined) {
    patchOrigem.recurring_value_cents = currentDraft.recurring_value_cents;
    patchOrigem.recurring_period = currentDraft.recurring_period ?? null;
    patchOrigem.recurring_months = currentDraft.recurring_months ?? null;
  }
  if (currentDraft?.expected_close_date !== undefined) {
    patchOrigem.expected_close_date = currentDraft.expected_close_date;
  }

  const { data: leadAtualizado } = await admin
    .from("crm_leads")
    .update(patchOrigem)
    .eq("organization_id", org.orgId)
    .eq("id", leadId)
    .select("*")
    .single();

  const leadEfetivo = leadAtualizado ?? {
    ...leadRow,
    ...patchOrigem,
  };

  // 3. Localizar o funil de Pedidos da organização
  const { data: pipelines, error: pipErr } = await admin
    .from("crm_pipelines")
    .select("id, name, slug, is_client_pipeline")
    .eq("organization_id", org.orgId)
    .eq("is_archived", false)
    .order("position", { ascending: true });

  if (pipErr || !pipelines || pipelines.length === 0) {
    return { ok: false, error: "Funis da organização não encontrados." };
  }

  const pedidosPipeline =
    pipelines.find((p) => p.slug === "pedidos" || p.name.trim().toLowerCase() === "pedidos") ??
    pipelines.find((p) => p.is_client_pipeline === true && p.id !== leadEfetivo.pipeline_id);

  if (!pedidosPipeline) {
    return { ok: false, error: "Funil de Pedidos não encontrado na organização." };
  }

  if (leadEfetivo.pipeline_id === pedidosPipeline.id) {
    return { ok: false, error: "Este registro já se encontra no funil de Pedidos." };
  }

  // 4. Localizar a primeira etapa aberta ("Pedido recebido") do funil de Pedidos
  const { data: etapasPedidos, error: stgErr } = await admin
    .from("crm_stages")
    .select("id, name, position, is_won, is_lost, is_archived")
    .eq("organization_id", org.orgId)
    .eq("pipeline_id", pedidosPipeline.id)
    .eq("is_archived", false)
    .order("position", { ascending: true });

  if (stgErr || !etapasPedidos || etapasPedidos.length === 0) {
    return { ok: false, error: "O funil de Pedidos não possui etapas configuradas." };
  }

  const etapaInicial =
    etapasPedidos.find((s) => !s.is_won && !s.is_lost) ?? etapasPedidos[0]!;

  const commercialId = (leadEfetivo.commercial_id as string | null) ?? null;

  // 5. Verificação de Idempotência: procurar se este Lead já gerou um Pedido no funil de Pedidos
  let pedidoExistente: Record<string, unknown> | null = null;

  if (commercialId) {
    const { data: porCodigo } = await admin
      .from("crm_leads")
      .select("*")
      .eq("organization_id", org.orgId)
      .eq("pipeline_id", pedidosPipeline.id)
      .eq("commercial_id", commercialId)
      .maybeSingle();
    if (porCodigo) pedidoExistente = porCodigo as Record<string, unknown>;
  }

  if (!pedidoExistente) {
    const { data: porOrigem } = await admin
      .from("crm_leads")
      .select("*")
      .eq("organization_id", org.orgId)
      .eq("pipeline_id", pedidosPipeline.id)
      .contains("custom_fields", { lead_origem_id: leadId })
      .limit(1)
      .maybeSingle();
    if (porOrigem) pedidoExistente = porOrigem as Record<string, unknown>;
  }

  const camposNovosDoPedido = montarCamposDoPedido({
    id: leadId,
    pipeline_id: leadEfetivo.pipeline_id as string,
    commercial_id: commercialId,
    custom_fields: customFieldsMesclados,
  });

  if (pedidoExistente) {
    const idExistente = pedidoExistente.id as string;
    const camposAtuaisDoPedido =
      (pedidoExistente.custom_fields as Record<string, unknown> | null) ?? {};

    // Mescla novos dados do lead sem sobrescrever campos operacionais já preenchidos no pedido
    const camposSincronizados: Record<string, unknown> = {
      ...camposNovosDoPedido,
      ...camposAtuaisDoPedido,
    };

    await admin
      .from("crm_leads")
      .update({
        title: leadEfetivo.title as string,
        description: (leadEfetivo.description as string | null) ?? null,
        value_cents: (leadEfetivo.value_cents as number | null) ?? null,
        custom_fields: camposSincronizados,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", org.orgId)
      .eq("id", idExistente);

    await admin
      .from("crm_leads")
      .update({
        custom_fields: {
          ...customFieldsMesclados,
          pedido_gerado_id: idExistente,
          pedido_pipeline_id: pedidosPipeline.id,
        },
      })
      .eq("organization_id", org.orgId)
      .eq("id", leadId);

    revalidatePath(`/app/pipelines/${leadEfetivo.pipeline_id as string}`);
    revalidatePath(`/app/pipelines/${pedidosPipeline.id}`);

    return {
      ok: true,
      alreadyExists: true,
      orderId: idExistente,
      pipelineId: pedidosPipeline.id,
      stageId: (pedidoExistente.stage_id as string) ?? etapaInicial.id,
      commercialId: (pedidoExistente.commercial_id as string | null) ?? commercialId,
    };
  }

  // 6. Calcular posição no topo da etapa "Pedido recebido"
  const { data: primeiraRow } = await admin
    .from("crm_leads")
    .select("position_in_stage")
    .eq("organization_id", org.orgId)
    .eq("stage_id", etapaInicial.id)
    .order("position_in_stage", { ascending: true })
    .limit(1)
    .maybeSingle();

  const nextPos = posicaoDeEntradaNaEtapa(
    primeiraRow?.position_in_stage == null ? null : Number(primeiraRow.position_in_stage),
  );

  // 7. Inserir novo Pedido preservando o mesmo commercial_id (ROB-2026-XXXXXX)
  const { data: novoPedido, error: insErr } = await admin
    .from("crm_leads")
    .insert({
      organization_id: org.orgId,
      pipeline_id: pedidosPipeline.id,
      stage_id: etapaInicial.id,
      commercial_id: commercialId,
      title: leadEfetivo.title as string,
      description: (leadEfetivo.description as string | null) ?? null,
      contact_id: (leadEfetivo.contact_id as string | null) ?? null,
      value_cents: (leadEfetivo.value_cents as number | null) ?? null,
      recurring_value_cents: (leadEfetivo.recurring_value_cents as number | null) ?? null,
      recurring_period: (leadEfetivo.recurring_period as "monthly" | null) ?? null,
      recurring_months: (leadEfetivo.recurring_months as number | null) ?? null,
      currency: (leadEfetivo.currency as string | null) ?? "BRL",
      owner_user_id: (leadEfetivo.owner_user_id as string | null) ?? null,
      owner_agent_id: (leadEfetivo.owner_agent_id as string | null) ?? null,
      owner_kind: (leadEfetivo.owner_kind as string | null) ?? null,
      assigned_at: (leadEfetivo.assigned_at as string | null) ?? null,
      expected_close_date: (leadEfetivo.expected_close_date as string | null) ?? null,
      tags: (leadEfetivo.tags as string[] | null) ?? [],
      source: (leadEfetivo.source as string | null) ?? "manual",
      custom_fields: camposNovosDoPedido,
      status: "open",
      position_in_stage: nextPos,
      created_by_user_id: user.id,
    })
    .select("*")
    .single();

  // Fallback idempotente para colisão concorrente no índice único (23505)
  if (insErr?.code === "23505" && commercialId) {
    const { data: colisao } = await admin
      .from("crm_leads")
      .select("*")
      .eq("organization_id", org.orgId)
      .eq("pipeline_id", pedidosPipeline.id)
      .eq("commercial_id", commercialId)
      .maybeSingle();

    if (colisao) {
      return {
        ok: true,
        alreadyExists: true,
        orderId: colisao.id as string,
        pipelineId: pedidosPipeline.id,
        stageId: colisao.stage_id as string,
        commercialId: (colisao.commercial_id as string | null) ?? commercialId,
      };
    }
  }

  if (insErr || !novoPedido) {
    logger.error("[createOrderFromLead] falha ao inserir pedido", {
      leadId,
      error: insErr?.message,
      code: insErr?.code,
    });
    return {
      ok: false,
      error: insErr?.message ?? "Não foi possível criar o pedido.",
    };
  }

  const orderId = novoPedido.id as string;
  const orderCommercialId = (novoPedido.commercial_id as string | null) ?? commercialId;

  // 8. Gravar vínculo pedido_gerado_id no Lead de origem
  await admin
    .from("crm_leads")
    .update({
      custom_fields: {
        ...customFieldsMesclados,
        pedido_gerado_id: orderId,
        pedido_pipeline_id: pedidosPipeline.id,
      },
    })
    .eq("organization_id", org.orgId)
    .eq("id", leadId);

  // 9. Registrar na linha do tempo do Lead e do Pedido + auditoria
  const actor = { type: "user" as const, id: user.id };
  await emitLeadActivity(admin, {
    organizationId: org.orgId,
    leadId,
    contactId: (leadEfetivo.contact_id as string | null) ?? null,
    type: "lead_edited",
    sourceModule: "crm",
    sourceId: orderId,
    actor,
    reason: `Pedido ${orderCommercialId ?? ""} gerado no funil de Pedidos (${etapaInicial.name})`.trim(),
    payload: {
      order_id: orderId,
      order_pipeline_id: pedidosPipeline.id,
      commercial_id: orderCommercialId,
    },
  });

  await emitLeadActivity(admin, {
    organizationId: org.orgId,
    leadId: orderId,
    contactId: (leadEfetivo.contact_id as string | null) ?? null,
    type: "lead_created",
    sourceModule: "crm",
    sourceId: leadId,
    actor,
    reason: `Pedido criado a partir do lead ${orderCommercialId ?? leadEfetivo.title}`.trim(),
    payload: {
      lead_origem_id: leadId,
      pipeline_origem_id: leadEfetivo.pipeline_id,
      commercial_id: orderCommercialId,
    },
  });

  await audit({
    action: "lead.created",
    actorUserId: user.id,
    organizationId: org.orgId,
    resourceType: "crm_lead",
    resourceId: orderId,
    requestId,
    metadata: {
      lead_origem_id: leadId,
      pipeline_origem_id: leadEfetivo.pipeline_id,
      order_pipeline_id: pedidosPipeline.id,
      commercial_id: orderCommercialId,
    },
  });

  revalidatePath(`/app/pipelines/${leadEfetivo.pipeline_id as string}`);
  revalidatePath(`/app/pipelines/${pedidosPipeline.id}`);

  return {
    ok: true,
    alreadyExists: false,
    orderId,
    pipelineId: pedidosPipeline.id,
    stageId: etapaInicial.id,
    commercialId: orderCommercialId,
  };
}
