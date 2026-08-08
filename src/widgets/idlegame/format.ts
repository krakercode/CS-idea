const nf = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

export function formatCompactNumber(value: number): string {
  return nf.format(Math.max(0, value));
}
