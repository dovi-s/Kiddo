export type FundAccountType = "UTMA" | "Personal";

export type FundSummary = {
  id: string;
  slug: string;
  recipientFirstName: string;
  accountType: FundAccountType;
};

export type StockChoice = {
  ticker: string;
  name: string;
};

export type ProjectionSnapshot = {
  annualGift: number;
  years: number;
  savings: number;
  invested: number;
  difference: number;
};

export type OnboardingInvestmentChoice = "sp500" | "stock" | "cash";
export type OnboardingStep = "welcome" | "who" | "details" | "projection" | "investment" | "kyc" | "live";
export type OnboardingAccountType = "child" | "personal" | null;
export type OnboardingAuthMode = "none" | "email";

export type OnboardingDraft = {
  step: OnboardingStep;
  authMode: OnboardingAuthMode;
  accountType: OnboardingAccountType;
  email: string;
  name: string;
  birthdate: string;
  annualGift: number;
  investment: OnboardingInvestmentChoice;
  ticker: string;
  lastName?: string;
  occasion?: string;
  gifterAudience?: string;
  recipientState?: string;
  country?: "US" | "OTHER" | "";
};

export type AuthProvidersStatus = {
  google: boolean;
  apple: boolean;
};

export type GifterLoopTouchpoint =
  | "gift_success_cta"
  | "gift_receipt_email"
  | "milestone_email"
  | "birthday_reminder_email"
  | "memory_book_share_email"
  | "age_18_email"
  | "gifter_dashboard_cta";

export type GifterLoopConversionAction =
  | "cta_viewed"
  | "cta_clicked"
  | "email_sent"
  | "email_opened"
  | "email_clicked"
  | "gifter_account_created"
  | "parent_onboarding_started"
  | "parent_account_created"
  | "fund_created";

export type GifterLoopChannel = "web" | "email" | "dashboard" | "native";

export type GifterLoopAttributionEvent = {
  gifterId?: string | null;
  gifterFundId?: string | null;
  fundId?: string | null;
  touchpoint: GifterLoopTouchpoint;
  action: GifterLoopConversionAction;
  channel: GifterLoopChannel;
  sessionId?: string | null;
  candidateParentEmail?: string | null;
  metadata?: Record<string, unknown>;
};

export type GifterLoopMetricsTargets = {
  receiptEmailOpenRate: string;
  receiptEmailSignupRate: string;
  gifterAccountCreationRate: string;
  gifterToParentConversionRate: string;
  age18ConversionRate: string;
};
export type BrandSurface = "website" | "app" | "gifter";

export type PublicGiftEvent = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  eventType?: string;
  theme?: string;
};

export type PublicGiftFund = {
  id: string;
  name: string;
  slug: string;
  recipientFirstName?: string;
  creatorFirstName?: string | null;
  investmentStrategy?: string | null;
  defaultMode?: "managed" | "stock" | "cash";
  defaultTicker?: string | null;
  allowGifterStockPick?: boolean | string | number;
  allowGifterCashGift?: boolean | string | number;
  investmentPreferences?: {
    defaultMode?: "managed" | "stock" | "cash";
    managedStrategy?: string | null;
    defaultTicker?: string | null;
    allowGifterStockPick?: boolean | string | number;
    allowGifterCashGift?: boolean | string | number;
  } | null;
};

export type PublicGiftDestination = {
  event: PublicGiftEvent;
  fund: PublicGiftFund;
  giftCount: number;
};
