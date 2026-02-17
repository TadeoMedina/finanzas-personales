"use client";

import { useEffect, useMemo, useState } from "react";
import TxEditorTable from "@/components/TxEditorTable";
import { deleteTxById, loadTxs, saveTxs, updateTx, type Tx } from "@/lib/storage";

function sortDescByDateCreated(a: Tx, b: Tx) {
  return (b.date + b.createdAt).localeCompare(a.date + a.createdAt);
}

export default function HistoryPage() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setTxs(loadTxs().sort(sortDescByDateCreated));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return txs;
    return txs.filter((t) => {
      return (
        t.description.toLowerCase().includes(q) ||
        t.accountKey.toLowerCase().includes(q) ||
        t.currency.toLowerCase().includes(q) ||
        t.date.includes(q)
      );
    });
  }, [txs, query]);

  function onTableChange(rows: Tx[]) {
    // En historial, tratamos rows como “estado completo filtrado”, por simplicidad:
    // actualizamos los que están en filtered y mantenemos el resto.
    // Para evitar líos, aplicamos patch por id desde rows.
    const map = new Map(rows.map((r) => [r.id, r]));
    const next = txs.map((t) => map.get(t.id) ?? t);
    setTxs(next);
    saveTxs(next);
  }

  function deleteOne(id: string) {
    const next = deleteTxById(id);
    setTxs(next.sort(sortDescByDateCreated));
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Historial</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Podés editar todo y eliminar registros.
          </div>
        </div>

        <input
          className="w-[320px] max-w-[55vw] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none
                     dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          placeholder="Buscar (desc, fecha, cuenta...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-zinc-600 dark:text-zinc-400">No hay movimientos con ese filtro.</div>
      ) : (
        <div className="space-y-3">
          {/* Tabla editable */}
          <TxEditorTable
            rows={filtered}
            onChange={(rows) => {
              // En vez de borrar desde la tabla, acá hacemos "quitar fila" como un delete real
              // Detectamos cuáles faltan vs filtered original y los borramos
              const incomingIds = new Set(rows.map((r) => r.id));
              const removed = filtered.filter((t) => !incomingIds.has(t.id));
              for (const r of removed) deleteOne(r.id);

              onTableChange(rows);
            }}
          />

          {/* Botones rápidos: eliminar por id (opcional) */}
          <div className="text-xs text-zinc-500 dark:text-zinc-500">
            Tip: “Quitar” elimina la fila. Los cambios se guardan automáticamente.
          </div>
        </div>
      )}
    </main>
  );
}
