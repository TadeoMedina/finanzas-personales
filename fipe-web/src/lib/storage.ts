export type Currency = "ARS" | "USD";
export type TxType = "expense" | "income";

export type Tx = {
  id: string;
  createdAt: string; // ISO
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positivo
  currency: Currency;
  type: TxType;
  accountKey: string;

  installment?: string; // "05/06"
};

export type ImportMeta = {
  id: string;
  createdAt: string; // ISO
  sourceName: string;
  detected: string;
  count: number;
};

export type ImportBatch = {
  meta: ImportMeta;
  rows: Tx[];
};

const KEY_TXS = "fipe.txs.v1";
const KEY_IMPORTS = "fipe.imports.v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return safeParse<T>(localStorage.getItem(key), fallback);
}

function makeId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as any).randomUUID()
    : `${prefix}_${Math.random().toString(16).slice(2)}`;
}

function sanitizeMeta(meta: any): ImportMeta {
  const id = typeof meta?.id === "string" && meta.id ? meta.id : makeId("imp");
  const createdAt =
    typeof meta?.createdAt === "string" && meta.createdAt
      ? meta.createdAt
      : new Date().toISOString();

  const sourceName =
    typeof meta?.sourceName === "string" && meta.sourceName.trim()
      ? meta.sourceName
      : "Import";

  const detected =
    typeof meta?.detected === "string" && meta.detected.trim()
      ? meta.detected
      : "Unknown";

  const count =
    typeof meta?.count === "number" && Number.isFinite(meta.count)
      ? meta.count
      : 0;

  return { id, createdAt, sourceName, detected, count };
}

function sanitizeTx(t: any): Tx | null {
  if (!t) return null;

  const id = typeof t.id === "string" && t.id ? t.id : makeId("tx");
  const createdAt =
    typeof t.createdAt === "string" && t.createdAt ? t.createdAt : new Date().toISOString();
  const date = typeof t.date === "string" ? t.date : "";
  if (!date) return null;

  const description =
    typeof t.description === "string" && t.description.trim() ? t.description : "(sin descripción)";

  const amount = Number(t.amount);
  if (!Number.isFinite(amount)) return null;

  const currency: Currency = t.currency === "USD" ? "USD" : "ARS";
  const type: TxType = t.type === "income" ? "income" : "expense";
  const accountKey = typeof t.accountKey === "string" && t.accountKey ? t.accountKey : "cash_ars";

  const installment =
    typeof t.installment === "string" && t.installment.trim() ? t.installment : undefined;

  return {
    id,
    createdAt,
    date,
    description,
    amount: Math.abs(amount),
    currency,
    type,
    accountKey,
    installment,
  };
}

/* -------------------------
   TXS
-------------------------- */

export function loadTxs(): Tx[] {
  const raw = load<any[]>(KEY_TXS, []);
  const arr = raw.map(sanitizeTx).filter(Boolean) as Tx[];

  // Si hubo basura, la limpiamos y persistimos
  if (arr.length !== raw.length) saveTxs(arr);

  return arr.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export function saveTxs(next: Tx[]) {
  save(KEY_TXS, next);
}

export function addTransactions(rows: Tx[]) {
  const current = loadTxs();
  const byId = new Map(current.map((t) => [t.id, t]));
  for (const r of rows) byId.set(r.id, r);
  saveTxs(Array.from(byId.values()));
}

export function updateTx(id: string, patch: Partial<Tx>) {
  const current = loadTxs();
  saveTxs(current.map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export function deleteTx(id: string) {
  const current = loadTxs();
  saveTxs(current.filter((t) => t.id !== id));
}

export function deleteTxById(id: string) {
  deleteTx(id);
}

export function clearTxs() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_TXS);
}

export function getTransactions(): Tx[] {
  return loadTxs();
}

export function setTransactions(next: Tx[]) {
  return saveTxs(next);
}

/* -------------------------
   IMPORTS
-------------------------- */

export function loadImports(): ImportBatch[] {
  const raw = load<any[]>(KEY_IMPORTS, []);

  const batches: ImportBatch[] = raw
    .map((b) => {
      const meta = sanitizeMeta(b?.meta ?? b?.Meta ?? b);
      const rowsRaw = Array.isArray(b?.rows) ? b.rows : Array.isArray(b?.txs) ? b.txs : [];
      const rows = rowsRaw.map(sanitizeTx).filter(Boolean) as Tx[];
      const fixedMeta = { ...meta, count: rows.length };
      return { meta: fixedMeta, rows };
    })
    .filter((b) => b.rows.length > 0 || b.meta.sourceName || b.meta.detected);

  // Persistimos migración/limpieza (esto evita el crash para siempre)
  if (batches.length !== raw.length) saveImports(batches);

  return batches.sort((a, b) => (a.meta.createdAt < b.meta.createdAt ? 1 : -1));
}

export function saveImports(next: ImportBatch[]) {
  save(KEY_IMPORTS, next);
}

export function addImport(rows: Tx[], meta?: Partial<ImportMeta>) {
  const createdAt = new Date().toISOString();
  const id = makeId("imp");

  const fullMeta: ImportMeta = sanitizeMeta({
    id,
    createdAt,
    sourceName: meta?.sourceName ?? "Import",
    detected: meta?.detected ?? "Unknown",
    count: rows.length,
  });

  const batch: ImportBatch = { meta: { ...fullMeta, count: rows.length }, rows };

  const all = loadImports();
  saveImports([batch, ...all]);

  // impacta en historial final
  addTransactions(rows);

  return batch;
}

export function deleteImportBatch(batchId: string) {
  const all = loadImports();
  saveImports(all.filter((b) => b.meta.id !== batchId));
}

export function clearImports() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_IMPORTS);
}
