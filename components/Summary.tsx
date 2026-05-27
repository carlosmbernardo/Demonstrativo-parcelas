"use client";

import { EvolutionSummary } from "@/types";

interface Props {
  summary: EvolutionSummary;
}

function fmtMoney(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Painel de resumo final. Exibe os totais consolidados em formato
 * fácil de copiar para petições/comunicações.
 */
export default function Summary({ summary }: Props) {
  return (
    <div className="card-pad space-y-3">
      <h2 className="text-lg font-semibold text-slate-800">Resumo</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Row label="Valor original" value={summary.originalValue} />
        <Row label="Correção" value={summary.correction} accent="blue" />
        <Row label="Multa" value={summary.fine} accent="red" />
        <Row label="Juros" value={summary.interest} accent="orange" />
        <Row label="Pagamentos" value={-summary.payments} accent="green" />
        <div className="col-span-2 border-t border-slate-200 mt-2 pt-3 flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-700">Total atualizado</span>
          <span className="text-xl font-bold text-slate-900 tabular-nums">
            {fmtMoney(summary.total)}
          </span>
        </div>
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "blue" | "red" | "orange" | "green";
}) {
  const color =
    accent === "blue"
      ? "text-blue-700"
      : accent === "red"
      ? "text-red-700"
      : accent === "orange"
      ? "text-orange-700"
      : accent === "green"
      ? "text-emerald-700"
      : "text-slate-800";
  return (
    <>
      <dt className="text-slate-600">{label}</dt>
      <dd className={`text-right font-medium tabular-nums ${color}`}>{fmtMoney(value)}</dd>
    </>
  );
}
