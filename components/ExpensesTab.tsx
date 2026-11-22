"use client";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { CATEGORY_COLOR } from "@/lib/categories";
import { money } from "@/lib/format";
import { dateHeading, monthLabel } from "@/lib/months";
import { actions, useData } from "@/lib/store";
import type { Txn } from "@/lib/types";
import { Donut } from "./Donut";
import { PlusIcon } from "./icons";
import { ConfirmDialog } from "./Sheet";
import { TxnSheet } from "./TxnSheet";

export function ExpensesTab({ month }: { month: string }) {
  const { transactions } = useData();
  const [editing, setEditing] = useState<{ txn: Txn | null; key: number } | null>(null);
  const [deleting, setDeleting] = useState<Txn | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const list = useMemo(() => transactions.filter((t) => t.date.startsWith(month)), [transactions, month]);
  const income = list.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = list.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const left = income - expenses;

  const slices = useMemo(() => {
    const by = new Map<string, number>();
    list.filter((t) => t.type === "expense").forEach((t) => by.set(t.category, (by.get(t.category) ?? 0) + t.amount));
    return [...by.entries()]
      .map(([label, value]) => ({ label, value, color: CATEGORY_COLOR[label] ?? CATEGORY_COLOR.Other }))
      .sort((a, b) => b.value - a.value);
  }, [list]);

  const groups = useMemo(() => {
    const m = new Map<string, Txn[]>();
    [...list].sort((a, b) => b.date.localeCompare(a.date)).forEach((t) => m.set(t.date, [...(m.get(t.date) ?? []), t]));
    return [...m.entries()];
  }, [list]);

  const open = (txn: Txn | null) => {
    setNonce((n) => n + 1);
    setEditing({ txn, key: nonce + 1 });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[20px] border border-line bg-card p-5 shadow-soft">
        <p className="text-xs font-medium text-muted">Left in {monthLabel(month, "long")}</p>
        <p className={`mt-1 text-[34px] font-semibold leading-tight tracking-tight ${left < 0 ? "text-accent" : ""}`}>{money(left)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stat label="Income" value={money(income)} />
          <Stat label="Expenses" value={money(expenses)} />
        </div>
      </section>

      {slices.length > 0 && (
        <section className="rounded-[20px] border border-line bg-card p-5 shadow-soft">
          <h2 className="mb-4 text-sm font-semibold">Where it went</h2>
          <Donut slices={slices} total={expenses} active={active} onActive={setActive} />
          <ul className="mt-6 space-y-3.5">
            {slices.map((s) => (
              <li
                key={s.label}
                onMouseEnter={() => setActive(s.label)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setActive(active === s.label ? null : s.label)}
                className={`cursor-pointer transition-opacity ${active && active !== s.label ? "opacity-40" : ""}`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="font-medium">
                    {money(s.value)} <span className="ml-1 text-xs font-normal text-muted">{Math.round((s.value / expenses) * 100)}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-soft">
                  <motion.div className="h-full rounded-full" style={{ background: s.color }} initial={{ width: 0 }} animate={{ width: `${(s.value / expenses) * 100}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-[#ddd6c8] px-6 py-14 text-center">
          <p className="text-base font-medium">Nothing recorded for {monthLabel(month, "long")}</p>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">Add your income and what you spend to see how much is left and where it goes.</p>
          <button onClick={() => open(null)} className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">
            Add an entry
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([date, rows]) => (
            <section key={date}>
              <h3 className="mb-2 px-1 text-xs font-medium text-muted">{dateHeading(date)}</h3>
              <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-card shadow-soft">
                {rows.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => open(t)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[#fbfaf7]">
                      <span className="h-9 w-9 shrink-0 rounded-full" style={{ background: `${CATEGORY_COLOR[t.category] ?? CATEGORY_COLOR.Other}33`, boxShadow: `inset 0 0 0 5px ${CATEGORY_COLOR[t.category] ?? CATEGORY_COLOR.Other}55` }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{t.merchant || t.category}</span>
                        <span className="block truncate text-xs text-muted">{[t.merchant ? t.category : null, t.note].filter(Boolean).join(" · ") || " "}</span>
                      </span>
                      <span className={`text-[15px] font-semibold ${t.type === "income" ? "text-good" : ""}`}>
                        {t.type === "income" ? "+" : ""}
                        {money(t.amount)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <button
        onClick={() => open(null)}
        aria-label="Add entry"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_12px_28px_-10px_rgba(232,116,59,0.8)] transition active:scale-95 md:right-[max(1.5rem,calc(50%-26rem))]"
      >
        <PlusIcon width={24} height={24} />
      </button>

      <TxnSheet key={editing?.key ?? 0} open={editing !== null} txn={editing?.txn ?? null} month={month} onClose={() => setEditing(null)} onDelete={(t) => { setEditing(null); setDeleting(t); }} />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this entry?"
        message={deleting ? `${deleting.merchant || deleting.category} · ${money(deleting.amount)} will be removed.` : ""}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deleteTxn(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#faf8f4] px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}
