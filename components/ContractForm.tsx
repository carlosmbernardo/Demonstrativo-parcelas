"use client";

import { Contract, CorrectionIndex, NegativeIndexMode, ValidationErrors } from "@/types";
import PaymentsInput from "./PaymentsInput";

interface Props {
  contract: Partial<Contract>;
  indices: CorrectionIndex[];
  errors: ValidationErrors;
  onChange: (patch: Partial<Contract>) => void;
}

/**
 * Formulário do contrato. É controlado: o estado vive no pai (page.tsx), aqui
 * só renderizamos campos e delegamos updates via onChange.
 *
 * Convenção: percentuais são exibidos para o usuário em base 100 (ex.: "2"
 * para 2%) e convertidos para fração decimal (0.02) antes de descer ao
 * `contract`. Mantém o cálculo limpo (sempre fração).
 */
export default function ContractForm({ contract, indices, errors, onChange }: Props) {
  // Helpers para campos numéricos com conversão.
  const pct = (v: number | undefined): string =>
    v == null || isNaN(v) ? "" : String(v * 100);
  const num = (v: number | undefined): string =>
    v == null || isNaN(v) ? "" : String(v);

  return (
    <div className="card-pad space-y-5">
      <h2 className="text-lg font-semibold text-slate-800">Dados do contrato</h2>

      {/* Identificação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Título</label>
          <input
            className="input"
            value={contract.title ?? ""}
            onChange={(e) => onChange({ title: e.target.value })}
          />
          {errors.title && <p className="error">{errors.title}</p>}
        </div>
        <div>
          <label className="label">Devedor</label>
          <input
            className="input"
            value={contract.debtor ?? ""}
            onChange={(e) => onChange({ debtor: e.target.value })}
          />
          {errors.debtor && <p className="error">{errors.debtor}</p>}
        </div>
      </div>

      {/* Parcela */}
      <div className="grid grid-cols-2 gap-4 items-end">
        <div>
          <label className="label">Parcela atual</label>
          <input
            type="number"
            min={1}
            className="input"
            value={num(contract.currentInstallment)}
            onChange={(e) =>
              onChange({ currentInstallment: parseInt(e.target.value, 10) || 0 })
            }
          />
          {errors.currentInstallment && (
            <p className="error">{errors.currentInstallment}</p>
          )}
        </div>
        <div>
          <label className="label">Total de parcelas</label>
          <input
            type="number"
            min={1}
            className="input"
            value={num(contract.totalInstallments)}
            onChange={(e) =>
              onChange({ totalInstallments: parseInt(e.target.value, 10) || 0 })
            }
          />
          {errors.totalInstallments && (
            <p className="error">{errors.totalInstallments}</p>
          )}
        </div>
        <div>
          <label className="label">Valor original (R$)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={num(contract.originalValue)}
            onChange={(e) =>
              onChange({ originalValue: parseFloat(e.target.value) || 0 })
            }
          />
          {errors.originalValue && <p className="error">{errors.originalValue}</p>}
        </div>
        <div>
          <label className="label">Data final do cálculo</label>
          <input
            type="date"
            className="input"
            value={contract.finalDate ?? ""}
            onChange={(e) => onChange({ finalDate: e.target.value })}
          />
          {errors.finalDate && <p className="error">{errors.finalDate}</p>}
        </div>
      </div>

      {/* Datas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Competência</label>
          <input
            type="date"
            className="input"
            value={contract.competencia ?? ""}
            onChange={(e) => onChange({ competencia: e.target.value })}
          />
          {errors.competencia && <p className="error">{errors.competencia}</p>}
        </div>
        <div>
          <label className="label">Vencimento <span className="text-slate-400 font-normal">(opcional)</span></label>
          <input
            type="date"
            className="input"
            value={contract.vencimento ?? ""}
            onChange={(e) => onChange({ vencimento: e.target.value })}
          />
          {errors.vencimento && <p className="error">{errors.vencimento}</p>}
        </div>
      </div>

      {/* Multa e juros */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Multa (%)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            placeholder="ex.: 2"
            value={pct(contract.finePercent)}
            onChange={(e) =>
              onChange({ finePercent: (parseFloat(e.target.value) || 0) / 100 })
            }
          />
          {errors.finePercent && <p className="error">{errors.finePercent}</p>}
        </div>
        <div>
          <label className="label">Juros mensal (%)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            placeholder="ex.: 1"
            value={pct(contract.monthlyInterestPercent)}
            onChange={(e) =>
              onChange({
                monthlyInterestPercent: (parseFloat(e.target.value) || 0) / 100,
              })
            }
          />
          {errors.monthlyInterestPercent && (
            <p className="error">{errors.monthlyInterestPercent}</p>
          )}
        </div>
      </div>

      {/* Correção */}
      <div className="space-y-3">
        <div>
          <label className="label">Tipo de correção</label>
          <select
            className="input"
            value={contract.correctionMode ?? "none"}
            onChange={(e) =>
              onChange({ correctionMode: e.target.value as Contract["correctionMode"] })
            }
          >
            <option value="none">Sem correção</option>
            <option value="index">Índice cadastrado</option>
            <option value="manual">Percentual manual</option>
          </select>
        </div>

        {contract.correctionMode === "index" && (
          <>
            <div>
              <label className="label">Índice</label>
              {indices.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                  Nenhum índice cadastrado. Vá em <strong>Índices</strong> para cadastrar.
                </p>
              ) : (
                <select
                  className="input"
                  value={contract.correctionIndexId ?? ""}
                  onChange={(e) => onChange({ correctionIndexId: e.target.value })}
                >
                  <option value="">— selecione —</option>
                  {indices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.kind})
                    </option>
                  ))}
                </select>
              )}
              {errors.correctionIndexId && (
                <p className="error">{errors.correctionIndexId}</p>
              )}
            </div>

            <div>
              <label className="label">Tratamento de índice negativo</label>
              <select
                className="input"
                value={contract.negativeIndexMode ?? "zero"}
                onChange={(e) =>
                  onChange({ negativeIndexMode: e.target.value as NegativeIndexMode })
                }
              >
                <option value="zero">Utilizar 0 — mantém saldo, acumula déficit</option>
                <option value="maxPeriod">Máxima do período — retoma só quando superar o pico</option>
                <option value="negative">Usar negativo — aplica a variação como está</option>
              </select>
            </div>
          </>
        )}

        {contract.correctionMode === "manual" && (
          <div>
            <label className="label">Percentual manual de correção mensal (%)</label>
            <input
              type="number"
              step="0.0001"
              className="input"
              placeholder="ex.: 0,5"
              value={pct(contract.manualCorrectionPercent)}
              onChange={(e) =>
                onChange({
                  manualCorrectionPercent: (parseFloat(e.target.value) || 0) / 100,
                })
              }
            />
            {errors.manualCorrectionPercent && (
              <p className="error">{errors.manualCorrectionPercent}</p>
            )}
          </div>
        )}
      </div>

      {/* Pagamentos */}
      <PaymentsInput
        payments={contract.payments ?? []}
        onChange={(payments) => onChange({ payments })}
        errors={errors as Record<string, string | undefined>}
      />
    </div>
  );
}
