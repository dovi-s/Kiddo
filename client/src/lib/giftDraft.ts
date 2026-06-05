// Gift checkout draft persistence — pure logic, extracted from GiftCheckout
// so it's testable without mounting the 3k-line page (script/test-gift-draft.ts).
//
// Why drafts exist: everything the gifter composes lives in React state, which
// means a page refresh OR the Stripe-hosted-checkout cancel path (cancel_url
// lands back on the gift page as a fresh mount) used to wipe the typed message,
// recorded audio and uploaded photo. For a one-shot gifter (grandma,
// mid-card-entry second thoughts) that loss is a funnel exit at the moment of
// maximum intent. The draft lives in sessionStorage: tab-scoped, dies with the
// tab, survives refresh + the same-tab round-trip to Stripe. GiftSuccess clears
// every draft (by GIFT_DRAFT_PREFIX) once a payment completes.
//
// Security invariant: serialization is an explicit allowlist — a credential
// (recurringPassword) can never reach storage even if a future caller passes
// the whole component state in. Tested.

export const GIFT_DRAFT_PREFIX = "kiddo-gift-draft:";
export const GIFT_DRAFT_TTL_MS = 6 * 60 * 60 * 1000; // stale-tab guard

export type GiftDraftStep = "landing" | "amount" | "preview" | "payment";

export interface GiftDraftFields {
  step: GiftDraftStep;
  selectedAmount: number;
  showCustom: boolean;
  customAmount: string;
  executionModel: "auto" | "pick" | "family";
  selectedStock: string | null;
  senderName: string;
  senderEmail: string;
  isAnonymous: boolean;
  message: string;
  memoryAttachmentMode: "none" | "photo" | "video" | "voice";
  photoUrl: string;
  videoUrl: string;
  audioUrl: string;
  giftAddOn: string;
  isRecurring: boolean;
  recurringFrequency: "weekly" | "monthly" | "yearly";
}

export function buildGiftDraftKey(fundSlug?: string | null, eventSlug?: string | null): string {
  return `${GIFT_DRAFT_PREFIX}${fundSlug || ""}:${eventSlug || ""}`;
}

// Only write a draft once the gifter has actually composed something (or
// advanced past the landing) — and if they consciously emptied the form, the
// caller drops the draft instead of resurrecting deleted content on refresh.
export function isMeaningfulGiftDraft(f: GiftDraftFields): boolean {
  return (
    f.step !== "landing" ||
    f.message.trim() !== "" ||
    f.senderName.trim() !== "" ||
    f.senderEmail.trim() !== "" ||
    f.photoUrl !== "" ||
    f.videoUrl !== "" ||
    f.audioUrl !== "" ||
    f.customAmount.trim() !== ""
  );
}

export function serializeGiftDraft(fields: GiftDraftFields, now: number): string {
  // Explicit allowlist, field by field. NEVER add recurringPassword (or any
  // credential/token) here — drafts outlive the screen that collected it.
  return JSON.stringify({
    v: 1,
    ts: now,
    step: fields.step,
    selectedAmount: fields.selectedAmount,
    showCustom: fields.showCustom,
    customAmount: fields.customAmount,
    executionModel: fields.executionModel,
    selectedStock: fields.selectedStock,
    senderName: fields.senderName,
    senderEmail: fields.senderEmail,
    isAnonymous: fields.isAnonymous,
    message: fields.message,
    memoryAttachmentMode: fields.memoryAttachmentMode,
    photoUrl: fields.photoUrl,
    videoUrl: fields.videoUrl,
    audioUrl: fields.audioUrl,
    giftAddOn: fields.giftAddOn,
    isRecurring: fields.isRecurring,
    recurringFrequency: fields.recurringFrequency,
  });
}

// Validating parse: returns only the fields that survive type/value checks
// (storage is user-editable — treat it as untrusted input), or null when the
// draft is missing, malformed, a different version, or older than the TTL.
// Callers should remove the stored entry when raw existed but this returns
// null (stale/garbage cleanup).
export function parseGiftDraft(raw: string | null, now: number): Partial<GiftDraftFields> | null {
  if (!raw) return null;
  let d: any;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (d?.v !== 1 || typeof d.ts !== "number" || now - d.ts > GIFT_DRAFT_TTL_MS) return null;
  const out: Partial<GiftDraftFields> = {};
  if (d.step === "amount" || d.step === "preview" || d.step === "payment") out.step = d.step;
  if (typeof d.selectedAmount === "number" && d.selectedAmount >= 5) out.selectedAmount = d.selectedAmount;
  if (typeof d.showCustom === "boolean") out.showCustom = d.showCustom;
  if (typeof d.customAmount === "string") out.customAmount = d.customAmount;
  if (d.executionModel === "auto" || d.executionModel === "pick" || d.executionModel === "family") out.executionModel = d.executionModel;
  if (typeof d.selectedStock === "string" && d.selectedStock) out.selectedStock = d.selectedStock;
  if (typeof d.senderName === "string") out.senderName = d.senderName;
  if (typeof d.senderEmail === "string") out.senderEmail = d.senderEmail;
  if (typeof d.isAnonymous === "boolean") out.isAnonymous = d.isAnonymous;
  if (typeof d.message === "string") out.message = d.message;
  if (
    d.memoryAttachmentMode === "none" ||
    d.memoryAttachmentMode === "photo" ||
    d.memoryAttachmentMode === "video" ||
    d.memoryAttachmentMode === "voice"
  ) {
    out.memoryAttachmentMode = d.memoryAttachmentMode;
  }
  if (typeof d.photoUrl === "string") out.photoUrl = d.photoUrl;
  if (typeof d.videoUrl === "string") out.videoUrl = d.videoUrl;
  if (typeof d.audioUrl === "string") out.audioUrl = d.audioUrl;
  if (typeof d.giftAddOn === "string") out.giftAddOn = d.giftAddOn;
  if (typeof d.isRecurring === "boolean") out.isRecurring = d.isRecurring;
  if (d.recurringFrequency === "weekly" || d.recurringFrequency === "monthly" || d.recurringFrequency === "yearly") {
    out.recurringFrequency = d.recurringFrequency;
  }
  return out;
}
