export const pad = (n: number) => String(n).padStart(2, "0");

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}

export function monthRange(center: string, back = 12, ahead = 12): string[] {
  const out: string[] = [];
  for (let i = -back; i <= ahead; i++) out.push(addMonths(center, i));
  return out;
}

export function monthLabel(key: string, style: "short" | "long" | "full" = "short"): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  if (style === "short") return d.toLocaleDateString("en-US", { month: "short" });
  if (style === "long") return d.toLocaleDateString("en-US", { month: "long" });
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A sensible default date for an entry in `month`: today if inside it, else the 1st. */
export function defaultDateIn(month: string): string {
  const t = todayISO();
  return t.startsWith(month) ? t : `${month}-01`;
}

export function dateHeading(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
