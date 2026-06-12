// /lib/calculation.ts
// -----------------------------------------------------------------------------
// Motor de cálculo da evolução da parcela.
//
// Reproduz a lógica da planilha-modelo:
//
//   1. Da competência até o vencimento (ou data final, o que vier antes),
//      são gerados eventos mensais de "Correção" aplicando a variação do
//      índice escolhido sobre o saldo. Variações negativas viram déficit
//      acumulado (a planilha mostra "Utilizado = 0" quando o aferido é
//      negativo) e são absorvidas por correções positivas futuras.
//
//   2. Se a data final cobre o vencimento, é emitido o marcador "Vencimento".
//
//   3. Após o vencimento: aplica "Multa" única (multa% sobre o saldo do
//      vencimento) e inicia ciclos mensais de "Juros" + "Correção" até a
//      data final. A *base de cálculo* dos juros e da correção é o
//      principal (saldo - multa acumulada - juros do ciclo), evitando
//      anatocismo, exatamente como na planilha.
//
//   4. Pagamentos parciais entram em ordem cronológica reduzindo o saldo.
//
// Toda data circula como string ISO "YYYY-MM-DD" para isolar timezone.
// -----------------------------------------------------------------------------

import {
  CalculationResult,
  Contract,
  CorrectionIndex,
  EventType,
  EvolutionEvent,
  EvolutionSummary,
  IndexEntry,
  NegativeIndexMode,
  Payment,
  ValidationErrors,
} from "@/types";

// ---------- helpers de data --------------------------------------------------

/** Cria um objeto Date interpretado como UTC à meia-noite (sem timezone shift). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Formata um Date como string ISO "YYYY-MM-DD" no fuso UTC. */
export function formatISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Diferença em dias inteiros entre duas datas ISO. */
export function daysBetween(a: string, b: string): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Adiciona N meses preservando o dia. Se o mês destino não tiver aquele
 * dia (ex.: 31/jan + 1 mês), cai para o último dia do mês destino.
 */
export function addMonths(iso: string, months: number): string {
  const d = parseISODate(iso);
  const day = d.getUTCDate();
  const targetMonth = d.getUTCMonth() + months;
  const targetYear = d.getUTCFullYear() + Math.floor(targetMonth / 12);
  const wrappedMonth = ((targetMonth % 12) + 12) % 12;
  // Último dia do mês destino
  const lastDay = new Date(Date.UTC(targetYear, wrappedMonth + 1, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDay);
  return formatISODate(new Date(Date.UTC(targetYear, wrappedMonth, safeDay)));
}

/** "YYYY-MM" da data ISO. */
export function monthYearOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Comparação ISO: a < b. */
const before = (a: string, b: string) => a < b;
/** Comparação ISO: a ≤ b. */
const beforeOrEq = (a: string, b: string) => a <= b;

// ---------- helpers numéricos ------------------------------------------------

/** Arredondamento "comercial" para 2 casas; o cálculo interno mantém precisão total. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Taxa diária equivalente à mensal: (1 + i_m)^(1/30) - 1.
 * É a fórmula que a planilha usa (célula com `(1.01)^(1/30)-1`).
 */
export function dailyRateFromMonthly(monthlyRate: number): number {
  return Math.pow(1 + monthlyRate, 1 / 30) - 1;
}

/** Taxa acumulada em `days` dias a partir da mensal. */
export function ratePeriodFromMonthly(monthlyRate: number, days: number): number {
  return Math.pow(1 + monthlyRate, days / 30) - 1;
}

// ---------- índices ----------------------------------------------------------

/**
 * Recalcula as variações mensais de uma lista de entradas de índice.
 * Variação = valor[mês] / valor[mês anterior] - 1.
 *
 * A primeira entrada (por ordem cronológica) fica com variation = undefined,
 * pois não há mês anterior cadastrado para servir de base.
 */
export function recomputeIndexVariations(entries: IndexEntry[]): IndexEntry[] {
  const sorted = [...entries].sort((a, b) => a.monthYear.localeCompare(b.monthYear));
  return sorted.map((entry, i) => {
    if (i === 0) return { ...entry, variation: undefined };
    const prev = sorted[i - 1];
    if (!prev.value || prev.value === 0) return { ...entry, variation: undefined };
    return { ...entry, variation: entry.value / prev.value - 1 };
  });
}

/** Procura a entrada de um índice para o mês/ano dado. */
function findEntry(index: CorrectionIndex, monthYear: string): IndexEntry | undefined {
  return index.entries.find((e) => e.monthYear === monthYear);
}

// ---------- validação --------------------------------------------------------

/**
 * Validações de campos obrigatórios e regras de negócio do contrato.
 * Retorna um objeto vazio se tudo estiver OK.
 */
export function validateContract(
  c: Partial<Contract>,
  indices: CorrectionIndex[],
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!c.title?.trim()) errors.title = "Título é obrigatório.";
  if (!c.debtor?.trim()) errors.debtor = "Devedor é obrigatório.";

  if (c.currentInstallment == null || c.currentInstallment < 1)
    errors.currentInstallment = "Parcela atual deve ser ≥ 1.";
  if (c.totalInstallments == null || c.totalInstallments < 1)
    errors.totalInstallments = "Total de parcelas deve ser ≥ 1.";
  if (
    c.currentInstallment != null &&
    c.totalInstallments != null &&
    c.currentInstallment > c.totalInstallments
  )
    errors.currentInstallment = "Parcela atual maior que o total.";

  if (!c.competencia) errors.competencia = "Competência é obrigatória.";
  if (!c.finalDate) errors.finalDate = "Data final é obrigatória.";

  // Datas válidas
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  for (const f of ["competencia", "vencimento", "finalDate"] as const) {
    const v = c[f];
    if (v && !dateRe.test(v)) errors[f] = "Data inválida.";
  }

  // Vencimento ≥ competência (apenas quando informado)
  if (c.competencia && c.vencimento && dateRe.test(c.competencia) && dateRe.test(c.vencimento)) {
    if (before(c.vencimento, c.competencia))
      errors.vencimento = "Vencimento anterior à competência.";
  }

  // Final ≥ competência
  if (c.competencia && c.finalDate && dateRe.test(c.competencia) && dateRe.test(c.finalDate)) {
    if (before(c.finalDate, c.competencia))
      errors.finalDate = "Data final anterior à competência.";
  }

  // Valor original positivo
  if (c.originalValue == null || isNaN(c.originalValue))
    errors.originalValue = "Valor original é obrigatório.";
  else if (c.originalValue < 0) errors.originalValue = "Valor não pode ser negativo.";

  // Percentuais não-negativos
  if (c.finePercent != null && c.finePercent < 0)
    errors.finePercent = "Multa não pode ser negativa.";
  if (c.monthlyInterestPercent != null && c.monthlyInterestPercent < 0)
    errors.monthlyInterestPercent = "Juros não podem ser negativos.";

  // Pagamentos
  c.payments?.forEach((p, i) => {
    if (p.amount < 0) errors[`payments.${i}.amount`] = "Valor negativo.";
    if (p.date && !dateRe.test(p.date))
      errors[`payments.${i}.date`] = "Data inválida.";
  });

  // Modo de correção × índice
  if (c.correctionMode === "index") {
    if (!c.correctionIndexId) {
      errors.correctionIndexId = "Selecione um índice.";
    } else if (!indices.find((i) => i.id === c.correctionIndexId)) {
      errors.correctionIndexId = "Índice não cadastrado.";
    }
  }
  if (c.correctionMode === "manual") {
    if (c.manualCorrectionPercent == null || isNaN(c.manualCorrectionPercent))
      errors.manualCorrectionPercent = "Informe o percentual de correção.";
    else if (c.manualCorrectionPercent < 0)
      errors.manualCorrectionPercent = "Percentual não pode ser negativo.";
  }

  return errors;
}

// ---------- planejador de eventos --------------------------------------------

/**
 * Modelo mínimo de evento ainda não-calculado: só o tipo e a data.
 * O motor processa esses "tickets" em ordem cronológica calculando saldo.
 */
interface EventTicket {
  date: string;
  type: EventType;
  /** Para Pagamento: valor já conhecido. */
  paymentAmount?: number;
  /** Ordem secundária para empate de datas (Vencimento antes de Multa antes de Juros antes de Correção antes de Pagamento). */
  order: number;
}

const TYPE_ORDER: Record<EventType, number> = {
  ValorOriginal: 0,
  Correção: 4,
  Vencimento: 1,
  Multa: 2,
  Juros: 3,
  Pagamento: 5,
};

/**
 * Gera a lista de tickets de eventos entre competência e data final.
 *
 * Convenção observada na planilha-modelo (típica do mercado brasileiro):
 *
 *  • **Correção** → sempre no **dia 1º de cada mês**. Reflete que índices
 *    como CUB/SC, INCC, IPCA, IGP-M são publicados mês-calendário; a
 *    variação do mês M é aplicada na primeira data do mês M.
 *
 *  • **Vencimento** → marcador no dia exato do vencimento.
 *
 *  • **Multa** → no dia seguinte ao vencimento (uma única vez).
 *
 *  • **Juros** → no **último dia de cada mês** após o vencimento. O primeiro
 *    período pode ser parcial (dias entre vencimento e fim do mês). Se a
 *    data final cair no meio de um mês, adiciona-se um Juros parcial
 *    extra na própria data final.
 */
function planTickets(c: Contract): EventTicket[] {
  const tickets: EventTicket[] = [];

  // 1) Marcador inicial.
  tickets.push({
    date: c.competencia,
    type: "ValorOriginal",
    order: TYPE_ORDER.ValorOriginal,
  });

  // 2) Correções no dia 1º de cada mês, do primeiro 1º após a competência
  //    até a data final do cálculo.
  let cursor = firstOfNextMonth(c.competencia);
  while (beforeOrEq(cursor, c.finalDate)) {
    tickets.push({ date: cursor, type: "Correção", order: TYPE_ORDER.Correção });
    cursor = firstOfNextMonth(cursor);
  }

  // 3) Se o vencimento entra na janela do cálculo, processa eventos pós-venc.
  if (c.vencimento && beforeOrEq(c.vencimento, c.finalDate)) {
    const hasFine = c.finePercent != null && c.finePercent > 0;
    const hasInterest = c.monthlyInterestPercent != null && c.monthlyInterestPercent > 0;

    // Vencimento é exibido apenas se houver multa ou juros após ele
    if (hasFine || hasInterest) {
      tickets.push({
        date: c.vencimento,
        type: "Vencimento",
        order: TYPE_ORDER.Vencimento,
      });
    }

    // Multa: dia seguinte (clamp pela data final).
    if (hasFine) {
      const multaDate = addDays(c.vencimento, 1);
      if (beforeOrEq(multaDate, c.finalDate)) {
        tickets.push({ date: multaDate, type: "Multa", order: TYPE_ORDER.Multa });
      }
    }

    if (hasInterest) {
      // Juros no último dia de cada mês após vencimento.
      let jurosCursor = endOfMonth(c.vencimento);
      while (beforeOrEq(jurosCursor, c.finalDate)) {
        // Só emite se for estritamente após o vencimento.
        if (before(c.vencimento, jurosCursor)) {
          tickets.push({ date: jurosCursor, type: "Juros", order: TYPE_ORDER.Juros });
        }
        jurosCursor = endOfMonth(addDays(jurosCursor, 1));
      }

      // Juros parcial na data final, se ela cair no meio de um mês
      // (ainda não coberta por um juros de fim de mês).
      const finalIsEndOfMonth = c.finalDate === endOfMonth(c.finalDate);
      if (!finalIsEndOfMonth && before(c.vencimento, c.finalDate)) {
        tickets.push({ date: c.finalDate, type: "Juros", order: TYPE_ORDER.Juros });
      }
    }
  }

  // 4) Pagamentos parciais.
  //    Para cada pagamento após o vencimento, insere um ticket de Juros na
  //    mesma data (order menor → dispara antes do Pagamento). Isso apura os
  //    juros pro-rata até o dia do pagamento, exatamente como a planilha-modelo.
  const hasInterest = c.monthlyInterestPercent != null && c.monthlyInterestPercent > 0;

  for (const p of c.payments) {
    if (beforeOrEq(p.date, c.finalDate)) {
      tickets.push({
        date: p.date,
        type: "Pagamento",
        order: TYPE_ORDER.Pagamento,
        paymentAmount: p.amount,
      });
      // Juros pré-pagamento apenas pós-vencimento (antes do vencimento não há juros).
      if (hasInterest && c.vencimento && before(c.vencimento, p.date)) {
        tickets.push({ date: p.date, type: "Juros", order: TYPE_ORDER.Juros });
      }
    }
  }

  // Ordenação determinística por (data, ordem do tipo).
  tickets.sort((a, b) => (a.date === b.date ? a.order - b.order : a.date.localeCompare(b.date)));
  return dedupe(tickets);
}

/** Retorna o 1º dia do mês seguinte à data ISO informada. */
function firstOfNextMonth(iso: string): string {
  const d = parseISODate(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return formatISODate(new Date(Date.UTC(y, m + 1, 1)));
}

/** Retorna o último dia do mês da data ISO informada. */
function endOfMonth(iso: string): string {
  const d = parseISODate(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  // dia 0 do mês seguinte = último dia do mês corrente
  return formatISODate(new Date(Date.UTC(y, m + 1, 0)));
}

function dedupe(tickets: EventTicket[]): EventTicket[] {
  const seen = new Set<string>();
  return tickets.filter((t) => {
    const k = `${t.date}|${t.type}|${t.paymentAmount ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return formatISODate(d);
}

// ---------- motor de correção ------------------------------------------------

/**
 * Estado interno do motor de correção entre eventos.
 *  highWaterMark    – para "maxPeriod": valor absoluto do índice no último pico em que
 *                     correção foi aplicada; 0 = não inicializado.
 *  lastPositiveVar  – para "lastPositive": última variação positiva observada;
 *                     undefined = ainda não houve nenhuma.
 */
interface CorrectionState {
  highWaterMark: number;
  lastPositiveVar?: number;
}

/**
 * Resolve a variação a aplicar em um ticket de Correção.
 *
 * Modos de índice negativo (negativeIndexMode):
 *   zero         – usa 0 quando negativo (saldo inalterado); cada mês independente.
 *   maxPeriod    – retoma correção somente quando o valor absoluto do índice superar
 *                  o último pico; aplica apenas o ganho acima do pico.
 *   negative     – aplica a variação como está, mesmo que reduza o saldo.
 *   lastPositive – quando negativa, reaplica a última variação positiva observada;
 *                  se ainda não houver nenhuma, comporta-se como "zero".
 */
function resolveCorrection(
  c: Contract,
  index: CorrectionIndex | undefined,
  monthYear: string,
  state: CorrectionState,
  warnings: string[],
): { aferido: number | undefined; utilizado: number; newState: CorrectionState } {
  if (c.correctionMode === "none") {
    return { aferido: undefined, utilizado: 0, newState: state };
  }

  if (c.correctionMode === "manual") {
    const v = c.manualCorrectionPercent ?? 0;
    return { aferido: v, utilizado: v, newState: state };
  }

  // index
  if (!index) {
    warnings.push("Índice não cadastrado.");
    return { aferido: undefined, utilizado: 0, newState: state };
  }
  const entry = findEntry(index, monthYear);
  if (!entry || entry.variation == null) {
    warnings.push(`Falta variação do índice ${index.name} em ${monthYear}.`);
    return { aferido: undefined, utilizado: 0, newState: state };
  }

  const aferido = entry.variation;
  const mode: NegativeIndexMode = c.negativeIndexMode ?? "zero";

  // ── Usar negativo ──────────────────────────────────────────────────────────
  if (mode === "negative") {
    return { aferido, utilizado: aferido, newState: state };
  }

  // ── Utilizar 0 ────────────────────────────────────────────────────────────
  if (mode === "zero") {
    if (aferido < 0) {
      return { aferido, utilizado: 0, newState: state };
    }
    return { aferido, utilizado: aferido, newState: state };
  }

  // ── Usar o último positivo ────────────────────────────────────────────────
  if (mode === "lastPositive") {
    if (aferido > 0) {
      // Atualiza o último positivo e aplica normalmente.
      return { aferido, utilizado: aferido, newState: { ...state, lastPositiveVar: aferido } };
    }
    // Variação negativa (ou zero): reutiliza o último positivo, se houver.
    const utilizado = state.lastPositiveVar ?? 0;
    return { aferido, utilizado, newState: state };
  }

  // ── Máxima do período (high-water mark no valor absoluto) ─────────────────
  let { highWaterMark } = state;

  if (highWaterMark === 0) {
    // Inicializa com o valor do mês anterior ao primeiro evento de correção.
    // variation = currentValue / prevValue - 1  →  prevValue = currentValue / (1 + variation)
    const prevValue =
      entry.variation !== -1
        ? entry.value / (1 + entry.variation)
        : entry.value;
    highWaterMark = prevValue;
  }

  if (entry.value > highWaterMark) {
    const utilizado = entry.value / highWaterMark - 1;
    return { aferido, utilizado, newState: { ...state, highWaterMark: entry.value } };
  }

  return { aferido, utilizado: 0, newState: { ...state, highWaterMark } };
}

// ---------- motor principal --------------------------------------------------

/**
 * Calcula a evolução completa da parcela.
 *
 * Estado mantido durante a varredura:
 *   - balance: saldo corrente (o que vai virar "Saldo" na linha).
 *   - accumulatedFine: total de multa aplicada (no nosso modelo: um evento único).
 *   - cumulativeInterest: total de juros acumulados desde o vencimento. NÃO é
 *     resetado entre ciclos; cada nova capitalização carrega adiante.
 *   - principalAtVencimento: saldo no momento do vencimento, base da multa.
 *   - deficit: déficit de variações negativas (apenas para modo index).
 *   - lastInterestDate: última data em que juros foram apurados (usada para
 *     contar dias do próximo cálculo de juros).
 *
 * Base de cálculo em cada evento pós-vencimento (reproduzindo a planilha):
 *   • Juros:    base = saldo − multa     (capitaliza juros sobre juros)
 *   • Correção: base = saldo − multa − juros_acumulados   (corrige só o principal)
 *
 * Isso é o que o mercado chama de "juros capitalizáveis com correção sobre o
 * principal" — a Correção não incide sobre juros, mas os Juros incidem sobre
 * juros já lançados (anatocismo mensal). Antes do vencimento, base = saldo.
 */
export function calculateEvolution(
  contract: Contract,
  indices: CorrectionIndex[],
): CalculationResult {
  const warnings: string[] = [];

  const index =
    contract.correctionMode === "index"
      ? indices.find((i) => i.id === contract.correctionIndexId)
      : undefined;

  let balance = 0;
  let accumulatedFine = 0;
  let cumulativeInterest = 0;
  let correctionState: CorrectionState = { highWaterMark: 0 };
  let lastInterestDate: string | null = null;
  let afterVencimento = false;

  let totalCorrection = 0;
  let totalFine = 0;
  let totalInterest = 0;
  let totalPayments = 0;

  const events: EvolutionEvent[] = [];
  const tickets = planTickets(contract);

  for (const t of tickets) {
    const previousBalance = balance;

    if (t.type === "ValorOriginal") {
      balance = contract.originalValue;
      events.push({
        date: t.date,
        type: "ValorOriginal",
        previousBalance: 0,
        multa: 0,
        juros: 0,
        base: contract.originalValue,
        value: contract.originalValue,
        balance,
      });
      continue;
    }

    if (t.type === "Correção") {
      // Pré-vencimento: corrige saldo cheio.
      // Pós-vencimento: corrige só o principal (saldo − multa − juros acumulados).
      const base = afterVencimento
        ? balance - accumulatedFine - cumulativeInterest
        : balance;

      const { aferido, utilizado, newState } = resolveCorrection(
        contract,
        index,
        monthYearOf(t.date),
        correctionState,
        warnings,
      );
      correctionState = newState;

      const value = base * utilizado;
      balance += value;
      totalCorrection += value;

      events.push({
        date: t.date,
        type: "Correção",
        previousBalance,
        multa: accumulatedFine,
        juros: cumulativeInterest,
        base,
        indexAferido: aferido,
        indexUtilizado: utilizado,
        value,
        balance,
        appliedRate: utilizado,
      });
      continue;
    }

    if (t.type === "Vencimento") {
      afterVencimento = true;
      events.push({
        date: t.date,
        type: "Vencimento",
        previousBalance,
        multa: 0,
        juros: 0,
        base: balance,
        value: 0,
        balance,
      });
      lastInterestDate = t.date;
      continue;
    }

    if (t.type === "Multa") {
      // Multa sobre o saldo corrente no momento da cobrança (dia seguinte ao
      // vencimento). Usa balance e não principalAtVencimento para capturar
      // eventuais correções aplicadas no próprio dia do vencimento (situação
      // que ocorre quando vencimento cai em dia 1º — mesma data da Correção).
      const base = balance;
      const value = base * contract.finePercent;
      accumulatedFine += value;
      balance += value;
      totalFine += value;

      events.push({
        date: t.date,
        type: "Multa",
        previousBalance,
        multa: accumulatedFine,
        juros: cumulativeInterest,
        base,
        indexUtilizado: contract.finePercent,
        value,
        balance,
        appliedRate: contract.finePercent,
      });
      continue;
    }

    if (t.type === "Juros") {
      // Base dos juros: saldo − multa (juros incidem sobre principal + juros
      // anteriores, ou seja, capitaliza mês a mês).
      const base = balance - accumulatedFine;
      const startDate = lastInterestDate ?? contract.vencimento;
      const days = Math.max(0, daysBetween(startDate, t.date));

      // Avança a referência de data mesmo que o evento seja pulado, para não
      // acumular dias de períodos com base não-positiva na próxima apuração.
      lastInterestDate = t.date;

      // Sem dias decorridos ou base não-positiva (saldo consumido pela multa) →
      // não há juros a lançar. O ticket pode ter sido gerado pelo disparo de um
      // pagamento num período sem saldo líquido suficiente.
      if (days === 0 || base <= 0) continue;

      const rate = ratePeriodFromMonthly(contract.monthlyInterestPercent, days);
      // Arredondamento de 2 casas — a planilha-modelo arredonda nessa coluna.
      const value = round2(base * rate);

      cumulativeInterest += value;
      balance += value;
      totalInterest += value;

      events.push({
        date: t.date,
        type: "Juros",
        previousBalance,
        multa: accumulatedFine,
        juros: cumulativeInterest,
        base,
        value,
        balance,
        days,
        appliedRate: rate,
        indexUtilizado: rate,
      });
      continue;
    }

    if (t.type === "Pagamento") {
      const value = t.paymentAmount ?? 0;
      balance -= value;
      totalPayments += value;

      events.push({
        date: t.date,
        type: "Pagamento",
        previousBalance,
        multa: accumulatedFine,
        juros: cumulativeInterest,
        base: previousBalance,
        value,
        balance,
      });
      continue;
    }
  }

  const summary: EvolutionSummary = {
    originalValue: contract.originalValue,
    correction: totalCorrection,
    fine: totalFine,
    interest: totalInterest,
    payments: totalPayments,
    total: balance,
  };

  return { events, summary, warnings: dedupArr(warnings) };
}

function dedupArr<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
