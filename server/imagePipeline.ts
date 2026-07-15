// Image normalization pipeline — the shared building block for media uploads.
//
// One pass that does the three things raw storage doesn't (see MEDIA_PIPELINE_SPEC.md):
//   1. Bakes in EXIF orientation (no more sideways phone photos).
//   2. STRIPS all metadata, including GPS — a child-privacy / COPPA requirement,
//      not a nice-to-have. sharp does not copy metadata to output by default, so
//      the strip is the absence of `.withMetadata()`, made explicit here.
//   3. Emits right-sized modern-format derivatives (a full + a thumb) so surfaces
//      serve crisp AND fast instead of CSS-scaling a multi-MB original.
//
// Pure + isolated on purpose: it does NOT touch storage, the content scanner, or
// the DB — callers compose those (scan the ORIGINAL bytes, then normalize+store).
// Not yet wired into the (gated, fail-closed) upload handlers; this is the unit
// they'll call once the scanner + object storage land.

import sharp from "sharp";

export type NormalizedImage = {
  /** <=2048px longest edge, webp q90, metadata stripped, orientation baked. */
  full: Buffer;
  /** <=256px longest edge, webp q80 — for avatars / list rows. */
  thumb: Buffer;
  /** Displayed (post-orientation) dimensions of `full`. */
  width: number;
  height: number;
  format: "webp";
};

export const FULL_MAX_PX = 2048;
export const THUMB_MAX_PX = 256;

/**
 * Normalize an uploaded image buffer into stripped, oriented, right-sized webp
 * derivatives. Throws if the input is not a decodable image (the caller should
 * treat a throw as "reject the upload" — never store an unprocessed original on a
 * child-facing surface). `failOn: 'none'` tolerates a slightly-truncated but still
 * renderable file rather than throwing on a soft warning.
 */
export async function normalizeImage(input: Buffer): Promise<NormalizedImage> {
  // .rotate() with no angle applies the EXIF orientation tag, then drops it.
  const base = sharp(input, { failOn: "none" }).rotate();

  const full = await base
    .clone()
    .resize({ width: FULL_MAX_PX, height: FULL_MAX_PX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();

  const thumb = await base
    .clone()
    .resize({ width: THUMB_MAX_PX, height: THUMB_MAX_PX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const meta = await sharp(full).metadata();
  return {
    full,
    thumb,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    format: "webp",
  };
}
