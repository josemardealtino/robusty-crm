"use client";

import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { useEffect, useImperativeHandle, useMemo, useState, type Ref } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEditLead } from "@/hooks/kanban/useUpdateLead";
import type { Lead } from "@/lib/types/leads";
import { updateLeadSchema, type UpdateLeadInput } from "@/lib/schemas/leads";
import { MOEDA_PADRAO } from "@/lib/money";
import { mesclarCamposDoPerfil } from "@/lib/leads/campos-do-perfil";
import { soChavesAlteradas } from "@/lib/leads/custom-fields-so-diff";
import { CustomFieldsEditor, type CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";
import { lerRecorrenciaDoFormulario } from "@/lib/leads/valor-recorrente";
import type { CampoConfirmadoDoDocumento } from "./RevisaoDoDocumento";
import { calcularOrcamentoProjeto } from "@/lib/robusty/catalogo";

interface FormShape {
  title: string;
  detalhesDaNecessidade: string;
  valorRecorrenteReais: string;
  recorrenciaMeses: string;
  expected_close_date: string;
}

export interface RascunhoDosCamposDoNegocio {
  title: string;
  description: string | null;
  value_cents: number | null;
  recurring_value_cents: number | null;
  recurring_period: string | null;
  recurring_months: number | null;
  expected_close_date: string | null;
  custom_fields: Record<string, unknown>;
}

export interface ControleDosCamposDoNegocio {
  confirmarCampo: (confirmado: CampoConfirmadoDoDocumento) => void;
  obterRascunhoAtual?: () => RascunhoDosCamposDoNegocio;
  submeter?: () => void;
  customFields?: Record<string, unknown>;
  setCustomField?: (campo: string, valor: unknown) => void;
}

interface Props {
  lead: Lead;
  pipelineId: string;
  fieldDefs?: CustomFieldDef[];
  onSaved?: () => void;
  onCancel?: () => void;
  controle?: Ref<ControleDosCamposDoNegocio>;
  onCustomFieldsChange?: (cf: Record<string, unknown>) => void;
  mostrarBotoesAcao?: boolean;
}

function obterTextoUnificado(lead: Lead, cf: Record<string, unknown>): string {
  const desc = (lead.description ?? "").trim();
  const det = typeof cf.detalhes_da_necessidade === "string" ? cf.detalhes_da_necessidade.trim() : "";
  if (desc && det) {
    return desc === det ? desc : `${desc}\n\n${det}`;
  }
  return desc || det || "";
}

export function LeadFieldsForm({
  lead,
  pipelineId,
  fieldDefs = [],
  onSaved,
  onCancel,
  controle,
  onCustomFieldsChange,
  mostrarBotoesAcao = true,
}: Props) {
  const t = useT();
  const org = useActiveOrg();
  const moedaDoValor = lead.currency ?? org?.currency ?? MOEDA_PADRAO;
  const edit = useEditLead(pipelineId);

  const [customFields, setCustomFields] = useState<Record<string, unknown>>(
    lead.custom_fields ?? {},
  );
  const [camposCarregados, setCamposCarregados] = useState<Record<string, unknown>>(
    lead.custom_fields ?? {},
  );

  const form = useForm<FormShape>({
    defaultValues: {
      title: lead.title,
      detalhesDaNecessidade: obterTextoUnificado(lead, lead.custom_fields ?? {}),
      valorRecorrenteReais: "",
      recorrenciaMeses: "",
      expected_close_date: lead.expected_close_date ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      title: lead.title,
      detalhesDaNecessidade: obterTextoUnificado(lead, lead.custom_fields ?? {}),
      valorRecorrenteReais: "",
      recorrenciaMeses: "",
      expected_close_date: lead.expected_close_date ?? "",
    });
    setCustomFields(lead.custom_fields ?? {});
    setCamposCarregados(lead.custom_fields ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  function handleCustomFieldsChange(next: Record<string, unknown>) {
    setCustomFields(next);
    onCustomFieldsChange?.(next);
  }

  // Filtra detalhes_da_necessidade, valor_desconto e tipo_desconto para que não
  // apareçam duplicados nos campos gerais do CustomFieldsEditor.
  const camposDoPerfil = useMemo(() => {
    const mesclados = mesclarCamposDoPerfil(fieldDefs, customFields);
    return mesclados.filter(
      (c) =>
        c.key !== "detalhes_da_necessidade" &&
        c.key !== "valor_desconto" &&
        c.key !== "tipo_desconto",
    );
  }, [fieldDefs, customFields]);

  useImperativeHandle(
    controle,
    () => ({
      confirmarCampo(confirmacao) {
        if (confirmacao.leadId !== lead.id) return;
        const { campo, valor } = confirmacao;
        const next = { ...customFields, [campo]: valor };
        setCustomFields(next);
        setCamposCarregados(next);
        onCustomFieldsChange?.(next);
      },
      obterRascunhoAtual() {
        const vals = form.getValues();
        const textoObservacoes = vals.detalhesDaNecessidade.trim() || null;
        const orcamento = calcularOrcamentoProjeto(customFields);
        const valueCentsFinal =
          orcamento.total_geral_cents > 0
            ? orcamento.total_geral_cents
            : lead.value_cents ?? null;

        return {
          title: vals.title.trim() || lead.title,
          description: textoObservacoes,
          value_cents: valueCentsFinal,
          recurring_value_cents: lead.recurring_value_cents ?? null,
          recurring_period: lead.recurring_period === "monthly" ? "monthly" : null,
          recurring_months: lead.recurring_months ?? null,
          expected_close_date: vals.expected_close_date || null,
          custom_fields: {
            ...customFields,
            detalhes_da_necessidade: textoObservacoes,
          },
        };
      },
      submeter() {
        void form.handleSubmit(onSubmit)();
      },
      customFields,
      setCustomField(campo: string, valor: unknown) {
        const next = { ...customFields, [campo]: valor };
        setCustomFields(next);
        onCustomFieldsChange?.(next);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lead.id, lead.title, lead.recurring_value_cents, lead.recurring_period, lead.recurring_months, form, customFields],
  );

  async function onSubmit(values: FormShape) {
    const textoObservacoes = values.detalhesDaNecessidade.trim() || null;
    const orcamento = calcularOrcamentoProjeto(customFields);
    const valueCentsFinal =
      orcamento.total_geral_cents > 0
        ? orcamento.total_geral_cents
        : lead.value_cents ?? null;

    const cfParaGravar: Record<string, unknown> = {
      ...customFields,
      detalhes_da_necessidade: textoObservacoes,
    };

    const leitura = lerRecorrenciaDoFormulario(
      values.valorRecorrenteReais,
      values.recorrenciaMeses,
      moedaDoValor,
    );

    const patch: Record<string, unknown> = {
      title: values.title.trim() || lead.title,
      description: textoObservacoes,
      value_cents: valueCentsFinal,
      ...(leitura.ok
        ? leitura.trio
        : {
            recurring_value_cents: lead.recurring_value_cents ?? null,
            recurring_period: lead.recurring_period === "monthly" ? ("monthly" as const) : null,
            recurring_months: lead.recurring_months ?? null,
          }),
      expected_close_date: values.expected_close_date || null,
      custom_fields: soChavesAlteradas(camposCarregados, cfParaGravar),
    };

    const parsed = updateLeadSchema.safeParse(patch);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? t("Dados inválidos"));
      return;
    }

    try {
      await edit.mutateAsync({
        leadId: lead.id,
        patch: parsed.data as UpdateLeadInput,
      });
      setCamposCarregados({ ...cfParaGravar });
      toast.success(t("Negócio atualizado"));
      onSaved?.();
    } catch {
      // toast already shown
    }
  }

  return (
    <form
      id="lead-fields-form"
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-5"
    >
      {/* 1. Título do Negócio */}
      <div className="space-y-1.5">
        <Label htmlFor="title" className="text-xs font-bold text-text-muted uppercase tracking-wider">
          {t("Título do negócio")}
        </Label>
        <Input
          id="title"
          className="font-medium text-sm h-9"
          {...form.register("title", { required: true, minLength: 2 })}
        />
      </div>

      {/* 2. Campos do Funil (Veículo, Bagageiro, Acessórios em largura total, Modalidade, CEP, Endereço, etc.) */}
      {camposDoPerfil.length > 0 && (
        <div className="space-y-3 pt-1">
          <CustomFieldsEditor
            fields={camposDoPerfil}
            value={customFields}
            onChange={handleCustomFieldsChange}
            mode="lead"
            leadId={lead.id}
          />
        </div>
      )}

      {/* 3. Observações / Detalhes da necessidade (Campo único de texto amplo) */}
      <div className="space-y-2 pt-2 border-t border-border">
        <Label
          htmlFor="detalhesDaNecessidade"
          className="text-xs font-bold text-text-muted uppercase tracking-wider"
        >
          {t("Detalhes da necessidade")}
        </Label>
        <Textarea
          id="detalhesDaNecessidade"
          rows={4}
          placeholder={t("Observações, requisitos específicos do cliente, preferências de entrega…")}
          className="text-sm leading-relaxed"
          {...form.register("detalhesDaNecessidade")}
        />
      </div>


      {/* Botões opcionais no próprio formulário */}
      {mostrarBotoesAcao && (
        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={edit.isPending}
            >
              {t("Cancelar")}
            </Button>
          )}
          <Button
            type="submit"
            disabled={edit.isPending}
            className="bg-accent text-white hover:bg-accent/90"
          >
            {edit.isPending ? t("Salvando…") : t("Salvar alterações")}
          </Button>
        </div>
      )}
    </form>
  );
}
