"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { parseQuickEntry } from "@/lib/quickEntry";
import TxEditorTable from "@/components/TxEditorTable";
import { parseBankPDF, type ImportedTx } from "@/lib/pdfBankParsers";
import { addImport, type Tx } from "@/lib/storage";

type PreviewState = {
  open: boolean;
  sourceName: string;
  detected: string;
  rows: Tx[];
};

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as any).randomUUID()
    : `id_${Math.random().toString(16).slice(2)}`;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function mapImportedTxToTx(t: ImportedTx): Tx {
  const isExpense = t.amount < 0;
  const accountKey =
    t.accountHint?.includes("Galicia")
      ? "galicia_credit_visa"
      : t.accountHint?.includes("BBVA")
      ? "bbva_credit"
      : "cash_ars";

  return {
    id: makeId(),
    createdAt: new Date().toISOString(),
    date: t.date,
    description: t.description,
    amount: Math.abs(t.amount),
    currency: t.currency,
    type: isExpense ? "expense" : "income",
    accountKey,
    installment: t.installment ?? undefined,
  };
}

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf");

  try {
    const workerSrc = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  } catch {}

  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let full = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map((it: any) => it.str).filter(Boolean);
    full += strings.join(" ") + "\n";
  }

  return full.trim();
}

function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 4l6.5 6.5-1.4 1.4L13 7.8V20h-2V7.8L6.9 11.9 5.5 10.5 12 4z"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="currentColor" d="M11 5h2v14h-2zM5 11h14v2H5z" />
    </svg>
  );
}

export default function QuickBar() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PreviewState>({
    open: false,
    sourceName: "",
    detected: "",
    rows: [],
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => {
    return parseQuickEntry(text, { defaultAccountKey: "cash_ars", defaultDate: todayISO() });
  }, [text]);

  function quickAdd() {
    const p = parsed;
    if (!p || !p.ok) return;

    const row: Tx = {
      id: makeId(),
      createdAt: new Date().toISOString(),
      date: p.date,
      description: p.description || "(sin descripción)",
      amount: p.amount,
      currency: p.currency,
      type: p.type,
      accountKey: p.accountKey,
      installment: p.installment,
    };

    addImport([row], { sourceName: "Manual", detected: "Manual" });
    setText("");
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const file = files[0];

    try {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const text = await extractPdfText(file);
        const parsed = parseBankPDF(text);

        if (!parsed.txs || parsed.txs.length === 0) {
          alert(
            `No pude detectar filas (todavía).\nDetectado: ${parsed.detected}\nSi el PDF es escaneado (imagen), no va a traer texto.`
          );
          return;
        }

        const rows = parsed.txs.map(mapImportedTxToTx);

        setPreview({
          open: true,
          sourceName: file.name,
          detected: parsed.detected,
          rows,
        });
        return;
      }

      if (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls")) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

        const rows: Tx[] = [];
        for (const r of json) {
          const date = String(r.Fecha || r.FECHA || r.date || r.Date || "").trim();
          const desc = String(
            r.Descripción || r.DESCRIPCION || r.Descripcion || r.Desc || r.description || ""
          ).trim();
          const amountRaw = String(r.Monto || r.MONTO || r.amount || r.Amount || "").trim();
          if (!date || !desc || !amountRaw) continue;

          const amount = Number(amountRaw.replace(/\./g, "").replace(",", "."));
          if (!Number.isFinite(amount)) continue;

          rows.push({
            id: makeId(),
            createdAt: new Date().toISOString(),
            date,
            description: desc,
            amount: Math.abs(amount),
            currency: "ARS",
            type: "expense",
            accountKey: "cash_ars",
          });
        }

        if (rows.length === 0) {
          alert("No pude detectar filas en el XLSX (aún).");
          return;
        }

        setPreview({
          open: true,
          sourceName: file.name,
          detected: "XLSX",
          rows,
        });
        return;
      }

      alert("Formato no soportado. Subí PDF o XLSX.");
    } catch (e: any) {
      console.error(e);
      alert(`No pude leer el archivo.\n${e?.message ?? e}`);
    }
  }

  function confirmImport() {
    if (preview.rows.length === 0) return;
    addImport(preview.rows, { sourceName: preview.sourceName, detected: preview.detected });
    setPreview({ open: false, sourceName: "", detected: "", rows: [] });
  }

  const canSend = Boolean(parsed?.ok);

  return (
    <div className="w-full">
      <div
        className={[
          "rounded-[28px] border shadow-sm",
          "bg-[#f4f4f5] border-[#e4e4e7] text-[#111827]",
          "dark:bg-[#2f2f2f] dark:border-[#3f3f3f] dark:text-[#e7e7e7]",
        ].join(" ")}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex items-end gap-3 px-4 py-3">
          <button
            className={[
              "h-10 w-10 rounded-full grid place-items-center transition",
              "text-[#111827] hover:bg-black/5",
              "dark:text-[#e7e7e7] dark:hover:bg-white/10",
            ].join(" ")}
            onClick={() => fileInputRef.current?.click()}
            title="Adjuntar"
            aria-label="Adjuntar"
            type="button"
          >
            <PlusIcon />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder='Escribí: "Verdulería 900 ayer efectivo" o adjuntá PDF/XLSX (podés arrastrar)'
            className={[
              "flex-1 resize-none bg-transparent outline-none",
              "text-[15px] leading-6",
              "placeholder:text-[#6b7280] dark:placeholder:text-[#9ca3af]",
            ].join(" ")}
          />

          <button
            onClick={quickAdd}
            disabled={!canSend}
            className={[
              "h-10 w-10 rounded-full grid place-items-center transition",
              canSend
                ? "bg-white text-black hover:bg-[#f3f4f6]"
                : "bg-white/60 text-black/50 cursor-not-allowed",
              "dark:bg-white dark:text-black dark:hover:bg-[#f3f4f6]",
            ].join(" ")}
            title={canSend ? "Enviar" : "Completá un monto válido"}
            aria-label="Enviar"
            type="button"
          >
            <ArrowUpIcon />
          </button>
        </div>

        <div className="px-5 pb-4">
          <div className="text-xs text-[#6b7280] dark:text-[#a3a3a3]">
            <span className="mr-3">
              Tipo:{" "}
              <span className="text-[#111827] dark:text-[#e7e7e7]">
                {parsed?.ok ? (parsed.type === "expense" ? "Gasto" : "Ingreso") : "—"}
              </span>
            </span>
            <span className="mr-3">
              Fecha:{" "}
              <span className="text-[#111827] dark:text-[#e7e7e7]">
                {parsed?.ok ? parsed.date : "—"}
              </span>
            </span>
            <span className="mr-3">
              Cuenta:{" "}
              <span className="text-[#111827] dark:text-[#e7e7e7]">
                {parsed?.ok ? parsed.accountKey : "—"}
              </span>
            </span>
            <span className="mr-3">
              Monto:{" "}
              <span className="text-[#111827] dark:text-[#e7e7e7]">
                {parsed?.ok ? parsed.amount : "—"}
              </span>
            </span>
            {parsed?.ok && parsed.installment ? (
              <span className="mr-3">
                Cuota:{" "}
                <span className="text-[#111827] dark:text-[#e7e7e7]">
                  {parsed.installment}
                </span>
              </span>
            ) : null}
          </div>

          <div className="mt-1 text-xs text-[#6b7280] dark:text-[#a3a3a3]">
            Descripción:{" "}
            <span className="text-[#111827] dark:text-[#e7e7e7]">
              {parsed?.ok ? parsed.description || "(sin descripción)" : "—"}
            </span>
          </div>
        </div>
      </div>

      {preview.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-6xl rounded-3xl border border-[var(--fipe-border)] bg-[var(--fipe-surface)] shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--fipe-border)] p-4">
              <div>
                <div className="text-sm font-semibold text-[var(--fipe-text)]">
                  Preview de importación · {preview.detected}
                </div>
                <div className="text-xs text-[color:var(--fipe-muted)]">
                  {preview.sourceName} · {preview.rows.length} filas
                </div>
              </div>
              <button
                className="rounded-xl border border-[var(--fipe-border)] bg-[var(--fipe-surface2)] px-3 py-2 text-sm hover:opacity-90"
                onClick={() => setPreview({ open: false, sourceName: "", detected: "", rows: [] })}
                type="button"
              >
                Cerrar
              </button>
            </div>

            <div className="p-4">
              <TxEditorTable
                title="Filas a importar (editables)"
                rows={preview.rows}
                onChange={(r) => setPreview((p) => ({ ...p, rows: r }))}
                pageSize={50}
                enableSearch
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--fipe-border)] p-4">
              <button
                className="rounded-xl border border-[var(--fipe-border)] bg-[var(--fipe-surface2)] px-4 py-2 text-sm hover:opacity-90"
                onClick={() => setPreview({ open: false, sourceName: "", detected: "", rows: [] })}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800
                           dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                onClick={confirmImport}
                type="button"
              >
                Confirmar import ({preview.rows.length})
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
