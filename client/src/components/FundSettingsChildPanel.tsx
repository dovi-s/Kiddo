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
import { PreviousCustodianAccessCard } from "@/components/PreviousCustodianAccessCard";
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
  // Once a fund is TRANSFERRED it belongs to the now-adult, so Kid View (a
  // parent-configures-a-minor surface) is meaningless on it. Gate Kid View on
  // this, NOT fundIsOwnerHeld: keying on "owner-held" alone leaked editable
  // "Turn on Kid View / Set a PIN" controls to the view-only PREVIOUS custodian
  // on a handed-off fund (Phil on Haley's fund). 2026-06-10 fix.
  const fundIsTransferred = Boolean((fund as any)?.transferredAt);
  // Collaborators (co-admin AND viewer): managing access, closing the fund,
  // and naming a successor custodian are owner-only structural actions (the
  // server 403s them), so hide those cards instead of showing controls that
  // fail. The co-admin still manages the day-to-day. NOTE 2026-06-04: this
  // previously checked only === "co-admin", and /api/funds used to tag
  // collaborator funds with a generic accessRole="collaborator" — so the
  // demo's Claire (co-admin) saw the owner-only co-parent card complete with
  // "Primary custodian · Full control" and a Kiddo+ invite upsell on a fund
  // already covered by Phil's Family plan. The list route now stamps real
  // roles ('co-admin' | 'viewer'); this gate covers both.
  const fundAccessRole = String((fund as any)?.accessRole || "");
  const fundIsCoAdmin = fundAccessRole === "co-admin";
  const fundIsCollaborator = fundIsCoAdmin || fundAccessRole === "viewer";
  return (
    <div className="space-y-4" data-testid="settings-child-panel">
      <ChildIdentityCard fund={fund} onEditChild={onEditFund} />
      {/* Kid View is the CHILD's login surface, meaningless once the fund is
          handed off (the now-adult logs in as themselves with full access). Hide
          it on ANY transferred fund, for the adult owner AND the view-only
          previous custodian alike (gating on owner-held alone leaked editable
          controls to the previous owner). It returns naturally on a new child
          fund. See project_adult_account_is_parent_2_0_onramp. */}
      {!fundIsTransferred && <KidsViewCard fund={fund} enabled={kidViewQueryEnabled} />}
      <InvitationsToYouCard />
      {!fundIsOwnerHeld && !fundIsCollaborator && (
        <CoParentAccessCard
          fund={fund}
          user={user}
          userPlan={userPlan}
          onOpenInviteModal={onOpenInviteModal}
        />
      )}
      {/* Post-handoff owner's access control — the adult-owner analog of the
          co-parent card above. The former custodian keeps a view-only window
          by default; this is where the owner can close it (2026-06-07,
          migration 0042 — see PreviousCustodianAccessCard for the safety
          rationale). Renders only while the window is open. */}
      {fundIsOwnerHeld && <PreviousCustodianAccessCard fund={fund} />}
      {/* Collaborator's own access note — the warm read-only answer to "what
          am I here?" The full CoParentAccessCard is owner-machinery (invite
          button, access list, revoke, plan upsell — every piece 403s or
          mis-describes for a collaborator), so collaborators get this small
          truthful card instead of either the owner card or nothing.
          2026-06-04, follow-up to the accessRole tag fix. */}
      {!fundIsOwnerHeld && fundIsCollaborator && (
        <section className="rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card" data-testid="collaborator-access-note">
          <div className="p-5">
            <h2 className="text-base font-bold text-foreground">Your access</h2>
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[hsl(var(--kiddo-evergreen)/0.18)] bg-[hsl(var(--kiddo-evergreen)/0.04)] p-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  {fundIsCoAdmin ? "Co-Admin" : "Viewer"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {fundIsCoAdmin
                    ? `You can see everything and manage the day-to-day: occasions, Memory Book entries, thank-yous, and child details.`
                    : `You can see the fund's growth, activity, and Memory Book. Making changes stays with the custodian.`}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[hsl(var(--kiddo-evergreen)/0.10)] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--kiddo-evergreen))]">
                {fundIsCoAdmin ? "Co-Admin" : "Viewer"}
              </span>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground/80 leading-relaxed">
              {(fund as any)?.recipientFirstName ? `${(fund as any).recipientFirstName}'s` : "The"} primary custodian manages who has access and the money settings. You are not on the legal UTMA account.
            </p>
          </div>
        </section>
      )}
      <FundDetailsCard fund={fund} onEditFund={onEditFund} />
      {!fundIsOwnerHeld && !fundIsCollaborator && <SuccessorCustodianCard fund={fund} />}
      <LegalDocumentsCard />
      {!fundIsCollaborator && <CloseFundCard fund={fund} onOpenCloseDialog={onOpenCloseDialog} />}
    </div>
  );
}
