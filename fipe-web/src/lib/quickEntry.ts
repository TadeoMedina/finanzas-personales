export type QuickParseResult =
  | {
      ok: true;
      description: string;
      amount: number;
      currency: "ARS" | "USD";
      date: string; // YYYY-MM-DD
      type: "expense" | "income";
      accountKey: string;
      installment?: string;
    }
  | { ok: false };

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateToken(token: string): string | null {
  if (!token) return null;

  if (token.toLowerCase() === "ayer") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  const m = token.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

export function parseQuickEntry(
  input: string,
  opts: { defaultAccountKey: string; defaultDate: string }
): QuickParseResult {
  if (!input.trim()) return { ok: false };

  const tokens = input.trim().split(/\s+/);

  let amount: number | null = null;
  let date = opts.defaultDate || todayISO();
  let accountKey = opts.defaultAccountKey;
  let descriptionTokens: string[] = [];

  for (const token of tokens) {
    // monto
    if (!amount && /^\d+([.,]\d+)?$/.test(token)) {
      amount = Number(token.replace(",", "."));
      continue;
    }

    // fecha
    const parsedDate = parseDateToken(token);
    if (parsedDate) {
      date = parsedDate;
      continue;
    }

    // cuenta básica
    const t = token.toLowerCase();
    if (t === "bbva") accountKey = "bbva_credit";
    else if (t === "galicia") accountKey = "galicia_credit_visa";
    else if (t === "efectivo") accountKey = "cash_ars";
    else descriptionTokens.push(token);
  }

  if (!amount) return { ok: false };

  const description = descriptionTokens.join(" ").trim();
  const type = amount > 0 ? "expense" : "income";

  return {
    ok: true,
    description,
    amount: Math.abs(amount),
    currency: "ARS",
    date,
    type,
    accountKey,
  };
}
