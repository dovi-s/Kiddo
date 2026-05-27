/* eslint-disable no-console */
// Founder claim-token issuance — two modes:
//
//   Single (testing / support):   --email founder@example.com
//     Mints a fresh claim token for that ONE founder and PRINTS the claim URL,
//     so you can exercise the /founder-claim/:token flow in dev without digging
//     the link out of the email outbox. Re-issuing invalidates any prior token.
//
//   Bulk launch (Path A):         --all  [--dry-run]
//     Issues a token for EVERY unclaimed founder and sends the "Kiddo is live —
//     claim your Founder account" email. --dry-run lists who WOULD be emailed
//     without minting tokens or sending anything.
//
// Run via: npm run founder:issue -- --email you@example.com
//          npm run founder:issue -- --all --dry-run
//          npm run founder:issue -- --all
//
// Per project_founding_member_claim_flow_spec.md (Days 2 + 5 / task #7).
// Token mechanics + the email live in server/services/founderClaimAuth.ts and
// server/templates/founderClaim.ts; this script is just the driver.

import "dotenv/config";
import { isNull } from "drizzle-orm";
import { db } from "../server/db";
import { foundingMembers } from "../shared/models/auth";
import { issueFounderClaimToken } from "../server/services/founderClaimAuth";
import { buildFounderClaimEmail } from "../server/templates/founderClaim";
import { sendEmail } from "../server/emailDelivery";

async function main() {
  const args = process.argv.slice(2);
  const emailIdx = args.indexOf("--email");
  const emailArg = emailIdx >= 0 ? (args[emailIdx + 1] || "").trim() : null;
  const all = args.includes("--all");
  const dryRun = args.includes("--dry-run");

  if (!emailArg && !all) {
    console.log(
      [
        "Founder claim issuance — usage:",
        "  --email <addr>      mint + PRINT a claim URL for one founder (testing/support)",
        "  --all               issue tokens + send the launch email to ALL unclaimed founders",
        "  --all --dry-run     list who would be emailed; mint nothing, send nothing",
      ].join("\n"),
    );
    process.exit(1);
  }

  // Single-founder mint (testing). Prints the URL; does NOT send an email.
  if (emailArg) {
    const issued = await issueFounderClaimToken(emailArg);
    if (!issued) {
      console.log(`No unclaimed founder found for ${emailArg} (not a founder, or already claimed).`);
    } else {
      console.log(`Founder #${issued.position} (${issued.firstName}). Claim URL — good for 30 days:`);
      console.log(issued.linkUrl);
    }
    return;
  }

  // Bulk launch: every founder who hasn't claimed yet.
  const unclaimed = await db
    .select({
      email: foundingMembers.email,
      firstName: foundingMembers.firstName,
      position: foundingMembers.position,
    })
    .from(foundingMembers)
    .where(isNull(foundingMembers.claimedAt));

  console.log(`${unclaimed.length} unclaimed founder(s).`);

  if (dryRun) {
    for (const f of unclaimed) console.log(`  #${f.position}  ${f.email}  (${f.firstName})`);
    console.log("Dry run — no tokens minted, no email sent. Re-run without --dry-run to issue.");
    return;
  }

  let sent = 0;
  for (const f of unclaimed) {
    const issued = await issueFounderClaimToken(f.email);
    if (!issued) continue; // raced into claimed since the select; skip.
    try {
      await sendEmail(
        buildFounderClaimEmail({
          to: issued.email,
          claimUrl: issued.linkUrl,
          firstName: issued.firstName,
          position: issued.position,
          intent: "launch",
        }),
      );
      sent++;
    } catch (e: any) {
      console.error(`  send failed for ${f.email}:`, e?.message || e);
    }
  }
  console.log(`Issued + emailed ${sent}/${unclaimed.length} founder claim links.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("founder-issue-claims failed:", e?.message || e);
    process.exit(1);
  });
