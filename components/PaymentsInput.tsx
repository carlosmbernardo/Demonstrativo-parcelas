"use client";

import { Payment } from "@/types";
import { uid } from "@/lib/storage";

interface Props {
  payments: Payment[];
  onChange: (payments: Payment[]) => void;
  errors?: Record<string, string | undefined>;
}

/**
 * Lista dinâmica de pagamentos parciais. Cada linha tem data + valor + remover.
 * O componente é totalmente controlado: o estado fica no pai.
 */
export default function PaymentsInput({ payments, onChange, errors }: Props) {
  function add() {
    onChange([...payments, { id: uid(), date: "", amount: 0 }]);
  }
  function remove(id: string) {
    onChange(payments.filter((p) => p.id !== id));
  }
  function update(id: string, patch: Partial<Payment>) {
    onChange(payments.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="label !mb-0">Pagamentos parciais</label>
        <button type="button" onClick={add} className="text-xs text-brand-700 hover:underline">
          + adicionar
        </button>
      </div>

      {payments.length === 0 && (
        <p className="text-xs text-slate-500 italic">Nenhum pagamento informado.</p>
      )}

      {payments.map((p, i) => (
        <div key={p.id} className="flex gap-2 items-start">
          <div className="flex-1">
            <input
              type="date"
              className="input"
              value={p.date}
              onChange={(e) => update(p.id, { date: e.target.value })}
            />
            {errors?.[`payments.${i}.date`] && (
              <p className="error">{errors[`payments.${i}.date`]}</p>
            )}
          </div>
          <div className="flex-1">
            <input
              type="number"
              step="0.01"
              className="input"
              placeholder="Valor (R$)"
              value={p.amount || ""}
              onChange={(e) => update(p.id, { amount: parseFloat(e.target.value) || 0 })}
            />
            {errors?.[`payments.${i}.amount`] && (
              <p className="error">{errors[`payments.${i}.amount`]}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => remove(p.id)}
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
