"use client";
import { useEffect, useRef, useState } from "react";
import { actions } from "@/lib/store";
import { fetchPreview } from "@/lib/refresh";
import { detectStore, STORE_LABEL } from "@/lib/stores";
import { MAX_HISTORY, type Priority, type StoreName, type WishItem } from "@/lib/types";
import { fieldCls, labelCls, primaryBtn, Sheet } from "./Sheet";

type Status = "idle" | "loading" | "ok" | "fail";
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];

function isHttp(v: string) {
  try {
    return /^https?:$/.test(new URL(v).protocol);
  } catch {
    return false;
  }
}

export function ItemSheet({
  open,
  item,
  defaultMonth,
  prefillUrl,
  onClose,
  onDelete,
}: {
  open: boolean;
  item: WishItem | null;
  defaultMonth: string;
  prefillUrl?: string;
  onClose: () => void;
  onDelete: (item: WishItem) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={item ? "Edit item" : "Add to wishlist"}>
      <ItemForm item={item} defaultMonth={defaultMonth} prefillUrl={prefillUrl} onClose={onClose} onDelete={onDelete} />
    </Sheet>
  );
}

function ItemForm({
  item,
  defaultMonth,
  prefillUrl,
  onClose,
  onDelete,
}: {
  item: WishItem | null;
  defaultMonth: string;
  prefillUrl?: string;
  onClose: () => void;
  onDelete: (item: WishItem) => void;
}) {
  const startUrl = item?.url ?? prefillUrl ?? "";
  const [url, setUrl] = useState(startUrl);
  const [title, setTitle] = useState(item?.title ?? "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [price, setPrice] = useState(item?.priceHistory.at(-1)?.price?.toString() ?? "");
  const [currency, setCurrency] = useState(item?.currency ?? "INR");
  const [month, setMonth] = useState(item?.targetMonth ?? defaultMonth);
  const [priority, setPriority] = useState<Priority>(item?.priority ?? "med");
  const [store, setStore] = useState<StoreName>(item?.store ?? detectStore(startUrl));
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [status, setStatus] = useState<Status>(!item && prefillUrl && isHttp(prefillUrl) ? "loading" : "idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abort = useRef<AbortController>(undefined);

  async function runPreview(u: string) {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    const p = await fetchPreview(u, ctrl.signal);
    if (ctrl.signal.aborted) return;
    if (!p || !p.ok) {
      setStatus("fail");
      return;
    }
    // Only fill blanks; never overwrite what the user typed.
    setTitle((t) => t || p.title || "");
    setImageUrl((i) => i || p.image || "");
    setPrice((v) => v || (p.price ? String(p.price) : ""));
    if (p.currency && /^[A-Z]{3}$/.test(p.currency) && CURRENCIES.includes(p.currency)) setCurrency(p.currency);
    setStatus("ok");
  }

  useEffect(() => {
    const a = abort;
    const t = timer;
    if (status === "loading") t.current = setTimeout(() => void runPreview(startUrl), 0);
    return () => {
      a.current?.abort();
      clearTimeout(t.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onUrlChange(v: string) {
    setUrl(v);
    const trimmed = v.trim();
    setStore(detectStore(trimmed));
    clearTimeout(timer.current);
    if (isHttp(trimmed)) {
      setStatus("loading");
      timer.current = setTimeout(() => void runPreview(trimmed), 450);
    } else {
      abort.current?.abort();
      setStatus("idle");
    }
  }

  const priceNum = price.trim() === "" ? undefined : parseFloat(price.replace(/,/g, ""));
  const priceInvalid = priceNum !== undefined && (!Number.isFinite(priceNum) || priceNum < 0);
  const urlInvalid = url.trim() !== "" && !isHttp(url.trim());
  const canSave = title.trim().length > 0 && !priceInvalid && !urlInvalid;

  function save() {
    if (!canSave) return;
    const base = {
      title: title.trim(),
      url: url.trim() || undefined,
      store,
      imageUrl: imageUrl.trim() || undefined,
      currency,
      targetMonth: month,
      priority,
      notes: notes.trim() || undefined,
    };
    const now = new Date().toISOString();
    if (item) {
      const last = item.priceHistory.at(-1)?.price;
      let history = item.priceHistory;
      if (priceNum !== undefined && priceNum !== last) history = [...history, { price: priceNum, checkedAt: now }].slice(-MAX_HISTORY);
      actions.updateItem(item.id, { ...base, priceHistory: history });
    } else {
      actions.addItem({
        ...base,
        status: "wanted",
        priceHistory: priceNum !== undefined ? [{ price: priceNum, checkedAt: now }] : [],
        // brand new + no price from the fetch: leave lastTriedAt unset so auto-refresh may try later
        lastTriedAt: status === "ok" || status === "fail" ? now : undefined,
      });
    }
    onClose();
  }

  const hint =
    status === "loading" ? "Fetching details…" : status === "ok" ? "Filled in what we could find. Check and adjust below." : status === "fail" ? "Couldn't read that page — fill in the details yourself." : "Paste a product link, or just type the details.";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div>
        <label className={labelCls} htmlFor="wi-url">Product link (optional)</label>
        <input id="wi-url" className={fieldCls} inputMode="url" placeholder="https://www.amazon.in/…" value={url} onChange={(e) => onUrlChange(e.target.value)} />
        <p className={`mt-1.5 text-xs ${status === "fail" || urlInvalid ? "text-accent" : "text-muted"}`}>{urlInvalid ? "Links must start with http:// or https://" : hint}</p>
      </div>

      {imageUrl && (
        <div className="flex h-24 items-center justify-center overflow-hidden rounded-2xl bg-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" referrerPolicy="no-referrer" className="h-full object-contain mix-blend-multiply" onError={(e) => (e.currentTarget.style.display = "none")} />
        </div>
      )}

      <div>
        <label className={labelCls} htmlFor="wi-title">Name</label>
        <input id="wi-title" className={fieldCls} placeholder="What do you want?" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="grid grid-cols-[1fr_96px] gap-3">
        <div>
          <label className={labelCls} htmlFor="wi-price">Current price</label>
          <input id="wi-price" className={fieldCls} inputMode="decimal" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="wi-cur">Currency</label>
          <select id="wi-cur" className={fieldCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {(CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="wi-month">Plan for</label>
          <input id="wi-month" type="month" className={fieldCls} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls} htmlFor="wi-store">Store</label>
          <select id="wi-store" className={fieldCls} value={store} onChange={(e) => setStore(e.target.value as StoreName)}>
            {(Object.keys(STORE_LABEL) as StoreName[]).map((s) => (
              <option key={s} value={s}>{STORE_LABEL[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className={labelCls}>Priority</span>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-soft p-1">
          {(["low", "med", "high"] as Priority[]).map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setPriority(p)}
              className={`rounded-xl py-2 text-sm font-medium capitalize transition ${priority === p ? "bg-white shadow-sm" : "text-muted"}`}
            >
              {p === "med" ? "Medium" : p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="wi-img">Image link (optional)</label>
        <input id="wi-img" className={fieldCls} inputMode="url" placeholder="https://…" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
      </div>

      <div>
        <label className={labelCls} htmlFor="wi-notes">Notes</label>
        <textarea id="wi-notes" className={`${fieldCls} resize-none`} rows={2} placeholder="Colour, size, why you want it…" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <button type="submit" disabled={!canSave} className={primaryBtn}>
        {item ? "Save changes" : "Add to wishlist"}
      </button>
      {item && (
        <button type="button" onClick={() => onDelete(item)} className="w-full py-2 text-sm font-medium text-[#b4503a]">
          Delete item
        </button>
      )}
    </form>
  );
}
