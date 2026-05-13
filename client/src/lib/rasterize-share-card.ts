// Rasterize a rendered DOM element into a PNG and share it as a File via the
// Web Share Files API, falling back to a download anchor when files-sharing
// isn't supported. Used by MilestoneMoment to turn the MilestoneShareCard
// React component into a 1-tap shareable image.
//
// Why a separate helper:
//   The share card is designed React-first (CSS gradients, lucide icons,
//   Tailwind tokens, font-heading). html-to-image captures the rendered
//   output pixel-faithfully — no Canvas re-drawing, no design drift between
//   the in-app render and the shared asset. The card is the source of truth.
//
// Constraints respected:
//   - pixelRatio 2: sharp on retina, doesn't OOM mid-range Android
//   - document.fonts.ready: webfonts (DM Sans, Bricolage Grotesque) must
//     be loaded or the PNG falls back to system fonts and the brand drifts
//   - cream backgroundColor: explicit so transparent edges don't bleed
//   - The card is rasterized as-is; callers control aspect ratio + sizing

import { toBlob } from "html-to-image";

export interface RasterizeOptions {
  filename: string;
  pixelRatio?: number;
  backgroundColor?: string;
}

export async function rasterizeElementToPng(
  node: HTMLElement,
  options: RasterizeOptions,
): Promise<File | null> {
  // Wait for any pending webfonts so the rasterized PNG matches the on-screen
  // rendering. Without this, fast taps after a cold load can capture before
  // Bricolage Grotesque arrives and the milestone number renders in DM Sans.
  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  } catch {
    // Old browser; continue without font wait.
  }

  const blob = await toBlob(node, {
    pixelRatio: options.pixelRatio ?? 2,
    backgroundColor: options.backgroundColor ?? "hsl(43 47% 95%)", // kiddo-cream
    cacheBust: true,
    skipFonts: false,
  });

  if (!blob) return null;
  return new File([blob], options.filename, { type: "image/png" });
}

export interface ShareImageOptions {
  title: string;
  text: string;
  url?: string;
}

export type ShareImageOutcome =
  | { kind: "shared" }
  | { kind: "downloaded" }
  | { kind: "cancelled" }
  | { kind: "failed"; reason: "no-blob" | "rasterize-error"; error?: unknown };

// Share the file via the Web Share Files API if supported, otherwise fall
// back to a download anchor. Returns an outcome the caller can act on (e.g.
// haptic + toast for "shared" / "downloaded", no toast for "cancelled").
export async function shareOrDownloadImage(
  file: File,
  share: ShareImageOptions,
): Promise<ShareImageOutcome> {
  // Web Share Files API path. Safari iOS 15+, Chrome Android, Edge desktop.
  // canShare({ files }) is the right gate — `navigator.share` exists on
  // browsers that don't accept files (older Safari macOS pre-16.4).
  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (canShareFiles && typeof navigator.share === "function") {
    try {
      await navigator.share({
        files: [file],
        title: share.title,
        text: share.text,
        // url intentionally omitted when sharing a file — some OSes show the
        // url as a separate attachment line and that competes with the image.
      });
      return { kind: "shared" };
    } catch (err) {
      // AbortError = user dismissed; anything else = fall through to download.
      if (err instanceof Error && err.name === "AbortError") {
        return { kind: "cancelled" };
      }
      // Continue to download fallback.
    }
  }

  // Download fallback. Works in every browser that supports anchor download.
  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Slight delay before revoke so Safari finishes the download dispatch.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { kind: "downloaded" };
  } catch (error) {
    return { kind: "failed", reason: "rasterize-error", error };
  }
}
