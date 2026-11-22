"use client";
import { useSyncExternalStore } from "react";
import { actions } from "./store";
import { repository } from "./storage";

export interface PreviewResponse {
  ok: boolean;
  store?: string;
  title?: string;
  image?: string;
  price?: number;
  currency?: string;
  error?: string;
}

export async function fetchPreview(url: string, signal?: AbortSignal): Promise<PreviewResponse | null> {
  try {
    const res = await fetch(`/api/preview?url=${encodeURIComponent(url)}`, { signal });
    return (await res.json()) as PreviewResponse;
  } catch {
    return null;
  }
}

// --- "refreshing" ids as a tiny external store -------------------------------
let refreshing: ReadonlySet<string> = new Set();
const subs = new Set<() => void>();
const EMPTY: ReadonlySet<string> = new Set();
function mark(id: string, on: boolean) {
  const next = new Set(refreshing);
  if (on) next.add(id);
  else next.delete(id);
  refreshing = next;
  subs.forEach((s) => s());
}
export function useRefreshing(): ReadonlySet<string> {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => refreshing,
    () => EMPTY,
  );
}

export async function refreshItem(id: string): Promise<boolean> {
  const item = actions.getItem(id);
  if (!item?.url || refreshing.has(id)) return false;
  mark(id, true);
  try {
    const p = await fetchPreview(item.url);
    if (p?.price) {
      actions.pushPrice(id, p.price);
      return true;
    }
    actions.markTried(id);
    return false;
  } finally {
    mark(id, false);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function refreshAll(delayMs = 1200): Promise<{ updated: number; failed: number }> {
  const ids = repository
    .load()
    .items.filter((i) => i.url && i.status === "wanted")
    .map((i) => i.id);
  let updated = 0;
  let failed = 0;
  for (let n = 0; n < ids.length; n++) {
    if (await refreshItem(ids[n])) updated++;
    else failed++;
    if (n < ids.length - 1) await sleep(delayMs);
  }
  return { updated, failed };
}

const DAY = 24 * 60 * 60 * 1000;
let autoStarted = false;

/** On app open: refresh wanted items whose last check is older than 24h, one at a time. */
export async function autoRefreshStale(delayMs = 1500) {
  if (autoStarted) return;
  autoStarted = true;
  const now = Date.now();
  const stale = repository
    .load()
    .items.filter((i) => {
      if (!i.url || i.status !== "wanted") return false;
      const last = Math.max(
        i.lastTriedAt ? Date.parse(i.lastTriedAt) : 0,
        i.priceHistory.length ? Date.parse(i.priceHistory[i.priceHistory.length - 1].checkedAt) : 0,
      );
      return now - last > DAY;
    })
    .map((i) => i.id);
  for (const id of stale) {
    await refreshItem(id);
    await sleep(delayMs);
  }
}
