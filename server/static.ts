import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { getSeoForPath, type PageSeo } from "./seoMeta";
import { getPublicBaseUrl } from "./publicUrl";

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Replace the content="" of a single meta tag, matching the exact format the
// source index.html uses (single-spaced, double-quoted). A miss is a graceful
// no-op (the other tags still get set), so a future head-format change can't
// break page delivery.
function setMetaContent(html: string, attr: "name" | "property", key: string, value: string): string {
  const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
  return html.replace(re, `$1${escAttr(value)}$2`);
}

// Inject per-route SEO into the built index.html head. This is head-level SSR:
// it fixes title/description/canonical/OG in the INITIAL HTML so non-JS crawlers
// (social, LLM, Google's first wave) see correct per-page metadata instead of
// the generic "Kiddo" shell. The body is still client-rendered; usePageSeo
// upserts the same tags on hydration, so pre/post-hydration heads agree.
function injectSeo(template: string, seo: PageSeo, canonical: string): string {
  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escText(seo.title)}</title>`);
  html = setMetaContent(html, "name", "description", seo.description);
  html = setMetaContent(html, "property", "og:title", seo.title);
  html = setMetaContent(html, "property", "og:description", seo.description);
  html = setMetaContent(html, "property", "og:type", seo.ogType);
  html = setMetaContent(html, "property", "og:url", canonical);
  html = setMetaContent(html, "name", "twitter:title", seo.title);
  html = setMetaContent(html, "name", "twitter:description", seo.description);
  if (!/rel="canonical"/.test(html)) {
    html = html.replace("</head>", `    <link rel="canonical" href="${escAttr(canonical)}" />\n  </head>`);
  }
  return html;
}

// Absolutize the social-share image per request. The shell ships a RELATIVE
// og:image (client/index.html), and social scrapers (Facebook, iMessage,
// Twitter/X, LinkedIn) reject relative image URLs → no preview card on ANY
// shared link, including the gift links the whole product depends on. Rewriting
// it here with the real request host makes it correct at runtime regardless of
// the build-time env. Applies to every served route, not just the SEO ones.
// 2026-06-15.
function injectOgImage(template: string, base: string): string {
  const ogImage = `${base}/kiddo-og-image.png`;
  let html = setMetaContent(template, "property", "og:image", ogImage);
  html = setMetaContent(html, "name", "twitter:image", ogImage);
  return html;
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }
  const indexHtmlPath = path.resolve(distPath, "index.html");
  // Read the built shell once as the template for head injection.
  let indexTemplate = "";
  try {
    indexTemplate = fs.readFileSync(indexHtmlPath, "utf-8");
  } catch {
    indexTemplate = "";
  }

  app.use(express.static(distPath));

  // SPA fallback. For the known public/satellite routes, serve the shell with a
  // correct per-route head injected (head-level SSR). Everything else (app,
  // private, dynamic gift pages, 404s) falls through to the unchanged shell.
  app.use("*", (req, res) => {
    const pathname = (req.originalUrl || "/").split("?")[0].split("#")[0];
    // No template loaded → fall back to the raw file (unchanged behavior).
    if (!indexTemplate) {
      return res.sendFile(indexHtmlPath);
    }
    const base = getPublicBaseUrl(req);
    // EVERY route gets an absolute social image (so shared gift links preview),
    // then known public/satellite routes additionally get their per-route head.
    let html = injectOgImage(indexTemplate, base);
    const seo = getSeoForPath(pathname);
    if (seo) {
      const normalized = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
      html = injectSeo(html, seo, `${base}${normalized}`);
    }
    res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).send(html);
  });
}
