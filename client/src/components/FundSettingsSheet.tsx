// FundSettingsSheet — the Child tab as a Dashboard-context sheet.
//
// Created on 2026-05-14 as Phase 2 sheet-extraction chunk 10
// (the capstone). Mounts FundSettingsChildPanel inside a Sheet
// so the parent can open per-fund settings without leaving
// Dashboard.
//
// The sheet ships in a deliberate first-version shape: it
// exposes every READ surface in the Child tab (kid identity,
// kid view PIN + share link, incoming invitations, co-parent
// list, fund metadata, successor designation, legal/tax links,
// close-fund affordance) but routes the three WRITE-action
// modals — Edit fund details, Invite co-parent, Close fund
// confirmation — to /settings?tab=child where those Dialogs
// already live.
//
// Why route the modals instead of re-mounting them here:
//   1. Each modal has its own state machine + submission flow
//      currently coupled to Settings(). Re-implementing them
//      in the sheet would duplicate logic.
//   2. The locked schema/migration discipline + the "never
//      bulk-codemod" memory says ship in small, revertable
//      chunks. The sheet shipping today unlocks the new
//      surface; extracting the three modals can be future
//      chunks (11-13) when there's appetite.
//   3. The MOST-COMMON sheet visits are read-heavy: parent
//      checking the Kid View link, copying the PIN, browsing
//      co-parent access. Those work in-sheet today. The
//      rarer "edit fund details" trips the sheet→Settings
//      handoff, which is acceptable (still one tap from
//      Dashboard, just opens the full page).
//
// Per the locked WHO/HOW IA principle: per-fund settings are
// scoped to ONE fund. The sheet takes a `fund` prop directly
// instead of reading from active-fund context, so a parent
// can open Settings for a specific child without switching
// the global active-fund (and so Dashboard's hero stays put
// behind the sheet).

import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { FundSettingsChildPanel } from "@/components/FundSettingsChildPanel";

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

export function FundSettingsSheet({
  open,
  onClose,
  fund,
}: {
  open: boolean;
  onClose: () => void;
  fund: FundShape | null;
}) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: subscription } = useSubscription();
  const userPlan = subscription?.effectivePlan ?? "free";

  // Hand off to /settings?tab=child for the three actions whose
  // modals still live in Settings. Close the sheet first so the
  // user lands on the route cleanly instead of seeing the sheet
  // animate-out over the navigation. We use plain string targets
  // (not new query params) so the existing Settings page renders
  // the Child tab and the user taps the affordance again there.
  // This keeps the contract simple — no Settings-side changes
  // needed for this chunk to ship.
  const handoffToSettings = () => {
    onClose();
    navigate("/settings?tab=child");
  };

  // Sheet is null-guarded on fund; nothing to render if the
  // caller didn't pass a fund (e.g., Dashboard before the fund
  // list has loaded). The Sheet itself stays mounted with the
  // open=false state so animation-out works on close transitions.
  if (!fund) {
    return (
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent side="bottom" className="p-0">
          <SheetTitle className="sr-only">Fund settings</SheetTitle>
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        </SheetContent>
      </Sheet>
    );
  }

  const childName = fund.recipientFirstName?.trim();

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="p-0">
        <div className="overflow-y-auto max-h-[88dvh] px-4 pb-8">
          <SheetTitle className="px-1 pt-1 pb-4 text-lg font-semibold text-foreground">
            {childName ? `${childName}'s settings` : "Fund settings"}
          </SheetTitle>
          {/* kidViewQueryEnabled tied to `open` so the kid-view
              query doesn't fire until the sheet is actually
              opened. Saves a network call on every Dashboard
              render where the sheet stays closed. */}
          <FundSettingsChildPanel
            fund={fund}
            user={user as any}
            userPlan={userPlan}
            kidViewQueryEnabled={open}
            onEditFund={handoffToSettings}
            onOpenInviteModal={handoffToSettings}
            onOpenCloseDialog={handoffToSettings}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
