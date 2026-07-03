"use client";

import { Addition } from "@/types";
import { uid } from "@/lib/storage";

interface Props {
  additions: Addition[];
  onChange: (additions: Addition[]) => void;
  errors?: Record<string, string | undefined>;
}

/**
 * Lista dinâmica de adições lançadas sobre o saldo (ex.: taxa extra, custo
 * adicional). Mesma mecânica do DiscountsInput/PaymentsInput: data + valor +
 * remover, controlado pelo pai.
 */
export default function AdditionsInput({ additions, onChange, errors }: Props) {
  function add() {
    onChange([...additions, { id: uid(), date: "", amount: 0 }]);
  }
  function remove(id: string) {
    onChange(additions.filter((a) => a.id !== id));
  }
  function update(id: string, patch: Partial<Addition>) {
    onChange(additions.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="label !mb-0">
          Adições <span className="text-slate-400 font-normal">(opcional)</span>
        </label>
        <button type="button" onClick={add} className="text-xs text-brand-700 hover:underline">
          + adicionar
        </button>
      </div>

      {additions.length === 0 && (
        <p className="text-xs text-slate-500 italic">Nenhuma adição informada.</p>
      )}

      {additions.map((a, i) => (
        <div key={a.id} className="flex gap-2 items-start">
          <div className="flex-1">
            <input
              type="date"
              className="input"
              value={a.date}
              onChange={(e) => update(a.id, { date: e.target.value })}
            />
            {errors?.[`additions.${i}.date`] && (
              <p className="error">{errors[`additions.${i}.date`]}</p>
            )}
          </div>
          <div className="flex-1">
            <input
              type="number"
              step="0.01"
              className="input"
              placeholder="Valor (R$)"
              value={a.amount || ""}
              onChange={(e) => update(a.id, { amount: parseFloat(e.target.value) || 0 })}
            />
            {errors?.[`additions.${i}.amount`] && (
              <p className="error">{errors[`additions.${i}.amount`]}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => remove(a.id)}
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
