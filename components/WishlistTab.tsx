"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { money } from "@/lib/format";
import { defaultDateIn, monthLabel } from "@/lib/months";
import { refreshAll, refreshItem, useRefreshing } from "@/lib/refresh";
import { searchProvider, type ProductSearchResult } from "@/lib/search";
import { actions, useData } from "@/lib/store";
import { STORE_LABEL } from "@/lib/stores";
import type { WishItem } from "@/lib/types";
import { ItemCard } from "./ItemCard";
import { ItemSheet } from "./ItemSheet";
import { PlusIcon, RefreshIcon } from "./icons";
import { ConfirmDialog, fieldCls, Sheet } from "./Sheet";

export function WishlistTab({ month }: { month: string }) {
  const { items, transactions } = useData();
  const refreshing = useRefreshing();
  const [scope, setScope] = useState<"month" | "all">("month");
  const [sheet, setSheet] = useState<{ item: WishItem | null; url?: string } | null>(null);
  const [sheetKey, setSheetKey] = useState(0);
  const [deleting, setDeleting] = useState<WishItem | null>(null);
  const [buying, setBuying] = useState<WishItem | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast((t) => (t === m ? null : t)), 3200);
  };

  const monthIncome = useMemo(() => transactions.filter((t) => t.type === "income" && t.date.startsWith(month)).reduce((s, t) => s + t.amount, 0), [transactions, month]);
  const monthExpense = useMemo(() => transactions.filter((t) => t.type === "expense" && t.date.startsWith(month)).reduce((s, t) => s + t.amount, 0), [transactions, month]);
  const left = monthIncome - monthExpense;

  const planned = useMemo(
    () =>
      items
        .filter((i) => i.status === "wanted" && i.targetMonth === month && i.currency === "INR")
        .reduce((s, i) => s + (i.priceHistory.at(-1)?.price ?? 0), 0),
    [items, month],
  );

  const shown = useMemo(() => {
    const list = scope === "all" ? items : items.filter((i) => i.targetMonth === month);
    const rank = { high: 0, med: 1, low: 2 } as const;
    return [...list].sort((a, b) => Number(a.status === "bought") - Number(b.status === "bought") || rank[a.priority] - rank[b.priority] || b.createdAt.localeCompare(a.createdAt));
  }, [items, month, scope]);

  const openSheet = (item: WishItem | null, url?: string) => {
    setSheetKey((k) => k + 1);
    setSheet({ item, url });
  };

  const queryIsUrl = /^https?:\/\//i.test(query.trim());
  const over = planned > Math.max(left, 0);
  const pct = planned <= 0 ? 0 : left <= 0 ? 100 : Math.min(100, (planned / left) * 100);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (queryIsUrl) {
      openSheet(null, q);
      setQuery("");
      setResults(null);
      return;
    }
    setResults(await searchProvider.search(q));
  }

  function confirmBought(withExpense: boolean) {
    const it = buying;
    if (!it) return;
    actions.updateItem(it.id, { status: "bought" });
    const price = it.priceHistory.at(-1)?.price;
    if (withExpense && price) {
      actions.addTxn({
        type: "expense",
        amount: price,
        category: "Shopping",
        merchant: it.store === "other" ? "" : STORE_LABEL[it.store],
        date: defaultDateIn(it.targetMonth),
        note: it.title,
      });
      say(`Added ${money(price, it.currency)} to ${monthLabel(it.targetMonth, "long")} expenses`);
    }
    setBuying(null);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[20px] border border-line bg-card p-5 shadow-soft">
        <p className="text-xs font-medium text-muted">Planned for {monthLabel(month, "long")}</p>
        <p className="mt-1 text-[34px] font-semibold leading-tight tracking-tight">{money(planned)}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-soft">
          <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", damping: 26, stiffness: 160 }} />
        </div>
        <p className="mt-2.5 text-sm text-muted">
          {left > 0 ? (
            <>
              <span className="font-medium text-ink">{money(left)}</span> left this month
              {over && planned > 0 && <span className="text-accent"> · {money(planned - left)} over</span>}
            </>
          ) : monthIncome === 0 && monthExpense === 0 ? (
            "Add income in Expenses to compare against your plan"
          ) : (
            <span className="text-accent">Nothing left this month ({money(left)})</span>
          )}
        </p>
      </section>

      <form onSubmit={onSearch} className="space-y-2">
        <input
          className={`${fieldCls} bg-white`}
          placeholder="Search products or paste a link…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setResults(null);
          }}
          aria-label="Search products or paste a link"
        />
        {queryIsUrl && <p className="px-1 text-xs text-muted">Press Enter to add this link.</p>}
        {results && results.length === 0 && <p className="px-1 text-xs text-muted">{searchProvider.emptyMessage}</p>}
      </form>

      <div className="flex items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-soft p-1 text-sm font-medium">
          {(["month", "all"] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)} className={`rounded-full px-4 py-1.5 transition ${scope === s ? "bg-white shadow-sm" : "text-muted"}`}>
              {s === "all" ? "All" : monthLabel(month, "long")}
            </button>
          ))}
        </div>
        <button
          onClick={async () => {
            setBusyAll(true);
            const r = await refreshAll();
            setBusyAll(false);
            say(r.updated + r.failed === 0 ? "No linked items to refresh" : `Prices updated for ${r.updated} item${r.updated === 1 ? "" : "s"}${r.failed ? `, ${r.failed} couldn't be read` : ""}`);
          }}
          disabled={busyAll || !items.some((i) => i.url && i.status === "wanted")}
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted hover:bg-soft disabled:opacity-40"
        >
          <RefreshIcon width={15} height={15} className={busyAll ? "animate-spin" : ""} /> Refresh all
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-[#ddd6c8] px-6 py-14 text-center">
          <p className="text-base font-medium">{items.length === 0 ? "Your wishlist is empty" : `Nothing planned for ${monthLabel(month, "long")}`}</p>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
            {items.length === 0 ? "Paste a link from Amazon or Flipkart, or add something by hand, and plan which month to buy it." : "Add something, or switch to All to see everything you've saved."}
          </p>
          <button onClick={() => openSheet(null)} className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">
            Add an item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 md:gap-4">
          <AnimatePresence mode="popLayout">
            {shown.map((it) => (
              <ItemCard
                key={it.id}
                item={it}
                refreshing={refreshing.has(it.id)}
                showMonth={scope === "all"}
                onEdit={() => openSheet(it)}
                onRefresh={async () => {
                  const ok = await refreshItem(it.id);
                  if (!ok) say("Couldn't read a price from that page");
                }}
                onToggleBought={() => (it.status === "bought" ? actions.updateItem(it.id, { status: "wanted" }) : setBuying(it))}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <button
        onClick={() => openSheet(null)}
        aria-label="Add item"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_12px_28px_-10px_rgba(232,116,59,0.8)] transition active:scale-95 md:right-[max(1.5rem,calc(50%-26rem))]"
      >
        <PlusIcon width={24} height={24} />
      </button>

      <ItemSheet
        key={sheetKey}
        open={sheet !== null}
        item={sheet?.item ?? null}
        prefillUrl={sheet?.url}
        defaultMonth={month}
        onClose={() => setSheet(null)}
        onDelete={(it) => {
          setSheet(null);
          setDeleting(it);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this item?"
        message={deleting ? `“${deleting.title}” will be removed from your wishlist.` : ""}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deleteItem(deleting.id);
          setDeleting(null);
        }}
      />

      <Sheet open={buying !== null} onClose={() => setBuying(null)} title="Marked as bought">
        {buying && (
          <>
            <p className="text-sm leading-relaxed text-muted">
              {buying.priceHistory.at(-1)
                ? `Add ${money(buying.priceHistory.at(-1)!.price, buying.currency)} as a Shopping expense in ${monthLabel(buying.targetMonth, "long")}?`
                : "This item has no price, so there's no expense to add."}
            </p>
            <div className="mt-6 space-y-2">
              {buying.priceHistory.at(-1) && (
                <button onClick={() => confirmBought(true)} className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white">
                  Add expense
                </button>
              )}
              <button onClick={() => confirmBought(false)} className="w-full rounded-2xl bg-soft py-3.5 text-[15px] font-medium">
                {buying.priceHistory.at(-1) ? "Just mark as bought" : "Mark as bought"}
              </button>
            </div>
          </>
        )}
      </Sheet>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-sm text-white shadow-lg"
            role="status"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
