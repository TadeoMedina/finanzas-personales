"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import QuickBar from "@/components/QuickBar";
import {
  loadImports,
  loadTxs,
  type ImportBatch,
  type ImportMeta,
  type Tx,
} from "@/lib/storage";

function upper(v: any, fallback = "") {
  if (typeof v !== "string") return fallback;
  const s = v.trim();
  return s ? s.toUpperCase() : fallback;
}

function safeStr(v: any, fallback = "") {
  if (typeof v !== "string") return fallback;
  const s = v.trim();
  return s ? s : fallback;
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function last3<T>(arr: T[]) {
  return arr.slice(0, 3);
}

export default function ImportPage() {
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);

  useEffect(() => {
    setImports(loadImports());
    setTxs(loadTxs());
  }, []);

  const last3Imports = useMemo(() => last3(imports), [imports]);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* QUICKBAR — más ancho y con aire */}
        <section className="mx-auto max-w-6xl">
          <div className="min-h-[52vh] flex items-center justify-center">
            <div className="w-full max-w-5xl px-2">
              <QuickBar />
            </div>
          </div>
        </section>

        {/* ÚLTIMAS CARGAS — compactas */}
        <section className="mx-auto mt-8 max-w-2xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold tracking-wide text-[var(--fipe-text)]">
              Últimas cargas
            </div>
            <Link
              href="/history"
              className="text-xs text-[color:var(--fipe-muted)] hover:text-[var(--fipe-text)]"
            >
              Ver todo →
            </Link>
          </div>

          {last3Imports.length === 0 ? (
            <div className="rounded-2xl border border-[var(--fipe-border)] bg-[var(--fipe-surface)] p-3 text-sm text-[color:var(--fipe-muted)]">
              Todavía no hay cargas. Probá importar un PDF/XLSX o cargar manualmente arriba.
            </div>
          ) : (
            <div className="space-y-2">
              {last3Imports.map((b, idx) => {
                const meta: ImportMeta = (b as any)?.meta ?? ({} as any);

                const detected = upper((meta as any)?.detected, "UNKNOWN");
                const sourceName = safeStr((meta as any)?.sourceName, "Import");
                const createdAt = safeStr((meta as any)?.createdAt, "");

                const count =
                  typeof (meta as any)?.count === "number" &&
                  Number.isFinite((meta as any).count)
                    ? (meta as any).count
                    : Array.isArray((b as any)?.rows)
                    ? (b as any).rows.length
                    : 0;

                return (
                  <div
                    key={(meta as any)?.id ?? `${idx}`}
                    className="rounded-2xl border border-[var(--fipe-border)] bg-[var(--fipe-surface)] px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] text-[color:var(--fipe-muted)]">
                          {createdAt ? formatDateTime(createdAt) : "—"} ·{" "}
                          <span className="font-semibold text-[var(--fipe-text)]">
                            {detected}
                          </span>
                        </div>

                        <div className="mt-0.5 truncate text-sm font-semibold text-[var(--fipe-text)]">
                          {sourceName}
                        </div>
                      </div>

                      <div className="shrink-0 text-xs font-semibold text-[var(--fipe-text)]">
                        {count} filas
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-[color:var(--fipe-muted)]">
                      Consejo: podés editar todo en{" "}
                      <Link href="/history" className="underline underline-offset-2">
                        Historial
                      </Link>
                      .
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 text-[11px] text-[color:var(--fipe-muted)]">
            Total movimientos: {txs.length} · Total imports: {imports.length}
          </div>
        </section>
      </main>
    </div>
  );
}
