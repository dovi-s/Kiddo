/* eslint-disable no-console */
// One-off: scrub the LEGACY Dunphy demo accounts orphaned by the Dunphy→Rivera
// rename. The reset tooling only knows the Rivera emails and keeps user rows, so
// the old `*@dunphyfamily.com` accounts (e.g. claire@dunphyfamily.com) linger —
// an IP-tell (Modern Family) that must not ship, and a stale login.
//
// SAFE BY DESIGN: this wipes their demo DATA (funds + dependents, reusing the
// reset's proven order) and NEUTRALIZES their identity (email + names → archived
// placeholders, isDemoAccount=false) instead of hard-deleting the user row. A
// hard delete is FK-RESTRICT-heavy across ~12 business tables and one missed
// reference half-fails; neutralizing removes the IP-tell + the login with zero
// cascade risk, and the row becomes inert.
//
// Run it AFTER switching off the legacy account (sign in as elena@riverafamily.com).
//   npm run cleanup:legacy-demo        (dry run — prints what it would touch)
//   npm run cleanup:legacy-demo -- --apply
import { db, pool } from "../server/db";
import { users } from "../shared/models/auth";
import {
  funds, gifts, holdings, parentContributions, recurringGifts, transactions,
  fundSnapshots, activities, fundMemberships, fundCollaborators, subscriptions,
  bankAccounts, events, ageTransitions, age18ReminderState, gifterFunds, notifications,
} from "../shared/schema";
import { sql as drizzleSql, inArray, or, like, eq } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");
const LEGACY_DOMAIN = "%@dunphyfamily.com";

async function main() {
  // 1. Find legacy demo users by the dunphyfamily.com domain. No real user has
  //    this domain — it's exclusively the pre-rename demo cast.
  const legacy = await db.select({ id: users.id, email: users.email })
    .from(users)
    .where(or(
      like(users.email, LEGACY_DOMAIN),
      // Re-runnable: also catch already-neutralized rows so a partial run finishes.
      like(users.email, "archived-legacy-demo-%@example.invalid"),
    ));
  if (legacy.length === 0) {
    console.log("No legacy @dunphyfamily.com accounts found. Nothing to do.");
    await pool.end();
    return;
  }
  const ids = legacy.map((u) => u.id);
  console.log(`Found ${legacy.length} legacy account(s):`);
  legacy.forEach((u) => console.log(`  - ${u.email}`));

  // 2. Their funds (owned now OR previously, before any handoff).
  const legacyFunds = await db.select({ id: funds.id, name: funds.name })
    .from(funds)
    .where(or(inArray(funds.userId, ids), inArray(funds.previousOwnerId, ids)));
  const fundIds = legacyFunds.map((f) => f.id);
  console.log(`  → ${fundIds.length} fund(s) tied to them.`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing changed. Re-run with `-- --apply` to wipe data + neutralize these accounts.");
    await pool.end();
    return;
  }

  // STEP 1 (critical, FK-safe): neutralize identity FIRST. This is an UPDATE on
  // users (the id never changes, so it violates no FK), so it ALWAYS succeeds and
  // removes the IP-tell + the login regardless of how the best-effort data wipe
  // below goes. Doing this first means a stray FK in the wipe can't leave a
  // dunphyfamily.com email behind.
  for (const u of legacy) {
    const shortId = String(u.id).slice(0, 8);
    await db.update(users).set({
      email: `archived-legacy-demo-${shortId}@example.invalid`,
      firstName: "Archived",
      lastName: "Demo",
      preferredName: null as any,
      profileImageUrl: null as any,
      isDemoAccount: false as any,
    }).where(eq(users.id, u.id));
    console.log(`  neutralized ${u.email} → archived-legacy-demo-${shortId}@example.invalid`);
  }
  console.log("  ✓ IP-tell removed — no @dunphyfamily.com email remains.");

  // STEP 2 (best-effort): wipe their demo data. Each delete is wrapped so one
  // unknown FK (e.g. referral_events → events) logs and continues instead of
  // aborting. referral_events is deleted before events. Anything left behind is
  // junk owned by a now-neutralized "Archived Demo" account — not an IP-tell.
  const tryDel = async (label: string, op: () => Promise<unknown>) => {
    try { await op(); console.log(`  wiped ${label}`); }
    catch (e: any) { console.warn(`  (left ${label}: ${e?.message?.split("\n")[0]})`); }
  };
  if (fundIds.length > 0) {
    const idsList = drizzleSql.join(fundIds.map((id) => drizzleSql`${id}`), drizzleSql`, `);
    await tryDel("memory_entries", () => db.execute(drizzleSql`DELETE FROM memory_entries WHERE gift_id IN (SELECT id FROM gifts WHERE fund_id IN (${idsList}))`));
    await tryDel("thank_yous", () => db.execute(drizzleSql`DELETE FROM thank_yous WHERE gift_id IN (SELECT id FROM gifts WHERE fund_id IN (${idsList}))`));
    await tryDel("gifts", () => db.delete(gifts).where(inArray(gifts.fundId, fundIds)));
    await tryDel("holdings", () => db.delete(holdings).where(inArray(holdings.fundId, fundIds)));
    await tryDel("parentContributions", () => db.delete(parentContributions).where(inArray(parentContributions.fundId, fundIds)));
    await tryDel("recurringGifts", () => db.delete(recurringGifts).where(inArray(recurringGifts.fundId, fundIds)));
    await tryDel("transactions", () => db.delete(transactions).where(inArray(transactions.fundId, fundIds)));
    await tryDel("fundSnapshots", () => db.delete(fundSnapshots).where(inArray(fundSnapshots.fundId, fundIds)));
    await tryDel("activities(byFund)", () => db.delete(activities).where(inArray(activities.fundId, fundIds)));
    await tryDel("gifterFunds", () => db.delete(gifterFunds).where(inArray(gifterFunds.fundId, fundIds)));
    await tryDel("fundCollaborators(byFund)", () => db.delete(fundCollaborators).where(inArray(fundCollaborators.fundId, fundIds)));
    await tryDel("fundMemberships(byFund)", () => db.delete(fundMemberships).where(inArray(fundMemberships.fundId, fundIds)));
    await tryDel("referral_events", () => db.execute(drizzleSql`DELETE FROM referral_events WHERE event_id IN (SELECT id FROM events WHERE fund_id IN (${idsList}))`));
    await tryDel("events", () => db.delete(events).where(inArray(events.fundId, fundIds)));
    await tryDel("ageTransitions", () => db.delete(ageTransitions).where(inArray(ageTransitions.fundId, fundIds)));
    await tryDel("age18ReminderState", () => db.delete(age18ReminderState).where(inArray(age18ReminderState.fundId, fundIds)));
    // Dynamic FK sweep: clear EVERY table that references funds.id (from the
    // catalog), so no hand-enumerated list can miss one (the events→referral_events
    // trap). fund ids are DB-issued UUIDs, table/column names come from the
    // catalog — both trusted, so inlining is safe here.
    const idLiterals = fundIds.map((id) => `'${String(id).replace(/'/g, "")}'`).join(",");
    const fkRes: any = await db.execute(drizzleSql`
      SELECT kcu.table_name AS t, kcu.column_name AS c
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'funds' AND ccu.column_name = 'id'
    `);
    const fkRows: Array<{ t: string; c: string }> = fkRes.rows ?? fkRes ?? [];
    for (const row of fkRows) {
      await tryDel(`${row.t}.${row.c}`, () => db.execute(drizzleSql.raw(`DELETE FROM "${row.t}" WHERE "${row.c}" IN (${idLiterals})`)));
    }
    await tryDel("funds", () => db.execute(drizzleSql.raw(`DELETE FROM "funds" WHERE "id" IN (${idLiterals})`)));
  }
  // User-level rows that reference the user (not a fund).
  await tryDel("subscriptions", () => db.delete(subscriptions).where(inArray(subscriptions.userId, ids)));
  await tryDel("bankAccounts", () => db.delete(bankAccounts).where(inArray(bankAccounts.userId, ids)));
  await tryDel("fundMemberships(byUser)", () => db.delete(fundMemberships).where(inArray(fundMemberships.userId, ids)));
  await tryDel("fundCollaborators(byUser)", () => db.delete(fundCollaborators).where(inArray(fundCollaborators.userId, ids)));
  await tryDel("activities(byUser)", () => db.delete(activities).where(inArray(activities.userId, ids)));
  await tryDel("transactions(byUser)", () => db.delete(transactions).where(inArray(transactions.userId, ids)));
  await tryDel("parentContributions(byUser)", () => db.delete(parentContributions).where(inArray(parentContributions.userId, ids)));
  await tryDel("notifications(byUser)", () => db.delete(notifications).where(inArray(notifications.userId, ids)));

  console.log(`\n✓ Done. ${legacy.length} legacy Dunphy account(s) neutralized; their demo data wiped (best-effort). No @dunphyfamily.com remains.`);
  await pool.end();
}

main().catch((err) => { console.error("cleanup-legacy-demo failed:", err); process.exit(1); });
