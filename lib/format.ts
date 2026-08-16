export function formatRupiah(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactIDR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return "Rp 0";
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (abs >= 1_000_000_000_000) {
    const val = abs / 1_000_000_000_000;
    const formatted = val.toLocaleString("id-ID", { maximumFractionDigits: 2 });
    return `${sign}Rp ${formatted} T`;
  }
  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000;
    const formatted = val.toLocaleString("id-ID", { maximumFractionDigits: 2 });
    return `${sign}Rp ${formatted} M`;
  }
  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    const formatted = val.toLocaleString("id-ID", { maximumFractionDigits: 1 });
    return `${sign}Rp ${formatted} Jt`;
  }
  if (abs >= 1_000) {
    const val = abs / 1_000;
    const formatted = val.toLocaleString("id-ID", { maximumFractionDigits: 0 });
    return `${sign}Rp ${formatted} Rb`;
  }
  return formatRupiah(amount);
}

export function formatPct(pct: number): string {
  if (isNaN(pct) || pct === null || pct === undefined) return "0%";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1).replace(".", ",")}%`;
}

export function formatDateID(date: string | Date): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
