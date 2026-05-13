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
// before uploads succeed; we create it as PUBLIC the first time so the
// returned URLs work in <img> / <video> / <audio> without signed-URL roundtrips.
// This is idempotent — Supabase returns 409 on duplicate which we ignore.
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
        public: true,
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

  // Public bucket → /storage/v1/object/public/{bucket}/{path} is the
  // permanent CDN-cacheable URL. Survives container restarts because the
  // bytes live in Supabase's storage tier, not on our container disk.
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
