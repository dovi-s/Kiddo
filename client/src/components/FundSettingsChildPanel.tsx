// FundSettingsChildPanel — the Child tab's full body, composed
// from the eight extracted cards in their canonical order.
//
// Created on 2026-05-14 as Phase 2 sheet-extraction chunk 9.
// Settings.tsx renders this directly inside the
// `settingsTab === "child"` branch; FundSettingsSheet (chunk 10)
// also mounts this same component to surface the Child tab as a
// Dashboard-context sheet without re-implementing the
// composition. One source of truth for the panel's contents and
// ordering; two mount points.
//
// All actual fund-mutation logic lives inside the individual
// cards. This panel just orchestrates them and routes shared
// callbacks (the Settings-owned modals: Edit fund, Invite
// co-parent, Close fund) to the parent surface.
//
// Order matches the locked card-ordering principle for Settings
// Apple-register: identity → kid-facing surface → inbound
// signals → access controls → fund metadata → legacy/legal →
// destructive last. (Per the standard "destructive at the
// bottom" UX convention.)

import { ChildIdentityCard } from "@/components/ChildIdentityCard";
import { KidsViewCard } from "@/components/KidsViewCard";
import { InvitationsToYouCard } from "@/components/InvitationsToYouCard";
import { CoParentAccessCard } from "@/components/CoParentAccessCard";
import { FundDetailsCard } from "@/components/FundDetailsCard";
import { SuccessorCustodianCard } from "@/components/SuccessorCustodianCard";
import { LegalDocumentsCard } from "@/components/LegalDocumentsCard";
import { CloseFundCard } from "@/components/CloseFundCard";

type FundShape = {
  id?: string;
  recipientFirstName?: string | null;
  recipientBirthdate?: string | null;
  createdAt?: string | null;
  childPhotoUrl?: string | null;
  name?: string | null;
  accountType?: string | null;
  status?: string | null;
  majorityAge?: number | null;
  successorCustodianName?: string | null;
  successorCustodianEmail?: string | null;
  successorCustodianRelation?: string | null;
};

type UserShape = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  profileImageUrl?: string | null;
};

export function FundSettingsChildPanel({
  fund,
  user,
  userPlan,
  kidViewQueryEnabled = true,
  onEditFund,
  onOpenInviteModal,
  onOpenCloseDialog,
}: {
  fund: FundShape;
  user: UserShape | null | undefined;
  userPlan: string;
  /** Gate the kid-view-settings query — when this panel mounts in
      a non-visible context (e.g., a sheet not yet opened), pass
      false to defer the network call. */
  kidViewQueryEnabled?: boolean;
  onEditFund: () => void;
  onOpenInviteModal: () => void;
  onOpenCloseDialog: () => void;
}) {
  return (
    <div className="space-y-4" data-testid="settings-child-panel">
      <ChildIdentityCard fund={fund} onEditChild={onEditFund} />
      <KidsViewCard fund={fund} enabled={kidViewQueryEnabled} />
      <InvitationsToYouCard />
      <CoParentAccessCard
        fund={fund}
        user={user}
        userPlan={userPlan}
        onOpenInviteModal={onOpenInviteModal}
      />
      <FundDetailsCard fund={fund} onEditFund={onEditFund} />
      <SuccessorCustodianCard fund={fund} />
      <LegalDocumentsCard />
      <CloseFundCard fund={fund} onOpenCloseDialog={onOpenCloseDialog} />
    </div>
  );
}
