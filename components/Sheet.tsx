"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, type ReactNode } from "react";
import { CloseIcon } from "./icons";

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-labelledby={id}>
          <motion.div
            className="absolute inset-0 bg-[#2b2a28]/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-card shadow-sheet md:rounded-[24px]"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-2">
              <h2 id={id} className="text-lg font-semibold tracking-tight">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-muted hover:bg-soft">
                <CloseIcon />
              </button>
            </div>
            <div className="overflow-y-auto px-6 pt-2 pb-7">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <p className="text-sm leading-relaxed text-muted">{message}</p>
      <div className="mt-6 flex gap-3">
        <button onClick={onCancel} className="flex-1 rounded-2xl bg-soft py-3 text-sm font-medium">
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 rounded-2xl py-3 text-sm font-medium text-white ${danger ? "bg-[#b4503a]" : "bg-accent"}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

export const fieldCls =
  "w-full rounded-2xl border border-line bg-[#fbfaf7] px-4 py-3 text-[15px] placeholder:text-[#b5b0a6] focus:border-accent/60 focus:bg-white focus:outline-none";
export const labelCls = "mb-1.5 block text-xs font-medium text-muted";
export const primaryBtn =
  "w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white shadow-soft transition active:scale-[0.99] disabled:opacity-50";
