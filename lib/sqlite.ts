import { normalizeData, SCHEMA_VERSION } from "./storage";
import type { AppData } from "./types";
import { download } from "./export";

/** sql.js is lazy-loaded so it never lands in the main bundle. The wasm is served from /public. */
async function getSql() {
  const mod = await import("sql.js");
  const init = mod.default;
  return init({ locateFile: () => "/sql-wasm.wasm", useOldExtensionFunctions: false });
}

export async function exportSqlite(data: AppData) {
  const SQL = await getSql();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE wishlist_items (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT, store TEXT, image_url TEXT,
      currency TEXT, target_month TEXT, priority TEXT, status TEXT, notes TEXT,
      created_at TEXT, last_tried_at TEXT
    );
    CREATE TABLE price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT NOT NULL REFERENCES wishlist_items(id),
      price REAL NOT NULL, checked_at TEXT
    );
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY, type TEXT, amount REAL, category TEXT, merchant TEXT, date TEXT, note TEXT
    );
  `);
  db.run("INSERT INTO meta VALUES (?, ?)", ["schema_version", String(SCHEMA_VERSION)]);
  db.exec("BEGIN");
  const insItem = db.prepare("INSERT INTO wishlist_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
  const insPrice = db.prepare("INSERT INTO price_history (item_id, price, checked_at) VALUES (?,?,?)");
  for (const i of data.items) {
    insItem.run([
      i.id, i.title, i.url ?? null, i.store, i.imageUrl ?? null, i.currency, i.targetMonth,
      i.priority, i.status, i.notes ?? null, i.createdAt, i.lastTriedAt ?? null,
    ]);
    for (const p of i.priceHistory) insPrice.run([i.id, p.price, p.checkedAt]);
  }
  insItem.free();
  insPrice.free();
  const insTx = db.prepare("INSERT INTO transactions VALUES (?,?,?,?,?,?,?)");
  for (const t of data.transactions) insTx.run([t.id, t.type, t.amount, t.category, t.merchant, t.date, t.note ?? null]);
  insTx.free();
  db.exec("COMMIT");
  const bytes = db.export();
  db.close();
  download(`wishlist-manager-${new Date().toISOString().slice(0, 10)}.sqlite`, bytes as BlobPart, "application/x-sqlite3");
}

function rows(db: import("sql.js").Database, sql: string): Record<string, unknown>[] {
  const res = db.exec(sql);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]])));
}

export async function parseSqliteFile(file: File): Promise<AppData> {
  const SQL = await getSql();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let db: import("sql.js").Database;
  try {
    db = new SQL.Database(bytes);
    db.exec("SELECT 1 FROM wishlist_items LIMIT 1");
    db.exec("SELECT 1 FROM transactions LIMIT 1");
  } catch {
    throw new Error("That file isn't a Wishlist Manager SQLite backup.");
  }
  try {
    const history = rows(db, "SELECT item_id, price, checked_at FROM price_history ORDER BY id");
    const items = rows(db, "SELECT * FROM wishlist_items").map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      store: r.store,
      imageUrl: r.image_url,
      currency: r.currency,
      targetMonth: r.target_month,
      priority: r.priority,
      status: r.status,
      notes: r.notes,
      createdAt: r.created_at,
      lastTriedAt: r.last_tried_at,
      priceHistory: history
        .filter((h) => h.item_id === r.id)
        .map((h) => ({ price: h.price, checkedAt: h.checked_at })),
    }));
    const data = normalizeData({ items, transactions: rows(db, "SELECT * FROM transactions") });
    if (!data) throw new Error("empty");
    return data;
  } catch {
    throw new Error("Couldn't read data from that SQLite file.");
  } finally {
    db.close();
  }
}
