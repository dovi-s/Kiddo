/* eslint-disable no-console */
// Email provider smoke test. Renders a REAL template and pushes it through the
// REAL sendEmail() path (suppression + dedupe + bereavement + provider), so you
// confirm your Postmark/SendGrid config actually delivers — in one command.
//
// Run (after setting your provider token + a destination inbox):
//   set NODE_OPTIONS=--use-system-ca&& set SMOKE_EMAIL_TO=you@example.com&& npm run smoke:email
//
// With NO provider token set, it falls to the local outbox (.local/email-outbox.jsonl)
// — still useful: it proves the render + sendEmail path works, and tells you the
// provider is the only missing piece. See EMAIL_GOLIVE.md for the full checklist.

import { sendEmail } from "../server/emailDelivery";
import { buildVerificationEmail } from "../server/templates/emailVerification";

async function main() {
  const to = String(process.env.SMOKE_EMAIL_TO || "").trim();
  if (!to) {
    console.log("Set SMOKE_EMAIL_TO=your@inbox first (where the test email should land).");
    process.exit(2);
  }
  const hasPostmark = Boolean(String(process.env.POSTMARK_SERVER_TOKEN || "").trim());
  const hasSendgrid = Boolean(String(process.env.SENDGRID_API_KEY || "").trim());
  const from = process.env.EMAIL_FROM || process.env.SUPPORT_EMAIL || "support@kiddofund.com";

  console.log(`> provider: ${hasPostmark ? "postmark" : hasSendgrid ? "sendgrid" : "NONE (will fall to local outbox)"}`);
  console.log(`> from:     ${from}`);
  console.log(`> to:       ${to}\n`);

  const msg = buildVerificationEmail({
    to,
    firstName: "Smoke",
    verifyUrl: "https://kiddofund.com/verify?token=smoke-test",
  });
  const result = await sendEmail(msg);

  console.log(`result: mode=${result.mode} delivered=${result.delivered} providerId=${result.providerId ?? "-"}`);
  if (result.mode === "postmark" || result.mode === "sendgrid") {
    console.log(`✅ Sent via ${result.mode}. Check ${to} (and spam). If it lands in spam, finish SPF/DKIM/DMARC — see EMAIL_GOLIVE.md.`);
  } else if (result.mode === "outbox_fallback") {
    console.log(
      hasPostmark || hasSendgrid
        ? "⚠️ A provider IS set but the send FAILED — see .local/email-outbox.jsonl for the error (bad token? unverified sender domain?)."
        : "⚠️ No provider configured — set POSTMARK_SERVER_TOKEN (or SENDGRID_API_KEY). The email was written to .local/email-outbox.jsonl so you can inspect it.",
    );
  } else {
    console.log(`ℹ️ ${result.mode} (suppressed / deduped / demo-domain). Try a fresh SMOKE_EMAIL_TO, or wait out the 12h dedupe window.`);
  }
  process.exit(result.delivered ? 0 : 1);
}

main().catch((e) => { console.error("email smoke crashed:", e); process.exit(1); });
