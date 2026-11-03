"use client";

import { useT } from "@/hooks/i18n/useT";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updatePipelineConfig } from "@/app/actions/settings/updatePipelineConfig";
import type { CustomFieldDef, NewLeadFormFieldConfig } from "@/lib/schemas/settings";
import { CaretDown, CaretUp, Eye, EyeSlash } from "@/lib/ui/icons";

interface Props {
  pipeline: {
    id: string;
    name: string;
    settings?: Record<string, unknown> | null;
  };
}

export const CAMPOS_PADRAO_DISPONIVEIS: { key: string; label: string; dica?: string; defaultVisible: boolean }[] = [
  { key: "contact", label: "Contato / Cliente", dica: "Busca e seleção de contato cadastrado", defaultVisible: true },
  { key: "title", label: "Título do Negócio", dica: "Se ocultado, é gerado automaticamente pelo nome do contato ou data", defaultVisible: true },
  { key: "stage_id", label: "Etapa Inicial", dica: "Se ocultado, assume automaticamente a primeira etapa aberta", defaultVisible: true },
  { key: "description", label: "Observações / Descrição", dica: "Texto livre para anotações iniciais", defaultVisible: true },
  { key: "value", label: "Valor da Venda", dica: "Valor monetário previsto ou fechado", defaultVisible: true },
  { key: "expected_close_date", label: "Previsão de Fechamento", dica: "Data prevista para conclusão", defaultVisible: false },
  { key: "recorrencia", label: "Mensalidade / Recorrência", dica: "Campos de valor mensal e duração em meses", defaultVisible: false },
  { key: "tags", label: "Tags", dica: "Etiquetas separadas por vírgula", defaultVisible: false },
];

/**
 * Combina a configuração salva com todos os campos disponíveis (padrão e personalizados),
 * preservando a ordem exata definida pelo usuário. Campos novos não configurados
 * são adicionados ao final.
 */
export function obterListaOrdenadaDeCampos(
  savedFields: NewLeadFormFieldConfig[] | undefined | null,
  camposPersonalizados: CustomFieldDef[]
): NewLeadFormFieldConfig[] {
  const result: NewLeadFormFieldConfig[] = [];
  const chavesProcessadas = new Set<string>();

  // 1. Processar itens salvos na ordem em que foram salvos
  if (Array.isArray(savedFields)) {
    for (const saved of savedFields) {
      const padrao = CAMPOS_PADRAO_DISPONIVEIS.find((p) => p.key === saved.key);
      const cp = camposPersonalizados.find((c) => c.key === saved.key);

      if (padrao) {
        result.push({
          key: saved.key,
          label: padrao.label,
          visible: saved.visible,
          is_standard: true,
        });
        chavesProcessadas.add(saved.key);
      } else if (cp) {
        result.push({
          key: saved.key,
          label: cp.label,
          visible: saved.visible,
          is_standard: false,
        });
        chavesProcessadas.add(saved.key);
      }
    }
  }

  // 2. Adicionar campos padrão que não estavam na lista salva
  for (const padrao of CAMPOS_PADRAO_DISPONIVEIS) {
    if (!chavesProcessadas.has(padrao.key)) {
      result.push({
        key: padrao.key,
        label: padrao.label,
        visible: padrao.defaultVisible,
        is_standard: true,
      });
      chavesProcessadas.add(padrao.key);
    }
  }

  // 3. Adicionar campos personalizados que não estavam na lista salva
  for (const cp of camposPersonalizados) {
    if (!chavesProcessadas.has(cp.key)) {
      result.push({
        key: cp.key,
        label: cp.label,
        visible: false,
        is_standard: false,
      });
      chavesProcessadas.add(cp.key);
    }
  }

  return result;
}

export function NewLeadFormSection({ pipeline }: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [pendente, startTransition] = useTransition();

  // Configuração salva atualmente
  const rawFormConfig = (pipeline.settings?.new_lead_form as { fields?: NewLeadFormFieldConfig[] } | undefined)?.fields;
  const camposPersonalizados = ((pipeline.settings?.fields as CustomFieldDef[] | undefined) ?? []).filter(
    (f) => f.escopo !== "contato"
  );

  // Inicializar estado local com lista ordenada
  const [listaCampos, setListaCampos] = useState<NewLeadFormFieldConfig[]>(() =>
    obterListaOrdenadaDeCampos(rawFormConfig, camposPersonalizados)
  );

  const totalAtivos = listaCampos.filter((c) => c.visible).length;

  function alternar(key: string) {
    setListaCampos((prev) =>
      prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c))
    );
  }

  function mover(index: number, direcao: "cima" | "baixo") {
    setListaCampos((prev) => {
      const targetIndex = direcao === "cima" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index]!;
      copy[index] = copy[targetIndex]!;
      copy[targetIndex] = temp;
      return copy;
    });
  }

  function marcarTodos(visivel: boolean) {
    setListaCampos((prev) => prev.map((c) => ({ ...c, visible: visivel })));
  }

  function salvar() {
    startTransition(async () => {
      const res = await updatePipelineConfig(pipeline.id, {
        new_lead_form: {
          fields: listaCampos,
        },
      });

      if (!res.ok) {
        toast.error(t("Erro ao salvar configuração do formulário"));
        return;
      }

      toast.success(t("Configuração do formulário de Novo Lead salva com sucesso!"));
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-all">
      <div
        className="flex cursor-pointer items-center justify-between"
        onClick={() => setAberto(!aberto)}
        role="button"
        tabIndex={0}
      >
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t("Formulário de Novo Lead")}
            </h3>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
              {totalAtivos} {t("campos visíveis")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("Personalize exatamente quais campos padrão e personalizados aparecem ao abrir o modal Novo Lead deste funil.")}
          </p>
        </div>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={aberto ? t("Recolher") : t("Expandir")}
        >
          {aberto ? <CaretUp size={18} /> : <CaretDown size={18} />}
        </button>
      </div>

      {aberto && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("Use as setas para definir a ordem e alterne para exibir ou ocultar:")}</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => marcarTodos(true)}
              >
                {t("Marcar todos")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => marcarTodos(false)}
              >
                {t("Desmarcar todos")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {listaCampos.map((campo, idx) => {
              const ativo = campo.visible;
              const padrao = CAMPOS_PADRAO_DISPONIVEIS.find((p) => p.key === campo.key);
              const cp = !campo.is_standard
                ? camposPersonalizados.find((c) => c.key === campo.key)
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
                    {/* Botões de reordenação */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => mover(idx, "cima")}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                        title={t("Mover para cima")}
                      >
                        <CaretUp size={14} weight="bold" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === listaCampos.length - 1}
                        onClick={() => mover(idx, "baixo")}
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
                    onClick={() => alternar(campo.key)}
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

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={salvar}
              disabled={pendente}
              className="bg-accent text-accent-foreground hover:bg-accent-hover"
            >
              {pendente ? t("Salvando formulário...") : t("Salvar Configuração do Formulário")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
