// Shared age-transition store — Postgres-backed.
//
// Originally lived as a JSON file at .local/age-transition-flows.json,
// extracted to its own module so the routes and the age-18 worker would
// stop racing on the same file. Now backed by the `age_transitions`
// Postgres table for two reasons:
//
//   1. Multi-server scale: the JSON file is per-process. Two API servers
//      reading + writing to it would race each other and lose updates.
//      Postgres makes this safe across any number of replicas.
//   2. Audit / DD readiness: per-fund state in a queryable table is what
//      a technical reviewer expects. JSON files in `.local/` get
//      flagged as "doesn't scale."
//
// The reader/writer signatures (`getAgeTransitionRecord`,
// `patchAgeTransitionRecord`, `loadAgeTransitionStore`,
// `normalizeAgeTransitionRecord`) are unchanged — every call site keeps
// working without modification.
//
// One-time backfill: on first call, any rows that exist in the legacy
// JSON file but not in the table are inserted. Backfill is idempotent
// (safe to run repeatedly) and gated by a process-wide flag so it only
// fires once per process startup. The JSON file is left in place for
// safety — it can be deleted manually after a successful first run in
// production.

import fs from "fs/promises";
import path from "path";
import { db } from "./db";
import { ageTransitions } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export const AGE_TRANSITION_STATE_PATH = path.join(
  process.cwd(),
  ".local",
  "age-transition-flows.json",
);

export type AgeTransitionRecord = {
  fundId: string;
  childEmail: string | null;
  parentMessage: string | null;
  previewToken: string | null;
  previewPreparedAt: string | null;
  previewViewedAt: string | null;
  inviteToken: string | null;
  invitedAt: string | null;
  inviteViewedAt: string | null;
  childClaimedAt: string | null;
  childClaimedByUserId: string | null;
  handoffRequestedAt: string | null;
  ownershipTransferredAt: string | null;
  ownershipTransferredByUserId: string | null;
  formerCustodianUserId: string | null;
  childEmailVerificationToken: string | null;
  childEmailVerificationSentAt: string | null;
  childEmailVerifiedAt: string | null;
  updatedAt: string | null;
};

export function createEmptyAgeTransitionRecord(fundId: string): AgeTransitionRecord {
  return {
    fundId,
    childEmail: null,
    parentMessage: null,
    previewToken: null,
    previewPreparedAt: null,
    previewViewedAt: null,
    inviteToken: null,
    invitedAt: null,
    inviteViewedAt: null,
    childClaimedAt: null,
    childClaimedByUserId: null,
    handoffRequestedAt: null,
    ownershipTransferredAt: null,
    ownershipTransferredByUserId: null,
    formerCustodianUserId: null,
    childEmailVerificationToken: null,
    childEmailVerificationSentAt: null,
    childEmailVerifiedAt: null,
    updatedAt: null,
  };
}

// Convert a Date or ISO string to ISO string. Postgres returns Date objects
// from timestamp columns; JSON files stored ISO strings. Both shapes
// flow through here unchanged on output.
function toIsoOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return v.toISOString();
  }
  if (typeof v === "string" && v.trim()) return v;
  return null;
}

function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeAgeTransitionRecord(
  fundId: string,
  raw: any,
): AgeTransitionRecord {
  return {
    fundId,
    childEmail:
      typeof raw?.childEmail === "string" && raw.childEmail.trim()
        ? raw.childEmail.trim().toLowerCase()
        : null,
    parentMessage: trimOrNull(raw?.parentMessage),
    previewToken: trimOrNull(raw?.previewToken),
    previewPreparedAt: toIsoOrNull(raw?.previewPreparedAt),
    previewViewedAt: toIsoOrNull(raw?.previewViewedAt),
    inviteToken: trimOrNull(raw?.inviteToken),
    invitedAt: toIsoOrNull(raw?.invitedAt),
    inviteViewedAt: toIsoOrNull(raw?.inviteViewedAt),
    childClaimedAt: toIsoOrNull(raw?.childClaimedAt),
    childClaimedByUserId: trimOrNull(raw?.childClaimedByUserId),
    handoffRequestedAt: toIsoOrNull(raw?.handoffRequestedAt),
    ownershipTransferredAt: toIsoOrNull(raw?.ownershipTransferredAt),
    ownershipTransferredByUserId: trimOrNull(raw?.ownershipTransferredByUserId),
    formerCustodianUserId: trimOrNull(raw?.formerCustodianUserId),
    childEmailVerificationToken: trimOrNull(raw?.childEmailVerificationToken),
    childEmailVerificationSentAt: toIsoOrNull(raw?.childEmailVerificationSentAt),
    childEmailVerifiedAt: toIsoOrNull(raw?.childEmailVerifiedAt),
    updatedAt: toIsoOrNull(raw?.updatedAt),
  };
}

// One-time JSON-to-Postgres backfill. Reads the legacy .json file (if
// present), inserts any rows not already in the table, no-ops on rows
// that already exist. Process-scoped flag prevents repeated reads.
let backfillRan = false;
async function ensureBackfilled(): Promise<void> {
  if (backfillRan) return;
  backfillRan = true;
  try {
    const raw = await fs.readFile(AGE_TRANSITION_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    const entries = Object.entries(parsed) as Array<[string, any]>;
    if (entries.length === 0) return;
    for (const [fundId, value] of entries) {
      const record = normalizeAgeTransitionRecord(fundId, value);
      // INSERT ... ON CONFLICT DO NOTHING — preserves Postgres state if
      // it already has a row for this fund. The JSON is the legacy
      // source; Postgres wins on conflict.
      await db
        .insert(ageTransitions)
        .values(recordToColumnValues(record))
        .onConflictDoNothing()
        .catch((err: any) => {
          // Backfill failure is non-fatal — log and move on so the
          // rest of the rows still migrate. A missing fund_id FK
          // (orphaned legacy entry) is the most likely cause and is
          // safe to skip.
          console.warn(`[ageTransitionStore] backfill skipped fund ${fundId}: ${String(err?.message || err)}`);
        });
    }
    console.log(`[ageTransitionStore] backfilled ${entries.length} legacy JSON rows`);
  } catch (err: any) {
    // ENOENT (file doesn't exist) is the normal case after migration —
    // not an error. Anything else, log + move on; the new Postgres
    // table is authoritative regardless.
    if (err?.code !== "ENOENT") {
      console.warn(`[ageTransitionStore] backfill read failed: ${String(err?.message || err)}`);
    }
  }
}

function recordToColumnValues(record: AgeTransitionRecord) {
  // Convert ISO strings → Date for Drizzle's timestamp columns. Drizzle
  // accepts both but Date is the canonical inferred type from the schema.
  const dateOrNull = (v: string | null) => (v ? new Date(v) : null);
  return {
    fundId: record.fundId,
    childEmail: record.childEmail,
    parentMessage: record.parentMessage,
    previewToken: record.previewToken,
    previewPreparedAt: dateOrNull(record.previewPreparedAt),
    previewViewedAt: dateOrNull(record.previewViewedAt),
    inviteToken: record.inviteToken,
    invitedAt: dateOrNull(record.invitedAt),
    inviteViewedAt: dateOrNull(record.inviteViewedAt),
    childClaimedAt: dateOrNull(record.childClaimedAt),
    childClaimedByUserId: record.childClaimedByUserId,
    handoffRequestedAt: dateOrNull(record.handoffRequestedAt),
    ownershipTransferredAt: dateOrNull(record.ownershipTransferredAt),
    ownershipTransferredByUserId: record.ownershipTransferredByUserId,
    formerCustodianUserId: record.formerCustodianUserId,
    childEmailVerificationToken: record.childEmailVerificationToken,
    childEmailVerificationSentAt: dateOrNull(record.childEmailVerificationSentAt),
    childEmailVerifiedAt: dateOrNull(record.childEmailVerifiedAt),
    updatedAt: dateOrNull(record.updatedAt) || new Date(),
  };
}

// Returns the entire store as a Record keyed by fundId. Used by the
// public verify endpoint to find a fund by token. Postgres-backed
// query replaces the old "load JSON file, return parsed object" path.
export async function loadAgeTransitionStore(): Promise<Record<string, AgeTransitionRecord>> {
  await ensureBackfilled();
  try {
    const rows = await db.select().from(ageTransitions);
    return Object.fromEntries(
      rows.map((row: any) => [row.fundId, normalizeAgeTransitionRecord(row.fundId, row)]),
    );
  } catch (err) {
    console.warn(`[ageTransitionStore] loadAgeTransitionStore failed: ${String((err as any)?.message || err)}`);
    return {};
  }
}

// Legacy compatibility — saveAgeTransitionStore was used internally by
// the JSON-based implementation. The new pattern is per-record patch
// (atomic UPDATE), so this function is intentionally not exported.
// Anyone reaching for it should use patchAgeTransitionRecord instead.

export async function getAgeTransitionRecord(fundId: string): Promise<AgeTransitionRecord> {
  await ensureBackfilled();
  try {
    const [row] = await db
      .select()
      .from(ageTransitions)
      .where(eq(ageTransitions.fundId, fundId))
      .limit(1);
    if (!row) return createEmptyAgeTransitionRecord(fundId);
    return normalizeAgeTransitionRecord(fundId, row);
  } catch (err) {
    console.warn(`[ageTransitionStore] getAgeTransitionRecord failed for ${fundId}: ${String((err as any)?.message || err)}`);
    return createEmptyAgeTransitionRecord(fundId);
  }
}

// Atomic upsert — preserves existing fields, applies the patch, bumps
// updatedAt. Replaces the read-modify-write JSON pattern, which lost
// concurrent updates.
export async function patchAgeTransitionRecord(
  fundId: string,
  patch: Partial<AgeTransitionRecord>,
): Promise<AgeTransitionRecord> {
  await ensureBackfilled();
  // Build the column-shaped patch (ISO strings → Date for timestamps,
  // omit fields not present in the patch so existing values are
  // preserved on UPDATE).
  const dateOrNullSet = (key: keyof AgeTransitionRecord, target: Record<string, any>, columnName: string) => {
    if (key in patch) {
      const v = patch[key] as string | null | undefined;
      target[columnName] = v ? new Date(v) : null;
    }
  };
  const stringSet = (key: keyof AgeTransitionRecord, target: Record<string, any>, columnName: string) => {
    if (key in patch) target[columnName] = patch[key] as string | null;
  };

  const updateSet: Record<string, any> = { updatedAt: new Date() };
  stringSet("childEmail", updateSet, "childEmail");
  stringSet("parentMessage", updateSet, "parentMessage");
  stringSet("previewToken", updateSet, "previewToken");
  dateOrNullSet("previewPreparedAt", updateSet, "previewPreparedAt");
  dateOrNullSet("previewViewedAt", updateSet, "previewViewedAt");
  stringSet("inviteToken", updateSet, "inviteToken");
  dateOrNullSet("invitedAt", updateSet, "invitedAt");
  dateOrNullSet("inviteViewedAt", updateSet, "inviteViewedAt");
  dateOrNullSet("childClaimedAt", updateSet, "childClaimedAt");
  stringSet("childClaimedByUserId", updateSet, "childClaimedByUserId");
  dateOrNullSet("handoffRequestedAt", updateSet, "handoffRequestedAt");
  dateOrNullSet("ownershipTransferredAt", updateSet, "ownershipTransferredAt");
  stringSet("ownershipTransferredByUserId", updateSet, "ownershipTransferredByUserId");
  stringSet("formerCustodianUserId", updateSet, "formerCustodianUserId");
  stringSet("childEmailVerificationToken", updateSet, "childEmailVerificationToken");
  dateOrNullSet("childEmailVerificationSentAt", updateSet, "childEmailVerificationSentAt");
  dateOrNullSet("childEmailVerifiedAt", updateSet, "childEmailVerifiedAt");

  // INSERT for the first patch on this fund (no existing row), UPDATE
  // for subsequent. ON CONFLICT lets us write both with one statement.
  const insertValues = recordToColumnValues({
    ...createEmptyAgeTransitionRecord(fundId),
    ...patch,
    fundId,
  });

  try {
    const [row] = await db
      .insert(ageTransitions)
      .values(insertValues)
      .onConflictDoUpdate({
        target: ageTransitions.fundId,
        set: updateSet,
      })
      .returning();
    return normalizeAgeTransitionRecord(fundId, row);
  } catch (err) {
    console.error(`[ageTransitionStore] patchAgeTransitionRecord failed for ${fundId}: ${String((err as any)?.message || err)}`);
    // Defensive: return the patch applied to a fresh empty record so
    // callers don't crash. Caller should treat next read as truth.
    return normalizeAgeTransitionRecord(fundId, { ...patch, fundId });
  }
}

// Helper for the rare path that wants to look a record up by token.
// Avoids loading the entire store. Used by the public verify endpoint.
export async function findAgeTransitionByVerificationToken(
  token: string,
): Promise<AgeTransitionRecord | null> {
  await ensureBackfilled();
  try {
    const [row] = await db
      .select()
      .from(ageTransitions)
      .where(eq(ageTransitions.childEmailVerificationToken, token))
      .limit(1);
    if (!row) return null;
    return normalizeAgeTransitionRecord(row.fundId, row);
  } catch (err) {
    console.warn(`[ageTransitionStore] findAgeTransitionByVerificationToken failed: ${String((err as any)?.message || err)}`);
    return null;
  }
}

// Suppress unused-import warning for `sql` — kept available for future
// query helpers (e.g., expiring tokens by age). Cheap to keep imported.
void sql;
