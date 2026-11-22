import type { StoreName } from "./types";

export function detectStore(url?: string): StoreName {
  if (!url) return "other";
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (/(^|\.)amazon\.[a-z.]+$/.test(h) || /(^|\.)amzn\.(in|to|com|eu)$/.test(h) || h === "a.co") return "amazon";
    if (/(^|\.)flipkart\.com$/.test(h) || /(^|\.)fkrt\.(it|cc|xyz)$/.test(h)) return "flipkart";
  } catch {
    /* not a URL */
  }
  return "other";
}

export const STORE_LABEL: Record<StoreName, string> = {
  amazon: "Amazon",
  flipkart: "Flipkart",
  other: "Other",
};
