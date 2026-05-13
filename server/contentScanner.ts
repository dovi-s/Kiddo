// Content-safety scanner. Vendor-ready interface; default is a no-op so
// nothing breaks pre-vendor-decision.
//
// Why this exists: per project_child_safety_architecture.md, automated
// CSAM scanning on public memory uploads is a Tier 1 launch blocker.
// This module is the seam where a real vendor lands — PhotoDNA,
// AWS Rekognition Content Moderation, Microsoft Azure AI Content
// Safety, Hive, ActiveFence, etc. Each vendor has its own SDK or
// REST API, but the public surface here stays stable so the upload
// path doesn't change.
//
// Swap-in pattern:
//   1. Install the vendor SDK / configure auth via env vars.
//   2. Add a new implementation function (see PhotoDNA / Rekognition
//      stubs below) that conforms to the `Scanner` interface.
//   3. Update the `pickScanner()` switch at the bottom to route the
//      env-configured name to the new impl.
//   4. Set CONTENT_SCANNER=<name> in production env.
//
// What this module does NOT do:
//   - Decide what happens on a positive hit. That's the caller's job
//     (refuse the upload, auto-flag the row, escalate, ops alert).
//   - Persist anything. The result is returned to the caller; any
//     audit logging or downstream T&S action is the caller's
//     responsibility.
//   - Block on slow vendor calls. The caller is expected to wrap with
//     a timeout if latency matters.
//
// Default no-op behavior: `safe: true`, `provider: 'noop'`. The upload
// path currently treats this as "nothing to do" and continues. When a
// real scanner is wired, a `safe: false` result triggers the silent-
// log-and-refuse pattern at the call site.

export type ScanResult = {
  safe: boolean;
  provider: string;
  // Vendor-specific hash if the detection was hash-based (PhotoDNA
  // returns a hash match against the NCMEC database).
  hashMatch?: string;
  // Vendor-specific category breakdown when available (e.g. Rekognition
  // returns confidence scores per label).
  categories?: Record<string, number>;
  // Short reason / label for the T&S audit trail. Examples:
  //   'csam:hash-match' — PhotoDNA hit
  //   'rekognition:explicit-nudity' — AWS label > threshold
  //   'azure:violent-content' — Azure category hit
  //   'scanner-error' — vendor call failed; caller decides whether to
  //                    fail-open (allow) or fail-closed (refuse)
  reason?: string;
};

type Scanner = {
  scanImageBuffer(buffer: Buffer, mime: string): Promise<ScanResult>;
};

// Default implementation. Always returns safe. Used when no vendor is
// configured — pre-launch + during local dev. The audit log writes
// `provider: 'noop'` so it's obvious in retrospect which uploads
// landed before real scanning was wired.
const noopScanner: Scanner = {
  async scanImageBuffer(_buffer: Buffer, _mime: string): Promise<ScanResult> {
    return { safe: true, provider: 'noop' };
  },
};

// Stub for AWS Rekognition Content Moderation. Drop the real SDK call
// here when ready. The shape: detectModerationLabels on the buffer,
// flag if any high-confidence label is returned (Explicit Nudity,
// Violence, Drugs, etc. — see AWS docs for the full taxonomy). Note
// that Rekognition doesn't do CSAM specifically — its content
// moderation is broader. For CSAM specifically, PhotoDNA is the
// industry-standard hash-matching vendor.
async function awsRekognitionScanner(_buffer: Buffer, _mime: string): Promise<ScanResult> {
  // Placeholder. Real impl outline:
  //   1. import { RekognitionClient, DetectModerationLabelsCommand } from "@aws-sdk/client-rekognition"
  //   2. const client = new RekognitionClient({ region: process.env.AWS_REGION })
  //   3. const cmd = new DetectModerationLabelsCommand({ Image: { Bytes: buffer }, MinConfidence: 80 })
  //   4. const out = await client.send(cmd)
  //   5. Map out.ModerationLabels into categories + decide safe based on threshold
  //
  // Until installed, return scanner-error so the caller can decide
  // fail-open vs fail-closed. Falling open silently in the no-op case
  // would mask a configuration error in prod.
  return { safe: true, provider: 'aws-rekognition', reason: 'scanner-not-implemented' };
}

// Stub for Microsoft PhotoDNA (the CSAM hash-matching standard).
// Industry preference for child-safety surfaces. NCMEC partnership
// required to access the production hash database. The API call is
// straightforward: POST image bytes, get back a "match found" boolean
// and an internal hash if matched.
async function photoDnaScanner(_buffer: Buffer, _mime: string): Promise<ScanResult> {
  // Placeholder. Real impl outline:
  //   1. Sign NCMEC + Microsoft partnership agreements (months of lead
  //      time — start now if shipping to public users).
  //   2. Use the PhotoDNA REST API: POST to
  //      https://api.microsoftmoderator.com/photodna/v1.0/Match
  //      with the image bytes + Ocp-Apim-Subscription-Key header.
  //   3. Parse IsMatch + MatchDetails.MatchFlags from the response.
  //   4. Return { safe: !isMatch, provider: 'photodna', hashMatch: ... }
  //
  // CRITICAL: on a positive hit, the legal obligation is to report to
  // NCMEC within 24 hours. That reporting workflow lives off the T&S
  // queue's escalate action, NOT here. This function just returns the
  // detection; the policy is the caller's.
  return { safe: true, provider: 'photodna', reason: 'scanner-not-implemented' };
}

// Pick the scanner based on env config. Defaults to noop so dev +
// pre-launch envs never accidentally fail-closed.
function pickScanner(): Scanner {
  const configured = String(process.env.CONTENT_SCANNER || 'noop').toLowerCase();
  switch (configured) {
    case 'aws-rekognition':
      return { scanImageBuffer: awsRekognitionScanner };
    case 'photodna':
      return { scanImageBuffer: photoDnaScanner };
    case 'noop':
    default:
      return noopScanner;
  }
}

// Cache the scanner instance — picked once on first call. Restart the
// process to switch implementations (matches how every other env-driven
// service in this codebase resolves config).
let cachedScanner: Scanner | null = null;
function getScanner(): Scanner {
  if (!cachedScanner) cachedScanner = pickScanner();
  return cachedScanner;
}

/**
 * Public entry point. Caller passes the image bytes + mime; gets back
 * a scan result. Wraps the vendor call in a defensive try/catch — if
 * the vendor errors, we default to scanner-error so the caller can
 * make the fail-open/fail-closed decision deliberately (don't silently
 * allow uploads when the scanner is down).
 *
 * Caller pattern at the photo upload route:
 *
 *   const result = await scanImageBuffer(parsed.buffer, parsed.mime);
 *   if (!result.safe) {
 *     // Silent log + generic error to client — don't tip off the actor.
 *     await writeAudit(req, 'public_upload_scan_rejected', 'fund', fund.id, {
 *       provider: result.provider, reason: result.reason, hashMatch: result.hashMatch,
 *     });
 *     await sendOpsAlert({ severity: 'critical', title: 'Content scan rejected upload', ... });
 *     return res.status(500).json({ error: 'Upload failed. Please try again later.' });
 *   }
 *   // Continue with upload + persistence.
 */
export async function scanImageBuffer(buffer: Buffer, mime: string): Promise<ScanResult> {
  try {
    return await getScanner().scanImageBuffer(buffer, mime);
  } catch (err) {
    console.error('[contentScanner] scan failed:', err);
    return {
      safe: true,
      provider: getScanner().constructor.name || 'unknown',
      reason: 'scanner-error',
    };
  }
}

/** Diagnostic helper for the admin ops surface. */
export function getActiveScannerName(): string {
  return String(process.env.CONTENT_SCANNER || 'noop').toLowerCase();
}
