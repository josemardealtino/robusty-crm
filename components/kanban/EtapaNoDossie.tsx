"use client";

import { useState } from "react";
import { useT } from "@/hooks/i18n/useT";
import type { Stage } from "@/lib/kanban/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown } from "lucide-react";

export type EtapaComCor = Pick<Stage, "id" | "name"> & {
  color?: string | null;
  is_won?: boolean;
  is_lost?: boolean;
};

export function EtapaNoDossie({
  etapaAtual,
  etapas,
  podeMover,
  onMudar,
  leadNome,
}: {
  etapaAtual: string;
  etapas: EtapaComCor[];
  podeMover: boolean;
  onMudar: (stageId: string) => void;
  leadNome?: string;
}) {
  const t = useT();
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [etapaPendente, setEtapaPendente] = useState<EtapaComCor | null>(null);

  const indexAtual = etapas.findIndex((e) => e.id === etapaAtual);
  const etapaAtualObj = etapas[indexAtual];
  const nomeAtual = etapaAtualObj?.name ?? "—";
  const corAtual = etapaAtualObj?.color || "#ea580c";

  if (!podeMover || etapas.length === 0) {
    return (
      <span
        data-testid="dossie-etapa"
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-text-muted"
      >
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: corAtual }}
        />
        <span>{nomeAtual}</span>
      </span>
    );
  }

  function handleSelecionarEtapa(e: EtapaComCor) {
    if (e.id === etapaAtual) {
      setPopoverAberto(false);
      return;
    }
    setPopoverAberto(false);
    // Solicita confirmação antes de mover a etapa (conforme aprovado)
    setEtapaPendente(e);
  }

  function handleConfirmarMudanca() {
    if (etapaPendente) {
      onMudar(etapaPendente.id);
    }
    setEtapaPendente(null);
  }

  return (
    <span data-testid="dossie-etapa" className="relative inline-block">
      <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="dossie-etapa-select"
            aria-label={t("Etapa do funil")}
            className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1 text-xs font-bold text-text shadow-xs transition hover:border-accent hover:shadow-sm"
          >
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: corAtual }}
            />
            <span className="truncate max-w-[180px]">{nomeAtual}</span>
            {indexAtual >= 0 && (
              <span className="rounded bg-surface-elevated px-1.5 py-0.2 text-[10px] font-bold text-text-muted">
                {indexAtual + 1}/{etapas.length}
              </span>
            )}
            <ChevronDown size={13} className="text-text-muted" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-72 p-1.5 shadow-lg border-border"
        >
          <div className="border-b border-border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            {t("Mudar etapa do negócio")}
          </div>
          <div className="mt-1 space-y-0.5 max-h-64 overflow-y-auto">
            {etapas.map((e, idx) => {
              const isAtiva = e.id === etapaAtual;
              const cor = e.color || "#94a3b8";
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => handleSelecionarEtapa(e)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-xs text-left transition ${
                    isAtiva
                      ? "bg-accent/15 text-accent font-bold"
                      : "text-text hover:bg-surface-elevated"
                  }`}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: cor }}
                  >
                    {idx + 1}
                  </span>
                  <span className="flex-1 truncate">{e.name}</span>
                  {isAtiva && (
                    <span className="text-[10px] font-bold uppercase text-accent">
                      {t("Atual")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Diálogo de confirmação */}
      <AlertDialog
        open={Boolean(etapaPendente)}
        onOpenChange={(aberto) => !aberto && setEtapaPendente(null)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold flex items-center gap-2">
              <span className="text-amber-500">⚠️</span>
              <span>{t("Mudar etapa do negócio?")}</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-text-muted pt-1">
              {t("Deseja mover")}{" "}
              <strong className="text-text">{leadNome || t("este lead")}</strong>{" "}
              {t("para a etapa")}{" "}
              <strong className="text-accent">
                &ldquo;{etapaPendente?.name}&rdquo;
              </strong>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel onClick={() => setEtapaPendente(null)}>
              {t("Cancelar")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarMudanca}
              className="bg-accent text-white hover:bg-accent/90"
            >
              {t("Sim, mover etapa")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  );
}
