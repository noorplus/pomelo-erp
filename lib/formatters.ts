function parseDate(value: string | Date) {
  if (value instanceof Date) return value;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : new Date(Number.NaN);
  }
  return new Date(value);
}

export function getLocalDateInputValue(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return [year, month, day].join("-");
}

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
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "2-digit" }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined, locale = "en-GB") {
  if (!value) return "—";
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}
