export type StoreName = "amazon" | "flipkart" | "other";
export type Priority = "low" | "med" | "high";
export type ItemStatus = "wanted" | "bought";
export type TxnType = "income" | "expense";

export interface PricePoint {
  price: number;
  checkedAt: string; // ISO timestamp
}

export interface WishItem {
  id: string;
  title: string;
  url?: string;
  store: StoreName;
  imageUrl?: string;
  currency: string; // ISO 4217, default INR
  priceHistory: PricePoint[]; // capped to the last 3 (oldest first)
  targetMonth: string; // YYYY-MM
  priority: Priority;
  status: ItemStatus;
  notes?: string;
  createdAt: string;
  /** Last time a refresh was attempted (even if no price was found). */
  lastTriedAt?: string;
}

export interface Txn {
  id: string;
  type: TxnType;
  amount: number;
  category: string;
  merchant: string;
  date: string; // YYYY-MM-DD
  note?: string;
}

export interface AppData {
  version: number;
  items: WishItem[];
  transactions: Txn[];
}

export const CATEGORIES = [
  "Food",
  "Groceries",
  "Shopping",
  "Transport",
  "Bills",
  "Rent",
  "Entertainment",
  "Health",
  "Other",
] as const;

export const INCOME_CATEGORY = "Income";
export const MAX_HISTORY = 3;
