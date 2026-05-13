// OAuth identity store — DB-backed.
//
// PREVIOUS DESIGN (file-backed JSON at .local/oauth-identities.json):
// - In-process write -> JSON.stringify -> fs.writeFile every link/remap
// - Lost linkage data on crash mid-write
// - No DB-level uniqueness; relied on application-level dedupe
// - Couldn't ON DELETE CASCADE with the users table
//
// CURRENT DESIGN (oauth_identities table, see migrations/0012):
// - Single (provider, subject) row per OAuth identity
// - UNIQUE(provider, subject) at the DB layer
// - ON DELETE CASCADE on user_id -> deleting a user cleans up links
// - The legacy JSON file is kept on disk as a one-shot backup; the
//   first call to any read/write path checks if the DB is empty and
//   the file has rows, and if so seeds the DB from the file. After
//   that the file is informational only.
//
// Same exported function signatures as before. Callers in auth.ts
// and routes.ts (merge-duplicate-users endpoint) don't change.

import fs from "fs/promises";
import path from "path";
import { sql } from "drizzle-orm";
import { db } from "./db";

const LEGACY_FILE_PATH = path.join(process.cwd(), ".local", "oauth-identities.json");

type LegacyStore = {
  byProviderSubject: Record<string, string>;
  byUserId: Record<string, string[]>;
};

// One-shot migration latch. The first time anything in this module
// runs, we attempt to copy the legacy JSON file into the DB. After
// that the flag flips and we never read the file again from this
// process. On crash + restart the flag resets but the importer is
// idempotent (INSERT ... ON CONFLICT DO NOTHING).
let legacyImportAttempted = false;
let legacyImportPromise: Promise<void> | null = null;

async function ensureLegacyFileImported(): Promise<void> {
  if (legacyImportAttempted) return;
  if (legacyImportPromise) return legacyImportPromise;

  legacyImportPromise = (async () => {
    try {
      let raw: string;
      try {
        raw = await fs.readFile(LEGACY_FILE_PATH, "utf8");
      } catch {
        // No legacy file -> nothing to import. Common case for fresh
        // installs and for prod after this migration has been live a
        // while.
        return;
      }

      let parsed: LegacyStore;
      try {
        const json = JSON.parse(raw);
        parsed = {
          byProviderSubject:
            json?.byProviderSubject && typeof json.byProviderSubject === "object"
              ? json.byProviderSubject
              : {},
          byUserId:
            json?.byUserId && typeof json.byUserId === "object" ? json.byUserId : {},
        };
      } catch (parseErr) {
        console.warn(
          "[oauthIdentityStore] legacy file unparseable, skipping import:",
          (parseErr as any)?.message || parseErr,
        );
        return;
      }

      const entries = Object.entries(parsed.byProviderSubject || {});
      if (entries.length === 0) return;

      // Insert each (provider, subject) -> user_id mapping. ON
      // CONFLICT DO NOTHING so re-running after a partial import is
      // a no-op. We don't fail the import if a single row's user_id
      // doesn't FK-match (e.g., the user was deleted out-of-band) —
      // log + continue so one bad entry doesn't block all the rest.
      let imported = 0;
      let skipped = 0;
      for (const [key, userId] of entries) {
        if (!key || !userId) {
          skipped += 1;
          continue;
        }
        const sep = key.indexOf(":");
        if (sep < 1) {
          skipped += 1;
          continue;
        }
        const provider = key.slice(0, sep);
        const subject = key.slice(sep + 1);
        if (!provider || !subject) {
          skipped += 1;
          continue;
        }
        try {
          await db.execute(sql`
            INSERT INTO oauth_identities (provider, subject, user_id)
            VALUES (${provider}, ${subject}, ${String(userId)})
            ON CONFLICT (provider, subject) DO NOTHING
          `);
          imported += 1;
        } catch (insertErr) {
          // FK violation likely — user_id doesn't exist anymore.
          // Don't block the rest of the import.
          skipped += 1;
          console.warn(
            `[oauthIdentityStore] legacy import skipped row provider=${provider} subject=${subject.slice(0, 8)}…:`,
            (insertErr as any)?.message || insertErr,
          );
        }
      }

      if (imported > 0 || skipped > 0) {
        console.log(
          `[oauthIdentityStore] legacy import: ${imported} rows imported, ${skipped} skipped (file kept as backup)`,
        );
      }
    } catch (err) {
      // Don't let importer failures break OAuth — the DB is the
      // source of truth from here on, and a missed import row will
      // just cause one user to re-link their identity on next sign-in.
      console.warn(
        "[oauthIdentityStore] legacy import failed:",
        (err as any)?.message || err,
      );
    } finally {
      legacyImportAttempted = true;
    }
  })();

  return legacyImportPromise;
}

export async function getUserIdForOAuthIdentity(
  provider: string,
  subject: string,
): Promise<string | null> {
  await ensureLegacyFileImported();
  const result = await db.execute(sql`
    SELECT user_id FROM oauth_identities
    WHERE provider = ${provider} AND subject = ${subject}
    LIMIT 1
  `);
  const row = (result.rows as any[])?.[0];
  return row?.user_id ? String(row.user_id) : null;
}

export async function linkOAuthIdentity(
  userId: string,
  provider: string,
  subject: string,
): Promise<void> {
  await ensureLegacyFileImported();

  // ON CONFLICT DO UPDATE so re-linking the same (provider, subject)
  // to a different user_id (the merge-duplicate-users case, or a
  // genuine user-account swap) is supported and idempotent. The
  // unique index on (provider, subject) is what we conflict against.
  await db.execute(sql`
    INSERT INTO oauth_identities (provider, subject, user_id)
    VALUES (${provider}, ${subject}, ${userId})
    ON CONFLICT (provider, subject) DO UPDATE
      SET user_id = EXCLUDED.user_id, linked_at = NOW()
  `);
}

/**
 * Re-point every OAuth identity currently linked to `fromUserId` so it
 * lives under `toUserId` instead. Used by the merge-duplicate-users
 * migration: when two `users` rows share an email and we collapse the
 * secondary into the primary, any Google/Apple OAuth subjects recorded
 * against the secondary need to follow the merge or the user loses the
 * ability to sign in via that OAuth provider.
 *
 * Returns the count of identities remapped (used in the migration's
 * audit log). Idempotent — calling twice with the same args is a
 * no-op because the second call finds no rows matching `fromUserId`.
 *
 * NOTE: this could collide with an existing (provider, subject) row
 * already pointing at `toUserId` if both users had the same OAuth
 * identity linked (shouldn't happen but: db state can drift). We
 * DELETE-then-UPDATE rather than UPDATE-with-ON-CONFLICT because the
 * latter isn't natively supported on a plain UPDATE. The DELETE
 * removes any row already at `toUserId` for the same (provider,
 * subject) — accepting the from-user's mapping as the survivor
 * because that's the row the caller asked to keep linked.
 */
export async function remapOAuthIdentitiesForUser(
  fromUserId: string,
  toUserId: string,
): Promise<number> {
  if (fromUserId === toUserId) return 0;
  await ensureLegacyFileImported();

  // Count first so we can return the migration audit number.
  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM oauth_identities
    WHERE user_id = ${fromUserId}
  `);
  const count = Number((countResult.rows as any[])?.[0]?.n || 0);
  if (count === 0) return 0;

  // Two-step to handle the rare same-(provider, subject) collision
  // safely: delete any pre-existing target rows that would block the
  // UPDATE, then UPDATE the source rows over.
  await db.execute(sql`
    DELETE FROM oauth_identities
    WHERE user_id = ${toUserId}
      AND (provider, subject) IN (
        SELECT provider, subject FROM oauth_identities
        WHERE user_id = ${fromUserId}
      )
  `);
  await db.execute(sql`
    UPDATE oauth_identities
    SET user_id = ${toUserId}, linked_at = NOW()
    WHERE user_id = ${fromUserId}
  `);

  return count;
}
