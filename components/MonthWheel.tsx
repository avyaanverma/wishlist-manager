"use client";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { monthLabel } from "@/lib/months";

const ITEM_W = 76;

/**
 * Drum-style month picker. Scroll position drives the look (scale/opacity are
 * written straight to the DOM per frame); the centred month is the selection.
 */
export function MonthWheel({
  months,
  selected,
  currentMonth,
  onSelect,
}: {
  months: string[];
  selected: string;
  currentMonth: string;
  onSelect: (m: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const first = useRef(true);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  useLayoutEffect(() => {
    selectedRef.current = selected;
    onSelectRef.current = onSelect;
  });

  const paint = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const pos = el.scrollLeft / ITEM_W;
    const kids = el.querySelectorAll<HTMLElement>("[data-i]");
    kids.forEach((k) => {
      const d = Math.min(Math.abs(Number(k.dataset.i) - pos), 3);
      const scale = 1.18 - 0.3 * Math.min(d, 2);
      k.style.transform = `scale(${scale.toFixed(3)})`;
      k.style.opacity = String(Math.max(0.12, 1 - 0.34 * d).toFixed(3));
    });
    const idx = Math.max(0, Math.min(months.length - 1, Math.round(pos)));
    if (months[idx] !== selectedRef.current) onSelectRef.current(months[idx]);
  }, [months]);

  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(paint);
  };

  // Move the strip when the selection changes from outside (click / keys / mount).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = months.indexOf(selected);
    if (idx < 0) return;
    if (Math.round(el.scrollLeft / ITEM_W) !== idx || first.current) {
      el.scrollTo({ left: idx * ITEM_W, behavior: first.current ? "auto" : "smooth" });
    }
    first.current = false;
    paint();
  }, [selected, months, paint]);

  // Vertical wheel -> horizontal scroll (needs a non-passive listener).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // native horizontal swipe
      e.preventDefault();
      el.style.scrollSnapType = "none"; // otherwise snapping eats small deltas
      el.scrollLeft += e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
      clearTimeout(timer);
      timer = setTimeout(() => {
        el.style.scrollSnapType = "";
        el.scrollTo({ left: Math.round(el.scrollLeft / ITEM_W) * ITEM_W, behavior: "smooth" });
      }, 120);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(timer);
    };
  }, []);

  // Arrow keys anywhere (unless typing or a sheet is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const idx = months.indexOf(selectedRef.current);
      const next = months[idx + (e.key === "ArrowRight" ? 1 : -1)];
      if (next) {
        e.preventDefault();
        onSelectRef.current(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [months]);

  return (
    <div className="relative" aria-label="Month">
      <div
        ref={ref}
        onScroll={onScroll}
        role="listbox"
        aria-label="Select month"
        className="no-scrollbar flex snap-x snap-mandatory items-center overflow-x-auto py-4"
        style={{ WebkitOverflowScrolling: "touch", maskImage: "linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)" }}
      >
        <div className="shrink-0" style={{ width: `calc(50% - ${ITEM_W / 2}px)` }} aria-hidden />
        {months.map((m, i) => {
          const active = m === selected;
          return (
            <button
              key={m}
              data-i={i}
              role="option"
              aria-selected={active}
              onClick={() => onSelect(m)}
              style={{ width: ITEM_W }}
              className="flex shrink-0 snap-center justify-center will-change-transform"
            >
              <span
                className={`flex h-11 min-w-[60px] flex-col items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors duration-200 ${
                  active ? "bg-accent text-white shadow-[0_6px_16px_-6px_rgba(232,116,59,0.7)]" : "text-ink"
                }`}
              >
                <span className="leading-none">{active ? monthLabel(m).toUpperCase() : monthLabel(m)}</span>
                {m.endsWith("-01") && !active && <span className="mt-0.5 text-[9px] font-medium leading-none text-muted">{m.slice(0, 4)}</span>}
              </span>
            </button>
          );
        })}
        <div className="shrink-0" style={{ width: `calc(50% - ${ITEM_W / 2}px)` }} aria-hidden />
      </div>
      <p className="-mt-1 text-center text-xs text-muted">
        {monthLabel(selected, "full")}
        {selected === currentMonth && <span className="ml-1.5 text-accent">· this month</span>}
      </p>
    </div>
  );
}
