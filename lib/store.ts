"use client";
import { useSyncExternalStore } from "react";
import { emptyData, repository, STORAGE_KEY } from "./storage";
import { MAX_HISTORY, type AppData, type Txn, type WishItem } from "./types";
import { uid } from "./format";

/** Tiny external store over the repository, consumed via useSyncExternalStore (SSR-safe). */
const SERVER_SNAPSHOT: AppData = emptyData();
let state: AppData | null = null;
const listeners = new Set<() => void>();

function get(): AppData {
  if (state === null) state = repository.load();
  return state;
}

function set(next: AppData) {
  state = next;
  repository.save(next);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      state = repository.load();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useData(): AppData {
  return useSyncExternalStore(subscribe, get, () => SERVER_SNAPSHOT);
}

/** False on the server and during hydration, true afterwards. */
export function useReady(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export type NewItem = Omit<WishItem, "id" | "createdAt">;

export const actions = {
  addItem(item: NewItem): WishItem {
    const full: WishItem = { ...item, id: uid(), createdAt: new Date().toISOString() };
    const d = get();
    set({ ...d, items: [full, ...d.items] });
    return full;
  },
  updateItem(id: string, patch: Partial<WishItem>) {
    const d = get();
    set({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  },
  deleteItem(id: string) {
    const d = get();
    set({ ...d, items: d.items.filter((i) => i.id !== id) });
  },
  pushPrice(id: string, price: number) {
    const d = get();
    const now = new Date().toISOString();
    set({
      ...d,
      items: d.items.map((i) =>
        i.id === id
          ? { ...i, lastTriedAt: now, priceHistory: [...i.priceHistory, { price, checkedAt: now }].slice(-MAX_HISTORY) }
          : i,
      ),
    });
  },
  markTried(id: string) {
    const d = get();
    set({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, lastTriedAt: new Date().toISOString() } : i)) });
  },
  addTxn(t: Omit<Txn, "id">): Txn {
    const full = { ...t, id: uid() };
    const d = get();
    set({ ...d, transactions: [full, ...d.transactions] });
    return full;
  },
  updateTxn(id: string, patch: Partial<Txn>) {
    const d = get();
    set({ ...d, transactions: d.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  },
  deleteTxn(id: string) {
    const d = get();
    set({ ...d, transactions: d.transactions.filter((t) => t.id !== id) });
  },
  replaceAll(next: AppData) {
    set(next);
  },
  clearAll() {
    repository.clear();
    state = emptyData();
    listeners.forEach((l) => l());
  },
  getItem(id: string) {
    return get().items.find((i) => i.id === id);
  },
};
