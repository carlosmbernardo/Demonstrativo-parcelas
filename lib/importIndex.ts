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
  const entries: IndexEntry[] = [];

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const rawMonth = row?.[monthCol];
    const rawValue = row?.[valueCol];

    const monthYear = parseMonthYear(rawMonth);
    const value = parseValue(rawValue);

    if (!monthYear || value == null) {
      if (rawMonth != null || rawValue != null) {
        warnings.push(`Linha ${i + 1}: ignorada (mês="${rawMonth}", valor="${rawValue}")`);
      }
      continue;
    }

    entries.push({ id: uid(), monthYear, value });
  }

  return { entries, warnings };
}
