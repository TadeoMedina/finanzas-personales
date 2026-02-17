export type ImportedTx = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // gastos negativos
  currency: "ARS" | "USD";
  accountHint?: string;
  raw?: string;
  installment?: string; // 05/06
  receipt?: string;     // 051695
};

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function normalizeMoneyWithComma(token: string): number | null {
  // 80.733,33 / 4.685,95 / 22.314,05
  const t = token.trim();
  if (!/^\d[\d.]*,\d{2}$/.test(t)) return null;
  const v = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

function toISOFromDDMonYY(s: string): string | null {
  const m = s.match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const monStr = m[2][0].toUpperCase() + m[2].slice(1).toLowerCase();
  const mm = MONTHS[monStr];
  const yy = Number(m[3]);
  if (!mm) return null;
  const yyyy = 2000 + yy;
  return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
}

function toISOFromDDMMYY(s: string): string | null {
  const m = s.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yy = Number(m[3]);
  const yyyy = 2000 + yy;
  return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
}

function cleanDesc(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function sectionBetween(text: string, startKey: RegExp, endKey: RegExp): string {
  const T = text.replace(/\s+/g, " ").trim();
  const s = T.search(startKey);
  if (s < 0) return T;
  const after = T.slice(s);
  const e = after.search(endKey);
  if (e < 0) return after;
  return after.slice(0, e);
}

function lastMoneyToken(rest: string): string | null {
  const matches = Array.from(rest.matchAll(/\b(\d[\d.]*,\d{2})\b/g));
  if (matches.length === 0) return null;
  return matches[matches.length - 1][1];
}

function firstInstallmentToken(rest: string): string | null {
  const m = rest.match(/\b(\d{2}\/\d{2})\b/);
  return m ? m[1] : null;
}

function receiptAfterInstallment(rest: string, installment?: string): string | null {
  // En Galicia: suele ser 5-7 dígitos y suele venir después de cuota (05/06 051695)
  if (installment) {
    const idx = rest.indexOf(installment);
    if (idx >= 0) {
      const tail = rest.slice(idx + installment.length);
      const m = tail.match(/\b(\d{5,7})\b/);
      if (m) return m[1];
    }
  }
  // fallback
  const m = rest.match(/\b(\d{5,7})\b/);
  return m ? m[1] : null;
}

function truncateAtTotalsInsideDetail(chunk: string): string {
  // ✅ Clave: si el texto pegó la línea "TARJETA 9224 Total Consumos..."
  // NO descartamos toda la fila: cortamos ahí.
  const cutRe = /\bTARJETA\s+\d+\s+Total\s+Consumos\b/i;
  const m = chunk.match(cutRe);
  if (!m || m.index == null) return chunk;
  return chunk.slice(0, m.index).trim();
}

/**
 * GALICIA:
 * - Solo DETALLE DEL CONSUMO -> TOTAL A PAGAR
 * - Por cada fila: fecha dd-mm-yy
 * - Cuota: primer dd/dd
 * - Monto: ÚLTIMO \d[\d.]*,\d{2} del chunk (PESOS)
 * - Y cortamos dentro del chunk si aparece "TARJETA xxxx Total Consumos..." (para que no contamine AUTO ASIST)
 */
export function parseGaliciaVisa(text: string): ImportedTx[] {
  const scoped = sectionBetween(
    text,
    /\bDETALLE\s+DEL\s+CONSUMO\b/i,
    /\bTOTAL\s+A\s+PAGAR\b/i
  );

  const T = scoped.replace(/\s+/g, " ").trim();
  const out: ImportedTx[] = [];

  // Captura “fila” por fecha y todo hasta la próxima fecha o fin
  const rowRe = /(\d{2}-\d{2}-\d{2})\s+(.+?)(?=\s+\d{2}-\d{2}-\d{2}\s+|$)/g;

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(T)) !== null) {
    const iso = toISOFromDDMMYY(m[1]);
    if (!iso) continue;

    let chunk = m[2].trim();

    // Ignorar consolidado/pagos por si aparecieran
    if (/\bCONSOLIDADO\b/i.test(chunk)) continue;
    if (/\bSU\s+PAGO\s+EN\s+PESOS\b/i.test(chunk)) continue;

    // ✅ Cortar “totales” pegados dentro del detalle (esto arregla AUTO ASIST)
    chunk = truncateAtTotalsInsideDetail(chunk);
    if (!chunk) continue;

    // Cuota / comprobante
    const installment = firstInstallmentToken(chunk) ?? undefined;
    const receipt = receiptAfterInstallment(chunk, installment) ?? undefined;

    // Monto = último con coma
    const moneyTok = lastMoneyToken(chunk);
    if (!moneyTok) continue;

    const money = normalizeMoneyWithComma(moneyTok);
    if (money == null) continue;

    // Descripción = chunk sin montos / cuota / comprobante
    let description = chunk;

    // sacar todos los montos
    description = description.replace(/\b\d[\d.]*,\d{2}\b/g, " ");
    // sacar cuota
    description = description.replace(/\b\d{2}\/\d{2}\b/g, " ");
    // sacar comprobante exacto
    if (receipt) description = description.replace(new RegExp(`\\b${receipt}\\b`), " ");

    // limpiar asterisco inicial
    description = description.replace(/^\*\s*/, "");
    description = cleanDesc(description);

    // filtro extra por si quedó algo raro
    if (!description) continue;
    if (/\bTotal\s+Consumos\b/i.test(description)) continue;

    out.push({
      date: iso,
      description,
      amount: -Math.abs(money), // gasto
      currency: "ARS",
      accountHint: "Galicia Crédito (VISA)",
      raw: `${m[1]} ${chunk}`.replace(/\s+/g, " ").trim(),
      installment,
      receipt,
    });
  }

  return out;
}

export function parseBBVAVisa(text: string): ImportedTx[] {
  // ✅ Requisito: del PDF BBVA solo tomamos 2 secciones:
  // 1) "Consumos Tadeo Medina Vetre"
  // 2) "Impuestos, cargos e intereses"
  // (Ignoramos pagos, saldos, legales, etc.)

  const normalizedAll = text.replace(/\s+/g, " ").trim();
  const out: ImportedTx[] = [];

  // Helpers específicos BBVA
  const bbvaMoneyTokens = (chunk: string): string[] => {
    const re = /\b\d[\d.]*,\d{2}\b/g;
    return chunk.match(re) ?? [];
  };

  const stripBBVAHeaders = (chunk: string): string => {
    let c = chunk;

    // Headers de tabla (a veces pegados al cambiar de página)
    c = c.replace(/FECHA\s*DESCRIPCI(?:Ó|O)N\s*NRO\.?\s*CUP(?:Ó|O)N\s*PESOS\s*D(?:Ó|O)LARES/gi, " ");
    c = c.replace(/Consumos\s+Tadeo\s+Medina\s+Vetre/gi, " ");
    c = c.replace(/Impuestos,\s*cargos\s*e\s*intereses/gi, " ");

    // Footers típicos
    c = c.replace(/P\s*\.?\s*\d+\s*de\s*\d+/gi, " ");
    c = c.replace(/Página\s*\d+\s*de\s*\d+/gi, " ");
    c = c.replace(/Resumen\s*Visa/gi, " ");
    c = c.replace(/Sobre\s*\(\d+\)/gi, " ");

    return cleanDesc(c);
  };

  const bbvaMoneyPick = (chunk: string, isUSD: boolean): number | null => {
    const toks = bbvaMoneyTokens(chunk);
    if (toks.length === 0) return null;

    // Regla:
    // - USD: suele estar en columna "Dólares" (último token)
    // - ARS: suele estar en columna "Pesos" (primer token)
    const tok = isUSD ? toks[toks.length - 1] : toks[0];
    return normalizeMoneyWithComma(tok);
  };

  const bbvaInstallment = (chunk: string): string | undefined => {
    const m = chunk.match(/\bC\.(\d{2}\/\d{2})\b/);
    return m ? m[1] : undefined;
  };

  const bbvaCoupon = (chunk: string): string | undefined => {
    // En BBVA suele ser 5-7 dígitos cerca del final.
    const m = chunk.match(/\b(\d{5,7})\b(?!.*\b\d{5,7}\b)/);
    return m ? m[1] : undefined;
  };

  const parseSectionRows = (scoped: string, opts: { kind: "consumos" | "impuestos" }) => {
    const T = scoped.replace(/\s+/g, " ").trim();
    if (!T) return;

    // Captura “fila” por fecha y todo hasta la próxima fecha o fin
    const rowRe =
      /(\d{2}-[A-Za-z]{3}-\d{2})\s+(.+?)(?=\s+\d{2}-[A-Za-z]{3}-\d{2}\s+|$)/g;

    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(T)) !== null) {
      const iso = toISOFromDDMonYY(m[1]);
      if (!iso) continue;

      let chunk = m[2].trim();
      if (!chunk) continue;

      chunk = stripBBVAHeaders(chunk);
      if (!chunk) continue;

      // Filtros defensivos
      if (/\bSALDO\s+ACTUAL\b/i.test(chunk)) continue;
      if (/\bTOTAL\s+CONSUMOS\b/i.test(chunk)) continue;
      if (/\bLegales\s+y\s+avisos\b/i.test(chunk)) continue;

      // Moneda: si aparece USD (o U$S) en la línea => USD, si no => ARS
      const isUSD = /\bUSD\b/i.test(chunk) || /U\$S/i.test(chunk);
      const currency: "ARS" | "USD" = isUSD ? "USD" : "ARS";

      const money = bbvaMoneyPick(chunk, isUSD);
      if (money == null) continue;

      // Limpieza de descripción:
      // - quitar monto(s)
      // - quitar "USD" y columnas
      let desc = chunk
        .replace(/\bUSD\b/gi, " ")
        .replace(/U\$S/gi, " ")
        .replace(/\b\d[\d.]*,\d{2}\b/g, " ")
        .replace(/\bPESOS\b/gi, " ")
        .replace(/\bD(?:Ó|O)LARES\b/gi, " ")
        .trim();

      const installment = opts.kind === "consumos" ? bbvaInstallment(desc) : undefined;
      const receipt = opts.kind === "consumos" ? bbvaCoupon(desc) : undefined;

      // Si hay cuota, la removemos del texto principal
      if (installment) desc = desc.replace(new RegExp(`\\bC\\.${installment}\\b`), " ");
      // si hay cupón, lo removemos del texto principal
      if (receipt) desc = desc.replace(new RegExp(`\\b${receipt}\\b`), " ");

      desc = cleanDesc(desc);
      if (!desc) continue;

      // En BBVA, los consumos e impuestos son egresos
      out.push({
        date: iso,
        description: desc,
        amount: -Math.abs(money),
        currency,
        accountHint: "BBVA VISA",
        raw: chunk,
        installment,
        receipt,
      });
    }
  };

  // 1) Consumos (solo sección del titular)
  const consumos = sectionBetween(
    normalizedAll,
    /\bConsumos\s+Tadeo\s+Medina\s+Vetre\b/i,
    /\bImpuestos,\s*cargos\s*e\s*intereses\b/i
  );
  parseSectionRows(consumos, { kind: "consumos" });

  // 2) Impuestos, cargos e intereses (hasta fin o siguiente bloque)
  const impuestos = sectionBetween(
    normalizedAll,
    /\bImpuestos,\s*cargos\s*e\s*intereses\b/i,
    /\bPlan\s+V\b|\bResumen\b|\bLegales\b/i
  );
  parseSectionRows(impuestos, { kind: "impuestos" });

  return out;
}

export function parseBankPDF(text: string): { txs: ImportedTx[]; detected: string } {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length < 80) return { txs: [], detected: "NoText(Scanned?)" };

  const gal = parseGaliciaVisa(text);
  if (gal.length > 0) return { txs: gal, detected: "Galicia Visa" };

  const bbva = parseBBVAVisa(text);
  if (bbva.length > 0) return { txs: bbva, detected: "BBVA Visa" };

  return { txs: [], detected: "Unknown" };
}
