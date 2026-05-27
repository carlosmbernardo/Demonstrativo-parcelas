"use client";

import { useEffect, useMemo, useState } from "react";
import { Contract, CorrectionIndex, ValidationErrors } from "@/types";
import { calculateEvolution, validateContract } from "@/lib/calculation";
import { loadContract, loadIndicesFromServer, saveContract, uid } from "@/lib/storage";
import { exportToExcel } from "@/lib/export";
import ContractForm from "@/components/ContractForm";
import EvolutionTable from "@/components/EvolutionTable";
import Summary from "@/components/Summary";

/**
 * Modelo padrão para um contrato novo. Tudo zerado/vazio mas com tipos certos
 * para o formulário não disparar warnings de controlled vs uncontrolled.
 */
function emptyContract(): Partial<Contract> {
  return {
    id: uid(),
    title: "",
    debtor: "",
    currentInstallment: 1,
    totalInstallments: 1,
    competencia: "",
    vencimento: "",
    originalValue: 0,
    correctionMode: "none",
    finePercent: 0.02,
    monthlyInterestPercent: 0.01,
    finalDate: "",
    payments: [],
  };
}

export default function CalculatorPage() {
  // Carregamento perezoso pós-hidratação: garante que o servidor (SSR) renderize
  // sempre o mesmo HTML, e só após mount o estado vem do localStorage.
  const [contract, setContract] = useState<Partial<Contract>>(emptyContract());
  const [indices, setIndices] = useState<CorrectionIndex[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadContract();
    if (saved) setContract({ ...emptyContract(), ...saved });
    loadIndicesFromServer().then((data) => {
      setIndices(data);
      setHydrated(true);
    });
  }, []);

  // Persiste o contrato em cada alteração (após hidratado).
  useEffect(() => {
    if (hydrated) saveContract(contract);
  }, [contract, hydrated]);

  function update(patch: Partial<Contract>) {
    setContract((prev) => ({ ...prev, ...patch }));
  }
  function reset() {
    if (!confirm("Limpar todos os campos do contrato?")) return;
    setContract(emptyContract());
  }

  // Validação + cálculo são memoizados; só recomputam quando entradas mudam.
  const errors: ValidationErrors = useMemo(
    () => validateContract(contract, indices),
    [contract, indices],
  );

  const canCalculate =
    Object.keys(errors).length === 0 &&
    !!contract.competencia &&
    !!contract.vencimento &&
    !!contract.finalDate;

  const result = useMemo(() => {
    if (!canCalculate) return null;
    return calculateEvolution(contract as Contract, indices);
  }, [contract, indices, canCalculate]);

  function handleExport() {
    if (!result) return;
    exportToExcel(contract as Contract, result, indices);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Calculadora de Evolução</h1>
        <div className="flex gap-2">
          <button onClick={reset} className="btn-secondary">
            Limpar
          </button>
          <button
            onClick={handleExport}
            disabled={!result}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Exportar Excel
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[520px_1fr] gap-5 items-start">
        {/* Lado esquerdo: formulário */}
        <ContractForm
          contract={contract}
          indices={indices}
          errors={errors}
          onChange={update}
        />

        {/* Lado direito: resumo + tabela */}
        <div className="space-y-5">
          {result ? (
            <>
              <Summary summary={result.summary} />
              {result.warnings.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <strong className="block mb-1">Avisos:</strong>
                  <ul className="list-disc list-inside space-y-0.5">
                    {result.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <EvolutionTable events={result.events} />
            </>
          ) : (
            <div className="card-pad text-sm text-slate-600">
              Preencha os campos obrigatórios para gerar a evolução.
              {Object.keys(errors).length > 0 && (
                <ul className="mt-2 list-disc list-inside text-red-700 text-xs">
                  {Object.entries(errors)
                    .slice(0, 5)
                    .map(([k, v]) => (
                      <li key={k}>{v}</li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
