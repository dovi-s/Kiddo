# Media Pipeline — quality, privacy, and serving spec

*How pictures, profile pics, video, and voice notes are captured, processed,
stored, and served — and the gap between "functional" (today) and "top-tier."
Shares the upload path with `CONTENT_SCANNER_VENDOR_SPEC.md`; build them together.
Decision-support; the EXIF/GPS item is a child-privacy (COPPA) requirement.*

**Created:** 2026-06-09 · **Status:** spec, mostly unbuilt · **Gates:** the media
UGC feature (fail-closed off in prod until the scanner is wired).

---

## 0. Current state (audited 2026-06-09, grounded in code)

- **Caps are the headline quality ceiling — and they're coherent by surface, not a
  bug.** Both **memory-photo** paths are **3MB** (decoded `buffer.length`): the public
  `/api/public/funds/:id/memory/upload-photo` (`:8333`) AND the authenticated
  `/api/funds/:fundId/memory/upload-photo` (`:13479`) — so the 3MB is by *surface*,
  not by auth. Prominent **display** surfaces are 5MB: `/api/funds/:fundId/child-photo`
  (`:13409`), `/api/events/:id/upload-image` (`:10813`). Profile is 7MB on the
  data-URL string (`:14536`) ≈ ~5MB binary, so its "under 5MB" message is correct.
  Video 25MB, voice 10MB. **3MB on memory is a deliberate tight control** (the public
  one is a stranger→child upload). The ceiling is real (3MB rejects many phone photos,
  3–8MB), but **raising it is a quality decision bundled with the pipeline + scanner,
  not an inconsistency to "fix."**
- **No image-processing pipeline.** `sharp` is installed but used **only for OG
  social images** (`ogMiddleware.ts`). User uploads get NO resize, optimization,
  orientation fix, **EXIF strip**, webp/avif, or thumbnails. Bytes stored as-is.
- **Raw disk serving** from `/uploads` — no CDN, no responsive sizes, no signed
  URLs (object storage = `M2` roadmap). Display is plain `<img>` + `object-cover`;
  full originals are downloaded and CSS-scaled (a 3MB photo into a 40px avatar).
- **Video has a compatibility risk, not just size.** Accepts `video/quicktime`
  (iPhone `.mov`/HEVC) with **no transcoding** (`MemoryMediaPicker.tsx:458`) → may
  not play in the kid's browser at all.
- **Voice is fine.** `MediaRecorder` → `audio/webm` (Opus), `audio/mp4` Safari
  fallback, 60s soft cap. Good quality; leave it (optionally set an explicit
  `audioBitsPerSecond` for consistency).

**Verdict: functional, not top-tier, and slightly unsafe (EXIF/GPS).** Nothing
blocks the demo (seeded media is fine).

## 1. Why this is moat-relevant, not polish

The Memory Book media IS the switching cost — "records of being loved." A
grandparent's photo rejected for being 4MB, a video that won't play, or a child's
photo carrying home GPS coordinates directly corrode the emotional payload and the
trust that is the moat. This is one of the few "quality" areas worth real
investment — but it rides the same upload path + gate as the scanner and storage,
so build it with them, not as a standalone pass.

## 2. The principle: capture-high, serve-optimized (don't store-raw-huge)

"Top-tier" is NOT "keep the 8MB original on disk." It is: accept a high-quality
source, normalize it, strip what's unsafe, and serve right-sized modern-format
derivatives. Storing raw originals is slow, costly, and a privacy liability.

## 3. The pipeline (sharp — already installed)

**BUILT 2026-06-09: `server/imagePipeline.ts` (`normalizeImage(buffer)`) + unit test
(`npm run test:image-pipeline`, 11/11 — confirms EXIF/GPS stripped, orientation baked
100×200→200×100, webp, size caps).** It is *not yet wired* into the (gated, fail-closed)
upload handlers — that's the integration step that lands with the scanner + storage.
The helper, called on every image upload, does these in one pass:

```
// outline — server/imagePipeline.ts (new)
const img = sharp(buffer, { failOn: 'none' })
  .rotate();                 // bake in EXIF orientation, THEN drop the tag
// .withMetadata() is OFF by default → ALL metadata (incl. GPS) is stripped.
const full = await img.clone().resize({ width: 2048, withoutEnlargement: true })
  .webp({ quality: 90 }).toBuffer();      // crisp, modern, ~smaller
const thumb = await img.clone().resize({ width: 256 })
  .webp({ quality: 80 }).toBuffer();      // avatars / list rows
// store both; serve thumb in lists, full on detail. Keep a high-quality
// fallback (jpeg q92) for clients without webp if any remain.
```

1. **Strip EXIF — especially GPS** (priority-1, child-privacy/COPPA). `sharp`
   strips metadata by default; the only nuance is `.rotate()` first so orientation
   isn't lost when the tag is dropped.
2. **Normalize orientation** (no more sideways phone photos).
3. **Generate derivatives** — a ~2048px webp full + a 256px thumb. Serve the right
   one per surface (crisp *and* fast; today a 40px avatar pulls the full original).
4. Re-encode at **high quality** (webp q90 / jpeg q92) so "optimize" never means
   "degrade." Wrap in try/catch; on a sharp failure, fail the upload (don't store
   an unprocessed original on a child surface).

Run order vs the scanner: scan the **original** bytes (what the user actually sent),
then normalize+store. Both see the same image content.

## 4. Caps — unify and raise

Replace the 3MB-vs-5MB binary patchwork with one constant (e.g.
**`MAX_IMAGE_UPLOAD = 12MB`** binary) applied everywhere, since the pipeline now
stores an optimized derivative regardless of source size. (Profile measures the
data-URL string, so its limit needs the ~1.33× conversion — keep that distinction.)
Reconsider video (25MB is tight for a 60–90s clip) once transcoding exists.

## 5. Video — normalize for compatibility (spec only; NOT buildable-now)

The real problem isn't size, it's **playback**: a grandparent's iPhone `.mov`/HEVC
(`MemoryMediaPicker.tsx:458` accepts `video/quicktime`) may not decode in the kid's
browser at all. The fix is to **transcode to web-safe H.264/mp4 + AAC** on upload and
extract a **poster frame**.

**Why this is a spec, not a built unit (unlike `imagePipeline.ts`).** Verified
2026-06-09: there is **no ffmpeg dependency, no system ffmpeg, no references** in the
repo. The image helper was buildable + testable because `sharp` was already a
dependency and is a pure, fast function. Video transcode needs a heavy binary, is
slow/async, and can't be unit-verified here — so building it now would mean slipping
in an ~80MB dependency (an architecture/deploy decision you own) plus an unverifiable
helper. It's specced like PhotoDNA: ready, decided deliberately.

**The build-vs-rent decision (founder-owned architecture):**
- **Self-host ffmpeg** (`ffmpeg-static` + `fluent-ffmpeg`, or a Lambda): cheap per-
  clip, but adds the binary to the deploy, the transcode latency/queue, and the ops.
  Command shape: `-c:v libx264 -profile:v main -pix_fmt yuv420p -movflags +faststart
  -c:a aac` for universal web playback; `-ss 1 -frames:v 1` for the poster.
- **Rent a video platform** (Mux, Cloudflare Stream, AWS MediaConvert): transcode +
  thumbnails + adaptive delivery + CDN in one rail. More $/clip, **zero ops**, better
  playback. Per the company doctrine ("rent the commodity rails down") and the tiny
  team, **the rented option is likely the right call** — same logic as renting the
  custodian and the content scanner. Recommend Cloudflare Stream / Mux unless volume
  economics later favor self-hosting.

**The two-birds tie-in (the reason to decide this WITH the scanner):** whichever
path, the **same frame-extraction serves both** the scanner's C2 (sample N keyframes
→ run each through `imagePipeline`/the image scanner for moderation) AND the poster +
transcode here. One integration, both jobs — so don't build the scanner's video
moderation and the playback transcode separately; they're one ffmpeg/vendor decision.

**Async note:** transcode is slow — don't block the upload request. Accept → respond
"processing" → transcode in a job → swap the playable asset in when ready (a vendor
handles this for you). Voice: no change (Opus webm is already fine).

## 6. Storage + serving

Move `/uploads` to object storage (Supabase, `M2`) with **signed URLs** (also a
child-privacy item — `/uploads` is currently guessable/unsigned per `M2`), and serve
derivatives via the CDN. Use the thumb/full split with `loading="lazy"` (already
present on most surfaces) and keep the `fetchPriority="high"` on the primary child
photo (`DesktopSidebar.tsx:577`).

## 7. Sequencing + gating

- This shares the upload path with `CONTENT_SCANNER_VENDOR_SPEC.md` and the storage
  move (`M2`). **Build the three together** — one pass over the upload handlers.
- **EXIF/GPS strip is a hard pre-launch requirement** that must be in place before
  the media feature turns on. It is NOT an active leak today (fail-closed off), so
  it's a gating requirement, not an emergency standalone fix.
- **There is NO safe-now cap change.** Verified 2026-06-09: the 3MB memory caps are a
  deliberate per-surface control (incl. a stranger→child path), not an accident.
  Raising them loosens a safety control on a child surface, so it belongs *with* the
  pipeline + scanner (which store optimized derivatives, making source size matter
  less) — not as a standalone edit. The genuinely-done-now item is the building block
  itself: **`server/imagePipeline.ts` is built + unit-tested** (`npm run
  test:image-pipeline`, 11/11), ready to wire when the scanner + object storage land.

## 8. Tradeoffs (why not just max everything)

Bigger caps + higher quality = more storage cost + a bigger scan surface on a
child UGC path + slower mobile uploads. All mitigated by *accept-big, store-
optimized* (this pipeline). The re-encode must use high-quality settings or
"optimize" silently degrades — the opposite of the goal.

*Net: media today is functional but capped-low, unoptimized, and missing an
EXIF/GPS strip. The fix is a sharp pipeline (orientation + metadata strip +
derivatives), unified/raised caps, video normalize, and object storage — sequenced
with the scanner + storage work because they share the upload path. Voice is already
good. Pairs with `CONTENT_SCANNER_VENDOR_SPEC.md`, `KID_VIEW_SAFETY_GATE_SPEC.md`,
and the `M2` storage item.*
