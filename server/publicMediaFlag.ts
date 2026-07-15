// Public / gifter media uploads (photo, video, voice attached by an
// UNAUTHENTICATED gifter on the public gift link). DEFAULTS OFF.
//
// Founder decision 2026-06-18: gate public / stranger-sender media OFF at launch.
// The line is drawn at the SENDER, not the feature: money gifts, text notes
// (safety-screened on every path), and AUTHENTICATED parent + invited-family
// media all stay ON; only untrusted-sender media is gated. This closes the
// largest child-safety surface (CSAM on a child-facing Memory Book) and removes
// the months-long NCMEC / PhotoDNA partnership from the launch critical path.
//
// Fully reversible: flip PUBLIC_MEDIA_UPLOADS_ENABLED=true once BOTH a real
// content scanner (CONTENT_SCANNER) AND a sender-trust pre-visibility gate are
// wired. The public upload routes ALSO keep their scanner fail-closed underneath
// this flag, so even a premature flip cannot admit unscanned media in production.
//
// Single source of truth: the same flag gates the server upload routes AND rides
// along on the public fund response (`gifterMediaEnabled`) so the gift-checkout /
// gift-success clients hide the media picker atomically (no dead buttons).
export function isPublicMediaUploadsEnabled(): boolean {
  const flag = String(process.env.PUBLIC_MEDIA_UPLOADS_ENABLED || "").trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
