import { NextRequest, NextResponse } from "next/server";
import { buildPreview } from "@/lib/server/preview";
import { assertPublicUrl, UrlError } from "@/lib/server/ssrf";

export const runtime = "nodejs";

/** GET /api/preview?url=... — best-effort product metadata. Never throws for fetch failures. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim();
  if (!url) return NextResponse.json({ ok: false, error: "Missing url" }, { status: 400 });
  try {
    await assertPublicUrl(url);
  } catch (e) {
    const msg = e instanceof UrlError ? e.message : "Invalid URL";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
  const result = await buildPreview(url);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
