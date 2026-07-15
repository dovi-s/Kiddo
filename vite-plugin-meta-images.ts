import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

/**
 * Vite plugin that updates og:image and twitter:image meta tags
 * to point to the app's opengraph image with the correct deployment domain.
 */
export function metaImagesPlugin(): Plugin {
  return {
    name: 'vite-plugin-meta-images',
    transformIndexHtml(html) {
      const baseUrl = getDeploymentUrl();
      if (!baseUrl) {
        log('[meta-images] no deployment domain found, skipping meta tag updates');
        return html;
      }

      // Find the OpenGraph image in the public directory. The real asset is
      // kiddo-og-image.png (the index.html default + what the app ships); the
      // older opengraph.* names are kept as fallbacks. Matching the wrong name
      // was why this plugin always no-op'd and production shipped a RELATIVE
      // og:image that social scrapers reject (no link preview on shared gift
      // links). 2026-06-15 fix.
      const publicDir = path.resolve(process.cwd(), 'client', 'public');
      const candidates = ['kiddo-og-image.png', 'opengraph.png', 'opengraph.jpg', 'opengraph.jpeg'];
      const fileName = candidates.find((name) => fs.existsSync(path.join(publicDir, name))) ?? null;

      if (!fileName) {
        log('[meta-images] OpenGraph image not found, skipping meta tag updates');
        return html;
      }

      const imageUrl = `${baseUrl}/${fileName}`;

      log('[meta-images] updating meta image tags to:', imageUrl);

      html = html.replace(
        /<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/g,
        `<meta property="og:image" content="${imageUrl}" />`
      );

      html = html.replace(
        /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/>/g,
        `<meta name="twitter:image" content="${imageUrl}" />`
      );

      return html;
    },
  };
}

function getDeploymentUrl(): string | null {
  const configuredBaseUrl = process.env.APP_BASE_URL || process.env.PUBLIC_BASE_URL;
  if (configuredBaseUrl) {
    const normalized = configuredBaseUrl.replace(/\/$/, "");
    log('[meta-images] using configured base url:', normalized);
    return normalized;
  }

  if (process.env.VERCEL_URL) {
    const url = `https://${process.env.VERCEL_URL}`;
    log('[meta-images] using Vercel domain:', url);
    return url;
  }

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    const url = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    log('[meta-images] using Railway domain:', url);
    return url;
  }

  return null;
}

function log(...args: any[]): void {
  if (process.env.NODE_ENV === 'production') {
    console.log(...args);
  }
}
