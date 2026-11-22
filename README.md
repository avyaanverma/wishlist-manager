# Wishlist Manager

A calm, personal web app for two things: a **wishlist** of things you want to buy, planned month by month, and a simple **monthly income/expense tracker**. Everything stays in your browser.

## Features

- **Month wheel** shared by both tabs: a snap-scrolling drum from 12 months back to 12 ahead. Scroll with a trackpad swipe, shift+wheel or a plain mouse wheel, use the left/right arrow keys, or click a month.
- **Wishlist** shown as a two-column picture grid (three on wide screens): image, name, current price, price change since the last check, a tiny sparkline of the last 3 prices, and a store badge (Amazon / Flipkart / Other).
  - Add by pasting a link (title, image and price are fetched on a best-effort basis) or by typing details.
  - "Refresh price" per item and "Refresh all". Items not checked for more than 24 hours are refreshed automatically when the app opens, one at a time.
  - Filter by the selected month or show All. Planned spend is compared with that month's remaining money (income minus expenses).
  - Mark as bought and optionally create the matching expense.
  - A search box backed by a `ProductSearchProvider` interface (currently a stub).
- **Expenses**: income/expense entries by month, summary (Income, Expenses, Left), entries grouped by date, an animated category donut (hover or tap a slice) and a legend with amounts and progress bars.
- **Settings**: export JSON / CSV / SQLite, import JSON / SQLite (with confirmation), clear all data.

## Run it

Requires Node 22 and npm 10.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint
```

## Storage and export notes

- Data is stored in `localStorage` under the key `wishlist-manager:data` as one JSON document with a `version` field (currently `1`).
- All access goes through `lib/storage.ts` (a small `Repository` plus `normalizeData`, which validates and migrates anything it reads or imports). `lib/store.ts` wraps it for React. To add a backend later, implement the same repository shape and swap it in; add migrations in `normalizeData`.
- Price history is capped to the last 3 points per item. Only INR items count towards the "planned" total.
- **JSON** is the full backup. **CSV** downloads two files (`expenses-*.csv`, `wishlist-*.csv`). **SQLite** builds a real `.sqlite` file in the browser with [sql.js](https://sql.js.org) (lazy-loaded; the wasm is served from `/public/sql-wasm.wasm`) with tables `wishlist_items`, `price_history`, `transactions` (plus a `meta` table with the schema version).
- Importing replaces all existing data, after a confirmation.
- Clearing browser data erases your wishlist. Export a backup now and then.

## Known limits

- **Price fetching is best effort.** `/api/preview` fetches the page server-side and reads OpenGraph tags, JSON-LD (Product/Offer) and some Amazon/Flipkart patterns. Stores change markup, show captchas or block server IPs, and some pages (or some Amazon listings) don't include a price in the HTML. When that happens you fill in the form by hand; nothing breaks.
- **Product search is stubbed.** It returns nothing and shows "Search coming soon — paste a link for now". There is no scraping of search pages.
- The preview endpoint blocks non-http(s) URLs and hosts that resolve to localhost, private or link-local addresses, and re-checks every redirect. It validates DNS before fetching but does not pin the resolved IP, so treat it as a personal-use guard, not a hardened proxy.
- Single device, single browser: no sync, no accounts. Currency formatting is `en-IN`; the expense tracker is INR only.

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel choose **Add New... > Project** and import the repository.
3. Leave the defaults (framework: Next.js, build command `next build`, no environment variables needed).
4. Click **Deploy**.

The preview route runs as a Node.js serverless function. Some stores may block Vercel's IP ranges, so price fetching can behave differently than on your own machine.
