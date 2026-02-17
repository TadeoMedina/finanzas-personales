"use client";

import { useEffect, useMemo, useState } from "react";
import { loadTxs, type Tx } from "@/lib/storage";

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

function lastNDaysISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return sign + abs.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

export default function DashboardPage() {
  const [txs, setTxs] = useState<Tx[]>([]);

  useEffect(() => {
    setTxs(loadTxs());
  }, []);

  const from30 = lastNDaysISO(30);

  const stats = useMemo(() => {
    const last30 = txs.filter((t) => t.date >= from30);

    const byCur = (rows: Tx[], currency: "ARS" | "USD") => rows.filter((t) => t.currency === currency);

    function calc(rows: Tx[]) {
      const income = sum(rows.filter((t) => t.type === "income").map((t) => t.amount));
      const expense = sum(rows.filter((t) => t.type === "expense").map((t) => t.amount));
      const net = income - expense;
      return { income, expense, net };
    }

    const aAll = calc(byCur(txs, "ARS"));
    const uAll = calc(byCur(txs, "USD"));

    const a30 = calc(byCur(last30, "ARS"));
    const u30 = calc(byCur(last30, "USD"));

    // Top cuentas por gasto (ARS)
    const spendByAccountARS = new Map<string, number>();
    for (const t of byCur(last30, "ARS")) {
      if (t.type !== "expense") continue;
      spendByAccountARS.set(t.accountKey, (spendByAccountARS.get(t.accountKey) ?? 0) + t.amount);
    }
    const topAccountsARS = Array.from(spendByAccountARS.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Top descripciones (ARS) (agrupación simple)
    const spendByDescARS = new Map<string, number>();
    for (const t of byCur(last30, "ARS")) {
      if (t.type !== "expense") continue;
      const key = t.description.slice(0, 42);
      spendByDescARS.set(key, (spendByDescARS.get(key) ?? 0) + t.amount);
    }
    const topDescARS = Array.from(spendByDescARS.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { aAll, uAll, a30, u30, topAccountsARS, topDescARS, last30Count: last30.length };
  }, [txs, from30]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-2">
        <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Dashboard</div>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Métricas base (últimos 30 días y acumulado). Refinamos después.
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card title="ARS · Últimos 30 días" subtitle={`${stats.last30Count} movimientos`}>
          <StatRow label="Ingresos" value={money(stats.a30.income)} />
          <StatRow label="Gastos" value={money(stats.a30.expense)} />
          <StatRow label="Balance" value={money(stats.a30.net)} strong />
        </Card>

        <Card title="USD · Últimos 30 días">
          <StatRow label="Ingresos" value={money(stats.u30.income)} />
          <StatRow label="Gastos" value={money(stats.u30.expense)} />
          <StatRow label="Balance" value={money(stats.u30.net)} strong />
        </Card>

        <Card title="ARS · Acumulado">
          <StatRow label="Ingresos" value={money(stats.aAll.income)} />
          <StatRow label="Gastos" value={money(stats.aAll.expense)} />
          <StatRow label="Balance" value={money(stats.aAll.net)} strong />
        </Card>

        <Card title="USD · Acumulado">
          <StatRow label="Ingresos" value={money(stats.uAll.income)} />
          <StatRow label="Gastos" value={money(stats.uAll.expense)} />
          <StatRow label="Balance" value={money(stats.uAll.net)} strong />
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card title="Top cuentas (gasto ARS · últimos 30 días)">
          {stats.topAccountsARS.length === 0 ? (
            <Empty />
          ) : (
            <List items={stats.topAccountsARS.map(([k, v]) => ({ label: k, value: money(v) }))} />
          )}
        </Card>

        <Card title="Top consumos (ARS · últimos 30 días)">
          {stats.topDescARS.length === 0 ? (
            <Empty />
          ) : (
            <List items={stats.topDescARS.map(([k, v]) => ({ label: k, value: money(v) }))} />
          )}
        </Card>
      </div>
    </main>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
      {subtitle ? <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{subtitle}</div> : null}
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function StatRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="text-zinc-600 dark:text-zinc-400">{label}</div>
      <div className={strong ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-900 dark:text-zinc-100"}>
        {value}
      </div>
    </div>
  );
}

function List({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={idx} className="flex items-center justify-between text-sm">
          <div className="truncate pr-3 text-zinc-700 dark:text-zinc-300">{it.label}</div>
          <div className="text-zinc-900 dark:text-zinc-100">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return <div className="text-sm text-zinc-600 dark:text-zinc-400">Todavía no hay datos.</div>;
}
