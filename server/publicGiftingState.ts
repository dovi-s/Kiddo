import type { events, funds } from "@shared/schema";
import { effectiveOccasionDateMs } from "@shared/occasions";

type FundLike = Pick<typeof funds.$inferSelect, "status">;
type EventLike = Pick<typeof events.$inferSelect, "status" | "isPermanent" | "eventType" | "eventDate" | "goalAmount" | "giftVolume">;

type KycStatus = "none" | "pending" | "approved" | "rejected" | string | null | undefined;

type FundGiftingState = "live" | "cash_only" | "paused" | "archived";
type EventGiftingState = "active" | "goal_reached" | "date_passed" | "paused" | "closed";

export type PublicFundGiftingAvailability = {
  state: FundGiftingState;
  canCheckout: boolean;
  title: string;
  message: string;
};

export type PublicEventGiftingAvailability = {
  state: EventGiftingState;
  canCheckout: boolean;
  goalReached: boolean;
  eventDatePassed: boolean;
  title: string;
  message: string;
};

function normalizeStatus(raw: string | null | undefined) {
  return String(raw || "").trim().toLowerCase();
}

function parseMoney(value: unknown) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function getPublicFundGiftingAvailability(
  fund: FundLike | null | undefined,
  kycStatus?: KycStatus,
): PublicFundGiftingAvailability {
  const status = normalizeStatus(fund?.status);
  const normalizedKyc = normalizeStatus(kycStatus);

  if (status === "archived") {
    return {
      state: "archived",
      canCheckout: false,
      title: "This fund is archived",
      message: "This gift page is no longer accepting new contributions.",
    };
  }

  if (status === "paused") {
    return {
      state: "paused",
      canCheckout: false,
      title: "This fund is temporarily paused",
      message: "New gifts are turned off right now. Ask the parent for an updated link if they reopen it.",
    };
  }

  if (normalizedKyc !== "approved") {
    return {
      state: "cash_only",
      canCheckout: true,
      title: "This fund is live while investing is finishing setup",
      message: "Gifts can still come in now. They stay in cash until the parent finishes identity verification, then they follow the fund's default investment path.",
    };
  }

  return {
    state: "live",
    canCheckout: true,
    title: "This fund is live for gifting",
    message: "New gifts can be sent right away and follow the family's current gift-routing rules.",
  };
}

export function getPublicEventGiftingAvailability(
  event: EventLike | null | undefined,
): PublicEventGiftingAvailability {
  const status = normalizeStatus(event?.status) || "active";
  const now = Date.now();
  // Effective date rolls a birthday forward to its next occurrence, so a
  // recurring birthday never reads as "passed" (see @shared/occasions).
  const eventDateTs = event?.isPermanent ? Number.NaN : effectiveOccasionDateMs(event);
  const eventDatePassed = Boolean(!event?.isPermanent && Number.isFinite(eventDateTs) && eventDateTs < now);
  const goalAmount = parseMoney(event?.goalAmount);
  const giftVolume = parseMoney(event?.giftVolume);
  const goalReached = goalAmount > 0 && giftVolume >= goalAmount;

  if (status === "paused") {
    return {
      state: "paused",
      canCheckout: false,
      goalReached,
      eventDatePassed,
      title: event?.isPermanent ? "This gift page is temporarily paused" : "This event is temporarily paused",
      message: event?.isPermanent
        ? "This family's always-on gift page is temporarily offline. Check back soon."
        : "This event is temporarily offline. The family may open it again soon.",
    };
  }

  if (status === "archived" || status === "closed") {
    return {
      state: "closed",
      canCheckout: false,
      goalReached,
      eventDatePassed,
      title: event?.isPermanent ? "This gift page is closed" : "This event is closed",
      message: event?.isPermanent
        ? "This family's always-on gift page is not accepting new gifts right now."
        : "This event page is no longer accepting new gifts. The family may still share a different active gift link.",
    };
  }

  if (goalReached) {
    return {
      state: "goal_reached",
      canCheckout: true,
      goalReached: true,
      eventDatePassed,
      title: "Goal reached. This page is still open.",
      message: "Kiddo does not auto-close an event just because it hit its goal. Gifts can still come through this page until the parent closes it.",
    };
  }

  if (eventDatePassed) {
    return {
      state: "date_passed",
      canCheckout: true,
      goalReached,
      eventDatePassed: true,
      title: "The event date passed, but the page is still open.",
      message: "Kiddo does not auto-close an event when the date passes. Gifts can still come through this page until the parent closes it.",
    };
  }

  return {
    state: "active",
    canCheckout: true,
    goalReached,
    eventDatePassed,
    title: event?.isPermanent ? "Private gift link" : "Active event",
    message: event?.isPermanent
      ? "This always-on gift page is active and ready for the next gift."
      : "This event page is active and ready for gifts.",
  };
}
