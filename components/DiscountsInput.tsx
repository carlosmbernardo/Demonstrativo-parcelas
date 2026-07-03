"use client";

import { Discount } from "@/types";
import { uid } from "@/lib/storage";

interface Props {
  discounts: Discount[];
  onChange: (discounts: Discount[]) => void;
  errors?: Record<string, string | undefined>;
}

/**
 * Lista dinâmica de descontos concedidos ao cliente (ex.: pela construtora).
 * Mesma mecânica do PaymentsInput: data + valor + remover, controlado pelo pai.
 */
export default function DiscountsInput({ discounts, onChange, errors }: Props) {
  function add() {
    onChange([...discounts, { id: uid(), date: "", amount: 0 }]);
  }
  function remove(id: string) {
    onChange(discounts.filter((d) => d.id !== id));
  }
  function update(id: string, patch: Partial<Discount>) {
    onChange(discounts.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="label !mb-0">
          Descontos <span className="text-slate-400 font-normal">(opcional)</span>
        </label>
        <button type="button" onClick={add} className="text-xs text-brand-700 hover:underline">
          + adicionar
        </button>
      </div>

      {discounts.length === 0 && (
        <p className="text-xs text-slate-500 italic">Nenhum desconto informado.</p>
      )}

      {discounts.map((d, i) => (
        <div key={d.id} className="flex gap-2 items-start">
          <div className="flex-1">
            <input
              type="date"
              className="input"
              value={d.date}
              onChange={(e) => update(d.id, { date: e.target.value })}
            />
            {errors?.[`discounts.${i}.date`] && (
              <p className="error">{errors[`discounts.${i}.date`]}</p>
            )}
          </div>
          <div className="flex-1">
            <input
              type="number"
              step="0.01"
              className="input"
              placeholder="Valor (R$)"
              value={d.amount || ""}
              onChange={(e) => update(d.id, { amount: parseFloat(e.target.value) || 0 })}
            />
            {errors?.[`discounts.${i}.amount`] && (
              <p className="error">{errors[`discounts.${i}.amount`]}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => remove(d.id)}
            className="btn-danger px-3"
            title="Remover"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
