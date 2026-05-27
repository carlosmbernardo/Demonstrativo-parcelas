"use client";

import { useEffect, useState } from "react";
import { CorrectionIndex } from "@/types";
import { loadIndicesFromServer, saveIndicesToServer } from "@/lib/storage";
import IndexManager from "@/components/IndexManager";

export default function IndicesPage() {
  const [indices, setIndices] = useState<CorrectionIndex[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    loadIndicesFromServer().then((data) => {
      setIndices(data);
      setHydrated(true);
    });
  }, []);

  // Persiste no servidor em cada mudança.
  useEffect(() => {
    if (hydrated) saveIndicesToServer(indices);
  }, [indices, hydrated]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Índices de correção</h1>
        <p className="text-sm text-slate-600 mt-1">
          Cadastre índices (CUB/SC, INCC, IPCA, IGP-M ou personalizado) e seus
          valores mensais. A variação é calculada automaticamente.
        </p>
      </header>

      <IndexManager indices={indices} onChange={setIndices} />
    </div>
  );
}
