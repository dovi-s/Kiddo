import type { Fund } from "@shared/schema";
import { investingLiveCopy } from "@shared/legal-copy";

export type SetupStep = {
  key: "fund" | "recipient" | "investing" | "bank" | "profile";
  label: string;
  done: boolean;
};

export type SetupNextAction =
  | "create_fund"
  | "add_recipient"
  | "activate_investing"
  | "link_bank"
  | "complete_profile"
  | "review";

export type SetupProgress = {
  percent: number;
  steps: SetupStep[];
  nextAction: SetupNextAction;
};

type BuildSetupProgressInput = {
  fund?: Fund | null;
  hasBank: boolean;
  hasProfile: boolean;
};

function needsRecipientDetails(fund?: Fund | null): boolean {
  if (!fund) return false;
  return (fund.accountType || "").toUpperCase() === "UTMA";
}

function hasRecipientDetails(fund?: Fund | null): boolean {
  if (!fund) return false;
  return Boolean(fund.recipientFirstName && fund.recipientBirthdate);
}

function isInvestingActivated(fund?: Fund | null): boolean {
  if (!fund) return false;
  return (fund.status || "").toLowerCase() === "active";
}

export function buildSetupProgress({ fund, hasBank, hasProfile }: BuildSetupProgressInput): SetupProgress {
  const hasFund = Boolean(fund);
  const recipientRequired = needsRecipientDetails(fund);
  const recipientDone = !recipientRequired || hasRecipientDetails(fund);
  const investingDone = isInvestingActivated(fund);
  const bankDone = hasBank;
  // Actual UTMA majority age for this fund (18/21/25 by state), so the bank
  // copy matches the dashboard hero instead of hardcoding 18.
  const majorityAge = Number((fund as any)?.majorityAge) || 18;

  const steps: SetupStep[] = [
    {
      key: "fund",
      label: hasFund ? "Your fund is ready for its first gift" : "Create your first fund",
      done: hasFund,
    },
    {
      key: "recipient",
      label: recipientRequired
        ? recipientDone
          ? "Child details are in place"
          : "Add your child's details"
        : "Recipient details are not needed for this fund",
      done: recipientDone,
    },
    {
      key: "investing",
      // HONESTY: the ✓ means investing is ACTIVATED for this fund (status
      // "active"), but gifts sit as cash until INVESTING_LIVE flips (custodian
      // is still a stub). So the present-tense "go straight into real stocks"
      // is only true once live — route it through investingLiveCopy() like
      // every other real-stocks surface (GiftCheckout, FundSnapshot, About).
      label: investingDone
        ? investingLiveCopy(
            "First gifts go straight into real stocks",
            "First gifts buy real stocks once investing goes live",
          )
        : "Activate investing so first gifts go straight into real stocks",
      done: investingDone,
    },
    {
      key: "bank",
      // Linking a Plaid bank is the WITHDRAWAL/payout rail for the at-18
      // handoff — not "fund protection" (custody/SIPC protection comes from the
      // custodian, not from linking a payout bank). Match the honest framing
      // the action-item card already uses for the same action.
      label: bankDone ? `Withdrawals are linked for the age-${majorityAge} handoff` : `Link a withdrawal bank for the age-${majorityAge} handoff`,
      done: bankDone,
    },
    {
      key: "profile",
      label: hasProfile ? "Your profile is set" : "Add your name and photo for the Memory Book",
      done: hasProfile,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const percent = Math.round((completed / steps.length) * 100);

  let nextAction: SetupNextAction = "review";
  if (!hasFund) nextAction = "create_fund";
  else if (!recipientDone) nextAction = "add_recipient";
  else if (!investingDone) nextAction = "activate_investing";
  else if (!bankDone) nextAction = "link_bank";
  else if (!hasProfile) nextAction = "complete_profile";

  return { percent, steps, nextAction };
}
