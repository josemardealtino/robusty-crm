import { useMemo } from "react";
import { useT } from "@/hooks/i18n/useT";
import { calcularOrcamentoProjeto, type ResumoOrcamentoRobusty } from "@/lib/robusty/catalogo";
import { formatCents } from "@/lib/money";
import { Calculator, Package, Wrench, Truck } from "lucide-react";

interface Props {
  customFields?: Record<string, unknown> | null;
  moeda?: string;
  onAtualizarValorTotal?: (totalCents: number) => void;
  className?: string;
}

export function ResumoOrcamentoProjeto({
  customFields,
  moeda = "BRL",
  onAtualizarValorTotal,
  className = "",
}: Props) {
  const t = useT();

  const resumo: ResumoOrcamentoRobusty = useMemo(() => {
    return calcularOrcamentoProjeto(customFields);
  }, [customFields]);

  // Se nada foi selecionado ainda, não renderiza caixa vazia
  if (!resumo.bagageiro && resumo.acessorios.length === 0 && !resumo.instalacao && resumo.frete_cents === 0) {
    return null;
  }

  const temItens = Boolean(resumo.bagageiro || resumo.acessorios.length > 0);

  return (
    <div
      className={`rounded-lg border border-accent/30 bg-accent/5 p-3.5 text-xs text-text shadow-sm transition-all ${className}`}
    >
      <div className="flex items-center justify-between border-b border-accent/20 pb-2 mb-2.5">
        <div className="flex items-center gap-1.5 font-semibold text-accent">
          <Calculator size={15} />
          <span>{t("Orçamento Estimado do Projeto")}</span>
        </div>
        {resumo.veiculo && (
          <span className="rounded bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
            {resumo.veiculo.label}
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-text-muted">
        {/* 1. Bagageiro */}
        {resumo.bagageiro && (
          <div className="flex items-center justify-between text-text">
            <div className="flex items-center gap-1.5">
              <Package size={13} className="text-accent" />
              <span>{resumo.bagageiro.label}</span>
            </div>
            <span className="font-mono font-medium text-text">
              {formatCents(resumo.bagageiro.price_cents, moeda)}
            </span>
          </div>
        )}

        {/* 2. Acessórios */}
        {resumo.acessorios.map((acessorio) => (
          <div key={acessorio.key} className="flex items-center justify-between pl-4 text-[11px]">
            <span>+ {acessorio.label}</span>
            <span className="font-mono">{formatCents(acessorio.price_cents, moeda)}</span>
          </div>
        ))}

        {/* 3. Instalação */}
        {resumo.instalacao && (
          <div className="flex items-center justify-between border-t border-accent/10 pt-1 text-text">
            <div className="flex items-center gap-1.5">
              <Wrench size={13} className="text-emerald-500" />
              <span>{resumo.instalacao.label}</span>
            </div>
            <span className="font-mono font-medium text-text">
              {formatCents(resumo.instalacao.price_cents, moeda)}
            </span>
          </div>
        )}

        {/* 4. Frete / Entrega */}
        {resumo.frete_cents > 0 && (
          <div className="flex items-center justify-between border-t border-accent/10 pt-1 text-text">
            <div className="flex items-center gap-1.5">
              <Truck size={13} className="text-blue-500" />
              <span>{t("Entrega")}</span>
            </div>
            <span className="font-mono font-medium text-text">
              {formatCents(resumo.frete_cents, moeda)}
            </span>
          </div>
        )}
      </div>

      {/* Total Geral com destaque */}
      <div className="mt-3 flex items-center justify-between border-t border-accent/25 pt-2 font-medium">
        <span className="text-text font-semibold">{t("Total do Pedido / Lead:")}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-accent">
            {formatCents(resumo.total_geral_cents, moeda)}
          </span>
          {onAtualizarValorTotal && (
            <button
              type="button"
              onClick={() => onAtualizarValorTotal(resumo.total_geral_cents)}
              className="rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-white transition hover:opacity-90"
              title={t("Copiar valor calculado para o campo Valor do negócio")}
            >
              {t("Usar este valor")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
