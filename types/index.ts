// Tipos centrais da aplicação. Tudo que circula entre form, cálculo, UI e
// armazenamento passa por esses contratos.

/** Modo de correção monetária aplicada à parcela. */
export type CorrectionMode = "index" | "manual" | "none";

/**
 * Como tratar variações negativas de índice.
 *  zero      – Utilizar 0: mantém saldo, acumula déficit e absorve em futuras positivas.
 *  maxPeriod – Máxima do período: retoma correção apenas quando o valor absoluto do
 *              índice superar o pico anterior.
 *  negative  – Usar negativo: aplica a variação como está (saldo diminui).
 */
export type NegativeIndexMode = "zero" | "maxPeriod" | "negative";

/** Tipos pré-definidos de índices (mais o "custom" para qualquer outro). */
export type IndexKind = "CUB/SC" | "INCC" | "IPCA" | "IGP-M" | "custom";

/** Uma entrada mensal de um índice. */
export interface IndexEntry {
  id: string;
  /** Mês/ano no formato "YYYY-MM". */
  monthYear: string;
  /** Valor publicado do índice naquele mês (ex.: 2112.9 para o CUB). */
  value: number;
  /**
   * Variação mensal em relação ao mês anterior, em fração decimal
   * (ex.: 0.013 para 1,3%). Calculado automaticamente; pode ficar undefined
   * para o primeiro mês cadastrado (não há mês anterior).
   */
  variation?: number;
}

/** Um índice cadastrado, com seu histórico de valores mensais. */
export interface CorrectionIndex {
  id: string;
  name: string;
  kind: IndexKind;
  entries: IndexEntry[];
}

/** Pagamento parcial registrado pelo usuário. */
export interface Payment {
  id: string;
  /** Data ISO "YYYY-MM-DD". */
  date: string;
  amount: number;
}

/** O contrato/parcela a ser calculado. */
export interface Contract {
  id: string;
  title: string;
  debtor: string;
  currentInstallment: number;
  totalInstallments: number;
  /** Competência (mês-base) ISO "YYYY-MM-DD". */
  competencia: string;
  /** Vencimento da parcela ISO "YYYY-MM-DD". */
  vencimento: string;
  originalValue: number;
  correctionMode: CorrectionMode;
  /** Quando correctionMode === "index". */
  correctionIndexId?: string;
  /** Quando correctionMode === "manual". Fração decimal (ex.: 0.005 = 0,5%/mês). */
  manualCorrectionPercent?: number;
  /** Como tratar variações negativas (apenas correctionMode === "index"). */
  negativeIndexMode?: NegativeIndexMode;
  /** Multa em fração decimal (ex.: 0.02 = 2%). */
  finePercent: number;
  /** Juros mensais em fração decimal (ex.: 0.01 = 1%/mês). */
  monthlyInterestPercent: number;
  /** Data limite do cálculo ISO "YYYY-MM-DD". */
  finalDate: string;
  payments: Payment[];
}

/** Tipo de evento na linha do tempo da evolução. */
export type EventType =
  | "ValorOriginal"
  | "Correção"
  | "Vencimento"
  | "Multa"
  | "Juros"
  | "Pagamento";

/** Uma linha da tabela de evolução. */
export interface EvolutionEvent {
  date: string; // ISO
  type: EventType;
  previousBalance: number;
  multa: number; // multa acumulada até aqui
  juros: number; // juros acumulados até aqui (no ciclo corrente)
  base: number; // base de cálculo desta operação
  /** Variação aferida do índice no mês (fração decimal). */
  indexAferido?: number;
  /** Variação efetivamente aplicada (pode ser menor que a aferida por causa do déficit). */
  indexUtilizado?: number;
  /** Valor monetário do evento (correção, multa, juros, pagamento). */
  value: number;
  /** Saldo após o evento. */
  balance: number;
  /** Quantidade de dias entre eventos (para juros). */
  days?: number;
  /** Taxa aplicada no evento (fração decimal). */
  appliedRate?: number;
}

/** Resumo final exibido após a tabela. */
export interface EvolutionSummary {
  originalValue: number;
  correction: number;
  fine: number;
  interest: number;
  payments: number;
  total: number;
}

/** Resultado completo do cálculo. */
export interface CalculationResult {
  events: EvolutionEvent[];
  summary: EvolutionSummary;
  warnings: string[];
}

/** Erros de validação (campo → mensagem). */
export type ValidationErrors = Partial<Record<string, string>>;
