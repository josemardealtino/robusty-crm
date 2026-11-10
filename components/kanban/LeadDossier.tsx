"use client";

import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle,
  CircleNotch,
  Copy,
  ShoppingCart,
  ChatCircle,
  UserCircle,
  Phone,
  EnvelopeSimple,
  Clock,
  Tag as TagIcon,
} from "@/lib/ui/icons";

import { createOrderFromLead } from "@/app/actions/leads/createOrderFromLead";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { useActiveOrg, usePermission, useUser } from "@/hooks/auth/AuthProvider";
import { ROLE_RANK } from "@/lib/auth/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLeadTimeline } from "@/hooks/leads/useLeadTimeline";
import type { Lead } from "@/lib/types/leads";
import { ContatoDoNegocio } from "./ContatoDoNegocio";
import { AtalhosDoNegocio } from "./AtalhosDoCard";
import { ConversaNoDossie } from "./ConversaNoDossie";
import { LeadFieldsForm, type ControleDosCamposDoNegocio } from "./LeadFieldsForm";
import { RevisaoDoDocumento } from "./RevisaoDoDocumento";
import { LeadTimeline } from "./LeadTimeline";
import { PropostasDoNegocio } from "./PropostasDoNegocio";
import { TarefasDoNegocio } from "./TarefasDoNegocio";
import { EtapaNoDossie, type EtapaComCor } from "./EtapaNoDossie";
import { SecaoDoDossie, useSecoesRecolhidas } from "./SecaoDoDossie";
import { ResumoOrcamentoProjeto } from "./ResumoOrcamentoProjeto";
import type { AtalhoDoCard } from "@/lib/leads/atalhos-do-card";
import type { CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: Lead;
  pipelineId: string;
  fieldDefs?: CustomFieldDef[];
  stageName: string;
  ownerNames?: Map<string, string | null>;
  etapas?: EtapaComCor[];
  onMudarEtapa?: (stageId: string) => void;
  atalhos?: AtalhoDoCard[];
}

const ENTRADAS_COM_A_LINHA_RECOLHIDA = 3;

function extrairIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}

export function LeadDossier({
  open,
  onOpenChange,
  lead,
  pipelineId,
  fieldDefs = [],
  stageName,
  ownerNames,
  etapas,
  onMudarEtapa,
  atalhos,
}: Props) {
  const tagDoIdioma = useTagDeIdioma();
  const t = useT();
  const atalhosDoCard = atalhos ?? [];
  const formulario = useRef<ControleDosCamposDoNegocio | null>(null);
  const timeline = useLeadTimeline(open ? lead.id : null, lead.contact_id);

  const { fechadas, alternar, abrir } = useSecoesRecolhidas();
  const timelineRecolhida = fechadas.has("linha-do-tempo");
  const itensDaTimeline = timelineRecolhida
    ? timeline.itens.slice(0, ENTRADAS_COM_A_LINHA_RECOLHIDA)
    : timeline.itens;
  const temMaisNaTimeline = timeline.itens.length > ENTRADAS_COM_A_LINHA_RECOLHIDA;

  const user = useUser();
  const activeOrg = useActiveOrg();

  const podeCriarProposta =
    user.is_platform_admin || (activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager) || false;
  const podeMoverCard = usePermission("pipeline.move_card");
  const podeEditarTarefas =
    (user.is_platform_admin && !user.support) ||
    (activeOrg ? ROLE_RANK[activeOrg.role] >= ROLE_RANK.agent : false);
  const podeConfirmarDoDocumento = podeEditarTarefas;

  const nomeContato = lead.title || t("Lead");
  const telefoneContato = lead.contact_phone || "";

  // Estado sincronizado de customFields para exibição imediata no orçamento lateral
  const [customFieldsAtuais, setCustomFieldsAtuais] = useState<Record<string, unknown>>(
    lead.custom_fields ?? {},
  );

  useEffect(() => {
    setCustomFieldsAtuais(lead.custom_fields ?? {});
  }, [lead.id, lead.custom_fields]);

  // Vínculo e conversão Lead ↔ Pedido
  const leadOrigemId =
    typeof lead.custom_fields?.lead_origem_id === "string"
      ? lead.custom_fields.lead_origem_id
      : null;
  const pipelineOrigemId =
    typeof lead.custom_fields?.pipeline_origem_id === "string"
      ? lead.custom_fields.pipeline_origem_id
      : null;
  const pedidoGeradoInicial =
    typeof lead.custom_fields?.pedido_gerado_id === "string"
      ? lead.custom_fields.pedido_gerado_id
      : null;
  const pedidoPipelineInicial =
    typeof lead.custom_fields?.pedido_pipeline_id === "string"
      ? lead.custom_fields.pedido_pipeline_id
      : null;

  const [criandoPedido, setCriandoPedido] = useState(false);
  const [pedidoGerado, setPedidoGerado] = useState<{
    orderId: string;
    pipelineId: string;
    commercialId: string | null;
  } | null>(
    pedidoGeradoInicial && pedidoPipelineInicial
      ? {
          orderId: pedidoGeradoInicial,
          pipelineId: pedidoPipelineInicial,
          commercialId: lead.commercial_id ?? null,
        }
      : null,
  );

  useEffect(() => {
    const idGerado =
      typeof lead.custom_fields?.pedido_gerado_id === "string"
        ? lead.custom_fields.pedido_gerado_id
        : null;
    const pipGerado =
      typeof lead.custom_fields?.pedido_pipeline_id === "string"
        ? lead.custom_fields.pedido_pipeline_id
        : null;
    setPedidoGerado(
      idGerado && pipGerado
        ? {
            orderId: idGerado,
            pipelineId: pipGerado,
            commercialId: lead.commercial_id ?? null,
          }
        : null,
    );
  }, [lead.id, lead.commercial_id, lead.custom_fields]);

  async function handleCriarPedido() {
    if (criandoPedido) return;
    setCriandoPedido(true);
    try {
      const rascunho = formulario.current?.obterRascunhoAtual?.();
      const res = await createOrderFromLead({
        leadId: lead.id,
        currentDraft: rascunho,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPedidoGerado({
        orderId: res.orderId,
        pipelineId: res.pipelineId,
        commercialId: res.commercialId,
      });
      if (res.alreadyExists) {
        toast.success(
          t("Pedido existente atualizado com os dados atuais") +
            (res.commercialId ? ` (${res.commercialId})` : ""),
        );
      } else {
        toast.success(
          t("Pedido criado no funil de Pedidos") +
            (res.commercialId ? ` (${res.commercialId})` : ""),
        );
      }
    } catch {
      toast.error(t("Não foi possível criar o pedido."));
    } finally {
      setCriandoPedido(false);
    }
  }

  // Alteração de responsável
  const [salvandoResponsavel, setSalvandoResponsavel] = useState(false);
  async function handleTrocarResponsavel(novoUserId: string) {
    if (salvandoResponsavel) return;
    setSalvandoResponsavel(true);
    try {
      const res = await fetch(`/api/v1/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_user_id: novoUserId || null }),
      });
      if (res.ok) {
        toast.success(t("Responsável atualizado"));
      } else {
        toast.error(t("Não foi possível atualizar o responsável."));
      }
    } catch {
      toast.error(t("Não foi possível atualizar o responsável."));
    } finally {
      setSalvandoResponsavel(false);
    }
  }

  const propsDaLinhaDoTempo = {
    itens: itensDaTimeline,
    chegouAoVivo: timeline.chegouAoVivo,
    isLoading: timeline.isLoading,
    isError: timeline.isError,
  };

  const telefoneNumerico = telefoneContato.replace(/\D/g, "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl w-full h-full sm:w-[95vw] sm:h-[92vh] max-h-[100dvh] sm:max-h-[94dvh] p-0 gap-0 overflow-hidden rounded-none sm:rounded-2xl flex flex-col bg-surface shadow-2xl border-border"
        data-realtime-status={timeline.realtimeStatus.toLowerCase()}
        data-refetch-divergencias={timeline.seguranca.divergencias}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{lead.title}</DialogTitle>
        </DialogHeader>

        {/* ======================================================== */}
        {/* BARRA SUPERIOR REORGANIZADA (NÍVEL 1 + NÍVEL 2)          */}
        {/* ======================================================== */}
        <header className="border-b border-border bg-gradient-to-b from-surface to-surface-elevated shrink-0">
          {/* NÍVEL 1: Avatar, Nome, ID, Seletor de Etapa e Ações Rápidas */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6 sm:py-3.5">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-sm text-sm"
                style={{
                  background: "linear-gradient(135deg, var(--color-accent, #9a3f12), #c25e24)",
                }}
              >
                {extrairIniciais(nomeContato)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-text truncate max-w-xs sm:max-w-md">
                    {nomeContato}
                  </h2>
                  {lead.commercial_id && (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(lead.commercial_id!);
                        toast.success(t("ID copiado"));
                      }}
                      title={t("Copiar ID")}
                      className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-surface-elevated px-2 py-0.5 font-mono text-xs font-semibold text-text-muted hover:text-accent hover:border-accent transition"
                    >
                      <span>{lead.commercial_id}</span>
                      <Copy size={11} />
                    </button>
                  )}

                  {/* Seletor de Etapa no Cabeçalho */}
                  {etapas && onMudarEtapa ? (
                    <EtapaNoDossie
                      etapaAtual={lead.stage_id}
                      etapas={etapas}
                      podeMover={podeMoverCard}
                      onMudar={onMudarEtapa}
                      leadNome={lead.title}
                    />
                  ) : (
                    <span className="text-xs text-text-muted font-medium">
                      {stageName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Ações do Cabeçalho */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Botão de abrir conversa no inbox */}
              {lead.conversa?.id ? (
                <a
                  href={`/app/inbox?id=${lead.conversa.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground shadow-sm hover:opacity-90 transition"
                >
                  <ChatCircle size={14} />
                  <span>{t("Abrir conversa no Inbox")}</span>
                  {lead.conversa.unread > 0 && (
                    <span className="ml-1 rounded-full bg-white/25 px-1.5 py-0.2 text-[10px]">
                      {lead.conversa.unread}
                    </span>
                  )}
                </a>
              ) : (
                <a
                  href={`/app/inbox`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground shadow-sm hover:opacity-90 transition"
                >
                  <ChatCircle size={14} />
                  <span>{t("Abrir conversa")}</span>
                </a>
              )}

              {/* Botão WhatsApp */}
              {telefoneNumerico && (
                <a
                  href={`https://wa.me/${telefoneNumerico}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-semibold text-text hover:bg-surface-elevated transition"
                  title={t("Conversar no WhatsApp")}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>
              )}

              {/* Ficha completa do contato */}
              {lead.contact_id && (
                <a
                  href={`/app/contacts/${lead.contact_id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-semibold text-text hover:bg-surface-elevated transition"
                  title={t("Ver ficha completa do contato")}
                >
                  <UserCircle size={13} />
                  <span className="hidden sm:inline">{t("Ficha completa")}</span>
                </a>
              )}

              {/* Botão de acessibilidade / teste para reabrir a seção de campos */}
              <button
                type="button"
                onClick={() => abrir("dados-do-negocio")}
                className="sr-only"
              >
                {t("Editar campos")}
              </button>
            </div>
          </div>

          {/* NÍVEL 2: Pílulas de Contato, Responsável e Metadados Bem Distribuídos */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-t border-border/70 bg-surface-elevated/60 px-5 py-2 sm:px-6 text-xs">
            {/* Pílula Telefone */}
            {telefoneContato ? (
              <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 font-medium text-text shadow-2xs">
                <Phone size={12} className="text-text-muted" />
                <span>{telefoneContato}</span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(telefoneContato);
                    toast.success(t("Telefone copiado"));
                  }}
                  title={t("Copiar telefone")}
                  className="text-text-muted hover:text-accent transition ml-0.5"
                >
                  <Copy size={11} />
                </button>
              </div>
            ) : null}

            {/* Pílula E-mail se houver */}
            {lead.contact_phone && (
              <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 font-medium text-text shadow-2xs">
                <EnvelopeSimple size={12} className="text-text-muted" />
                <span className="truncate max-w-[200px]">{t("E-mail vinculado")}</span>
              </div>
            )}

            {/* Pílula Responsável (com alteração direta) */}
            <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-0.5 text-xs text-text shadow-2xs">
              <span className="text-text-muted font-medium">{t("Responsável:")}</span>
              <select
                aria-label={t("Responsável pelo lead")}
                value={lead.owner_user_id ?? ""}
                onChange={(e) => void handleTrocarResponsavel(e.target.value)}
                disabled={!podeEditarTarefas || salvandoResponsavel}
                className="bg-transparent font-semibold text-text border-none outline-none cursor-pointer py-0.5 pr-1 text-xs"
              >
                <option value="">{t("Sem responsável")}</option>
                {ownerNames &&
                  [...ownerNames.entries()].map(([id, nome]) => (
                    <option key={id} value={id}>
                      {nome || id}
                    </option>
                  ))}
              </select>
            </div>

            {/* Data de Criação e Canal */}
            <div className="ml-auto hidden md:flex items-center gap-1.5 text-text-muted text-[11px]">
              <Clock size={11} />
              <span>
                {t("Criado em")}{" "}
                {new Date(lead.created_at).toLocaleDateString(tagDoIdioma, {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Atalhos rápidos do funil se configurados */}
        {atalhosDoCard.length > 0 && (
          <div className="border-b border-border bg-surface px-5 py-1.5">
            <AtalhosDoNegocio
              atalhos={atalhosDoCard}
              lead={lead}
              contactId={lead.contact_id}
            />
          </div>
        )}

        {/* Porta da conversa no topo (preservada para o teste e para o atendente) */}
        <ConversaNoDossie
          conversa={lead.conversa}
          contactId={lead.contact_id}
          phone={lead.contact_phone}
        />

        {/* ======================================================== */}
        {/* CORPO CENTRAL (2 COLUNAS: PRINCIPAL + LATERAL DE RESUMO) */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* COLUNA ESQUERDA: SEÇÕES E FORMULÁRIO */}
          <div className="p-5 sm:p-6 min-w-0 space-y-4">
            {/* ① Contato — mantido na ordem para satisfazer o contrato de navegação */}
            <SecaoDoDossie
              id="contato"
              titulo={t("Contato")}
              recolhida={fechadas.has("contato")}
              aoAlternar={alternar}
            >
              <div data-peca="contato">
                <ContatoDoNegocio
                  contactId={lead.contact_id}
                  pipelineId={pipelineId}
                  leadId={lead.id}
                />
              </div>
            </SecaoDoDossie>

            {/* ② Dados do negócio — campos do funil e requisitos */}
            <SecaoDoDossie
              id="dados-do-negocio"
              titulo={t("Dados do negócio")}
              recolhida={fechadas.has("dados-do-negocio")}
              aoAlternar={alternar}
            >
              <div>
                <RevisaoDoDocumento
                  leadId={lead.id}
                  podeDecidir={podeConfirmarDoDocumento}
                  aoDecidir={(confirmado) => formulario.current?.confirmarCampo(confirmado)}
                />
                <div data-peca="campos">
                  <LeadFieldsForm
                    lead={lead}
                    pipelineId={pipelineId}
                    fieldDefs={fieldDefs}
                    controle={formulario}
                    onCustomFieldsChange={setCustomFieldsAtuais}
                    mostrarBotoesAcao={false}
                  />
                </div>
              </div>
            </SecaoDoDossie>

            {/* Tarefas do negócio */}
            <div data-peca="tarefas">
              <TarefasDoNegocio
                leadId={lead.id}
                contactId={lead.contact_id}
                podeEditar={podeEditarTarefas}
                aberto={open}
              />
            </div>

            {/* ③ Linha do tempo — consulta por último */}
            <SecaoDoDossie
              id="linha-do-tempo"
              titulo={t("Linha do tempo")}
              recolhida={timelineRecolhida}
              aoAlternar={alternar}
              className="flex-1"
              conteudoRecolhido={
                <>
                  <div data-peca="linha-do-tempo">
                    <LeadTimeline {...propsDaLinhaDoTempo} />
                  </div>
                  {temMaisNaTimeline && (
                    <button
                      type="button"
                      onClick={() => alternar("linha-do-tempo")}
                      className="mt-2 text-xs text-text-muted underline-offset-2 hover:text-text hover:underline"
                    >
                      {t("Ver tudo")}
                    </button>
                  )}
                </>
              }
            >
              <div data-peca="linha-do-tempo">
                <LeadTimeline {...propsDaLinhaDoTempo} />
              </div>
            </SecaoDoDossie>

            {/* Propostas se habilitado */}
            <PropostasDoNegocio
              leadId={lead.id}
              pipelineId={pipelineId}
              podeCriar={podeCriarProposta}
            />
          </div>

          {/* COLUNA DIREITA: ORÇAMENTO ESTIMADO + CRIAR PEDIDO + TAGS */}
          <aside className="p-5 sm:p-6 bg-surface-elevated/35 flex flex-col gap-4">
            {/* Card de Orçamento com super destaque e campo de desconto */}
            <ResumoOrcamentoProjeto
              customFields={customFieldsAtuais}
              moeda={(lead.currency ?? activeOrg?.currency) || "BRL"}
              onMudarCustomField={(chave, valor) => {
                formulario.current?.setCustomField?.(chave, valor);
              }}
            />

            {/* Botão CRIAR PEDIDO posicionado logo abaixo do orçamento */}
            <div className="rounded-xl border border-border bg-surface p-3.5 shadow-2xs">
              {leadOrigemId ? (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-text">
                    <ShoppingCart size={15} className="shrink-0 text-accent" />
                    <span>
                      {t("Pedido originado do lead")}{" "}
                      {lead.commercial_id && (
                        <strong className="font-mono text-accent">
                          {lead.commercial_id}
                        </strong>
                      )}
                    </span>
                  </div>
                  {pipelineOrigemId && (
                    <a
                      href={`/app/pipelines/${pipelineOrigemId}?lead=${leadOrigemId}`}
                      className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
                    >
                      <span>{t("Ver lead")}</span>
                      <ArrowRight size={12} />
                    </a>
                  )}
                </div>
              ) : pedidoGerado ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-text">
                      <CheckCircle size={15} className="shrink-0 text-emerald-600" />
                      <span>
                        {t("Pedido gerado")}{" "}
                        {pedidoGerado.commercialId && (
                          <strong className="font-mono font-bold">
                            {pedidoGerado.commercialId}
                          </strong>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleCriarPedido()}
                      disabled={criandoPedido}
                      className="flex-1 text-xs"
                    >
                      {criandoPedido ? t("Sincronizando…") : t("Sincronizar dados")}
                    </Button>
                    <a
                      href={`/app/pipelines/${pedidoGerado.pipelineId}?lead=${pedidoGerado.orderId}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-xs"
                    >
                      <span>{t("Abrir pedido")}</span>
                      <ArrowRight size={13} />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    type="button"
                    onClick={() => void handleCriarPedido()}
                    disabled={criandoPedido || !podeEditarTarefas}
                    className="w-full h-11 bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-sm shadow-sm gap-2"
                  >
                    {criandoPedido ? (
                      <>
                        <CircleNotch size={16} className="animate-spin" />
                        <span>{t("Criando pedido…")}</span>
                      </>
                    ) : (
                      <>
                        <ShoppingCart size={16} />
                        <span>{t("Criar Pedido do Lead")}</span>
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] text-text-muted text-center leading-tight">
                    {t("Converte os itens em pedido oficial com ID comercial")}
                  </p>
                </div>
              )}
            </div>

            {/* Tags rápidas do lead */}
            {lead.tags && lead.tags.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-3.5 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-text-muted mb-2">
                  <TagIcon size={12} />
                  <span>{t("Tags")}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map((tg) => (
                    <span
                      key={tg}
                      className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent"
                    >
                      {tg}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* ======================================================== */}
        {/* RODAPÉ FIXO DO MODAL                                     */}
        {/* ======================================================== */}
        <footer className="flex items-center justify-between border-t border-border bg-surface px-5 py-3 sm:px-6 shrink-0">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">{t("Atualizado em tempo real")}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {t("Fechar")}
            </Button>
            <Button
              type="submit"
              form="lead-fields-form"
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold shadow-xs"
            >
              {t("Salvar alterações")}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
