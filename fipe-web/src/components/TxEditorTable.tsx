"use client";

import { useMemo, useState } from "react";
import type { Tx, Currency, TxType } from "@/lib/storage";

const ACCOUNT_LABELS: Record<string, string> = {
  cash_ars: "Efectivo ARS",
  cash_usd: "Efectivo USD",

  bbva_credit: "BBVA Crédito (VISA)",
  bbva_debit: "BBVA Débito (VISA)",

  santander_credit: "Santander Crédito (VISA)",
  santander_debit: "Santander Débito (VISA)",
  santander_usd: "Santander Caja ahorro USD",

  galicia_credit_visa: "Galicia Crédito (VISA)",
  galicia_credit_mc: "Galicia Crédito (Mastercard)",
  galicia_debit: "Galicia Débito (VISA)",
  galicia_usd: "Galicia Caja ahorro USD",

  carrefour_credit: "Carrefour Banco Crédito",
  carrefour_debit: "Carrefour Banco Débito",

  dolarapp_debit_usd: "DolarApp Débito USD",
  dolarapp_debit_ars: "DolarApp Débito ARS",
  dolarapp_savings_usd: "DolarApp Ahorro USD",
  dolarapp_savings_ars: "DolarApp Ahorro ARS",
};

const ACCOUNT_KEYS = Object.keys(ACCOUNT_LABELS);

function accountLabel(key: string) {
  return ACCOUNT_LABELS[key] ?? key;
}

function cx(...s: Array<string | false | undefined>) {
  return s.filter(Boolean).join(" ");
}

function pill(active: boolean) {
  return cx(
    "rounded-full border px-3 py-1 text-xs transition",
    active
      ? "border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-[#0f0f10] dark:text-zinc-100"
      : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white dark:border-zinc-800 dark:bg-[#151517] dark:text-zinc-300 dark:hover:bg-[#19191b]"
  );
}

export default function TxEditorTable({
  rows,
  onChange,
  allowDelete = true,
  title,
  compact = true,
  pageSize = 50,
  enableSearch = true,
  className,
}: {
  rows: Tx[];
  onChange: (rows: Tx[]) => void;
  allowDelete?: boolean;
  title?: string;
  compact?: boolean;
  pageSize?: number;
  enableSearch?: boolean;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [view, setView] = useState<"table" | "list">("table"); // ✅ toggle nuevo

  const filtered = useMemo(() => {
    if (!enableSearch) return rows;
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((r) => {
      return (
        r.description.toLowerCase().includes(qq) ||
        r.date.includes(qq) ||
        r.currency.toLowerCase().includes(qq) ||
        r.accountKey.toLowerCase().includes(qq) ||
        String(r.amount).includes(qq)
      );
    });
  }, [rows, q, enableSearch]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);

  const slice = useMemo(() => {
    const start = safePage * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  function setRowById(id: string, patch: Partial<Tx>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeById(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }

  function onSearchChange(v: string) {
    setQ(v);
    setPage(0);
  }

  return (
    <div
      className={cx(
        "rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#0f0f10]",
        className
      )}
    >
      {(title || enableSearch) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="min-w-0">
            {title ? (
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
            ) : null}
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {filtered.length.toLocaleString("es-AR")} filas
              {filtered.length !== rows.length ? (
                <span className="text-zinc-400 dark:text-zinc-500"> · filtradas</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className={pill(view === "table")} onClick={() => setView("table")}>
              Tabla
            </button>
            <button className={pill(view === "list")} onClick={() => setView("list")}>
              Lista
            </button>

            {enableSearch && (
              <input
                value={q}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar (desc, fecha, monto, cuenta...)"
                className="ml-2 w-[320px] max-w-[55vw] rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none
                           focus:bg-white dark:border-zinc-800 dark:bg-[#151517] dark:text-zinc-100 dark:focus:bg-[#19191b]"
              />
            )}
          </div>
        </div>
      )}

      {view === "table" ? (
        <div className="max-h-[62vh] overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-50 text-zinc-600 dark:bg-[#151517] dark:text-zinc-300">
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-3 py-2 text-left font-medium">Fecha</th>
                <th className="px-3 py-2 text-left font-medium">Descripción</th>
                <th className="px-3 py-2 text-left font-medium">Tipo</th>
                <th className="px-3 py-2 text-left font-medium">Monto</th>
                <th className="px-3 py-2 text-left font-medium">Moneda</th>
                <th className="px-3 py-2 text-left font-medium">Cuenta</th>
                <th className="px-3 py-2 text-left font-medium">Cuota</th>
                {allowDelete ? <th className="px-3 py-2" /> : null}
              </tr>
            </thead>

            <tbody>
              {slice.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-zinc-100 hover:bg-zinc-50/70 dark:border-zinc-800 dark:hover:bg-white/5"
                >
                  <td className={cx("px-3", compact ? "py-1.5" : "py-2.5")}>
                    <input
                      type="date"
                      className="w-36 rounded-lg border border-zinc-200 bg-white px-2 py-1 outline-none
                                 dark:border-zinc-800 dark:bg-[#0f0f10] dark:text-zinc-100"
                      value={r.date}
                      onChange={(e) => setRowById(r.id, { date: e.target.value })}
                    />
                  </td>

                  <td className={cx("px-3", compact ? "py-1.5" : "py-2.5")}>
                    <input
                      className="w-[520px] max-w-[65vw] rounded-lg border border-zinc-200 bg-white px-2 py-1 outline-none
                                 dark:border-zinc-800 dark:bg-[#0f0f10] dark:text-zinc-100"
                      value={r.description}
                      onChange={(e) => setRowById(r.id, { description: e.target.value })}
                    />
                  </td>

                  <td className={cx("px-3", compact ? "py-1.5" : "py-2.5")}>
                    <select
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 outline-none
                                 dark:border-zinc-800 dark:bg-[#0f0f10] dark:text-zinc-100"
                      value={r.type}
                      onChange={(e) => setRowById(r.id, { type: e.target.value as TxType })}
                    >
                      <option value="expense">Gasto</option>
                      <option value="income">Ingreso</option>
                    </select>
                  </td>

                  <td className={cx("px-3", compact ? "py-1.5" : "py-2.5")}>
                    <input
                      inputMode="decimal"
                      className="w-28 rounded-lg border border-zinc-200 bg-white px-2 py-1 outline-none
                                 dark:border-zinc-800 dark:bg-[#0f0f10] dark:text-zinc-100"
                      value={String(r.amount)}
                      onChange={(e) =>
                        setRowById(r.id, { amount: Number(String(e.target.value).replace(",", ".")) || 0 })
                      }
                    />
                  </td>

                  <td className={cx("px-3", compact ? "py-1.5" : "py-2.5")}>
                    <select
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 outline-none
                                 dark:border-zinc-800 dark:bg-[#0f0f10] dark:text-zinc-100"
                      value={r.currency}
                      onChange={(e) => setRowById(r.id, { currency: e.target.value as Currency })}
                    >
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </select>
                  </td>

                  <td className={cx("px-3", compact ? "py-1.5" : "py-2.5")}>
                    <select
                      className="w-56 rounded-lg border border-zinc-200 bg-white px-2 py-1 outline-none
                                 dark:border-zinc-800 dark:bg-[#0f0f10] dark:text-zinc-100"
                      value={r.accountKey}
                      onChange={(e) => setRowById(r.id, { accountKey: e.target.value })}
                    >
                      {ACCOUNT_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {accountLabel(k)}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className={cx("px-3", compact ? "py-1.5" : "py-2.5")}>
                    <input
                      className="w-20 rounded-lg border border-zinc-200 bg-white px-2 py-1 outline-none
                                 dark:border-zinc-800 dark:bg-[#0f0f10] dark:text-zinc-100"
                      value={r.installment ?? ""}
                      onChange={(e) => setRowById(r.id, { installment: e.target.value.trim() || undefined })}
                    />
                  </td>

                  {allowDelete ? (
                    <td className={cx("px-3 text-right", compact ? "py-1.5" : "py-2.5")}>
                      <button
                        className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                        onClick={() => removeById(r.id)}
                        title="Eliminar fila"
                      >
                        Eliminar
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}

              {slice.length === 0 ? (
                <tr>
                  <td colSpan={allowDelete ? 8 : 7} className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No hay filas para mostrar.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="max-h-[62vh] overflow-auto p-4">
          <div className="grid gap-3">
            {slice.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 shadow-sm
                           dark:border-zinc-800 dark:bg-[#151517]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs outline-none
                                 dark:border-zinc-800 dark:bg-[#0f0f10] dark:text-zinc-100"
                      value={r.date}
                      onChange={(e) => setRowById(r.id, { date: e.target.value })}
                    />
                    <select
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs outline-none
                                 dark:border-zinc-800 dark:bg-[#0f0f10] dark:text-zinc-100"
                      value={r.type}
                      onChange={(e) => setRowById(r.id, { type: e.target.value as TxType })}
                    >
                      <option value="expense">Gasto</option>
                      <option value="income">Ingreso</option>
                    </select>
                  </div>

                  {allowDelete ? (
                    <button
                      className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                      onClick={() => removeById(r.id)}
                    >
                      Eliminar
                    </button>
                  ) : null}
                </div>

                <div className="mt-2">
                  <input
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none
                               dark:border-zinc-800 dark:bg-[#0f0f10] dark:text-zinc-100"
                    value={r.description}
                    onChange={(e) => setRowById(r.id, { description: e.target.value })}
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <input
                    inputMode="decimal"
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none
                               dark:border-zinc-800 dark:bg-[#0f0f10] dark:text-zinc-100"
                    value={String(r.amount)}
                    onChange={(e) => setRowById(r.id, { amount: Number(String(e.target.value).replace(",", ".")) || 0 })}
                    placeholder="Monto"
                  />

                  <select
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none
                               dark:border-zinc-800 dark:bg-[#0f0f10] dark:text-zinc-100"
                    value={r.currency}
                    onChange={(e) => setRowById(r.id, { currency: e.target.value as Currency })}
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>

                  <select
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none
                               dark:border-zinc-800 dark:bg-[#0f0f10] dark:text-zinc-100"
                    value={r.accountKey}
                    onChange={(e) => setRowById(r.id, { accountKey: e.target.value })}
                  >
                    {ACCOUNT_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {accountLabel(k)}
                      </option>
                    ))}
                  </select>

                  <input
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none
                               dark:border-zinc-800 dark:bg-[#0f0f10] dark:text-zinc-100"
                    value={r.installment ?? ""}
                    onChange={(e) => setRowById(r.id, { installment: e.target.value.trim() || undefined })}
                    placeholder="Cuota"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
        <div>
          Página <b className="text-zinc-900 dark:text-zinc-100">{safePage + 1}</b> de{" "}
          <b className="text-zinc-900 dark:text-zinc-100">{pageCount}</b>
          <span className="text-zinc-400 dark:text-zinc-500"> · {pageSize} por página</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 hover:bg-white disabled:opacity-50
                       dark:border-zinc-800 dark:bg-[#151517] dark:hover:bg-[#19191b]"
            disabled={safePage === 0}
            onClick={() => setPage(0)}
          >
            «
          </button>
          <button
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 hover:bg-white disabled:opacity-50
                       dark:border-zinc-800 dark:bg-[#151517] dark:hover:bg-[#19191b]"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ‹
          </button>
          <button
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 hover:bg-white disabled:opacity-50
                       dark:border-zinc-800 dark:bg-[#151517] dark:hover:bg-[#19191b]"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            ›
          </button>
          <button
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 hover:bg-white disabled:opacity-50
                       dark:border-zinc-800 dark:bg-[#151517] dark:hover:bg-[#19191b]"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(pageCount - 1)}
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}
