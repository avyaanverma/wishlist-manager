"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { money } from "@/lib/format";
import { monthLabel } from "@/lib/months";
import { STORE_LABEL } from "@/lib/stores";
import type { WishItem } from "@/lib/types";
import { CheckIcon, EditIcon, ImageIcon, LinkIcon, RefreshIcon } from "./icons";
import { Sparkline } from "./Sparkline";

export function ItemCard({
  item,
  refreshing,
  showMonth,
  onEdit,
  onRefresh,
  onToggleBought,
}: {
  item: WishItem;
  refreshing: boolean;
  showMonth: boolean;
  onEdit: () => void;
  onRefresh: () => void;
  onToggleBought: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const prices = item.priceHistory.map((p) => p.price);
  const cur = prices.at(-1);
  const prev = prices.length > 1 ? prices[prices.length - 2] : undefined;
  const diff = cur !== undefined && prev !== undefined ? cur - prev : 0;
  const bought = item.status === "bought";
  const dot = item.priority === "high" ? "bg-accent" : item.priority === "med" ? "bg-[#d9c7a8]" : "bg-[#d8d4cc]";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className={`group relative flex flex-col overflow-hidden rounded-[18px] border border-line bg-card shadow-soft ${bought ? "opacity-70" : ""}`}
    >
      <button onClick={onEdit} className="relative block aspect-square w-full overflow-hidden bg-soft text-left" aria-label={`Edit ${item.title}`}>
        {item.imageUrl && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-contain p-3 mix-blend-multiply"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[#cfc9bd]">
            <ImageIcon />
          </span>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-muted shadow-sm">
          {STORE_LABEL[item.store]}
        </span>
        {bought && (
          <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-good px-2 py-1 text-[10px] font-semibold text-white">
            <CheckIcon width={11} height={11} /> Bought
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex items-start gap-2">
          <h3 className="line-clamp-2 flex-1 text-[13.5px] font-medium leading-snug">{item.title}</h3>
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} title={`${item.priority} priority`} />
        </div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[19px] font-semibold tracking-tight">{cur !== undefined ? money(cur, item.currency) : <span className="text-sm font-normal text-muted">No price yet</span>}</p>
            {diff !== 0 && cur !== undefined && (
              <p className={`text-[11px] font-medium ${diff < 0 ? "text-good" : "text-accent"}`}>
                {diff < 0 ? "↓" : "↑"} {money(Math.abs(diff), item.currency)}
              </p>
            )}
          </div>
          <Sparkline values={prices} color={diff < 0 ? "var(--color-good)" : "var(--color-accent)"} />
        </div>
        {showMonth && <p className="text-[11px] text-muted">For {monthLabel(item.targetMonth, "short")} {item.targetMonth.slice(0, 4)}</p>}

        <div className="mt-auto flex items-center gap-1 pt-2 text-muted">
          <IconBtn label="Refresh price" onClick={onRefresh} disabled={!item.url || refreshing}>
            <RefreshIcon width={16} height={16} className={refreshing ? "animate-spin" : ""} />
          </IconBtn>
          <IconBtn label={bought ? "Mark as wanted" : "Mark as bought"} onClick={onToggleBought}>
            <CheckIcon width={16} height={16} />
          </IconBtn>
          <IconBtn label="Edit" onClick={onEdit}>
            <EditIcon width={16} height={16} />
          </IconBtn>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label="Open product page" className="ml-auto rounded-full p-1.5 hover:bg-soft">
              <LinkIcon width={16} height={16} />
            </a>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className="rounded-full p-1.5 transition hover:bg-soft hover:text-ink disabled:opacity-40">
      {children}
    </button>
  );
}
