import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Evolução de Parcelas",
  description: "Cálculo de evolução de parcelas de contratos com correção monetária",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-base font-semibold text-slate-800">
              Evolução de Parcelas
            </Link>
            <nav className="flex gap-1 text-sm">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-slate-700 hover:bg-slate-100"
              >
                Calculadora
              </Link>
              <Link
                href="/indices"
                className="px-3 py-1.5 rounded-md text-slate-700 hover:bg-slate-100"
              >
                Índices
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
