"use client";

import { useMemo, useRef, useState } from "react";
import { CorrectionIndex, IndexEntry, IndexKind } from "@/types";
import { recomputeIndexVariations } from "@/lib/calculation";
import { uid } from "@/lib/storage";
import { parseIndexSpreadsheet } from "@/lib/importIndex";

interface Props {
  indices: CorrectionIndex[];
  onChange: (indices: CorrectionIndex[]) => void;
}

const KIND_OPTIONS: IndexKind[] = ["CUB/SC", "INCC", "IPCA", "IGP-M", "custom"];

/**
 * Gerenciador de índices. Cada índice tem nome + tipo + lista de entradas
 * mensais (mês/ano + valor). A variação é sempre recalculada em cima das
 * entradas, então o usuário só precisa informar o valor.
 */
export default function IndexManager({ indices, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    indices[0]?.id ?? null,
  );
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => indices.find((i) => i.id === selectedId) ?? null,
    [indices, selectedId],
  );

  function createIndex() {
    const newIdx: CorrectionIndex = {
      id: uid(),
      name: "Novo índice",
      kind: "custom",
      entries: [],
    };
    onChange([...indices, newIdx]);
    setSelectedId(newIdx.id);
  }

  function deleteIndex(id: string) {
    if (!confirm("Excluir este índice e suas entradas?")) return;
    const next = indices.filter((i) => i.id !== id);
    onChange(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  }

  function updateSelected(patch: Partial<CorrectionIndex>) {
    if (!selected) return;
    onChange(indices.map((i) => (i.id === selected.id ? { ...i, ...patch } : i)));
  }

  function addEntry() {
    if (!selected) return;
    // Padrão: próximo mês após o último cadastrado, ou o atual.
    const last = [...selected.entries].sort((a, b) =>
      a.monthYear.localeCompare(b.monthYear),
    )[selected.entries.length - 1];
    let monthYear: string;
    if (last) {
      const [y, m] = last.monthYear.split("-").map(Number);
      const next = new Date(Date.UTC(y, m, 1)); // m já é 1-based, +0 = mês seguinte
      monthYear = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
    } else {
      const now = new Date();
      monthYear = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    const entry: IndexEntry = { id: uid(), monthYear, value: 0 };
    const recomputed = recomputeIndexVariations([...selected.entries, entry]);
    updateSelected({ entries: recomputed });
  }

  function updateEntry(id: string, patch: Partial<IndexEntry>) {
    if (!selected) return;
    const updated = selected.entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    const recomputed = recomputeIndexVariations(updated);
    updateSelected({ entries: recomputed });
  }

  function removeEntry(id: string) {
    if (!selected) return;
    const updated = selected.entries.filter((e) => e.id !== id);
    const recomputed = recomputeIndexVariations(updated);
    updateSelected({ entries: recomputed });
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    e.target.value = "";

    try {
      const { entries, warnings } = await parseIndexSpreadsheet(file);

      if (entries.length === 0) {
        setImportWarnings(warnings.length ? warnings : ["Nenhuma entrada encontrada na planilha."]);
        return;
      }

      if (
        selected.entries.length > 0 &&
        !confirm(
          `O índice já possui ${selected.entries.length} entrada(s).\n\nDeseja SUBSTITUIR tudo pelas ${entries.length} linha(s) importadas?\n\nClique em "Cancelar" para mesclar (entradas existentes são mantidas; meses repetidos são atualizados).`,
        )
      ) {
        // Mesclar: manter entradas existentes, sobrescrever meses repetidos
        const map = new Map(selected.entries.map((e) => [e.monthYear, e]));
        for (const imp of entries) {
          map.set(imp.monthYear, { ...map.get(imp.monthYear), ...imp, id: map.get(imp.monthYear)?.id ?? imp.id });
        }
        const merged = recomputeIndexVariations(
          [...map.values()].sort((a, b) => a.monthYear.localeCompare(b.monthYear)),
        );
        updateSelected({ entries: merged });
      } else {
        updateSelected({ entries: recomputeIndexVariations(entries) });
      }

      setImportWarnings(warnings);
    } catch {
      setImportWarnings(["Erro ao ler a planilha. Verifique se o arquivo é .xlsx, .xls ou .csv."]);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
      {/* Coluna esquerda: lista de índices */}
      <aside className="card-pad space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Índices</h3>
          <button onClick={createIndex} className="text-xs text-brand-700 hover:underline">
            + novo
          </button>
        </div>
        {indices.length === 0 && (
          <p className="text-xs text-slate-500 italic">Nenhum índice. Clique em "+ novo".</p>
        )}
        <ul className="space-y-1">
          {indices.map((i) => (
            <li key={i.id}>
              <button
                onClick={() => setSelectedId(i.id)}
                className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition ${
                  selectedId === i.id
                    ? "bg-brand-100 text-brand-900"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                <div className="font-medium truncate">{i.name}</div>
                <div className="text-xs text-slate-500">
                  {i.kind} • {i.entries.length} entrada{i.entries.length !== 1 ? "s" : ""}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Coluna direita: detalhe do índice selecionado */}
      <section className="card-pad space-y-4">
        {!selected && (
          <p className="text-slate-500 text-sm">Selecione um índice à esquerda.</p>
        )}

        {selected && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="label">Nome</label>
                <input
                  className="input"
                  value={selected.name}
                  onChange={(e) => updateSelected({ name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select
                  className="input"
                  value={selected.kind}
                  onChange={(e) => updateSelected({ kind: e.target.value as IndexKind })}
                >
                  {KIND_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <h4 className="text-sm font-medium text-slate-700">Entradas mensais</h4>
              <div className="flex gap-2">
                <button onClick={addEntry} className="btn-secondary text-xs">
                  + adicionar mês
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary text-xs"
                  title="Importar valores de uma planilha (.xlsx, .xls, .csv)"
                >
                  Importar planilha
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImport}
                />
                <button
                  onClick={() => deleteIndex(selected.id)}
                  className="btn-danger text-xs"
                >
                  Excluir índice
                </button>
              </div>
            </div>

            {importWarnings.length > 0 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                <div className="font-semibold">Avisos da importação:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {importWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                <button
                  onClick={() => setImportWarnings([])}
                  className="mt-1 text-amber-600 hover:underline"
                >
                  Fechar
                </button>
              </div>
            )}

            {selected.entries.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Nenhuma entrada. Adicione meses com seus respectivos valores.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-700 text-xs">
                    <tr>
                      <th className="text-left px-2 py-2">Mês/Ano</th>
                      <th className="text-right px-2 py-2">Valor</th>
                      <th className="text-right px-2 py-2">Variação</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...selected.entries]
                      .sort((a, b) => b.monthYear.localeCompare(a.monthYear))
                      .map((e) => (
                        <tr key={e.id} className="border-t border-slate-100">
                          <td className="px-2 py-1.5">
                            <input
                              type="month"
                              className="input !py-1"
                              value={e.monthYear}
                              onChange={(ev) =>
                                updateEntry(e.id, { monthYear: ev.target.value })
                              }
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              step="0.0001"
                              className="input !py-1 text-right tabular-nums"
                              value={e.value || ""}
                              onChange={(ev) =>
                                updateEntry(e.id, {
                                  value: parseFloat(ev.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-slate-600 text-xs">
                            {e.variation == null
                              ? "—"
                              : (e.variation * 100).toFixed(4).replace(".", ",") + "%"}
                          </td>
                          <td className="px-2 py-1.5">
                            <button
                              onClick={() => removeEntry(e.id)}
                              className="text-red-600 hover:text-red-800 text-xs"
                              title="Remover"
                            >
                              remover
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
