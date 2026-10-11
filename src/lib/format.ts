// Formatting helpers for the pharmacy drug pricing system.
// Currency is IQD (Iraqi Dinar) — prices are large whole-ish numbers.

export function formatIQD(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  // Round to nearest dinar; IQD has no practical fractional unit.
  const rounded = Math.round(value);
  return rounded.toLocaleString("en-US");
}

export function formatIQDWithCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return `${formatIQD(value)} IQD`;
}

// Compact representation for the quick-lookup card (e.g. 128,700).
export function formatPrice(value: number | null | undefined): string {
  return formatIQD(value);
}

// Compute a per-tablet / per-unit price from pack price + units, when the
// NO OF TAB PER BACK field carries a parseable integer.
export function extractUnitsPerPack(raw: string): number | null {
  if (!raw) return null;
  // Find the first integer in the string (e.g. "pack of 15 vial" -> 15).
  const match = raw.match(/\d+/);
  if (!match) return null;
  const n = parseInt(match[0], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
