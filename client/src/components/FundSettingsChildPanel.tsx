// FundSettingsChildPanel — the Child tab's full body, composed
// from the eight extracted cards in their canonical order.
//
// Created on 2026-05-14 as Phase 2 sheet-extraction chunk 9.
// Settings.tsx renders this directly inside the
// `settingsTab === "child"` branch. (The chunk 10 FundSettingsSheet
// that previously also mounted this panel from Dashboard was
// removed 2026-05-15: the Dashboard entry-point was redundant with
// the canonical /settings nav entry, and the sheet's split-brain
// UX bounced every write action back to /settings anyway. Settings
// is now the single mount point — the panel kept its multi-mount
// shape in case a future surface re-introduces it cleanly.)
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
  // Post-handoff adult owner: two cards are custodian-of-a-minor concepts that
  // don't apply to someone who owns their own account, and they aren't owner-
  // framed yet (unlike ChildIdentity/KidsView/FundDetails, which adapt):
  //   - Co-parent access — you don't "co-parent" your own adult account; the
  //     "you are the legal custodian, they have no legal claim" framing is wrong.
  //   - Successor custodian — "manage the fund if anything happens to you before
  //     {child} turns 21" is false for a grown owner. The adult analog is a
  //     beneficiary / transfer-on-death designation — a separate build. Hide
  //     until that exists rather than show a custodian instrument.
  // See project_adult_account_is_parent_2_0_onramp.
  const fundIsOwnerHeld =
    (fund as any)?.accessRole === "owner" && Boolean((fund as any)?.transferredAt);
  return (
    <div className="space-y-4" data-testid="settings-child-panel">
      <ChildIdentityCard fund={fund} onEditChild={onEditFund} />
      {/* Kid View is the CHILD's login surface — meaningless for an adult owner
          who logs in as themselves with full access. Per the locked Kid View
          policy, hide it for the owner (it returns naturally on a child fund
          they later create). See project_adult_account_is_parent_2_0_onramp. */}
      {!fundIsOwnerHeld && <KidsViewCard fund={fund} enabled={kidViewQueryEnabled} />}
      <InvitationsToYouCard />
      {!fundIsOwnerHeld && (
        <CoParentAccessCard
          fund={fund}
          user={user}
          userPlan={userPlan}
          onOpenInviteModal={onOpenInviteModal}
        />
      )}
      <FundDetailsCard fund={fund} onEditFund={onEditFund} />
      {!fundIsOwnerHeld && <SuccessorCustodianCard fund={fund} />}
      <LegalDocumentsCard />
      <CloseFundCard fund={fund} onOpenCloseDialog={onOpenCloseDialog} />
    </div>
  );
}
