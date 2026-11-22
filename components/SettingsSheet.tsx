"use client";
import { useRef, useState } from "react";
import { exportCsv, exportJson, parseJsonFile } from "@/lib/export";
import { actions, useData } from "@/lib/store";
import type { AppData } from "@/lib/types";
import { ConfirmDialog, Sheet } from "./Sheet";

type Pending = { kind: "import"; data: AppData; name: string } | { kind: "clear" } | null;

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const [pending, setPending] = useState<Pending>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const jsonIn = useRef<HTMLInputElement>(null);
  const sqlIn = useRef<HTMLInputElement>(null);

  async function importFile(file: File | undefined, kind: "json" | "sqlite") {
    if (!file) return;
    setMsg(null);
    setBusy(true);
    try {
      const parsed = kind === "json" ? await parseJsonFile(file) : await (await import("@/lib/sqlite")).parseSqliteFile(file);
      setPending({ kind: "import", data: parsed, name: file.name });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Import failed.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function sqliteExport() {
    setBusy(true);
    setMsg(null);
    try {
      await (await import("@/lib/sqlite")).exportSqlite(data);
      setMsg({ text: "SQLite file downloaded." });
    } catch {
      setMsg({ text: "Couldn't build the SQLite file.", error: true });
    } finally {
      setBusy(false);
    }
  }

  const empty = data.items.length === 0 && data.transactions.length === 0;

  return (
    <>
      <Sheet open={open && pending === null} onClose={onClose} title="Settings">
        <div className="space-y-6">
          <p className="text-sm text-muted">
            Your data lives only in this browser. {empty ? "Nothing saved yet." : `${data.items.length} wishlist item${data.items.length === 1 ? "" : "s"}, ${data.transactions.length} transaction${data.transactions.length === 1 ? "" : "s"}.`}
          </p>

          <Group title="Export">
            <Row label="JSON backup" hint="Everything, restorable" onClick={() => exportJson(data)} action="Download" />
            <Row label="CSV" hint="Expenses and wishlist, two files" onClick={() => exportCsv(data)} action="Download" />
            <Row label="SQLite" hint="Tables: wishlist_items, price_history, transactions" onClick={sqliteExport} action="Download" disabled={busy} />
          </Group>

          <Group title="Import">
            <Row label="From JSON" hint="Replaces current data" onClick={() => jsonIn.current?.click()} action="Choose file" disabled={busy} />
            <Row label="From SQLite" hint="Replaces current data" onClick={() => sqlIn.current?.click()} action="Choose file" disabled={busy} />
            <input ref={jsonIn} type="file" accept="application/json,.json" hidden onChange={(e) => { void importFile(e.target.files?.[0], "json"); e.target.value = ""; }} />
            <input ref={sqlIn} type="file" accept=".sqlite,.sqlite3,.db,application/x-sqlite3" hidden onChange={(e) => { void importFile(e.target.files?.[0], "sqlite"); e.target.value = ""; }} />
          </Group>

          <Group title="Danger zone">
            <Row label="Clear all data" hint="Deletes everything stored in this browser" onClick={() => setPending({ kind: "clear" })} action="Clear…" danger />
          </Group>

          {msg && <p role="status" className={`text-sm ${msg.error ? "text-[#b4503a]" : "text-good"}`}>{msg.text}</p>}
        </div>
      </Sheet>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "clear" ? "Clear all data?" : "Replace your data?"}
        message={
          pending?.kind === "clear"
            ? "This permanently deletes your wishlist and all income and expense entries from this browser. Export a backup first if you might need them."
            : pending?.kind === "import"
              ? `Importing “${pending.name}” will overwrite everything you have now with ${pending.data.items.length} wishlist item${pending.data.items.length === 1 ? "" : "s"} and ${pending.data.transactions.length} transaction${pending.data.transactions.length === 1 ? "" : "s"}.`
              : ""
        }
        confirmLabel={pending?.kind === "clear" ? "Clear everything" : "Replace data"}
        danger
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending?.kind === "clear") {
            actions.clearAll();
            setMsg({ text: "All data cleared." });
          } else if (pending?.kind === "import") {
            actions.replaceAll(pending.data);
            setMsg({ text: "Data imported." });
          }
          setPending(null);
        }}
      />
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium text-muted">{title}</h3>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">{children}</div>
    </section>
  );
}

function Row({ label, hint, action, onClick, disabled, danger }: { label: string; hint: string; action: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[15px] font-medium">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <button onClick={onClick} disabled={disabled} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium disabled:opacity-40 ${danger ? "bg-[#f7e6e1] text-[#b4503a]" : "bg-soft"}`}>
        {action}
      </button>
    </div>
  );
}
