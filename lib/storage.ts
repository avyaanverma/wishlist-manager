/**
 * Repository layer over localStorage.
 *
 * Everything in the UI goes through `repository` so a backend can replace it
 * later (same shape, async-able). Data is stored as one versioned JSON blob;
 * `normalizeData` migrates/sanitises anything read from storage or imported.
 */
import {
  CATEGORIES,
  INCOME_CATEGORY,
  MAX_HISTORY,
  type AppData,
  type Priority,
  type PricePoint,
  type StoreName,
  type Txn,
  type WishItem,
} from "./types";
import { detectStore } from "./stores";
import { uid } from "./format";

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = "wishlist-manager:data";

export const emptyData = (): AppData => ({ version: SCHEMA_VERSION, items: [], transactions: [] });

export interface Repository {
  load(): AppData;
  save(data: AppData): void;
  clear(): void;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normItem(raw: unknown): WishItem | null {
  if (!isObj(raw)) return null;
  const title = str(raw.title);
  if (!title) return null;
  const url = str(raw.url);
  const history: PricePoint[] = (Array.isArray(raw.priceHistory) ? raw.priceHistory : [])
    .map((p) => {
      if (!isObj(p)) return null;
      const price = num(p.price);
      if (price === undefined) return null;
      return { price, checkedAt: str(p.checkedAt) ?? new Date().toISOString() };
    })
    .filter((p): p is PricePoint => p !== null)
    .slice(-MAX_HISTORY);
  const store = raw.store === "amazon" || raw.store === "flipkart" || raw.store === "other" ? (raw.store as StoreName) : detectStore(url);
  const priority: Priority = raw.priority === "low" || raw.priority === "high" ? raw.priority : "med";
  const now = new Date();
  const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    id: str(raw.id) ?? uid(),
    title,
    url,
    store,
    imageUrl: str(raw.imageUrl),
    currency: str(raw.currency) ?? "INR",
    priceHistory: history,
    targetMonth: typeof raw.targetMonth === "string" && MONTH_RE.test(raw.targetMonth) ? raw.targetMonth : fallbackMonth,
    priority,
    status: raw.status === "bought" ? "bought" : "wanted",
    notes: str(raw.notes),
    createdAt: str(raw.createdAt) ?? now.toISOString(),
    lastTriedAt: str(raw.lastTriedAt),
  };
}

function normTxn(raw: unknown): Txn | null {
  if (!isObj(raw)) return null;
  const amount = num(raw.amount);
  if (amount === undefined || amount < 0) return null;
  const date = typeof raw.date === "string" && DATE_RE.test(raw.date) ? raw.date : null;
  if (!date) return null;
  const type = raw.type === "income" ? "income" : "expense";
  let category = str(raw.category) ?? "Other";
  if (type === "income") category = INCOME_CATEGORY;
  else if (!(CATEGORIES as readonly string[]).includes(category)) category = "Other";
  return {
    id: str(raw.id) ?? uid(),
    type,
    amount,
    category,
    merchant: str(raw.merchant) ?? "",
    date,
    note: str(raw.note),
  };
}

/** Validate + migrate arbitrary input into the current schema. Returns null if unusable. */
export function normalizeData(raw: unknown): AppData | null {
  if (!isObj(raw)) return null;
  // Future migrations: switch on raw.version here.
  const itemsRaw = raw.items ?? raw.wishlist;
  const txRaw = raw.transactions ?? raw.expenses;
  if (!Array.isArray(itemsRaw) && !Array.isArray(txRaw)) return null;
  return {
    version: SCHEMA_VERSION,
    items: (Array.isArray(itemsRaw) ? itemsRaw : []).map(normItem).filter((x): x is WishItem => x !== null),
    transactions: (Array.isArray(txRaw) ? txRaw : []).map(normTxn).filter((x): x is Txn => x !== null),
  };
}

export const repository: Repository = {
  load() {
    if (typeof window === "undefined") return emptyData();
    try {
      const text = window.localStorage.getItem(STORAGE_KEY);
      if (!text) return emptyData();
      return normalizeData(JSON.parse(text)) ?? emptyData();
    } catch {
      return emptyData();
    }
  },
  save(data) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* quota / private mode: ignore */
    }
  },
  clear() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};
