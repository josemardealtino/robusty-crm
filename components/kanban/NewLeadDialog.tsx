"use client";

import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateLead } from "@/hooks/kanban/useCreateLead";
import type { RespostaCriacaoDeLead } from "@/hooks/kanban/useCreateLead";
import type { Stage } from "@/lib/kanban/types";
import {
  AVISO_NEGOCIO_ABERTO_EXISTENTE,
  negocioAbertoNoQuadro,
  type NegocioAbertoExistente,
} from "@/lib/leads/negocio-aberto-duplicado";
import type { Lead } from "@/lib/types/leads";
import { validaCamposExigidos } from "@/lib/leads/campos-exigidos";
import { lerRecorrenciaDoFormulario } from "@/lib/leads/valor-recorrente";
import { CustomFieldsEditor } from "@/components/contacts/CustomFieldsEditor";
import { camposVisiveis } from "@/lib/schemas/mostrar-quando";
import type { CustomFieldDef, NewLeadFormFieldConfig } from "@/lib/schemas/settings";
import { formatCents, MOEDA_PADRAO, parseReaisToCents, simboloDaMoeda } from "@/lib/money";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import type { Contact } from "@/lib/types/contacts";
import { AbrirConversaAposSalvar } from "@/components/channels/AbrirConversaAposSalvar";
import type { AlvoDeConversa } from "@/components/channels/SeletorDeCanalParaConversa";
import { EcoDoValor } from "./EcoDoValor";
import { SeletorDeContato } from "./SeletorDeContato";
import {
  Gear,
  CaretUp,
  CaretDown,
  Eye,
  EyeSlash,
  Phone,
  EnvelopeSimple,
  UserCircle,
  X,
} from "@/lib/ui/icons";
import {
  CAMPOS_PADRAO_DISPONIVEIS,
  obterListaOrdenadaDeCampos,
} from "@/app/app/settings/tenant/pipelines/_new-lead-form";
import { updatePipelineConfig } from "@/app/actions/settings/updatePipelineConfig";
import { ResumoOrcamentoProjeto } from "./ResumoOrcamentoProjeto";
import { calcularOrcamentoProjeto } from "@/lib/robusty/catalogo";
import { mesclarCamposDoPerfil } from "@/lib/leads/campos-do-perfil";

interface FormShape {
  title: string;
  description: string;
  stage_id: string;
  valueReais: string;
  valorRecorrenteReais: string;
  recorrenciaMeses: string;
  expected_close_date: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelineId: string;
  stages: Stage[];
  /** Vincula o lead criado a este contato de origem (ex.: painel do Inbox). */
  contactId?: string | null;
  /** Depois do INSERT — o inbox relê o resumo para o lead novo aparecer no formulário. */
  onCreated?: () => void;
  /**
   * Negócios do funil, para a pergunta de duplicidade ANTES de criar (#1751).
   */
  leads?: Lead[];
  /**
   * `crm_pipelines.settings` do funil — dele saem os campos que a ETAPA exige
   * (issue #3038).
   */
  settings?: Record<string, unknown> | null;
}

function defaultStageId(stages: Stage[]): string {
  const open = stages.find((s) => !s.is_won && !s.is_lost && !s.is_archived);
  return open?.id ?? stages[0]?.id ?? "";
}

function extrairIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}

export function NewLeadDialog({
  open,
  onOpenChange,
  pipelineId,
  stages,
  contactId,
  leads,
  settings,
  onCreated,
}: Props) {
  const t = useT();
  const org = useActiveOrg();
  const moedaDoValor = org?.currency ?? MOEDA_PADRAO;
  const create = useCreateLead(pipelineId);

  const [conversaAoCriar, setConversaAoCriar] = useState<AlvoDeConversa | null>(null);
  const initialStage = useMemo(() => defaultStageId(stages), [stages]);

  const [contato, setContato] = useState<Contact | null>(null);
  const [telefoneContato, setTelefoneContato] = useState("");
  const [emailContato, setEmailContato] = useState("");

  const [camposDoNegocio, setCamposDoNegocio] = useState<Record<string, unknown>>({});

  const [aviso, setAviso] = useState<{
    existente: NegocioAbertoExistente;
    valores: FormShape;
    abrir: boolean;
  } | null>(null);

  const [estavaAberto, setEstavaAberto] = useState(open);
  if (open !== estavaAberto) {
    setEstavaAberto(open);
    if (!open) {
      setContato(null);
      setTelefoneContato("");
      setEmailContato("");
      setAviso(null);
      setCamposDoNegocio({});
    }
  }

  const form = useForm<FormShape>({
    defaultValues: {
      title: "",
      description: "",
      stage_id: initialStage,
      valueReais: "",
      valorRecorrenteReais: "",
      recorrenciaMeses: "",
      expected_close_date: "",
    },
  });

  useEffect(() => {
    if (!form.getValues("stage_id") && initialStage) {
      form.setValue("stage_id", initialStage);
    }
  }, [initialStage, form]);

  const stageId = form.watch("stage_id");


  const [customizandoCampos, setCustomizandoCampos] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [localFormConfig, setLocalFormConfig] = useState<NewLeadFormFieldConfig[] | null>(() => {
    return (settings?.new_lead_form as { fields?: NewLeadFormFieldConfig[] } | undefined)?.fields ?? null;
  });

  useEffect(() => {
    if (settings?.new_lead_form) {
      setLocalFormConfig((settings.new_lead_form as { fields?: NewLeadFormFieldConfig[] }).fields ?? null);
    }
  }, [settings]);

  const activeFormConfig = localFormConfig ?? (settings?.new_lead_form as { fields?: NewLeadFormFieldConfig[] } | undefined)?.fields;

  const todosCamposPersonalizados = useMemo(() => {
    const fields = (settings?.fields as CustomFieldDef[] | undefined) ?? [];
    return fields.filter(
      (f) => f.escopo !== "contato" && f.key !== "tipo_de_acessorio" && f.key !== "tags",
    );
  }, [settings]);

  const camposMesclados = useMemo(() => {
    return mesclarCamposDoPerfil(todosCamposPersonalizados, camposDoNegocio);
  }, [todosCamposPersonalizados, camposDoNegocio]);

  const chavesVisiveisPorCondicao = useMemo(
    () => new Set(camposVisiveis(camposMesclados, camposDoNegocio).map((c) => c.key)),
    [camposMesclados, camposDoNegocio],
  );

  const camposQualificacaoVisiveis = useMemo(() => {
    return camposMesclados.filter((c) => chavesVisiveisPorCondicao.has(c.key));
  }, [camposMesclados, chavesVisiveisPorCondicao]);

  const orcamento = useMemo(() => {
    return calcularOrcamentoProjeto(camposDoNegocio);
  }, [camposDoNegocio]);

  // Lista ordenada consolidada de campos para personalização de visibilidade
  const camposOrdenados = useMemo(
    () => obterListaOrdenadaDeCampos(activeFormConfig, todosCamposPersonalizados),
    [activeFormConfig, todosCamposPersonalizados],
  );

  const [rascunhoCampos, setRascunhoCampos] = useState<NewLeadFormFieldConfig[]>([]);

  function iniciarCustomizacao() {
    setRascunhoCampos([...camposOrdenados]);
    setCustomizandoCampos(true);
  }

  function alternarRascunho(index: number) {
    setRascunhoCampos((prev) =>
      prev.map((c, i) => (i === index ? { ...c, visible: !c.visible } : c)),
    );
  }

  function moverRascunho(index: number, direcao: "cima" | "baixo") {
    setRascunhoCampos((prev) => {
      const target = direcao === "cima" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index]!;
      copy[index] = copy[target]!;
      copy[target] = temp;
      return copy;
    });
  }

  function marcarTodosRascunho(visivel: boolean) {
    setRascunhoCampos((prev) => prev.map((c) => ({ ...c, visible: visivel })));
  }

  async function salvarCustomizacao() {
    setSalvandoConfig(true);
    try {
      const res = await updatePipelineConfig(pipelineId, {
        new_lead_form: { fields: rascunhoCampos },
      });

      if (!res.ok) {
        toast.error(t("Erro ao salvar configuração dos campos"));
        return;
      }

      setLocalFormConfig(rascunhoCampos);
      setCustomizandoCampos(false);
      toast.success(t("Campos e ordem do formulário salvos com sucesso!"));
    } finally {
      setSalvandoConfig(false);
    }
  }

  const faltandoNaEtapa = useMemo(
    () =>
      validaCamposExigidos({
        lead: { custom_fields: camposDoNegocio },
        settingsDoFunil: settings,
        destino: { stageId, desfecho: null },
        motivoDeGanho: null,
        semAnexosAinda: true,
      }).faltando,
    [settings, stageId, camposDoNegocio],
  );

  async function onSubmit(values: FormShape) {
    await perguntarAntesDeGravar(values, false);
  }

  async function onSubmitIniciandoConversa(values: FormShape) {
    await perguntarAntesDeGravar(values, true);
  }

  async function perguntarAntesDeGravar(values: FormShape, abrir: boolean) {
    const idDoContato = contactId ?? contato?.id ?? null;
    const existente = negocioAbertoNoQuadro(leads ?? [], {
      pipelineId,
      contactId: idDoContato,
    });
    if (existente) {
      setAviso({ existente, valores: values, abrir });
      return;
    }
    await gravar(values, false, abrir);
  }

  async function confirmarAviso() {
    if (!aviso) return;
    const { valores, abrir } = aviso;
    setAviso(null);
    await gravar(valores, true, abrir);
  }

  async function gravar(values: FormShape, avisoJaMostrado: boolean, abrir: boolean) {
    if (faltandoNaEtapa.length > 0) return;

    const reais = values.valueReais.trim();
    let valueCents: number | null = null;
    if (reais.length > 0) {
      valueCents = parseReaisToCents(reais, moedaDoValor);
      if (valueCents === null) {
        form.setError("valueReais", { message: t("Valor inválido") });
        return;
      }
    }

    const leitura = lerRecorrenciaDoFormulario(
      values.valorRecorrenteReais,
      values.recorrenciaMeses,
      moedaDoValor,
    );
    if (!leitura.ok) {
      form.setError(leitura.campo === "valor" ? "valorRecorrenteReais" : "recorrenciaMeses", {
        message:
          leitura.motivo === "valor_invalido"
            ? t("Valor inválido")
            : leitura.motivo === "duracao_invalida"
              ? t("Duração inválida")
              : t("Informe a mensalidade para usar a duração"),
      });
      return;
    }

    let leadTitle = values.title?.trim() || "";
    if (!leadTitle) {
      if (contato) {
        leadTitle = rotuloDoContato(contato, t);
      }
      if (!leadTitle || leadTitle.length < 2) {
        const dataAtual = new Date().toLocaleDateString("pt-BR");
        leadTitle = `Lead ${dataAtual}`;
      }
    }

    let idDoContato = contactId ?? contato?.id ?? null;

    // Se o telefone foi digitado diretamente na tela de criação e ainda não há contato vinculado,
    // cria ou localiza o contato pelo telefone na organização.
    if (!idDoContato && telefoneContato.trim()) {
      try {
        const res = await fetch("/api/v1/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: leadTitle,
            phone_number: telefoneContato.trim(),
            email: emailContato.trim() || undefined,
          }),
        });
        const json = await res.json();
        if (res.ok && json?.data?.contact?.id) {
          idDoContato = json.data.contact.id;
        } else if (
          res.status === 409 &&
          (json?.error?.details?.contact_id || json?.error?.contact_id)
        ) {
          idDoContato = json.error.details?.contact_id || json.error.contact_id;
        }
      } catch {
        // segue com criação normal se requisição falhar
      }
    }

    const payload: Record<string, unknown> = {
      pipeline_id: pipelineId,
      stage_id: values.stage_id || initialStage,
      title: leadTitle,
      source: "manual",
      tags: [],
    };
    if (idDoContato) payload.contact_id = idDoContato;
    if (values.description?.trim()) payload.description = values.description.trim();

    const valueCentsFinal =
      valueCents ?? (orcamento.total_geral_cents > 0 ? orcamento.total_geral_cents : null);
    if (valueCentsFinal !== null) payload.value_cents = valueCentsFinal;

    if (leitura.trio.recurring_value_cents !== null) {
      payload.recurring_value_cents = leitura.trio.recurring_value_cents;
      payload.recurring_period = leitura.trio.recurring_period;
      if (leitura.trio.recurring_months !== null) {
        payload.recurring_months = leitura.trio.recurring_months;
      }
    }
    if (values.expected_close_date) payload.expected_close_date = values.expected_close_date;
    if (Object.keys(camposDoNegocio).length > 0) payload.custom_fields = camposDoNegocio;

    const parsed = createLeadSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? t("Dados inválidos"));
      return;
    }

    try {
      const resposta = await create.mutateAsync(parsed.data as CreateLeadInput);
      const meta = (resposta as RespostaCriacaoDeLead | null | undefined)?.meta;
      const avisos = meta?.avisos ?? [];
      if (!avisoJaMostrado && avisos.includes(AVISO_NEGOCIO_ABERTO_EXISTENTE)) {
        const existente = meta?.negocio_aberto_existente;
        toast.warning(t("Este contato já tem um negócio aberto neste funil."), {
          description: existente ? (
            <a
              href={`/app/pipelines/${pipelineId}?lead=${existente.id}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {existente.title}
            </a>
          ) : undefined,
        });
      }

      toast.success(t("Negócio criado"));
      onCreated?.();
      form.reset({
        title: "",
        description: "",
        stage_id: initialStage,
        valueReais: "",
        valorRecorrenteReais: "",
        recorrenciaMeses: "",
        expected_close_date: "",
      });
      setContato(null);
      setTelefoneContato("");
      setEmailContato("");
      setAviso(null);
      setCamposDoNegocio({});
      onOpenChange(false);
    } catch {
      return;
    }

    if (!abrir || !idDoContato) return;
    setConversaAoCriar({ contact_id: idDoContato });
  }

  const semTelefoneNoContato = Boolean(contato) && !contato?.phone_number?.trim();
  const faltaContato = !contactId && !contato && !telefoneContato.trim();
  const podeIniciarConversa = !faltaContato && !semTelefoneNoContato;
  const motivoSemConversa = faltaContato
    ? t("Escolha um contato para abrir a conversa.")
    : semTelefoneNoContato
      ? t("Sem telefone no contato: cadastre um telefone para abrir a conversa.")
      : null;

  function escolherContato(escolhido: Contact | null) {
    setContato(escolhido);
    if (escolhido) {
      if (!form.getValues("title").trim()) {
        form.setValue("title", rotuloDoContato(escolhido, t));
      }
      if (escolhido.phone_number) {
        setTelefoneContato(escolhido.phone_number);
      }
      if (escolhido.email) {
        setEmailContato(escolhido.email);
      }
    }
  }

  const tituloAtual = form.watch("title");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          customizandoCampos
            ? "w-full sm:max-w-xl md:max-w-2xl max-h-[85vh] overflow-y-auto p-5 sm:p-6"
            : "max-w-6xl w-full h-full sm:w-[95vw] sm:h-[92vh] max-h-[100dvh] sm:max-h-[94dvh] p-0 gap-0 overflow-hidden rounded-none sm:rounded-2xl flex flex-col bg-surface shadow-2xl border-border"
        }
      >
        <DialogHeader className={customizandoCampos ? "" : "sr-only"}>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {customizandoCampos
                ? t("Personalizar campos deste formulário")
                : t("Novo negócio")}
            </DialogTitle>
            {customizandoCampos && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 cursor-pointer"
                onClick={() => setCustomizandoCampos(false)}
              >
                <Gear size={13} />
                <span>{t("Voltar ao formulário")}</span>
              </Button>
            )}
          </div>
          <DialogDescription>
            {customizandoCampos
              ? t("Selecione quais campos devem aparecer ao cadastrar um novo lead neste funil.")
              : t("Abra um negócio para um contato neste funil.")}
          </DialogDescription>
        </DialogHeader>

        {customizandoCampos ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("Use as setas para alterar a ordem e selecione para exibir ou ocultar:")}</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => marcarTodosRascunho(true)}
                >
                  {t("Marcar todos")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => marcarTodosRascunho(false)}
                >
                  {t("Desmarcar todos")}
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
              {rascunhoCampos.map((campo, idx) => {
                const ativo = campo.visible;
                const padrao = CAMPOS_PADRAO_DISPONIVEIS.find((p) => p.key === campo.key);
                const cp = !campo.is_standard
                  ? todosCamposPersonalizados.find((c) => c.key === campo.key)
                  : null;

                return (
                  <div
                    key={campo.key}
                    className={`flex items-center justify-between gap-3 rounded-md border p-2.5 transition-colors ${
                      ativo
                        ? "border-accent/40 bg-accent/5"
                        : "border-border bg-background opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moverRascunho(idx, "cima")}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                          title={t("Mover para cima")}
                        >
                          <CaretUp size={14} weight="bold" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === rascunhoCampos.length - 1}
                          onClick={() => moverRascunho(idx, "baixo")}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                          title={t("Mover para baixo")}
                        >
                          <CaretDown size={14} weight="bold" />
                        </button>
                      </div>

                      <span className="text-xs font-mono font-medium text-muted-foreground w-6 text-center shrink-0">
                        #{idx + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {campo.label}
                          </span>
                          {campo.is_standard ? (
                            <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {t("Padrão")}
                            </span>
                          ) : (
                            <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                              {cp?.type ?? t("Personalizado")}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {padrao?.dica ?? `chave: ${campo.key}`}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => alternarRascunho(idx)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                        ativo
                          ? "bg-accent text-accent-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {ativo ? <Eye size={13} /> : <EyeSlash size={13} />}
                      <span>{ativo ? t("Visível") : t("Oculto")}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="pt-3 border-t border-border flex justify-between sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setCustomizandoCampos(false)}>
                {t("Cancelar")}
              </Button>
              <Button
                type="button"
                onClick={() => void salvarCustomizacao()}
                disabled={salvandoConfig}
              >
                {salvandoConfig ? t("Salvando…") : t("Salvar e aplicar campos")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
            {/* ======================================================== */}
            {/* CABEÇALHO UNIFICADO DO DOSSIÊ (NÍVEL 1 + NÍVEL 2)         */}
            {/* ======================================================== */}
            <header className="border-b border-border bg-gradient-to-b from-surface to-surface-elevated shrink-0">
              {/* NÍVEL 1: Avatar, Título / Nome, Seletor de Etapa e Personalização */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6 sm:py-3.5 pr-14 sm:pr-16">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-sm text-sm"
                    style={{
                      background: "linear-gradient(135deg, var(--color-accent, #9a3f12), #c25e24)",
                    }}
                  >
                    {extrairIniciais(tituloAtual || t("Novo"))}
                  </div>
                  <div className="min-w-0 flex-1 max-w-md">
                    <Label htmlFor="title" className="text-xs font-semibold text-text-muted mb-1 block">
                      {t("Título")}
                    </Label>
                    <Input
                      id="title"
                      placeholder={t("Nome do cliente ou título")}
                      className="h-9 text-sm font-semibold"
                      {...form.register("title", {
                        required: true,
                        minLength: 2,
                      })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="stage_id_select" className="text-xs font-medium text-text-muted shrink-0">
                      {t("Etapa:")}
                    </Label>
                    <Select
                      value={stageId}
                      onValueChange={(v) => form.setValue("stage_id", v)}
                    >
                      <SelectTrigger id="stage_id_select" className="h-9 text-xs min-w-[130px]">
                        <SelectValue placeholder={t("Selecione a etapa")} />
                      </SelectTrigger>
                      <SelectContent>
                        {stages
                          .filter((s) => !s.is_archived)
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs gap-1.5 cursor-pointer"
                    onClick={iniciarCustomizacao}
                    title={t("Personalizar campos")}
                  >
                    <Gear size={13} />
                    <span className="hidden sm:inline">{t("Personalizar campos")}</span>
                  </Button>
                </div>
              </div>

              {/* NÍVEL 2: Telefone, E-mail e Contato Vinculado */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-t border-border/70 bg-surface-elevated/60 px-5 py-2 sm:px-6 text-xs">
                {/* Pílula / Input Telefone */}
                <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs shadow-2xs">
                  <Phone size={12} className="text-accent shrink-0" />
                  <Label htmlFor="telefoneContato" className="text-text-muted font-medium cursor-pointer">
                    {t("Telefone")}
                  </Label>
                  <Input
                    id="telefoneContato"
                    placeholder="(11) 98765-4321"
                    value={telefoneContato}
                    onChange={(e) => setTelefoneContato(e.target.value)}
                    className="h-6 w-36 px-1.5 text-xs font-medium"
                  />
                </div>

                {/* Pílula / Input E-mail */}
                <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs shadow-2xs">
                  <EnvelopeSimple size={12} className="text-text-muted shrink-0" />
                  <Label htmlFor="emailContato" className="text-text-muted font-medium cursor-pointer">
                    {t("E-mail")}
                  </Label>
                  <Input
                    id="emailContato"
                    placeholder="email@exemplo.com"
                    value={emailContato}
                    onChange={(e) => setEmailContato(e.target.value)}
                    className="h-6 w-44 px-1.5 text-xs font-medium"
                  />
                </div>

                {/* Pílula Contato Vinculado (se selecionado na busca) */}
                {contato && (
                  <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300 shadow-2xs">
                    <UserCircle size={13} className="shrink-0" />
                    <span>{rotuloDoContato(contato, t)}</span>
                    <button
                      type="button"
                      onClick={() => escolherContato(null)}
                      className="text-text-muted hover:text-text p-0.5 cursor-pointer"
                      title={t("Trocar contato")}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* ======================================================== */}
            {/* CORPO CENTRAL (2 COLUNAS: ESQUERDA ROLÁVEL + LATERAL)    */}
            {/* ======================================================== */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
              {/* COLUNA ESQUERDA: FORMULÁRIO ROLÁVEL */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 min-w-0 space-y-4 pb-20 lg:pb-6">
                {/* Seletor de Contato da base (para pesquisar contato existente ou criar) */}
                {!contactId && !contato && (
                  <div className="rounded-xl border border-border bg-surface/70 p-3.5 space-y-2">
                    <SeletorDeContato escolhido={contato} onEscolher={escolherContato} />
                    {faltaContato && (
                      <p className="text-xs text-muted-foreground">
                        {t("Sem contato, este negócio não recebe WhatsApp nem entra nas automações.")}
                      </p>
                    )}
                  </div>
                )}

                {/* Bloco de Qualificação Comercial / Dados do Negócio */}
                <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="border-b border-border pb-2.5">
                    <h3 className="text-sm font-bold text-text uppercase tracking-wider">
                      {t("Dados do negócio")}
                    </h3>
                    <p className="text-xs text-text-muted">
                      {t("Qualificação comercial, veículo e produtos de interesse.")}
                    </p>
                  </div>

                  {/* Campos do dossiê ordenados e reativos */}
                  <CustomFieldsEditor
                    fields={camposQualificacaoVisiveis}
                    value={camposDoNegocio}
                    onChange={setCamposDoNegocio}
                    mode="lead"
                    className="space-y-3"
                  />

                  {/* Observações / Detalhes da necessidade */}
                  <div className="space-y-2 pt-3 border-t border-border">
                    <Label htmlFor="description" className="text-xs font-semibold text-text">
                      {t("Descrição")}
                    </Label>
                    <Textarea
                      id="description"
                      rows={3}
                      placeholder={t("Observações, requisitos específicos do cliente, preferências de entrega…")}
                      className="text-sm leading-relaxed"
                      {...form.register("description")}
                    />
                  </div>

                  {/* Valor único e fechamento previsto */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border">
                    <div className="space-y-2">
                      <Label htmlFor="valueReais" className="text-xs font-semibold text-text">
                        {t("Valor")} ({simboloDaMoeda(moedaDoValor)})
                      </Label>
                      <Input
                        id="valueReais"
                        inputMode="decimal"
                        placeholder="0,00"
                        {...form.register("valueReais")}
                      />
                      <EcoDoValor control={form.control} moeda={moedaDoValor} />
                      {form.formState.errors.valueReais && (
                        <p className="text-xs text-error-fg">
                          {form.formState.errors.valueReais.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expected_close_date" className="text-xs font-semibold text-text">
                        {t("Fechamento previsto")}
                      </Label>
                      <Input
                        id="expected_close_date"
                        type="date"
                        {...form.register("expected_close_date")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUNA DIREITA: ESTIMATIVA DE ORÇAMENTO + AÇÕES */}
              <aside className="w-full lg:w-[390px] xl:w-[410px] shrink-0 bg-surface-elevated/35 p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto">
                {/* Resumo do Orçamento com catálogo Robusty */}
                <ResumoOrcamentoProjeto
                  customFields={camposDoNegocio}
                  moeda={moedaDoValor}
                  onAtualizarValorTotal={(totalCents) => {
                    form.setValue("valueReais", (totalCents / 100).toFixed(2).replace(".", ","));
                  }}
                  onMudarCustomField={(chave, valor) => {
                    setCamposDoNegocio((prev) => ({ ...prev, [chave]: valor }));
                  }}
                />

                {/* Alerta de campos exigidos pela etapa */}
                {faltandoNaEtapa.length > 0 && (
                  <p
                    role="alert"
                    className="text-xs text-error-fg bg-error-bg/10 border border-error-border p-2.5 rounded-lg"
                  >
                    {t("Preencha os campos obrigatórios antes de continuar: {campos}.").replace(
                      "{campos}",
                      faltandoNaEtapa.map((campo) => campo.rotulo).join(", "),
                    )}
                  </p>
                )}

                {/* Aviso sem bloqueio (#1751) */}
                {aviso && (
                  <div
                    role="alert"
                    className="rounded-md border border-amber-300 bg-amber-100 p-3 text-sm text-amber-950"
                  >
                    <p className="font-medium">
                      {t("Este contato já tem um lead aberto neste funil.")}
                    </p>
                    <p className="mt-1">{t("Abrir mesmo assim?")}</p>
                    <a
                      href={`/app/pipelines/${pipelineId}?lead=${aviso.existente.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block underline"
                    >
                      {aviso.existente.title}
                    </a>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button type="button" variant="ghost" onClick={() => setAviso(null)}>
                        {t("Não criar")}
                      </Button>
                      <Button type="button" onClick={() => void confirmarAviso()}>
                        {t("Criar mesmo assim")}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Card de Ações de Criação */}
                <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs space-y-3">
                  <div className="flex items-baseline justify-between border-b border-border pb-2.5">
                    <span className="text-xs font-semibold text-text-muted">
                      {t("Total previsto")}
                    </span>
                    <span className="font-mono text-base font-bold text-accent">
                      {orcamento.total_geral_cents > 0
                        ? formatCents(orcamento.total_geral_cents, moedaDoValor)
                        : form.watch("valueReais")
                          ? `${simboloDaMoeda(moedaDoValor)} ${form.watch("valueReais")}`
                          : `${simboloDaMoeda(moedaDoValor)} 0,00`}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={create.isPending || !stageId || !podeIniciarConversa}
                      title={motivoSemConversa ?? undefined}
                      onClick={form.handleSubmit((values) =>
                        void onSubmitIniciandoConversa(values),
                      )}
                      className="w-full justify-center"
                    >
                      {t("Salvar e iniciar conversa")}
                    </Button>

                    <Button
                      type="submit"
                      disabled={create.isPending || !stageId}
                      className="w-full justify-center bg-accent text-white hover:bg-accent/90"
                    >
                      {create.isPending ? t("Criando…") : t("Criar negócio")}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onOpenChange(false)}
                      disabled={create.isPending}
                      className="w-full justify-center text-xs text-text-muted hover:text-text"
                    >
                      {t("Cancelar")}
                    </Button>
                  </div>
                </div>
              </aside>
            </div>
          </form>
        )}
      </DialogContent>

      {conversaAoCriar && <AbrirConversaAposSalvar alvo={conversaAoCriar} />}
    </Dialog>
  );
}
