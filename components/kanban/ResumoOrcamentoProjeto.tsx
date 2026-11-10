import { useMemo, useState, useEffect } from "react";
import { useT } from "@/hooks/i18n/useT";
import { calcularOrcamentoProjeto, type ResumoOrcamentoRobusty } from "@/lib/robusty/catalogo";
import { formatCents } from "@/lib/money";
import { Calculator, Package, Wrench, Truck, Tag, Percent } from "lucide-react";

interface Props {
  customFields?: Record<string, unknown> | null;
  moeda?: string | null;
  onAtualizarValorTotal?: (totalCents: number) => void;
  onMudarCustomField?: (campo: string, valor: unknown) => void;
  className?: string;
  somenteLeitura?: boolean;
}

export function ResumoOrcamentoProjeto({
  customFields,
  moeda: moedaProp,
  onAtualizarValorTotal,
  onMudarCustomField,
  className = "",
  somenteLeitura = false,
}: Props) {
  const moeda = moedaProp || "BRL";
  const t = useT();

  const resumo: ResumoOrcamentoRobusty = useMemo(() => {
    return calcularOrcamentoProjeto(customFields);
  }, [customFields]);

  const [tipoDescontoLocal, setTipoDescontoLocal] = useState<"reais" | "pct">(
    resumo.tipo_desconto,
  );
  const [valorDescontoLocal, setValorDescontoLocal] = useState<string>(
    resumo.valor_desconto > 0 ? String(resumo.valor_desconto) : "",
  );

  useEffect(() => {
    setTipoDescontoLocal(resumo.tipo_desconto);
    setValorDescontoLocal(
      resumo.valor_desconto > 0 ? String(resumo.valor_desconto) : "",
    );
  }, [resumo.tipo_desconto, resumo.valor_desconto]);

  // Se nada foi selecionado ainda, não renderiza caixa vazia
  if (
    !resumo.bagageiro &&
    resumo.acessorios.length === 0 &&
    !resumo.instalacao &&
    resumo.frete_cents === 0
  ) {
    return null;
  }

  function handleAlterarTipoDesconto(novoTipo: "reais" | "pct") {
    setTipoDescontoLocal(novoTipo);
    onMudarCustomField?.("tipo_desconto", novoTipo);
  }

  function handleAlterarValorDesconto(valorStr: string) {
    setValorDescontoLocal(valorStr);
    const num = valorStr.trim() ? Number(valorStr.replace(",", ".")) : 0;
    if (!Number.isNaN(num)) {
      onMudarCustomField?.("valor_desconto", num);
    }
  }

  return (
    <div
      className={`rounded-xl border border-accent/35 bg-surface text-xs text-text shadow-sm transition-all overflow-hidden ${className}`}
    >
      {/* Topo do Card de Orçamento */}
      <div className="flex items-center justify-between border-b border-accent/20 bg-accent/10 px-4 py-2.5">
        <div className="flex items-center gap-2 font-bold text-accent text-sm">
          <Calculator size={16} />
          <span>{t("Orçamento do Projeto")}</span>
        </div>
        {resumo.veiculo && (
          <span className="rounded-md bg-accent/20 px-2.5 py-0.5 text-[11px] font-bold text-accent">
            {resumo.veiculo.label}
          </span>
        )}
      </div>

      <div className="p-4 space-y-2 text-text-muted">
        {/* 1. Bagageiro */}
        {resumo.bagageiro && (
          <div className="flex items-center justify-between text-text text-sm">
            <div className="flex items-center gap-1.5 font-medium">
              <Package size={14} className="text-accent shrink-0" />
              <span>{resumo.bagageiro.label}</span>
            </div>
            <span className="font-mono font-semibold text-text">
              {formatCents(resumo.bagageiro.price_cents, moeda)}
            </span>
          </div>
        )}

        {/* 2. Acessórios */}
        {resumo.acessorios.map((acessorio) => (
          <div
            key={acessorio.key}
            className="flex items-center justify-between pl-4 text-xs"
          >
            <span>+ {acessorio.label}</span>
            <span className="font-mono font-medium">
              {formatCents(acessorio.price_cents, moeda)}
            </span>
          </div>
        ))}

        {/* 3. Instalação */}
        {resumo.instalacao && (
          <div className="flex items-center justify-between border-t border-accent/10 pt-1.5 text-text">
            <div className="flex items-center gap-1.5">
              <Wrench size={13} className="text-emerald-600" />
              <span>{resumo.instalacao.label}</span>
            </div>
            <span className="font-mono font-semibold text-text">
              {formatCents(resumo.instalacao.price_cents, moeda)}
            </span>
          </div>
        )}

        {/* 4. Frete / Entrega */}
        {resumo.frete_cents > 0 && (
          <div className="flex items-center justify-between border-t border-accent/10 pt-1.5 text-text">
            <div className="flex items-center gap-1.5">
              <Truck size={13} className="text-blue-600" />
              <span>{t("Entrega")}</span>
            </div>
            <span className="font-mono font-semibold text-text">
              {formatCents(resumo.frete_cents, moeda)}
            </span>
          </div>
        )}

        {/* 5. Bloco de Desconto (R$ ou %) */}
        <div className="mt-2.5 rounded-lg border border-accent/20 bg-accent/5 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1 font-semibold text-accent text-xs">
              <Tag size={12} />
              <span>{t("Desconto especial")}</span>
            </span>
            {!somenteLeitura && (
              <div className="inline-flex rounded-md border border-border bg-surface text-[11px] font-bold overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleAlterarTipoDesconto("reais")}
                  className={`px-2 py-0.5 transition ${
                    tipoDescontoLocal === "reais"
                      ? "bg-accent text-white"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  R$
                </button>
                <button
                  type="button"
                  onClick={() => handleAlterarTipoDesconto("pct")}
                  className={`px-2 py-0.5 transition ${
                    tipoDescontoLocal === "pct"
                      ? "bg-accent text-white"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  %
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!somenteLeitura ? (
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={tipoDescontoLocal === "pct" ? "0 a 100" : "0,00"}
                  value={valorDescontoLocal}
                  onChange={(e) => handleAlterarValorDesconto(e.target.value)}
                  className="w-full h-7 rounded border border-border bg-surface px-2 text-xs font-mono font-semibold text-text focus:border-accent focus:outline-none"
                />
                {tipoDescontoLocal === "pct" && (
                  <Percent
                    size={11}
                    className="absolute right-2 top-2 text-text-muted"
                  />
                )}
              </div>
            ) : null}

            {resumo.desconto_cents > 0 ? (
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap text-xs">
                - {formatCents(resumo.desconto_cents, moeda)}
              </span>
            ) : (
              <span className="text-[11px] text-text-muted">
                {t("Nenhum desconto")}
              </span>
            )}
          </div>
        </div>

        {/* Total Geral com destaque máximo */}
        <div className="mt-3.5 flex items-center justify-between rounded-lg bg-accent px-3.5 py-3 text-white shadow-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold opacity-90">
              {t("Total do Lead")}
            </div>
            <div className="text-[10px] opacity-75 font-mono">
              {t("Produtos + Frete - Desconto")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-extrabold tracking-tight">
              {formatCents(resumo.total_geral_cents, moeda)}
            </span>
            {onAtualizarValorTotal && (
              <button
                type="button"
                onClick={() => onAtualizarValorTotal(resumo.total_geral_cents)}
                className="rounded bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white transition hover:bg-white/30"
                title={t("Copiar valor calculado para o campo Valor do negócio")}
              >
                {t("Usar")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
