export type ReferralAction =
  | "share"
  | "copy_link"
  | "visit"
  | "signup"
  | "checkout_start"
  | "checkout_complete"
  | "cta_click"
  | "gift_link_opened"
  | "gift_amount_selected"
  | "gift_payment_started"
  | "gift_completed"
  | "fund_created"
  | "fund_link_shared"
  | "parent_returned_after_first_gift"
  | "parent_shared_again"
  | "gifter_updates_opt_in"
  | "gifter_started_own_fund"
  // Quiet "Send {child} another →" link on the gift-success page.
  // Distinct from cta_click (too generic) and share (broadcasting,
  // not self-acting). Lets the PLG funnel answer "what % of completed
  // gifts produce a same-session return-to-checkout intent?"
  | "gift_again_click";

export function isUserReferralCode(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8,16}$/.test(normalized);
}

type ReferralPayload = {
  refCode: string;
  action: ReferralAction;
  channel: string;
  fundId?: string | null;
  eventId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function extractUtmMetadata(search: string) {
  const params = new URLSearchParams(search);
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  const metadata: Record<string, string> = {};
  for (const key of keys) {
    const value = params.get(key);
    if (value) metadata[key] = value;
  }
  return metadata;
}

export function buildTrackedGetStartedHref(
  search: string,
  extras: { ref: string; src: string; [key: string]: string | undefined },
) {
  const params = new URLSearchParams();
  const utmMetadata = extractUtmMetadata(search);
  Object.entries(utmMetadata).forEach(([key, value]) => {
    params.set(key, value);
  });
  Object.entries(extras).forEach(([key, value]) => {
    if (!value) return;
    params.set(key, value);
  });
  const query = params.toString();
  return query ? `/get-started?${query}` : "/get-started";
}

export function trackReferralEvent(payload: ReferralPayload) {
  if (!payload.refCode) return;

  const body = JSON.stringify({
    refCode: payload.refCode,
    fundId: payload.fundId || null,
    eventId: payload.eventId || null,
    action: payload.action,
    channel: payload.channel,
    metadata: payload.metadata || null,
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/referrals/events", blob)) return;
    }
  } catch {
    // fall through to fetch
  }

  void fetch("/api/referrals/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // non-blocking analytics event
  });
}
