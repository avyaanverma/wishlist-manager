"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { monthKey, monthRange } from "@/lib/months";
import { autoRefreshStale } from "@/lib/refresh";
import { useReady } from "@/lib/store";
import { ExpensesTab } from "./ExpensesTab";
import { GearIcon } from "./icons";
import { MonthWheel } from "./MonthWheel";
import { SettingsSheet } from "./SettingsSheet";
import { WishlistTab } from "./WishlistTab";

type Tab = "wishlist" | "expenses";

export function App() {
  const ready = useReady();
  const [tab, setTab] = useState<Tab>("wishlist");
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [settings, setSettings] = useState(false);
  const currentMonth = useMemo(() => monthKey(new Date()), []);
  const months = useMemo(() => monthRange(currentMonth, 12, 12), [currentMonth]);

  useEffect(() => {
    if (ready) void autoRefreshStale();
  }, [ready]);

  if (!ready) {
    return (
      <main className="mx-auto max-w-3xl px-5 pt-8" aria-busy>
        <div className="h-7 w-40 animate-pulse rounded-full bg-soft" />
        <div className="mt-8 h-16 animate-pulse rounded-3xl bg-soft" />
        <div className="mt-6 h-40 animate-pulse rounded-3xl bg-soft" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-32 md:px-6">
      <header className="flex items-center justify-between pt-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Wishlist<span className="text-accent">.</span>
        </h1>
        <button onClick={() => setSettings(true)} aria-label="Settings" className="rounded-full p-2.5 text-muted transition hover:bg-soft hover:text-ink">
          <GearIcon />
        </button>
      </header>

      <div className="sticky top-0 z-20 -mx-4 bg-page/90 px-4 pb-3 backdrop-blur-md md:-mx-6 md:px-6">
        <MonthWheel months={months} selected={month} currentMonth={currentMonth} onSelect={setMonth} />
        <div className="mx-auto mt-3 grid max-w-xs grid-cols-2 gap-1 rounded-full bg-soft p-1 text-sm font-medium" role="tablist">
          {(["wishlist", "expenses"] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="relative rounded-full py-2 capitalize">
              {tab === t && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: "spring", damping: 30, stiffness: 400 }} />}
              <span className={`relative ${tab === t ? "text-ink" : "text-muted"}`}>{t}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {tab === "wishlist" ? <WishlistTab month={month} /> : <ExpensesTab month={month} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </main>
  );
}
