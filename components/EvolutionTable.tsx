"use client";

import { EvolutionEvent } from "@/types";

interface Props {
  events: EvolutionEvent[];
}

// Mapeia o tipo do evento para uma cor de fundo bem suave (boa para escaneamento visual).
const TYPE_BG: Record<string, string> = {
  ValorOriginal: "bg-slate-50",
  Correção: "bg-blue-50/60",
  Vencimento: "bg-amber-50",
  Multa: "bg-red-50",
  Juros: "bg-orange-50/60",
  Pagamento: "bg-emerald-50",
};

function fmtDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtMoney(v: number | undefined): string {
  if (v == null || isNaN(v) || v === 0) return "—";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(v: number | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return (v * 100).toFixed(4).replace(".", ",") + "%";
}

/**
 * Tabela de evolução. Apresenta todos os eventos calculados em ordem
 * cronológica com as 12 colunas previstas no requisito.
 */
export default function EvolutionTable({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="card-pad text-center text-slate-500 text-sm">
        Preencha o formulário para visualizar a evolução.
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <Th>Data</Th>
            <Th>Tipo</Th>
            <Th className="text-right">Saldo Anterior</Th>
            <Th className="text-right">Multa</Th>
            <Th className="text-right">Juros</Th>
            <Th className="text-right">Base Cálculo</Th>
            <Th className="text-right">Aferido</Th>
            <Th className="text-right">Utilizado</Th>
            <Th className="text-right">Valor</Th>
            <Th className="text-right">Saldo</Th>
            <Th className="text-right">Dias</Th>
            <Th className="text-right">Taxa Aplicada</Th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr
              key={`${e.date}-${e.type}-${i}`}
              className={`${TYPE_BG[e.type] ?? ""} border-t border-slate-100`}
            >
              <Td>{fmtDate(e.date)}</Td>
              <Td className="font-medium">{e.type}</Td>
              <Td className="text-right tabular-nums">{fmtMoney(e.previousBalance)}</Td>
              <Td className="text-right tabular-nums">{fmtMoney(e.multa)}</Td>
              <Td className="text-right tabular-nums">{fmtMoney(e.juros)}</Td>
              <Td className="text-right tabular-nums">{fmtMoney(e.base)}</Td>
              <Td className="text-right tabular-nums">{fmtPct(e.indexAferido)}</Td>
              <Td className="text-right tabular-nums">{fmtPct(e.indexUtilizado)}</Td>
              <Td className="text-right tabular-nums font-medium">{fmtMoney(e.value)}</Td>
              <Td className="text-right tabular-nums font-semibold">
                {fmtMoney(e.balance)}
              </Td>
              <Td className="text-right tabular-nums">{e.days ?? "—"}</Td>
              <Td className="text-right tabular-nums">{fmtPct(e.appliedRate)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-2 py-2 text-left font-medium whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-1.5 whitespace-nowrap ${className}`}>{children}</td>;
}
