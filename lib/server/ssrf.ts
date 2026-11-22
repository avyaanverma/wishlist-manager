import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function v4Private(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast + reserved
  );
}

export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return v4Private(ip);
  if (kind === 6) {
    const l = ip.toLowerCase();
    if (l === "::" || l === "::1") return true;
    const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return v4Private(mapped[1]);
    if (l.startsWith("::ffff:")) return true; // hex-form mapped, be conservative
    if (/^f[cd]/.test(l)) return true; // fc00::/7 unique local
    if (/^fe[89ab]/.test(l)) return true; // fe80::/10 link-local
    if (l.startsWith("ff")) return true; // multicast
    return false;
  }
  return true;
}

export class UrlError extends Error {}

/** Throws UrlError unless `raw` is an http(s) URL resolving only to public addresses. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UrlError("Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new UrlError("Only http(s) URLs are allowed");
  if (u.username || u.password) throw new UrlError("URLs with credentials are not allowed");
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UrlError("Host not allowed");
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new UrlError("Host not allowed");
    return u;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new UrlError("Could not resolve host");
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new UrlError("Host not allowed");
  return u;
}
