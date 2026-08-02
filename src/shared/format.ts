/** Formats an ISO timestamp as a short relative string ("5m ago", "3h ago"). */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export function formatSignedPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

/** Formats a byte count as a human-readable size ("1.2 GB"). */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  let exponent = Math.min(Math.floor(Math.log2(bytes) / 10), BYTE_UNITS.length - 1);
  let value = bytes / 1024 ** exponent;
  // A value just under a unit boundary (e.g. 1023.96 MB) rounds up to
  // "1024.0" at the display precision below - bump to the next unit so it
  // reads "1.0 GB" instead.
  if (value >= 1023.95 && exponent < BYTE_UNITS.length - 1) {
    exponent += 1;
    value = bytes / 1024 ** exponent;
  }
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${BYTE_UNITS[exponent]}`;
}
