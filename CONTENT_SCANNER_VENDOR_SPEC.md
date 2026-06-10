# Content Scanner — vendor wiring spec

*Implementation spec for the remaining CRITICAL trust-safety launch blockers
C1 (real scanner) + C2 (video/audio scanning). The architecture is already built
and fails closed; this is the "how to wire the vendor R&D" that
`TRUST_SAFETY_FINDINGS.md` says to "start now." Decision-support, not legal
advice; the NCMEC/CSAM reporting path is a licensed legal/ops workstream.*

**Created:** 2026-06-09 · **Status:** spec, unwired · **Gates:** public UGC surface.
**Pairs with:** `server/contentScanner.ts` (the seam), `TRUST_SAFETY_FINDINGS.md`
(C1/C2/H1), `KID_VIEW_SAFETY_GATE_SPEC.md` (the sender-trust gate = H1).

---

## 0. What's already true (don't rebuild it)

- `server/contentScanner.ts` is a clean vendor-swap seam: `Scanner` interface,
  `pickScanner()` env switch (`CONTENT_SCANNER`), PhotoDNA + Rekognition stubs,
  `isContentScanningLive()`, `getActiveScannerName()`.
- **It fails CLOSED in prod** (C1, 2026-06-04): the noop scanner, the error catch,
  and the unimplemented stubs all return `safe:false` in production. **Effect: prod
  photo uploads are *refused* today** — the gifter-photo feature is effectively OFF
  until a vendor is wired. There is no open hole; there is a disabled feature.
- Gifter **text** (name/message/guestbook/transcript) is already validated by
  `server/giftTextSafety.ts` on all five public text paths (H2/H9 closed).

So this spec does ONE thing: **wire vendor R&D into the two stubs + add the
video/audio method, which turns the fail-closed rejection into a real scan and
unlocks the UGC feature safely.** This is renting billions of CSAM/moderation R&D
rather than building a classifier.

## 1. Two-track vendor strategy (run both; they're complementary)

The stub comments already note this; making it the plan:

**Track A — general moderation (self-serve, fast, unlocks the feature).**
Catches explicit/nudity/violence/drugs/etc. via a hosted ML model. Candidates:
- **AWS Rekognition Content Moderation** — SDK + self-serve, slots straight into
  the existing `awsRekognitionScanner` stub (the outline is already in the file).
- **Hive Moderation** — often stronger for this category; REST API.
- **Azure AI Content Safety** — comparable; integrates with the PhotoDNA side.
Pick one. This is the track that flips prod photos from "refused" to "scanned."

**Track B — CSAM hash-match (long lead, legally load-bearing for a child surface).**
- **Microsoft PhotoDNA** — the industry standard; hash-match against the NCMEC
  database. **Requires a Microsoft + NCMEC partnership agreement (months of lead) —
  start procurement NOW**, in parallel with Track A. Slots into the `photoDnaScanner`
  stub.
- On a positive hit, **18 U.S.C. §2258A requires an NCMEC report within 24 hours.**
  That reporting + escalation workflow is a **legal/ops** build that lives OFF the
  scanner (the scanner only returns the detection; policy is the caller's — already
  the documented contract).

**Layering:** the `Scanner` should be able to chain — run PhotoDNA (CSAM) AND a
moderation vendor, fail on either. Extend `pickScanner()` to accept a chain (e.g.
`CONTENT_SCANNER=photodna+rekognition`) that runs both and returns the first
`safe:false`. Keep each impl single-responsibility.

## 2. C2 — the video/audio gap (the interface only scans images)

`Scanner` has only `scanImageBuffer`. Video and audio uploads bypass scanning
entirely (C2). Extend the seam:

- **Video:** add `scanVideoBuffer` (or a unified `scanMediaBuffer`). Two impl
  options: (a) **keyframe sampling** — `ffmpeg` extract N frames → run each through
  the image scanner (cheap, synchronous-ish, good enough pre-scale); (b) **vendor
  video moderation** (Rekognition Video / Hive Video) — async job model, more
  thorough, more plumbing. Recommend (a) to launch, (b) at scale.
  **DECIDE THIS WITH `MEDIA_PIPELINE_SPEC.md` §5, not separately:** the same
  frame-extraction (and the build-vs-rent ffmpeg/Mux/Cloudflare-Stream decision)
  serves both this moderation keyframe scan AND the playback transcode + poster
  frame. One integration, both jobs. There is no ffmpeg in the repo today, so this
  rides the same dependency decision (founder-owned architecture).
- **Audio:** **transcribe → text-moderate.** Whisper transcription is already
  scoped in-repo (`npm install openai`, ~$0.006/min) and public-path transcripts
  already drop on contact-pattern hits (M4). Route the transcript through
  `giftTextSafety` + a text classifier. (Audio rarely carries CSAM-image risk; the
  derivative-text surface is the real exposure — already partly handled.)
- **Until built:** every video/audio upload endpoint must gate on
  `isContentScanningLive()` and **fail closed** (reject) — same posture as images.

## 3. Flipping the switch (the go-live mechanics)

1. Implement Track A in the stub; add it to the `isContentScanningLive()`
   `IMPLEMENTED` allowlist (currently empty — that's what keeps it fail-closed).
2. Set `CONTENT_SCANNER` in prod env once Track A is real. Photos now scan instead
   of refuse.
3. Wire Track B (PhotoDNA) when the NCMEC partnership lands; chain it.
4. Add `scanVideoBuffer`/`scanAudioBuffer`; gate those endpoints on
   `isContentScanningLive()` until done.
5. Positive-hit policy is already specced at the call sites: silent audit log +
   generic client error (don't tip the actor) + critical ops alert; CSAM hit →
   the §2258A NCMEC workflow.

## 4. Governance gate before flipping it on (this is the real cost, not the code)

Each vendor receives **child-adjacent media** → it is a **data processor**, and
you are a children's-data company. Before `CONTENT_SCANNER` goes live:
- **DPA** with the vendor; confirm **no retention / no model-training** on the bytes
  you send, and a region you're comfortable with.
- **Data-minimization:** send only the image/frame bytes — never the child's name,
  age, fund, or any PII alongside.
- Fold the processor into the **COPPA / data-privacy inventory** + the counsel
  packet (it's a new sub-processor on a child surface).
This is a governance decision, not a default — "rent the R&D" is right, "pipe a
kid's photo to a new third party" needs sign-off.

## 5. Cost (approximate — verify at procurement)

Trivial at your volume. General moderation is roughly ~$1 per 1,000 images
(Rekognition/Hive order-of-magnitude; first-tier volumes often discounted);
PhotoDNA is free via the NCMEC/Microsoft partnership; video costs more (mitigated by
keyframe sampling). Pre-scale UGC volume makes the bill a rounding error — the cost
that matters is the **lead time** (PhotoDNA partnership) and the **governance**
(§4), not the per-call price.

## 6. Sequencing — and the clever tie-in with the sender-trust gate

The smart unlock combines this with `KID_VIEW_SAFETY_GATE_SPEC.md` (the H1
sender-trust gate):

- **Now / pre-public:** Track A wired → **trusted-family** photos can go live
  (family loop works), because trusted senders + general moderation is a reasonable
  bar for known family.
- **Before opening the public link to strangers:** Track B (PhotoDNA/CSAM) live
  **AND** the sender-trust gate holding untrusted media for parent approval. Stranger
  media must clear both the CSAM hash-match and a human (parent) before a child sees
  it.

That sequencing lets the family feature ship on Track A while the legally-load-
bearing CSAM track + the public surface wait for the full stack — matching the
audit's verdict ("do not open public UGC until the CRITICAL items close") without
freezing the family experience.

## 7. Out of scope

- Building any classifier (that's the rented R&D).
- The §2258A NCMEC reporting workflow (legal/ops, separate).
- Signed `/uploads` URLs (M2, infra roadmap).
- The H1 sender-trust gate itself (its own spec; this assumes it as the gate that
  decides *whose* media needs the full stack).

*Net: the seam is built and safe (fail-closed). This spec turns the disabled
feature back on by renting PhotoDNA + a moderation vendor, extends the seam to
video/audio (C2), and sequences the unlock so family ships first and strangers wait
for the full stack. The blockers are lead time + governance, not engineering.*
