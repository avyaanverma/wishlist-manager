"use client";
import { useState } from "react";
import { INCOME_CATEGORY } from "@/lib/types";
import { defaultDateIn } from "@/lib/months";
import { actions } from "@/lib/store";
import { CATEGORIES, type Txn, type TxnType } from "@/lib/types";
import { fieldCls, labelCls, primaryBtn, Sheet } from "./Sheet";

export function TxnSheet({
  open,
  txn,
  month,
  onClose,
  onDelete,
}: {
  open: boolean;
  txn: Txn | null;
  month: string;
  onClose: () => void;
  onDelete: (t: Txn) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={txn ? "Edit entry" : "Add entry"}>
      <TxnForm txn={txn} month={month} onClose={onClose} onDelete={onDelete} />
    </Sheet>
  );
}

function TxnForm({ txn, month, onClose, onDelete }: { txn: Txn | null; month: string; onClose: () => void; onDelete: (t: Txn) => void }) {
  const [type, setType] = useState<TxnType>(txn?.type ?? "expense");
  const [amount, setAmount] = useState(txn ? String(txn.amount) : "");
  const [category, setCategory] = useState(txn && txn.type === "expense" ? txn.category : "Food");
  const [merchant, setMerchant] = useState(txn?.merchant ?? "");
  const [date, setDate] = useState(txn?.date ?? defaultDateIn(month));
  const [note, setNote] = useState(txn?.note ?? "");

  const amt = parseFloat(amount.replace(/,/g, ""));
  const valid = Number.isFinite(amt) && amt > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  function save() {
    if (!valid) return;
    const data = {
      type,
      amount: amt,
      category: type === "income" ? INCOME_CATEGORY : category,
      merchant: merchant.trim(),
      date,
      note: note.trim() || undefined,
    };
    if (txn) actions.updateTxn(txn.id, data);
    else actions.addTxn(data);
    onClose();
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-soft p-1">
        {(["expense", "income"] as TxnType[]).map((t) => (
          <button type="button" key={t} onClick={() => setType(t)} className={`rounded-xl py-2 text-sm font-medium capitalize transition ${type === t ? "bg-white shadow-sm" : "text-muted"}`}>
            {t}
          </button>
        ))}
      </div>
      <div>
        <label className={labelCls} htmlFor="tx-amt">Amount (₹)</label>
        <input id="tx-amt" autoFocus className={`${fieldCls} text-xl font-semibold`} inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      {type === "expense" && (
        <div>
          <label className={labelCls} htmlFor="tx-cat">Category</label>
          <select id="tx-cat" className={fieldCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className={labelCls} htmlFor="tx-who">{type === "income" ? "From" : "Where"}</label>
        <input id="tx-who" className={fieldCls} placeholder={type === "income" ? "Employer, client…" : "Merchant or place"} value={merchant} onChange={(e) => setMerchant(e.target.value)} />
      </div>
      <div>
        <label className={labelCls} htmlFor="tx-date">Date</label>
        <input id="tx-date" type="date" className={fieldCls} value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div>
        <label className={labelCls} htmlFor="tx-note">Note</label>
        <input id="tx-note" className={fieldCls} placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button type="submit" disabled={!valid} className={primaryBtn}>
        {txn ? "Save changes" : "Add entry"}
      </button>
      {txn && (
        <button type="button" onClick={() => onDelete(txn)} className="w-full py-2 text-sm font-medium text-[#b4503a]">
          Delete entry
        </button>
      )}
    </form>
  );
}
