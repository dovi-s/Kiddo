import type { Fund } from "@shared/schema";

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
      label: investingDone ? "First gifts can go straight into real stocks" : "Activate investing so first gifts go straight into real stocks",
      done: investingDone,
    },
    {
      key: "bank",
      label: bankDone ? "Full fund protection is in place" : "Link withdrawals to unlock full fund protection",
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
