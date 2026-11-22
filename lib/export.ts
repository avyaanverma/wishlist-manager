import { normalizeData, SCHEMA_VERSION } from "./storage";
import type { AppData } from "./types";

export function download(filename: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportJson(data: AppData) {
  const payload = { app: "wishlist-manager", exportedAt: new Date().toISOString(), ...data, version: SCHEMA_VERSION };
  download(`wishlist-manager-backup-${stamp()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function exportCsv(data: AppData) {
  const tx = toCsv(
    ["id", "type", "amount", "category", "merchant", "date", "note"],
    data.transactions.map((t) => [t.id, t.type, t.amount, t.category, t.merchant, t.date, t.note]),
  );
  const wl = toCsv(
    ["id", "title", "store", "url", "currency", "current_price", "target_month", "priority", "status", "notes", "created_at"],
    data.items.map((i) => [
      i.id,
      i.title,
      i.store,
      i.url,
      i.currency,
      i.priceHistory.at(-1)?.price,
      i.targetMonth,
      i.priority,
      i.status,
      i.notes,
      i.createdAt,
    ]),
  );
  download(`expenses-${stamp()}.csv`, tx, "text/csv");
  setTimeout(() => download(`wishlist-${stamp()}.csv`, wl, "text/csv"), 300);
}

export async function parseJsonFile(file: File): Promise<AppData> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const data = normalizeData(parsed);
  if (!data) throw new Error("That file doesn't look like a Wishlist Manager backup.");
  return data;
}
