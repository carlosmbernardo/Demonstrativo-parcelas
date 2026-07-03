import * as XLSX from "xlsx";
import { IndexEntry } from "@/types";
import { uid } from "./storage";

const PT_MONTHS: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

function parseMonthYear(raw: unknown): string | null {
  if (raw == null) return null;

  // Serial de data do Excel (número)
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d?.y && d?.m) {
      return `${d.y}-${String(d.m).padStart(2, "0")}`;
    }
  }

  const s = String(raw).trim();

  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;

  // MM/YYYY ou M/YYYY
  const mmyyyy = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (mmyyyy) return `${mmyyyy[2]}-${mmyyyy[1].padStart(2, "0")}`;

  // "Jan/2024", "Janeiro/2024", "jan 2024", "jan-2024"
  const named = s.toLowerCase().match(/^([a-záéíóúãõ]{3})[a-z]*[\/\s\-](\d{4})$/);
  if (named && PT_MONTHS[named[1]]) return `${named[2]}-${PT_MONTHS[named[1]]}`;

  return null;
}

function parseValue(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return raw;
  const n = parseFloat(String(raw).trim().replace(",", "."));
  return isNaN(n) ? null : n;
}

/**
 * Reconhece célula formatada como percentual (ex.: "0.65 %", "-0,21%").
 * Retorna a fração decimal (0.65 % → 0.0065) ou null se a célula não trouxer "%".
 * Usada para planilhas que trazem a variação já pronta (ex.: INPC/IBGE),
 * em vez do valor absoluto do índice.
 */
function parsePercent(raw: unknown): number | null {
  if (raw == null || typeof raw === "number") return null;
  const s = String(raw).trim();
  if (!s.includes("%")) return null;
  const n = parseFloat(s.replace("%", "").trim().replace(",", "."));
  return isNaN(n) ? null : n / 100;
}

export interface ImportResult {
  entries: IndexEntry[];
  warnings: string[];
}

export async function parseIndexSpreadsheet(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  if (rows.length === 0) return { entries: [], warnings: ["Planilha vazia."] };

  // Detecta linha de cabeçalho e colunas de mês e valor
  let dataStart = 0;
  let monthCol = 0;
  let valueCol = 1;

  const firstRow = (rows[0] as unknown[]).map((v) => String(v ?? "").toLowerCase());
  const MONTH_KEYS = ["mês", "mes", "data", "período", "periodo", "month"];
  const VALUE_KEYS = ["valor", "índice", "indice", "index", "value"];

  const fMonth = firstRow.findIndex((h) => MONTH_KEYS.some((k) => h.includes(k)));
  const fValue = firstRow.findIndex((h) => VALUE_KEYS.some((k) => h.includes(k)));

  if (fMonth >= 0 && fValue >= 0) {
    dataStart = 1;
    monthCol = fMonth;
    valueCol = fValue;
  }

  const warnings: string[] = [];

  // Linhas cruas, ainda sem decidir se a coluna traz valor absoluto do
  // índice ou a variação percentual já pronta (ex.: planilhas do INPC/IBGE
  // trazem "mês + variação%", sem o valor acumulado do índice).
  const raw: { line: number; monthYear: string; value?: number; percent?: number }[] = [];

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const rawMonth = row?.[monthCol];
    const rawValue = row?.[valueCol];

    const monthYear = parseMonthYear(rawMonth);
    const percent = parsePercent(rawValue);
    const value = percent == null ? parseValue(rawValue) : null;

    if (!monthYear || (value == null && percent == null)) {
      if (rawMonth != null || rawValue != null) {
        warnings.push(`Linha ${i + 1}: ignorada (mês="${rawMonth}", valor="${rawValue}")`);
      }
      continue;
    }

    raw.push({ line: i + 1, monthYear, value: value ?? undefined, percent: percent ?? undefined });
  }

  const isPercentFormat = raw.some((r) => r.percent != null);

  if (!isPercentFormat) {
    const entries: IndexEntry[] = raw
      .filter((r) => r.value != null)
      .map((r) => ({ id: uid(), monthYear: r.monthYear, value: r.value as number }));
    return { entries, warnings };
  }

  // Formato "variação%": não há valor absoluto do índice, então sintetiza-se
  // uma série de valores compondo as variações a partir de uma base
  // arbitrária (100). O valor em si não tem significado absoluto — serve só
  // para que o resto do app (que deriva a variação de `value[i]/value[i-1]`)
  // continue funcionando sem mudanças. A variação recalculada bate com a
  // percentual importada.
  const sorted = raw
    .filter((r) => r.percent != null)
    .sort((a, b) => a.monthYear.localeCompare(b.monthYear));

  for (const r of raw) {
    if (r.percent == null) {
      warnings.push(`Linha ${r.line}: ignorada (mês="${r.monthYear}", sem variação percentual).`);
    }
  }

  const entries: IndexEntry[] = [];
  let value = 100;
  sorted.forEach((r, i) => {
    if (i > 0) value = value * (1 + (r.percent as number));
    entries.push({ id: uid(), monthYear: r.monthYear, value });
  });

  return { entries, warnings };
}
