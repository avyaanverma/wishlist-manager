const cache = new Map<string, Intl.NumberFormat>();

export function money(amount: number, currency = "INR"): string {
  const whole = Number.isInteger(amount);
  const k = `${currency}-${whole}`;
  let f = cache.get(k);
  if (!f) {
    try {
      f = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        minimumFractionDigits: whole ? 0 : 2,
        maximumFractionDigits: whole ? 0 : 2,
      });
    } catch {
      f = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: whole ? 0 : 2,
        maximumFractionDigits: whole ? 0 : 2,
      });
    }
    cache.set(k, f);
  }
  return f.format(amount);
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
