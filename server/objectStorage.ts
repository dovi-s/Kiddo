// Durable storage for Memory Book uploads (photos, videos, voice notes).
//
// THE PROBLEM this module exists to solve:
// Before this layer, every upload landed on local container disk at
// `process.cwd()/uploads/memory/...`. That worked in dev and for the happy
// path on a stable container, but it was the single biggest broken-promise
// risk in the product — a grandma records a 30-second voice note for
// 6-month-old Emma, the file lives on local disk, the container restarts,
// the Memory Book row's audioUrl points to a 404. By Emma's 18th birthday,
// every voice note from her first year is gone. The kid-at-18 lens treats
// that as a launch blocker, not a maintenance debt.
//
// HOW this module solves it:
// In production, uploads go to Supabase Storage (REST API, no SDK dep).
// Same vendor as the Postgres database, so no new auth surface and no new
// secrets — `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are already in the
// .env contract. Returns a full public https URL that survives container
// restarts, redeploys, and host migrations.
//
// THE DEV FALLBACK:
// If Supabase env vars aren't set, we transparently fall back to the old
// local-disk behavior so `npm run dev` still works without any cloud config.
// The boot log tells you which mode is active so there's no ambiguity in
// staging or production. URLs returned in dev are relative (`/uploads/...`)
// and served by the static middleware in server/index.ts.

import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = process.env.MEMORY_STORAGE_BUCKET || "memory";

export type StorageMode = "supabase" | "local";

export function getStorageMode(): StorageMode {
  return SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local";
}

export interface UploadInput {
  fundId: string;
  ext: string;
  mime: string;
  buffer: Buffer;
}

export interface UploadResult {
  url: string;
  storage: StorageMode;
  filename: string;
}

function safeFundIdFor(fundId: string): string {
  return String(fundId).replace(/[^a-zA-Z0-9_-]/g, "");
}

function buildFilename(ext: string): string {
  const cleanExt = String(ext || "bin").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
  return `${Date.now()}-${crypto.randomUUID()}.${cleanExt}`;
}

// Best-effort bucket bootstrap. Supabase Storage needs the bucket to exist
// before uploads succeed; idempotent (409 on duplicate is ignored).
//
// SECURITY (2026-05-26): the bucket is created PRIVATE. It holds children's
// photos / videos / voice notes — a PUBLIC bucket would make every object
// readable by anyone with the URL (leaked via browser history, referer
// headers, shared links, a DB dump). That is unacceptable for kids' media,
// and it fails OPEN. The original code created it `public: true` for
// convenience (public URLs render in <img>/<video>/<audio> with no signed-URL
// roundtrip); that convenience is not worth a public bucket of children's
// media. We now fail CLOSED.
//
// REQUIRED FOLLOW-UP before enabling Supabase Storage in production: with a
// private bucket the permanent `/object/public/...` URL built below will NOT
// resolve. Migrate the read path to short-lived SIGNED URLs generated
// on-read — store the object PATH in memory_entries and sign on serve in the
// Memory Book / KidView read routes (/storage/v1/object/sign/{bucket}/{path}
// with a short expiresIn). This is part of the durable-storage launch
// workstream. Until it ships, do NOT set SUPABASE_URL + SERVICE_ROLE in prod;
// the local-disk dev path keeps running unaffected.
let bucketEnsured = false;
async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  if (getStorageMode() !== "supabase") {
    bucketEnsured = true;
    return;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: BUCKET,
        name: BUCKET,
        public: false, // PRIVATE — children's media; fail closed. See SECURITY note above.
        // 30MB cap covers the largest video upload (25MB) with headroom.
        // Audio cap is 10MB, photo is 3MB — both well under.
        file_size_limit: 30 * 1024 * 1024,
      }),
    });
    // 200 = created, 409 = already exists. Both are "we're good".
    if (!res.ok && res.status !== 409) {
      const body = await res.text().catch(() => "");
      // Don't throw — let the upload itself surface a clearer error if the
      // bucket truly doesn't exist. Some Supabase setups create the bucket
      // out-of-band and we don't want to crash on a permissions edge case.
      console.warn(`[objectStorage] ensureBucket non-fatal: ${res.status} ${body.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn("[objectStorage] ensureBucket threw (non-fatal):", err);
  }
  bucketEnsured = true;
}

async function uploadToSupabase(input: UploadInput): Promise<UploadResult> {
  await ensureBucket();
  const safeFundId = safeFundIdFor(input.fundId);
  const filename = buildFilename(input.ext);
  const objectPath = `${safeFundId}/${filename}`;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": input.mime || "application/octet-stream",
      "x-upsert": "false",
      "cache-control": "public, max-age=31536000, immutable",
    },
    body: new Uint8Array(input.buffer),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase upload failed ${res.status}: ${body.slice(0, 300)}`);
  }

  // The bucket is now PRIVATE (see the SECURITY note in ensureBucket), so this
  // `/object/public/...` URL will NOT resolve. It's retained only as the shape
  // to replace: store `objectPath` in memory_entries and generate a short-lived
  // SIGNED URL on read instead. Do not enable Supabase Storage in production
  // until that signed-read path ships. The bytes survive restarts either way
  // (they live in Supabase's storage tier, not container disk).
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
  return { url, storage: "supabase", filename };
}

async function uploadToLocal(input: UploadInput): Promise<UploadResult> {
  const safeFundId = safeFundIdFor(input.fundId);
  const filename = buildFilename(input.ext);
  const dir = path.resolve(process.cwd(), "uploads", "memory", safeFundId);
  await fs.mkdir(dir, { recursive: true });
  const abs = path.join(dir, filename);
  await fs.writeFile(abs, input.buffer);
  // Relative URL — served by the static middleware in server/index.ts.
  // Old uploads created before this module landed already use this shape,
  // so backwards compat is automatic.
  const url = `/uploads/memory/${safeFundId}/${filename}`;
  return { url, storage: "local", filename };
}

export async function uploadMemoryFile(input: UploadInput): Promise<UploadResult> {
  return getStorageMode() === "supabase" ? uploadToSupabase(input) : uploadToLocal(input);
}

// ─── Read-time URL resolution (signed-read for the private bucket) ──────────
// Foundation for the signed-read migration in STORAGE_DURABILITY_SPEC.md.
// Stored media references are a MIX today, so the resolver must handle all:
//   - full URLs (gifter-pasted images, YouTube/Vimeo/Loom embeds, data: URLs)
//     → returned unchanged.
//   - local relative paths "/uploads/..." (current default) → unchanged
//     (served by the static middleware).
//   - bare Supabase object paths ("{fundId}/{file}") → signed on read with a
//     short TTL, because the bucket is private.
// The signing branch is exercised ONLY when Supabase Storage is configured;
// the passthrough branches are active now and are verified no-ops. WIRING:
// call resolveMediaUrl() in the Memory Book / KidView read routes (and switch
// uploadToSupabase to return the bare path) as the second, Storage-gated half
// of the migration — do that when SUPABASE creds exist so it's testable.

const SIGNED_URL_DEFAULT_TTL_SEC = 900; // 15 minutes

function isFullUrl(ref: string): boolean {
  return /^(https?:|data:)/i.test(ref);
}

function isLocalUploadPath(ref: string): boolean {
  return ref.startsWith("/uploads/");
}

// Generate a short-lived signed URL for a private-bucket object. Returns null
// when Storage isn't configured or signing fails (callers fall back to the
// raw ref so a value never becomes null). Dormant until Supabase creds exist.
export async function getSignedUrl(
  objectPath: string,
  expiresInSec: number = SIGNED_URL_DEFAULT_TTL_SEC,
): Promise<string | null> {
  if (getStorageMode() !== "supabase") return null;
  const clean = String(objectPath || "").replace(/^\/+/, "");
  if (!clean) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${clean}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: expiresInSec }),
    });
    if (!res.ok) {
      console.warn(`[objectStorage] sign failed ${res.status} for ${clean}`);
      return null;
    }
    const data: any = await res.json().catch(() => null);
    // Supabase returns { signedURL: "/object/sign/{bucket}/{path}?token=..." }
    const signed = data && (data.signedURL || data.signedUrl);
    return signed ? `${SUPABASE_URL}/storage/v1${signed}` : null;
  } catch (err) {
    console.warn("[objectStorage] sign threw (non-fatal):", (err as any)?.message || err);
    return null;
  }
}

// Resolve a stored media reference to a servable URL. Pure passthrough for
// full URLs + local paths (the only shapes in the DB today); signs bare
// object paths when Supabase Storage is active. Never returns null for a
// non-empty input — falls back to the raw ref.
export async function resolveMediaUrl(
  ref: string | null | undefined,
  opts?: { expiresInSec?: number },
): Promise<string | null> {
  const r = String(ref || "").trim();
  if (!r) return null;
  if (isFullUrl(r) || isLocalUploadPath(r)) return r;
  if (getStorageMode() === "supabase") {
    const signed = await getSignedUrl(r, opts?.expiresInSec ?? SIGNED_URL_DEFAULT_TTL_SEC);
    return signed || r;
  }
  return r;
}

// One-line boot log so the operator knows immediately which mode is active.
// Called from server/index.ts during startup.
export function logStorageMode(): void {
  const mode = getStorageMode();
  if (mode === "supabase") {
    console.log(`[objectStorage] Memory uploads → Supabase Storage (bucket: ${BUCKET})`);
  } else {
    console.warn(
      "[objectStorage] Memory uploads → LOCAL DISK (ephemeral on most hosts). " +
        "Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to enable durable storage."
    );
  }
}
