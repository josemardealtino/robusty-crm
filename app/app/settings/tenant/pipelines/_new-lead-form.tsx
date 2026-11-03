"use client";

import { useT } from "@/hooks/i18n/useT";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updatePipelineConfig } from "@/app/actions/settings/updatePipelineConfig";
import type { CustomFieldDef, NewLeadFormFieldConfig } from "@/lib/schemas/settings";
import { CaretDown, CaretUp, Check, Eye, EyeSlash } from "@/lib/ui/icons";

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

export function NewLeadFormSection({ pipeline }: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [pendente, startTransition] = useTransition();

  // Configuração salva atualmente
  const rawFormConfig = (pipeline.settings?.new_lead_form as { fields?: NewLeadFormFieldConfig[] } | undefined)?.fields;
  const camposPersonalizados = ((pipeline.settings?.fields as CustomFieldDef[] | undefined) ?? []).filter(
    (f) => f.escopo !== "contato"
  );

  // Inicializar estado local
  const [estadoCampos, setEstadoCampos] = useState<Record<string, boolean>>(() => {
    const mapa: Record<string, boolean> = {};

    // 1. Campos padrão
    CAMPOS_PADRAO_DISPONIVEIS.forEach((padrao) => {
      const salvo = rawFormConfig?.find((f) => f.key === padrao.key);
      mapa[padrao.key] = salvo ? salvo.visible : padrao.defaultVisible;
    });

    // 2. Campos personalizados
    camposPersonalizados.forEach((cp) => {
      const salvo = rawFormConfig?.find((f) => f.key === cp.key);
      // Se não havia configuração salva ainda, campos personalizados iniciam como visíveis por padrão
      mapa[cp.key] = salvo ? salvo.visible : true;
    });

    return mapa;
  });

  const totalAtivos = Object.values(estadoCampos).filter(Boolean).length;

  function alternar(key: string) {
    setEstadoCampos((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function marcarTodos(visivel: boolean) {
    setEstadoCampos((prev) => {
      const novo: Record<string, boolean> = {};
      Object.keys(prev).forEach((k) => {
        novo[k] = visivel;
      });
      return novo;
    });
  }

  function salvar() {
    startTransition(async () => {
      const fieldsConfig: NewLeadFormFieldConfig[] = [];

      // Mapear campos padrão
      CAMPOS_PADRAO_DISPONIVEIS.forEach((padrao) => {
        fieldsConfig.push({
          key: padrao.key,
          label: padrao.label,
          visible: Boolean(estadoCampos[padrao.key]),
          is_standard: true,
        });
      });

      // Mapear campos personalizados
      camposPersonalizados.forEach((cp) => {
        fieldsConfig.push({
          key: cp.key,
          label: cp.label,
          visible: Boolean(estadoCampos[cp.key]),
          is_standard: false,
        });
      });

      const res = await updatePipelineConfig(pipeline.id, {
        new_lead_form: {
          fields: fieldsConfig,
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
        <div className="mt-4 space-y-5 border-t border-border pt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("Marque os campos que deseja exibir no formulário de criação:")}</span>
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

          {/* 1. CAMPOS PADRÃO */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Campos Padrão do Sistema")}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {CAMPOS_PADRAO_DISPONIVEIS.map((campo) => {
                const ativo = Boolean(estadoCampos[campo.key]);
                return (
                  <div
                    key={campo.key}
                    onClick={() => alternar(campo.key)}
                    className={`flex items-start gap-3 rounded-md border p-2.5 transition-colors cursor-pointer select-none ${
                      ativo
                        ? "border-accent/50 bg-accent/5"
                        : "border-border bg-background opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        ativo
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-muted-foreground bg-transparent"
                      }`}
                    >
                      {ativo && <Check size={12} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">
                          {campo.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          {ativo ? <Eye size={12} className="text-accent" /> : <EyeSlash size={12} />}
                        </span>
                      </div>
                      {campo.dica && (
                        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                          {campo.dica}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. CAMPOS PERSONALIZADOS DO FUNIL */}
          {camposPersonalizados.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("Campos Personalizados Deste Funil")} ({camposPersonalizados.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {camposPersonalizados.map((cp) => {
                  const ativo = Boolean(estadoCampos[cp.key]);
                  return (
                    <div
                      key={cp.key}
                      onClick={() => alternar(cp.key)}
                      className={`flex items-start gap-3 rounded-md border p-2.5 transition-colors cursor-pointer select-none ${
                        ativo
                          ? "border-accent/50 bg-accent/5"
                          : "border-border bg-background opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          ativo
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-muted-foreground bg-transparent"
                        }`}
                      >
                        {ativo && <Check size={12} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground truncate">
                            {cp.label}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-1 rounded bg-muted text-muted-foreground">
                            {cp.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                          chave: {cp.key}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
