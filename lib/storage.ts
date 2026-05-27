// /lib/storage.ts
// -----------------------------------------------------------------------------
// Persistência em localStorage. Sem backend nesta fase. Tudo serializado em
// JSON sob chaves namespaceadas. Em SSR (sem window) as funções retornam
// fallbacks vazios para que o build do Next não quebre.
// -----------------------------------------------------------------------------

import { Contract, CorrectionIndex } from "@/types";

const NS = "contract-evolution";
const K_CONTRACT = `${NS}:current-contract`;
const K_INDICES = `${NS}:indices`;

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage cheio ou indisponível — ignora silenciosamente.
  }
}

export function loadIndices(): CorrectionIndex[] {
  return safeGet<CorrectionIndex[]>(K_INDICES, []);
}

export function saveIndices(indices: CorrectionIndex[]): void {
  safeSet(K_INDICES, indices);
}

// ---------------------------------------------------------------------------
// Armazenamento server-side (data/indices.json via API route).
// Todos os dispositivos da rede leem/gravam no mesmo arquivo do servidor.
// ---------------------------------------------------------------------------

/**
 * Carrega índices do servidor. Se o servidor retornar vazio mas o
 * localStorage tiver dados (situação de primeiro acesso pós-migração),
 * migra os dados do localStorage para o servidor automaticamente.
 */
export async function loadIndicesFromServer(): Promise<CorrectionIndex[]> {
  try {
    const res = await fetch("/api/indices");
    if (!res.ok) return loadIndices(); // fallback para localStorage
    const data: CorrectionIndex[] = await res.json();

    if (data.length === 0) {
      // Migração: se localStorage tiver índices, envia-os para o servidor.
      const local = loadIndices();
      if (local.length > 0) {
        await saveIndicesToServer(local);
        // Limpa localStorage para evitar duplicações futuras.
        safeSet(K_INDICES, []);
        return local;
      }
    }

    return Array.isArray(data) ? data : [];
  } catch {
    return loadIndices(); // offline → usa localStorage como fallback
  }
}

/** Grava índices no servidor (data/indices.json). */
export async function saveIndicesToServer(indices: CorrectionIndex[]): Promise<void> {
  try {
    await fetch("/api/indices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(indices),
    });
  } catch {
    // Falha silenciosa; a página ainda mantém o estado em memória.
  }
}

export function loadContract(): Partial<Contract> | null {
  return safeGet<Partial<Contract> | null>(K_CONTRACT, null);
}

export function saveContract(c: Partial<Contract>): void {
  safeSet(K_CONTRACT, c);
}

/** Gera um id único curto baseado em timestamp + random. */
export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}
