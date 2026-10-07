export function formatNumber(value: number | null | undefined, locale = "en-US") {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale).format(value);
}

export function formatCurrency(value: number | null | undefined, currency = "BDT", locale = "en-BD") {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export function formatDate(value: string | Date | null | undefined, locale = "en-GB") {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "2-digit" }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined, locale = "en-GB") {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}
