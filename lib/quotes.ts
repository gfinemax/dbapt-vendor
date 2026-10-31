export type QuoteItem = { name: string; amount: number };

export type QuoteComparisonRow = {
  id: string;
  projectId: string;
  vendorId: string;
  vendorName: string;
  version: number;
  receivedAt: string;
  amount: number;
  vatIncluded: boolean;
  durationDays: number | null;
  warrantyMonths: number | null;
  paymentTerms: string | null;
  items: QuoteItem[];
  note: string | null;
};

export function parseQuoteItems(value: unknown): QuoteItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const name = "name" in item && typeof item.name === "string" ? item.name : "";
    const amount = "amount" in item && typeof item.amount === "number" ? item.amount : Number.NaN;
    return name && Number.isSafeInteger(amount) && amount >= 0 ? [{ name, amount }] : [];
  });
}

export function vatIncludedAmount(quote: Pick<QuoteComparisonRow, "amount" | "vatIncluded">) {
  return quote.vatIncluded ? quote.amount : Math.round(quote.amount * 1.1);
}

export function latestQuotesByVendor(quotes: QuoteComparisonRow[]) {
  const latest = new Map<string, QuoteComparisonRow>();
  for (const quote of quotes) {
    const current = latest.get(quote.vendorId);
    if (!current || quote.version > current.version) latest.set(quote.vendorId, quote);
  }
  return [...latest.values()].sort((a, b) => a.vendorName.localeCompare(b.vendorName, "ko"));
}

export function quoteItemNames(quotes: QuoteComparisonRow[]) {
  return [...new Set(quotes.flatMap((quote) => quote.items.map((item) => item.name)))];
}
