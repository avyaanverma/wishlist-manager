import * as cheerio from "cheerio";
import { assertPublicUrl } from "./ssrf";
import { detectStore } from "../stores";
import type { StoreName } from "../types";

export interface PreviewResult {
  ok: boolean;
  store: StoreName;
  title?: string;
  image?: string;
  price?: number;
  currency?: string;
  source?: string[];
  error?: string;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_BYTES = 2_500_000;
const TIMEOUT_MS = 8000;

async function fetchHtml(startUrl: string): Promise<{ html: string; finalUrl: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let current = (await assertPublicUrl(startUrl)).toString();
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(current, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-IN,en;q=0.9",
        },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        const next = new URL(res.headers.get("location")!, current).toString();
        current = (await assertPublicUrl(next)).toString(); // re-validate every hop
        continue;
      }
      if (!res.ok) throw new Error(`Store responded with ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) return { html: await res.text(), finalUrl: current };
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        total += value.length;
        if (total > MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
      return { html: Buffer.concat(chunks).toString("utf8"), finalUrl: current };
    }
    throw new Error("Too many redirects");
  } finally {
    clearTimeout(timer);
  }
}

export function parsePrice(s: unknown): number | undefined {
  if (typeof s === "number") return Number.isFinite(s) && s > 0 ? s : undefined;
  if (typeof s !== "string") return undefined;
  const m = s.replace(/\s/g, "").match(/\d[\d,]*(\.\d+)?/);
  if (!m) return undefined;
  const n = parseFloat(m[0].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function toArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

type Json = Record<string, unknown>;

function collectJsonLd($: cheerio.CheerioAPI): Json[] {
  const nodes: Json[] = [];
  const visit = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(visit);
    if (n && typeof n === "object") {
      nodes.push(n as Json);
      const g = (n as Json)["@graph"];
      if (g) visit(g);
    }
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text();
    try {
      visit(JSON.parse(text));
    } catch {
      /* ignore malformed block */
    }
  });
  return nodes;
}

function hasType(n: Json, t: string): boolean {
  return toArray(n["@type"] as string | string[] | undefined).some((x) => String(x).toLowerCase() === t.toLowerCase());
}

function offerPrice(offers: unknown): { price?: number; currency?: string } {
  for (const o of toArray(offers as Json | Json[] | undefined)) {
    if (!o || typeof o !== "object") continue;
    const price = parsePrice(o.price) ?? parsePrice(o.lowPrice);
    if (price) return { price, currency: typeof o.priceCurrency === "string" ? o.priceCurrency : undefined };
    const nested = offerPrice(o.offers);
    if (nested.price) return nested;
    const spec = offerPrice(o.priceSpecification);
    if (spec.price) return spec;
  }
  return {};
}

function firstImage(v: unknown): string | undefined {
  const x = toArray(v as unknown)[0];
  if (typeof x === "string") return x;
  if (x && typeof x === "object" && typeof (x as Json).url === "string") return (x as Json).url as string;
  return undefined;
}

export function extractFromHtml(html: string, pageUrl: string): Omit<PreviewResult, "ok" | "store"> {
  const $ = cheerio.load(html);
  const source: string[] = [];
  let title: string | undefined;
  let image: string | undefined;
  let price: number | undefined;
  let currency: string | undefined;

  const meta = (...names: string[]) => {
    for (const n of names) {
      const v = $(`meta[property="${n}"], meta[name="${n}"], meta[itemprop="${n}"]`).first().attr("content");
      if (v && v.trim()) return v.trim();
    }
    return undefined;
  };

  // 1. JSON-LD Product / Offer
  for (const n of collectJsonLd($)) {
    if (!hasType(n, "Product")) continue;
    if (!title && typeof n.name === "string") {
      title = n.name;
      source.push("jsonld:title");
    }
    if (!image) {
      image = firstImage(n.image);
      if (image) source.push("jsonld:image");
    }
    if (!price) {
      const o = offerPrice(n.offers);
      if (o.price) {
        price = o.price;
        currency = o.currency;
        source.push("jsonld:price");
      }
    }
  }

  // 2. OpenGraph / product meta
  if (!title) {
    title = meta("og:title", "twitter:title");
    if (title) source.push("og:title");
  }
  if (!image) {
    image = meta("og:image", "og:image:secure_url", "twitter:image");
    if (image) source.push("og:image");
  }
  if (!price) {
    price = parsePrice(meta("product:price:amount", "og:price:amount", "price"));
    if (price) {
      currency = currency ?? meta("product:price:currency", "og:price:currency", "priceCurrency");
      source.push("meta:price");
    }
  }

  // 3. Store-specific patterns
  const store = detectStore(pageUrl);
  if (store === "amazon") {
    const t = $("#productTitle").first().text().trim();
    if (t && (!title || title.length < 8)) title = t;
    if (!price) {
      const sels = [
        "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
        "#corePrice_feature_div .a-price .a-offscreen",
        ".a-price .a-offscreen",
        "#priceblock_ourprice",
        "#priceblock_dealprice",
        "#price_inside_buybox",
        ".a-price-whole",
      ];
      for (const s of sels) {
        const p = parsePrice($(s).first().text());
        if (p) {
          price = p;
          source.push(`amazon:${s}`);
          break;
        }
      }
    }
    if (!image) {
      const img = $("#landingImage, #imgBlkFront").first();
      image = img.attr("data-old-hires") || img.attr("src") || undefined;
      if (image) source.push("amazon:image");
    }
  } else if (store === "flipkart") {
    if (!price) {
      for (const s of ["div.Nx9bqj", "div._30jeq3", "div.CxhGGd", "div._16Jk6d"]) {
        const p = parsePrice($(s).first().text());
        if (p) {
          price = p;
          source.push(`flipkart:${s}`);
          break;
        }
      }
    }
    if (!price) {
      const m = html.match(/₹\s?([\d,]{2,})/);
      const p = m && parsePrice(m[1]);
      if (p) {
        price = p;
        source.push("flipkart:₹regex");
      }
    }
  }

  // 4. Last resort: embedded JSON price fields
  if (!price) {
    const m = html.match(/"(?:sellingPrice|finalPrice|currentPrice|price)"\s*:\s*\{?\s*(?:"value"\s*:\s*)?"?(\d[\d,]*(?:\.\d+)?)"?/);
    const p = m && parsePrice(m[1]);
    if (p) {
      price = p;
      source.push("embedded-json");
    }
  }
  if (!price && !title) title = $("title").first().text().trim() || undefined;

  if (image) {
    try {
      image = new URL(image, pageUrl).toString();
      if (!/^https?:/.test(image)) image = undefined;
    } catch {
      image = undefined;
    }
  }
  if (title) title = title.replace(/\s+/g, " ").slice(0, 300);
  if (!currency && /₹|INR/.test(html.slice(0, 400000)) && price) currency = "INR";
  return { title, image, price, currency, source };
}

export async function buildPreview(rawUrl: string): Promise<PreviewResult> {
  const store = detectStore(rawUrl);
  try {
    const { html, finalUrl } = await fetchHtml(rawUrl);
    const r = extractFromHtml(html, finalUrl);
    const found = Boolean(r.title || r.image || r.price);
    return { ok: found, store, ...r, error: found ? undefined : "Couldn't read details from this page" };
  } catch (e) {
    return { ok: false, store, error: e instanceof Error ? e.message : "Fetch failed" };
  }
}
