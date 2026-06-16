// /lib/export.ts
// -----------------------------------------------------------------------------
// Exportação para Excel (.xlsx) usando xlsx-js-style.
// Layout baseado na planilha-modelo: cabeçalho colorido com dados do contrato,
// bloco de resumo, cabeçalho duplo da tabela e linhas de dados com fórmulas.
// -----------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as XLSX from "xlsx-js-style";
import {
  CalculationResult,
  Contract,
  CorrectionIndex,
  EvolutionEvent,
} from "@/types";

// ── Formatos numéricos Excel ─────────────────────────────────────────────────
const FMT_RS   = '_-"R$"\\ * #,##0.00_-;\\-"R$"\\ * #,##0.00_-;_-"R$"\\ * "-"??_-;_-@_-';
const FMT_PCT  = "0.00%";
const FMT_DATE = "dd/mm/yyyy";
const FMT_MY   = "mm/yyyy";
const FMT_NUM  = "#,##0.00";

// ── Paleta de cores (RRGGBB, sem alpha) ──────────────────────────────────────
const C_TITLE_BG  = "4472C4"; // azul cabeçalho título
const C_TITLE_FG  = "FFFFFF"; // branco título
const C_COL_BG    = "4472C4"; // azul cabeçalho colunas
const C_COL_FG    = "FFFFFF"; // branco cabeçalho colunas
const C_DATA_BG   = "DEEBF7"; // azul claro colunas pares (A, C, E, G, I)
const C_DATA_ALT  = "FFFFFF"; // branco colunas ímpares (B, D, F, H)
const C_TOTAL_BG  = "BDD7EE"; // azul médio célula total
const C_BORDER    = "9DC3E6"; // borda suave dados

// ── Estilos base ─────────────────────────────────────────────────────────────

/** Estilo título (linha 1). */
const ST_TITLE: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_TITLE_BG } },
  font: { bold: true, sz: 13, color: { rgb: C_TITLE_FG }, name: "Calibri" },
  alignment: { horizontal: "center", vertical: "center" },
};

/** Estilo cabeçalho de coluna (linhas 9–10). */
const ST_COL: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_COL_BG } },
  font: { bold: true, sz: 10, color: { rgb: C_COL_FG }, name: "Calibri" },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top:    { style: "thin", color: { rgb: C_COL_FG } },
    bottom: { style: "thin", color: { rgb: C_COL_FG } },
    left:   { style: "thin", color: { rgb: C_COL_FG } },
    right:  { style: "thin", color: { rgb: C_COL_FG } },
  },
};

/** Rótulo de info no cabeçalho (coluna A). */
const ST_LBL: object = {
  font: { bold: true, sz: 10, name: "Calibri" },
  alignment: { horizontal: "left", vertical: "center" },
};

/** Valor de info no cabeçalho. */
const ST_VAL: object = {
  font: { sz: 10, name: "Calibri" },
  alignment: { horizontal: "left", vertical: "center" },
};

/** Valor monetário no bloco de resumo. */
const ST_SUM_RS: object = {
  font: { sz: 10, name: "Calibri" },
  alignment: { horizontal: "right", vertical: "center" },
  numFmt: FMT_RS,
};

/** Total no canto superior direito (I3:I7). */
const ST_TOTAL: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_TOTAL_BG } },
  font: { bold: true, sz: 12, name: "Calibri" },
  alignment: { horizontal: "right", vertical: "center" },
  numFmt: FMT_RS,
};

/** Dado texto numa linha de evento. */
const ST_DAT_TXT: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_DATA_BG } },
  font: { sz: 10, name: "Calibri" },
  alignment: { horizontal: "left", vertical: "center" },
  border: { bottom: { style: "hair", color: { rgb: C_BORDER } } },
};

/** Dado data numa linha de evento. */
const ST_DAT_DATE: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_DATA_BG } },
  font: { sz: 10, name: "Calibri" },
  alignment: { horizontal: "center", vertical: "center" },
  border: { bottom: { style: "hair", color: { rgb: C_BORDER } } },
  numFmt: FMT_DATE,
};

/** Dado monetário numa linha de evento. */
const ST_DAT_RS: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_DATA_BG } },
  font: { sz: 10, name: "Calibri" },
  alignment: { horizontal: "right", vertical: "center" },
  border: { bottom: { style: "hair", color: { rgb: C_BORDER } } },
  numFmt: FMT_RS,
};

/** Dado percentual numa linha de evento. */
const ST_DAT_PCT: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_DATA_BG } },
  font: { sz: 10, name: "Calibri" },
  alignment: { horizontal: "right", vertical: "center" },
  border: { bottom: { style: "hair", color: { rgb: C_BORDER } } },
  numFmt: FMT_PCT,
};

/** Célula vazia com estilo (para mesclas coloridas). */
const ST_EMPTY_DATA: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_DATA_BG } },
  border: { bottom: { style: "hair", color: { rgb: C_BORDER } } },
};

// ── Estilos alternados (branco) — colunas B, D, F, H ─────────────────────────
/** Texto branco (coluna alternada). */
const ST_DAT_TXT_W: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_DATA_ALT } },
  font: { sz: 10, name: "Calibri" },
  alignment: { horizontal: "left", vertical: "center" },
  border: { bottom: { style: "hair", color: { rgb: C_BORDER } } },
};

/** Monetário branco (coluna alternada). */
const ST_DAT_RS_W: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_DATA_ALT } },
  font: { sz: 10, name: "Calibri" },
  alignment: { horizontal: "right", vertical: "center" },
  border: { bottom: { style: "hair", color: { rgb: C_BORDER } } },
  numFmt: FMT_RS,
};

/** Percentual branco (coluna alternada). */
const ST_DAT_PCT_W: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_DATA_ALT } },
  font: { sz: 10, name: "Calibri" },
  alignment: { horizontal: "right", vertical: "center" },
  border: { bottom: { style: "hair", color: { rgb: C_BORDER } } },
  numFmt: FMT_PCT,
};

/** Vazio branco (coluna alternada). */
const ST_EMPTY_W: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_DATA_ALT } },
  border: { bottom: { style: "hair", color: { rgb: C_BORDER } } },
};

// ── Estilos da tabela CUB (colunas K, L, M) ──────────────────────────────────

/** Mês/Ano na tabela CUB (coluna K, azul). */
const ST_CUB_DATE: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_DATA_BG } },
  font: { sz: 10, name: "Calibri" },
  alignment: { horizontal: "center", vertical: "center" },
  border: { bottom: { style: "hair", color: { rgb: C_BORDER } } },
  numFmt: FMT_MY,
};

/** Valor na tabela CUB (coluna L, branco). */
const ST_CUB_NUM_W: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_DATA_ALT } },
  font: { sz: 10, name: "Calibri" },
  alignment: { horizontal: "right", vertical: "center" },
  border: { bottom: { style: "hair", color: { rgb: C_BORDER } } },
  numFmt: FMT_NUM,
};

// ── Variantes brancas adicionais (necessárias para alternância por linha) ─────

/** Data principal branca (dd/mm/yyyy). */
const ST_DAT_DATE_W: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_DATA_ALT } },
  font: { sz: 10, name: "Calibri" },
  alignment: { horizontal: "center", vertical: "center" },
  border: { bottom: { style: "hair", color: { rgb: C_BORDER } } },
  numFmt: FMT_DATE,
};

/** Mês/Ano CUB branco (mm/yyyy). */
const ST_CUB_DATE_W: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_DATA_ALT } },
  font: { sz: 10, name: "Calibri" },
  alignment: { horizontal: "center", vertical: "center" },
  border: { bottom: { style: "hair", color: { rgb: C_BORDER } } },
  numFmt: FMT_MY,
};

/** Valor CUB azul (#,##0.00). */
const ST_CUB_NUM: object = {
  fill: { patternType: "solid", fgColor: { rgb: C_DATA_BG } },
  font: { sz: 10, name: "Calibri" },
  alignment: { horizontal: "right", vertical: "center" },
  border: { bottom: { style: "hair", color: { rgb: C_BORDER } } },
  numFmt: FMT_NUM,
};

// ── Mapeamento de tipos de evento para exibição ──────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  ValorOriginal: "Valor original",
  Correção:      "Correção",
  Vencimento:    "Vencimento",
  Multa:         "Multa",
  Juros:         "Juros",
  Pagamento:     "Pagamento",
};

// ── Utilitários ──────────────────────────────────────────────────────────────

/**
 * Converte data ISO "YYYY-MM-DD" para número serial Excel.
 * Fórmula: dias UTC desde Unix epoch + 25569 (serial de 1970-01-01 no Excel).
 * Não depende de XLSX.utils.datenum (ausente no xlsx-js-style).
 */
function isoSerial(iso: string): number | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  const utcMs = Date.UTC(y, m - 1, d);
  return Math.floor(utcMs / 86400000) + 25569;
}

/** Formata fração em string percentual para texto de cabeçalho. */
function pctStr(v: number | undefined): string {
  if (v == null || isNaN(v)) return "";
  return (v * 100).toFixed(4).replace(".", ",") + "%";
}

/**
 * Insere uma célula no worksheet.
 * @param ws  Worksheet
 * @param addr Endereço ("A1", "B3", …)
 * @param v   Valor
 * @param t   Tipo SheetJS ("s"=string, "n"=número, "z"=vazio)
 * @param st  Estilo xlsx-js-style
 * @param nf  Formato numérico (z property – compatibilidade SheetJS)
 */
function put(
  ws: any,
  addr: string,
  v: unknown,
  t: "s" | "n" | "z",
  st?: object,
  nf?: string,
) {
  const cell: any = { v, t };
  if (nf) cell.z = nf;
  if (st) cell.s = st;
  ws[addr] = cell;
}

/** Insere fórmula com resultado cacheado. */
function putFormula(
  ws: any,
  addr: string,
  formula: string,
  cached: number,
  st?: object,
  nf?: string,
) {
  const cell: any = { t: "n", f: formula, v: cached };
  if (nf) cell.z = nf;
  if (st) cell.s = st;
  ws[addr] = cell;
}

/** Insere célula vazia com estilo (para regiões mescladas ficarem coloridas). */
function blank(ws: any, addr: string, st?: object) {
  ws[addr] = { v: "", t: "s", s: st ?? {} };
}

// ── Função principal de exportação ──────────────────────────────────────────

/**
 * Gera o arquivo .xlsx em memória e dispara o download no navegador.
 *
 * Estrutura:
 *   Linha 1 : Título (mesclado A1:I1, fundo azul)
 *   Linhas 3-7 : Info do contrato (esq) + Resumo financeiro (dir)
 *   Linhas 9-10: Cabeçalho duplo da tabela (azul, "Índice" em F9:G9)
 *   Linha 11+  : Eventos – Saldo Anterior (C) e Saldo (I) como fórmulas
 */
export function exportToExcel(
  contract: Contract,
  result: CalculationResult,
  indices: CorrectionIndex[],
): void {
  const idx = indices.find((i) => i.id === contract.correctionIndexId);

  const correcaoLabel =
    contract.correctionMode === "index"
      ? `Índice ${idx?.name ?? "?"}`
      : contract.correctionMode === "manual"
      ? `Manual ${pctStr(contract.manualCorrectionPercent)}`
      : "Sem correção";

  const { summary, events } = result;
  const ws: any = {};

  // ───────────────────────────────────────────────────────────────────────
  // LINHA 1 — Título principal
  // ───────────────────────────────────────────────────────────────────────
  put(ws, "A1", "Detalhamento da evolução do valor", "s", ST_TITLE);
  for (const c of ["B","C","D","E","F","G","H","I"]) blank(ws, `${c}1`, ST_TITLE);

  // ───────────────────────────────────────────────────────────────────────
  // LINHAS 3–7 — Cabeçalho: info do contrato (A–E) + resumo (F–I)
  // ───────────────────────────────────────────────────────────────────────

  // Col A: rótulos
  put(ws, "A3", "Título",       "s", ST_LBL);
  put(ws, "A4", "Receber de",   "s", ST_LBL);
  put(ws, "A5", "Competência",  "s", ST_LBL);
  put(ws, "A6", "Correção",     "s", ST_LBL);
  put(ws, "A7", "Juros mensal", "s", ST_LBL);

  // Col B–E: valores do contrato
  // Linha 3: parcela + título (B3 = fracção, C3:E3 = texto)
  put(ws, "B3", `${contract.currentInstallment}/${contract.totalInstallments}`, "s", ST_VAL);
  put(ws, "C3", contract.title || "", "s", ST_VAL);
  blank(ws, "D3", ST_VAL); blank(ws, "E3", ST_VAL);

  // Linha 4: devedor (B4:E4)
  put(ws, "B4", contract.debtor || "", "s", ST_VAL);
  blank(ws, "C4", ST_VAL); blank(ws, "D4", ST_VAL); blank(ws, "E4", ST_VAL);

  // Linha 5: competência + vencimento
  const compSerial = isoSerial(contract.competencia);
  if (compSerial) put(ws, "B5", compSerial, "n", ST_VAL, FMT_DATE);
  put(ws, "D5", "Vencimento", "s", ST_LBL);
  const vencSerial = isoSerial(contract.vencimento);
  if (vencSerial) put(ws, "E5", vencSerial, "n", ST_VAL, FMT_DATE);

  // Linha 6: tipo de correção
  put(ws, "B6", correcaoLabel, "s", ST_VAL);

  // Linha 7: juros mensal + multa (reutiliza colunas D–E livres)
  put(ws, "B7", contract.monthlyInterestPercent ?? 0, "n", ST_VAL, FMT_PCT);
  put(ws, "D7", "Multa",                              "s", ST_LBL);
  put(ws, "E7", contract.finePercent ?? 0,            "n", ST_VAL, FMT_PCT);

  // Col F–G: rótulos + valores do resumo
  const SUMMARY_ROWS: [string, string, number][] = [
    ["F3", "G3", summary.originalValue],
    ["F4", "G4", summary.correction   ],
    ["F5", "G5", summary.payments     ],
    ["F6", "G6", summary.fine         ],
    ["F7", "G7", summary.interest     ],
  ];
  const SUMMARY_LABELS = [
    "Valor original", "Correção", "Pagamento", "Multa", "Juros",
  ];
  SUMMARY_ROWS.forEach(([fl, gl, val], i) => {
    put(ws, fl, SUMMARY_LABELS[i], "s", ST_LBL);
    put(ws, gl, val, "n", ST_SUM_RS, FMT_RS);
  });

  // Col H: vazio no bloco de resumo
  for (const r of ["3","4","5","6","7"]) blank(ws, `H${r}`);

  // Col I: TOTAL (I3:I7 mescladas)
  put(ws, "I3", summary.total, "n", ST_TOTAL, FMT_RS);
  for (const r of ["4","5","6","7"]) blank(ws, `I${r}`, ST_TOTAL);

  // ───────────────────────────────────────────────────────────────────────
  // LINHAS 9–10 — Cabeçalho duplo da tabela
  // ───────────────────────────────────────────────────────────────────────
  // Linha 9 — cabeçalhos principais (colunas sem sub-cabeçalho ficam mescladas 9:10)
  const HDR9: [string, string][] = [
    ["A9","Data"], ["B9","Tipo"], ["C9","Saldo Anterior"],
    ["D9","Multa"], ["E9","Juros"],
    ["F9","Índice"],   // mescla F9:G9
    ["H9","Valor"], ["I9","Saldo"],
  ];
  for (const [addr, label] of HDR9) put(ws, addr, label, "s", ST_COL);
  blank(ws, "G9", ST_COL); // parte da mescla F9:G9

  // Linha 10 — sub-cabeçalhos do Índice + células vazias das demais mesclagens
  put(ws, "F10", "Aferido",   "s", ST_COL);
  put(ws, "G10", "Utilizado", "s", ST_COL);
  for (const c of ["A","B","C","D","E","H","I"]) blank(ws, `${c}10`, ST_COL);

  // ───────────────────────────────────────────────────────────────────────
  // LINHAS DE DADOS — a partir de 11
  // ───────────────────────────────────────────────────────────────────────
  const FIRST_ROW = 11;

  events.forEach((ev: EvolutionEvent, i: number) => {
    const r = FIRST_ROW + i;

    // Alternância horizontal: linhas pares → azul, ímpares → branco
    const isBlue  = i % 2 === 0;
    const stDate  = isBlue ? ST_DAT_DATE  : ST_DAT_DATE_W;
    const stTxt   = isBlue ? ST_DAT_TXT   : ST_DAT_TXT_W;
    const stRS    = isBlue ? ST_DAT_RS    : ST_DAT_RS_W;
    const stPCT   = isBlue ? ST_DAT_PCT   : ST_DAT_PCT_W;
    const stEmpty = isBlue ? ST_EMPTY_DATA : ST_EMPTY_W;

    // A — Data
    const dSerial = isoSerial(ev.date);
    if (dSerial) put(ws, `A${r}`, dSerial, "n", stDate, FMT_DATE);
    else         blank(ws, `A${r}`, stDate);

    // B — Tipo
    put(ws, `B${r}`, TYPE_LABEL[ev.type] ?? ev.type, "s", stTxt);

    // C — Saldo Anterior: fórmula =I{r-1} (exceto 1ª linha)
    if (i === 0) {
      blank(ws, `C${r}`, stRS);
    } else {
      putFormula(ws, `C${r}`, `I${r - 1}`, ev.previousBalance, stRS, FMT_RS);
    }

    // D — Multa acumulada (vazio se zero)
    if (ev.multa > 0) put(ws, `D${r}`, ev.multa, "n", stRS, FMT_RS);
    else              blank(ws, `D${r}`, stEmpty);

    // E — Juros acumulados (vazio se zero)
    if (ev.juros > 0) put(ws, `E${r}`, ev.juros, "n", stRS, FMT_RS);
    else              blank(ws, `E${r}`, stEmpty);

    // F — Índice Aferido
    if (ev.indexAferido != null) put(ws, `F${r}`, ev.indexAferido, "n", stPCT, FMT_PCT);
    else                         blank(ws, `F${r}`, stEmpty);

    // G — Índice Utilizado
    if (ev.indexUtilizado != null) put(ws, `G${r}`, ev.indexUtilizado, "n", stPCT, FMT_PCT);
    else                           blank(ws, `G${r}`, stEmpty);

    // H — Valor do evento
    put(ws, `H${r}`, ev.value, "n", stRS, FMT_RS);

    // I — Saldo (Pagamento subtrai; demais eventos somam ao saldo anterior)
    const formula =
      i === 0
        ? `ROUND(H${r},2)`
        : ev.type === "Pagamento"
        ? `C${r}-H${r}`
        : `C${r}+H${r}`;
    putFormula(ws, `I${r}`, formula, ev.balance, stRS, FMT_RS);
  });

  // ───────────────────────────────────────────────────────────────────────
  // TABELA CUB — colunas K, L, M (J como espaçador)
  // Exibida quando correctionMode = "index" e um índice está selecionado.
  // ───────────────────────────────────────────────────────────────────────
  const hasCubTable = contract.correctionMode === "index" && !!idx;
  let cubEntries: Array<{ monthYear: string; value: number; variation?: number }> = [];

  if (hasCubTable && idx) {
    const compMonth  = contract.competencia?.slice(0, 7) ?? "";
    const finalMonth = contract.finalDate?.slice(0, 7)  ?? "";
    cubEntries = [...idx.entries]
      .filter(
        (e) =>
          (!compMonth  || e.monthYear >= compMonth) &&
          (!finalMonth || e.monthYear <= finalMonth),
      )
      .sort((a, b) => a.monthYear.localeCompare(b.monthYear));

    // Linha 9 — nome do índice (K9:M9 mesclados)
    put(ws, "K9", idx.name, "s", ST_COL);
    blank(ws, "L9", ST_COL);
    blank(ws, "M9", ST_COL);

    // Linha 10 — sub-cabeçalhos
    put(ws, "K10", "Mês/Ano",    "s", ST_COL);
    put(ws, "L10", "Valor",      "s", ST_COL);
    put(ws, "M10", "Variação %", "s", ST_COL);

    // Dados — uma linha por entrada do índice (mesma alternância horizontal)
    cubEntries.forEach((entry, i) => {
      const r = FIRST_ROW + i;
      const isBlue   = i % 2 === 0;
      const stCubDt  = isBlue ? ST_CUB_DATE  : ST_CUB_DATE_W;
      const stCubNum = isBlue ? ST_CUB_NUM   : ST_CUB_NUM_W;
      const stCubPct = isBlue ? ST_DAT_PCT   : ST_DAT_PCT_W;
      const stEmpty  = isBlue ? ST_EMPTY_DATA : ST_EMPTY_W;

      const mySerial = isoSerial(`${entry.monthYear}-01`);
      if (mySerial !== undefined) {
        put(ws, `K${r}`, mySerial, "n", stCubDt, FMT_MY);
      } else {
        blank(ws, `K${r}`, stEmpty);
      }
      put(ws, `L${r}`, entry.value, "n", stCubNum, FMT_NUM);
      if (entry.variation != null) {
        put(ws, `M${r}`, entry.variation, "n", stCubPct, FMT_PCT);
      } else {
        blank(ws, `M${r}`, stEmpty);
      }
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // METADADOS DO WORKSHEET
  // ───────────────────────────────────────────────────────────────────────
  const lastEventRow = FIRST_ROW + events.length - 1;
  const lastCubRow   = hasCubTable && cubEntries.length > 0
    ? FIRST_ROW + cubEntries.length - 1
    : 0;
  const lastRow = Math.max(lastEventRow, lastCubRow, FIRST_ROW);
  const lastCol = hasCubTable ? "M" : "I";
  ws["!ref"] = `A1:${lastCol}${lastRow}`;

  // Largura das colunas
  const baseCols = [
    { wch: 12 }, // A: Data
    { wch: 16 }, // B: Tipo
    { wch: 16 }, // C: Saldo Anterior
    { wch: 14 }, // D: Multa
    { wch: 14 }, // E: Juros
    { wch: 13 }, // F: Índice Aferido
    { wch: 13 }, // G: Índice Utilizado
    { wch: 14 }, // H: Valor
    { wch: 17 }, // I: Saldo
  ];
  ws["!cols"] = hasCubTable
    ? [
        ...baseCols,
        { wch: 2  }, // J: espaçador
        { wch: 12 }, // K: Mês/Ano (CUB)
        { wch: 13 }, // L: Valor (CUB)
        { wch: 11 }, // M: Variação % (CUB)
      ]
    : baseCols;

  // Altura das linhas do cabeçalho
  ws["!rows"] = [
    { hpt: 26 }, // 1: título
    { hpt: 5  }, // 2: espaço
    { hpt: 18 }, // 3: info
    { hpt: 18 }, // 4: info
    { hpt: 18 }, // 5: info
    { hpt: 18 }, // 6: info
    { hpt: 18 }, // 7: info
    { hpt: 5  }, // 8: espaço
    { hpt: 22 }, // 9: cabeçalho linha 1
    { hpt: 16 }, // 10: cabeçalho linha 2
  ];

  // Mesclas
  const baseMerges = [
    // Linha 1 — título
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    // Bloco de info
    { s: { r: 2, c: 2 }, e: { r: 2, c: 4 } }, // C3:E3 (título do contrato)
    { s: { r: 3, c: 1 }, e: { r: 3, c: 4 } }, // B4:E4 (devedor)
    // Total
    { s: { r: 2, c: 8 }, e: { r: 6, c: 8 } }, // I3:I7
    // Cabeçalho duplo — mesclagem vertical (9:10) para colunas sem sub-label
    { s: { r: 8, c: 0 }, e: { r: 9, c: 0 } }, // A9:A10
    { s: { r: 8, c: 1 }, e: { r: 9, c: 1 } }, // B9:B10
    { s: { r: 8, c: 2 }, e: { r: 9, c: 2 } }, // C9:C10
    { s: { r: 8, c: 3 }, e: { r: 9, c: 3 } }, // D9:D10
    { s: { r: 8, c: 4 }, e: { r: 9, c: 4 } }, // E9:E10
    { s: { r: 8, c: 5 }, e: { r: 8, c: 6 } }, // F9:G9 (Índice)
    { s: { r: 8, c: 7 }, e: { r: 9, c: 7 } }, // H9:H10
    { s: { r: 8, c: 8 }, e: { r: 9, c: 8 } }, // I9:I10
  ];
  ws["!merges"] = hasCubTable
    ? [
        ...baseMerges,
        { s: { r: 8, c: 10 }, e: { r: 8, c: 12 } }, // K9:M9 (nome do índice)
      ]
    : baseMerges;

  // ───────────────────────────────────────────────────────────────────────
  // GERAR E BAIXAR O ARQUIVO
  // ───────────────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Evolução");

  const safeTitle = (contract.title || "contrato")
    .replace(/[^a-z0-9_-]+/gi, "_")
    .slice(0, 40);
  XLSX.writeFile(wb, `evolucao_${safeTitle}.xlsx`);
}
