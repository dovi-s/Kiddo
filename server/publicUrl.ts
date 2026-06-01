import { type Request } from "express";

// The public origin (protocol://host) for building absolute URLs in robots.txt,
// sitemap.xml, and canonical / OG tags. Prefers an explicitly configured base
// URL, then proxy-forwarded headers, then the request host. Extracted from
// index.ts so static.ts can reuse it without a circular import.
export function getPublicBaseUrl(req: Request): string {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL ||
    "";
  if (configured) {
    try {
      const u = new URL(configured);
      return `${u.protocol}//${u.host}`;
    } catch {
      // fall through to request-derived URL
    }
  }
  const forwardedProtoRaw = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const forwardedHostRaw = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
  const reqHostRaw = String(req.get("host") || "").split(",")[0].trim();
  const proto = forwardedProtoRaw || req.protocol || "https";
  const host = forwardedHostRaw || reqHostRaw || "localhost:5000";
  return `${proto}://${host}`;
}
