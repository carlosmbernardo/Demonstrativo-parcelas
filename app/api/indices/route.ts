// app/api/indices/route.ts
// Persiste os índices de correção em data/indices.json no servidor.
// Todos os dispositivos da rede leem/gravam no mesmo arquivo.

import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "indices.json");

export async function GET() {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    // Arquivo ainda não existe → retorna vazio.
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const indices = await req.json();
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(indices, null, 2), "utf-8");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Erro ao salvar índices:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
