"use client";
import { motion } from "framer-motion";
import { money } from "@/lib/format";

export interface Slice {
  label: string;
  value: number;
  color: string;
}

const R = 76;
const C = 2 * Math.PI * R;

export function Donut({
  slices,
  total,
  active,
  onActive,
}: {
  slices: Slice[];
  total: number;
  active: string | null;
  onActive: (label: string | null) => void;
}) {
  const arcs = slices.map((s, i) => {
    const before = slices.slice(0, i).reduce((sum, x) => sum + x.value, 0);
    return { ...s, len: (s.value / total) * C, start: (before / total) * C };
  });
  const act = slices.find((s) => s.label === active);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[250px]">
      <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label="Expenses by category">
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--color-soft)" strokeWidth="24" />
        <g transform="rotate(-90 100 100)">
          {arcs.map((a, i) => {
            const gap = arcs.length > 1 ? 2 : 0;
            const len = Math.max(a.len - gap, 0.5);
            const isActive = active === a.label;
            return (
              <motion.circle
                key={a.label}
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke={a.color}
                strokeLinecap="butt"
                style={{ cursor: "pointer", outline: "none" }}
                initial={{ strokeDasharray: `0 ${C}`, strokeWidth: 24, opacity: 1 }}
                animate={{
                  strokeDasharray: `${len} ${C - len}`,
                  strokeDashoffset: -a.start,
                  strokeWidth: isActive ? 30 : 24,
                  opacity: active && !isActive ? 0.35 : 1,
                }}
                transition={{ duration: 0.8, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                onMouseEnter={() => onActive(a.label)}
                onMouseLeave={() => onActive(null)}
                onClick={() => onActive(isActive ? null : a.label)}
                tabIndex={0}
                onFocus={() => onActive(a.label)}
                onBlur={() => onActive(null)}
                aria-label={`${a.label}: ${money(a.value)}, ${Math.round((a.value / total) * 100)}%`}
              />
            );
          })}
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs text-muted">{act ? act.label : "Spent"}</span>
        <span className="text-[22px] font-semibold tracking-tight">{money(act ? act.value : total)}</span>
        {act && <span className="text-xs font-medium" style={{ color: act.color }}>{((act.value / total) * 100).toFixed(1)}%</span>}
      </div>
    </div>
  );
}
