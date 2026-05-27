# Storage Durability + Private Signed-Read — execution spec

> Created 2026-05-26. The remaining item from the Supabase security pass: move
> Memory Book media off ephemeral local disk onto a durable, PRIVATE store and
> serve it via short-lived signed URLs. This is a launch-workstream task, not a
> live security hole — `server/objectStorage.ts` is already fail-closed
> (bucket = private). Spec'd here because the build is (a) gated on a human
> prerequisite and (b) shouldn't be written blind/untested.

---

## Why this exists

- **Durability:** media currently lands on local container disk (`/uploads/...`)
  → vanishes on redeploy. The "grandma's voice note 404s by the kid's 18th
  birthday" risk. Real, but the data today is all test data, so not urgent.
- **Privacy:** the store must be PRIVATE (children's photos/video/voice). A
  public bucket fails open. `objectStorage.ts` now creates the bucket private —
  which means the old permanent `/object/public/...` URL won't resolve, so the
  read path must move to signed URLs. Durability + privacy are now coupled: you
  can't turn on durable Supabase Storage until signed-read ships.

## Human prerequisite (blocks everything below)

Pick + configure ONE durable store, then hand me the creds/env:
- **Option A — Supabase Storage** (recommended: same vendor, scaffold exists).
  Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (+ optional
  `MEMORY_STORAGE_BUCKET`, default `memory`).
- **Option B — Cloudflare R2 / AWS S3.** Private bucket; presigned GETs.

Until this is set, the app runs on local disk (dev) — fine for now.

## Architecture: store the PATH, sign on READ

The core change: stop storing a permanent URL; store the **object reference**
and resolve it to a **short-lived signed URL at serve time.**

1. **`objectStorage.ts`**
   - `uploadMemoryFile` returns `{ ref, storage }` where `ref` is the object
     path (e.g. `memory/{fundId}/{file}`) for cloud, or the `/uploads/...`
     relative path for local.
   - Add `resolveMediaUrl(ref, { expiresInSec = 900 })`:
     - cloud (`supabase`): POST `/storage/v1/object/sign/{bucket}/{path}` with
       `{ expiresIn }`, service-role auth → return full signed URL (~15 min TTL).
     - local: return `ref` as-is (static middleware serves it; no signing).
     - **external/legacy** (value starts with `http` and isn't our bucket, or
       is a YouTube/Vimeo/Loom embed a gifter pasted): return unchanged.
   - This makes the resolver safe for the **mixed** reality of stored values:
     our-storage paths, legacy local `/uploads/...`, and gifter-pasted external
     URLs all coexist in the DB today.

2. **Upload routes** (store the ref, not a URL): memory upload-photo/video/audio
   (public + authenticated), child-photo, event upload-image. Persist `ref`
   into the existing columns.

3. **Read routes** (resolve → signed URL on serve): public memory
   (`/api/public/funds/:id/memory`), kid-view content, parent memory
   (`/api/funds/:fundId/memory`), gifter dashboard, gifters sheet, dashboard
   summary — anywhere a media URL is returned. Run each value through
   `resolveMediaUrl` before sending.

## DB columns that hold media references

`memory_entries.{photoUrl,videoUrl,audioUrl,authorPhotoUrl}`,
`gifts.{photoUrl,videoUrl,audioUrl}`, `funds.childPhotoUrl`, `events.imageUrl`,
`users.profileImageUrl`.

## Existing-data migration

No destructive migration needed. The resolver passes through legacy local
`/uploads/...` paths and external URLs unchanged; only NEW cloud uploads use the
sign path. Optionally, later: a one-time job to re-upload legacy local files to
the durable store and rewrite their refs. Not required for launch.

## Test plan

- **Now (local mode, testable):** verify `resolveMediaUrl` is a correct no-op
  for local + external refs; verify upload→store-ref→read round-trips and media
  still renders in the Memory Book / KidView via the static middleware.
- **When Storage is configured:** verify upload to the private bucket, signed
  URL resolves + renders, expiry works (a stale signed URL 404s), and the bucket
  is confirmed `public=false`.

## Effort + ownership

~1–2 focused days. **I build + test it the moment you configure the store** (the
signing branch is untestable until then, so I won't ship it blind). The local
no-op branch + the route rewiring are testable now and can be staged first if
you want to de-risk the diff.

## Until it ships

Leave `SUPABASE_URL`/`SERVICE_ROLE` UNSET in production (local-disk dev keeps
running). The bucket is already private (fail-closed), so there is no exposure;
the only cost of waiting is durability, which only matters once real families'
media is in the system. Not launch-gating.
