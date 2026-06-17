// Reset the Rivera demo state. Wipes all data tied to demo users, then
// re-runs the seed. Used by:
//   1. Manual invocation: `npm run reset:dunphys` — when a demo visitor
//      mutated the seeded data and you want to put it back.
//   2. Nightly cron: server/demoResetWorker.ts fires this daily so the
//      shared public demo doesn't drift over time.
//
// Idempotent. Safe to run on a fresh DB (no demo users found = no-op
// wipe, then seed creates everything). Safe to run repeatedly.
//
// What gets wiped: all rows in dependent tables filtered to demo-owned
// funds OR demo-owned users. What stays: the user rows themselves
// (preserves password hashes so the seed's idempotent upsert path runs
// cheaper). The seed's upsertUser will refresh names + flags anyway.
//
// Per DUNPHY_DEMO_SPEC.md "nightly reset cron" deferred item.

import "../server/env";
import { db, pool } from "../server/db";
import {
  users,
  funds,
  gifts,
  holdings,
  memoryEntries,
  activities,
  parentContributions,
  transactions,
  fundMemberships,
  fundSnapshots,
  gifterFunds,
  bankAccounts,
  fundCollaborators,
  thankYous,
  recurringGifts,
  events,
  ageTransitions,
  age18ReminderState,
} from "../shared/schema";
import { sql as drizzleSql } from "drizzle-orm";
import { eq, inArray, or, like } from "drizzle-orm";
import { runRiveraSeed } from "./seed-dunphys";

const DEMO_EMAILS = [
  "marcus@riverafamily.com",
  "elena@riverafamily.com",
  "robert@riverafamily.com",
  "sofia@riverafamily.com",
  "david@riverafamily.com",
  "chris@riverafamily.com",
  "leo@riverafamily.com",
];

async function wipeDemoState(): Promise<void> {
  // 1. Find demo user IDs.
  // Legacy-aware: the Rivera emails (current demo) PLUS any orphaned pre-rename
  // "@dunphyfamily.com" accounts, so their stale funds get wiped too and a
  // Dunphy-era family can never re-orphan. The hard identity scrub of those
  // legacy rows lives in script/cleanup-legacy-demo.ts (run once).
  const demoUsers = await db.select({ id: users.id, email: users.email })
    .from(users)
    .where(or(
      inArray(users.email, DEMO_EMAILS),
      like(users.email, "%@dunphyfamily.com"),
    ));
  const demoUserIds = demoUsers.map((u) => u.id);

  if (demoUserIds.length === 0) {
    console.log("No Rivera demo users found. Nothing to wipe.");
    return;
  }

  console.log(`Found ${demoUserIds.length} demo user(s). Wiping dependent rows...`);

  // 2. Find demo fund IDs. Collect by current owner OR previous owner OR the
  //    "-dunphy" slug — NOT just current owner. A fund handed off to a graduated
  //    demo kid (Mia) is owned by the KID, and across resets the kid's funds
  //    were being missed and ORPHANED: each reseed left the old transferred fund
  //    behind and created a slug-collision dupe (mia-rivera-2, -3…), so the app
  //    showed an empty Mia fund while her gifts/activities lived on an orphan.
  //    previousOwnerId (the former custodian, always a demo user) + the slug
  //    pattern (every demo fund is "{kid}-dunphy") make the wipe exhaustive.
  const demoFunds = await db.select({ id: funds.id, name: funds.name })
    .from(funds)
    .where(or(
      inArray(funds.userId, demoUserIds),
      inArray(funds.previousOwnerId, demoUserIds),
      like(funds.slug, "%-dunphy%"),
      like(funds.slug, "%-rivera%"),
    ));
  const demoFundIds = demoFunds.map((f) => f.id);

  // 3. Delete dependent rows in FK-safe order. Fund-scoped first, then
  //    user-scoped, then funds + memberships + subscriptions are handled
  //    after dependents are clear.
  //
  //    Subscriptions table is intentionally NOT wiped — the seed's
  //    ensureMarcusFamilySubscription() upserts it. Wiping the row would
  //    cascade onto Stripe IDs the seed sets to null, no real harm.
  //    Keeping the row avoids a needless DELETE.
  if (demoFundIds.length > 0) {
    // ORDER MATTERS: every table that FK-references gifts.id must
    // be wiped BEFORE gifts; every table that FK-references funds.id
    // must be wiped BEFORE funds. The references are:
    //   memory_entries.gift_id  → gifts.id   (no cascade)
    //   thank_yous.gift_id      → gifts.id   (no cascade)
    //   transactions.gift_id    → gifts.id   (no cascade)
    //   events.fund_id          → funds.id   (NOT NULL, no cascade)
    //   age_transitions.fund_id → funds.id   (PK, no cascade)
    //   age18_reminder_state.fund_id → funds.id (PK, no cascade)
    //   plus various nullable refs (referralEvents, analyticsEvents,
    //   notifications, etc.) — handled via raw SQL nullable update.
    // Locked 2026-05-21 after each FK fix surfaced the next one.
    // Fund-id list, reused by the referral_events.event_id clear below and
    // the nullable-ref UPDATEs near the end. Hoisted here so it's available
    // before the events delete.
    const idsList = drizzleSql.join(demoFundIds.map((id) => drizzleSql`${id}`), drizzleSql`, `);
    await db.delete(memoryEntries).where(inArray(memoryEntries.fundId, demoFundIds));
    await db.delete(thankYous).where(inArray(thankYous.fundId, demoFundIds));
    await db.delete(transactions).where(inArray(transactions.fundId, demoFundIds));
    await db.delete(recurringGifts).where(inArray(recurringGifts.fundId, demoFundIds));
    // memory_entries.gift_id → gifts.id (no cascade). Clear it BEFORE deleting
    // demo gifts or the gifts delete FK-fails on memory_entries_gift_id_gifts_id_fk.
    // The fund-scoped memoryEntries delete above misses ORPHANS: an interrupted
    // reseed can leave a memory_entry whose own fundId is no longer in
    // demoFundIds yet whose gift_id still points at a demo gift. That orphan
    // survives the delete above and trips the gifts delete — which aborts the
    // whole reset before the funds are deleted, so the seed then sees Marcus's
    // funds and SKIPS (the root cause of "occasions missing" / "data gone").
    // Delete by gift_id to catch the orphans too. Same class of bug + fix as the
    // referral_events.event_id clear below.
    await db.execute(drizzleSql`DELETE FROM memory_entries WHERE gift_id IN (SELECT id FROM gifts WHERE fund_id IN (${idsList}))`);
    // thank_yous.gift_id → gifts.id (no cascade). Same orphan class as the
    // memory_entries delete above: the fund-scoped thankYous delete (line ~111)
    // misses a thank_you whose own fund_id drifted out of demoFundIds (or is
    // null) but whose gift_id still points at a demo gift. That orphan survives
    // and trips the gifts delete on thank_yous_gift_id_gifts_id_fk, aborting the
    // whole reset before funds are deleted (so the seed then sees Marcus's funds
    // and SKIPS). Delete by gift_id to catch the orphans too.
    await db.execute(drizzleSql`DELETE FROM thank_yous WHERE gift_id IN (SELECT id FROM gifts WHERE fund_id IN (${idsList}))`);
    await db.delete(gifts).where(inArray(gifts.fundId, demoFundIds));
    await db.delete(holdings).where(inArray(holdings.fundId, demoFundIds));
    await db.delete(activities).where(inArray(activities.fundId, demoFundIds));
    await db.delete(parentContributions).where(inArray(parentContributions.fundId, demoFundIds));
    await db.delete(fundMemberships).where(inArray(fundMemberships.fundId, demoFundIds));
    await db.delete(fundSnapshots).where(inArray(fundSnapshots.fundId, demoFundIds));
    await db.delete(gifterFunds).where(inArray(gifterFunds.fundId, demoFundIds));
    // referral_events.event_id → events.id (nullable, no cascade). Clear it
    // BEFORE deleting demo events or the events delete FK-fails on
    // referral_events_event_id_events_id_fk. This gap broke `reset:dunphys`
    // AND the nightly demoResetWorker once any demo event accrued a referral
    // event. The fund_id ref is nulled in the block below; event_id was missed.
    await db.execute(drizzleSql`UPDATE referral_events SET event_id = NULL WHERE event_id IN (SELECT id FROM events WHERE fund_id IN (${idsList}))`);
    await db.delete(events).where(inArray(events.fundId, demoFundIds));
    await db.delete(ageTransitions).where(inArray(ageTransitions.fundId, demoFundIds));
    await db.delete(age18ReminderState).where(inArray(age18ReminderState.fundId, demoFundIds));
    // Wipe co-parent collaborator rows so the seed can re-create them
    // from a clean slate (Elena's row, anyone else added per-fund).
    await db.delete(fundCollaborators).where(inArray(fundCollaborators.fundId, demoFundIds));
    // Nullable refs (notifications, referral_events, analytics_events,
    // blocked_gifters, gift_intents). The seed doesn't create rows in
    // these tables, but defensive SET NULL handles any background-
    // worker side-effects so the fund delete won't FK-fail.
    await db.execute(drizzleSql`UPDATE notifications     SET fund_id = NULL WHERE fund_id IN (${idsList})`);
    await db.execute(drizzleSql`UPDATE referral_events   SET fund_id = NULL WHERE fund_id IN (${idsList})`);
    await db.execute(drizzleSql`UPDATE analytics_events  SET fund_id = NULL WHERE fund_id IN (${idsList})`);
    await db.execute(drizzleSql`UPDATE blocked_gifters   SET fund_id = NULL WHERE fund_id IN (${idsList})`);
    await db.execute(drizzleSql`UPDATE gift_intents      SET fund_id = NULL WHERE fund_id IN (${idsList})`);
    console.log(`  cleared dependents for ${demoFundIds.length} fund(s)`);
  }

  // 4. Also delete user-scoped rows that aren't fund-keyed.
  await db.delete(bankAccounts).where(inArray(bankAccounts.userId, demoUserIds));
  // Activities can be user-scoped without a fundId (e.g. subscription events).
  await db.delete(activities).where(inArray(activities.userId, demoUserIds));
  await db.delete(transactions).where(inArray(transactions.userId, demoUserIds));

  // 5. Delete the funds themselves.
  if (demoFundIds.length > 0) {
    // Defensive last-moment re-clear: if the dev server is up, a background
    // worker (e.g. age-transition for a near-majority kid, recurring worker)
    // can insert an activity referencing a demo fund AFTER the bulk activities
    // delete above, racing the funds delete and tripping
    // activities_fund_id_funds_id_fk. Re-clear fund-keyed activities (the
    // observed offender) immediately before the funds delete to shrink the
    // race window to ~microseconds.
    // Same race, second offender (observed 2026-06-04): the snapshot writer
    // re-inserted a fund_snapshots row between the bulk wipe above and the
    // funds delete, tripping fund_snapshots_fund_id_funds_id_fk and aborting
    // the whole reset. The single-shot re-clear below still lost the race when
    // the dev server was UP (the worker re-inserts every few seconds). Retry the
    // re-clear + funds delete a few times: the race window is microseconds, so a
    // handful of attempts reliably hits a clean window and the reset succeeds
    // WITHOUT having to stop the server first. 2026-06-11.
    // idsList is block-scoped to the dependent-clear section above; recompute it
    // here for the raw by-gift deletes in the retry loop.
    const idsList = drizzleSql.join(demoFundIds.map((id) => drizzleSql`${id}`), drizzleSql`, `);
    let deleted = false;
    for (let attempt = 0; attempt < 8 && !deleted; attempt++) {
      try {
        // Re-clear EVERY fund-referencing table a live worker or request can
        // repopulate mid-reset, in FK-safe order, then delete the funds:
        //   recurring-gift worker / gift checkout → gifts (+ memory_entries,
        //     thank_yous, holdings off the settled gift)
        //   snapshot worker → fund_snapshots
        //   misc workers → activities
        // Single-shot re-clears kept losing the race to whichever table the
        // server touched next (snapshots → gifts → ...). Re-clearing the whole
        // set and retrying the block reliably hits a clean window, so the reset
        // succeeds with the server UP instead of aborting (which leaves stale
        // funds and makes the seed SKIP). 2026-06-11.
        await db.execute(drizzleSql`DELETE FROM memory_entries WHERE gift_id IN (SELECT id FROM gifts WHERE fund_id IN (${idsList}))`);
        await db.execute(drizzleSql`DELETE FROM thank_yous WHERE gift_id IN (SELECT id FROM gifts WHERE fund_id IN (${idsList}))`);
        await db.delete(gifts).where(inArray(gifts.fundId, demoFundIds));
        await db.delete(holdings).where(inArray(holdings.fundId, demoFundIds));
        await db.delete(parentContributions).where(inArray(parentContributions.fundId, demoFundIds));
        await db.delete(recurringGifts).where(inArray(recurringGifts.fundId, demoFundIds));
        await db.delete(transactions).where(inArray(transactions.fundId, demoFundIds));
        await db.delete(fundSnapshots).where(inArray(fundSnapshots.fundId, demoFundIds));
        await db.delete(activities).where(inArray(activities.fundId, demoFundIds));
        await db.delete(funds).where(inArray(funds.id, demoFundIds));
        deleted = true;
      } catch (raceErr) {
        if (attempt === 7) throw raceErr;
        await new Promise((r) => setTimeout(r, 250)); // let the racing worker's txn settle
      }
    }
    console.log(`  deleted ${demoFundIds.length} fund(s)`);
  }

  // 6. Users stay — the seed upserts by email and the password hashes
  //    are stable across resets. Saves a bcrypt pass per user per reset.
}

export async function resetRiveras(options: { closePool?: boolean } = {}): Promise<void> {
  const closePool = options.closePool !== false;
  await wipeDemoState();
  console.log("");
  await runRiveraSeed({ closePool: false });
  if (closePool) await pool.end();
}

const isDirectInvocation = (() => {
  try {
    const invoked = process.argv[1] ? process.argv[1].replace(/\\/g, "/").toLowerCase() : "";
    return invoked.endsWith("/reset-dunphys.ts") || invoked.endsWith("/reset-dunphys.js");
  } catch {
    return false;
  }
})();

if (isDirectInvocation) {
  resetRiveras().catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });
}
