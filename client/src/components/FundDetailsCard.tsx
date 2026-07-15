// FundDetailsCard — the read-only fund-metadata block in
// Settings.tsx's Child tab. Fund name, account type, status,
// UTMA transfer date.
//
// Extracted on 2026-05-14 as Phase 2 sheet-extraction chunk 3.
// The "Edit fund" row was removed 2026-07: it opened the EXACT
// same combined editor as the Child card's "Edit child details"
// (both were wired to onEditFund in FundSettingsChildPanel), so
// two differently-labeled buttons led to one modal. The child-card
// entry is the single door now; that modal still edits the fund
// name alongside the child fields. This card is now pure display.
//
// The transfer-date row only renders for UTMA funds with a real
// recipient birthdate. Personal funds and unfilled UTMA funds
// (no birthdate yet) skip it cleanly. Date computation routes
// through the canonical getMajorityDate helper so state-specific
// majority ages (Mississippi 21, California 21, etc.) are
// respected without duplicating the math here.

import { getMajorityDate } from "@shared/utma";
import { capFirst } from "@/lib/format-name";

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[hsl(var(--kiddo-border))] bg-card ${className}`}>
      {children}
    </section>
  );
}

type FundDetailsShape = {
  name?: string | null;
  accountType?: string | null;
  status?: string | null;
  recipientFirstName?: string | null;
  recipientBirthdate?: string | null;
  majorityAge?: number | null;
};

export function FundDetailsCard({
  fund,
}: {
  fund: FundDetailsShape;
}) {
  const isUtma = !fund?.accountType || String(fund.accountType).toUpperCase() === "UTMA";
  const transferDate = isUtma && fund?.recipientBirthdate
    ? getMajorityDate(fund.recipientBirthdate, fund.majorityAge ?? null)
    : null;
  const transferDateValid = transferDate && !isNaN(transferDate.getTime());
  const childName = capFirst(fund?.recipientFirstName);
  // Owner mode: the handoff already happened, so a future-tense "Transfers to
  // {child}" row is wrong — hide it for the owner.
  const isOwnerMode = (fund as any)?.accessRole === "owner" && !!(fund as any)?.transferredAt;

  return (
    <SectionCard>
      <div className="divide-y divide-[hsl(var(--kiddo-border))]">
        <div className="flex items-center justify-between gap-4 p-4">
          <span className="text-sm text-muted-foreground">Fund name</span>
          <span className="text-sm font-semibold text-foreground truncate max-w-[60%] text-right">{fund?.name || "-"}</span>
        </div>
        <div className="flex items-center justify-between gap-4 p-4">
          <span className="text-sm text-muted-foreground">Account type</span>
          {/* A UTMA terminates at the age of majority — the custodianship
              dissolves and the assets become the (former) minor's own
              individual account. So a post-handoff owner's fund is Personal,
              even if the stored accountType still reads "UTMA" (the demo seed /
              handoff may not flip the column). Show the legally-correct type. */}
          <span className="text-sm font-semibold text-foreground">{(isOwnerMode || fund?.accountType === "personal") ? "Personal" : "UTMA"}</span>
        </div>
        <div className="flex items-center justify-between gap-4 p-4">
          <span className="text-sm text-muted-foreground">Status</span>
          <span className={`text-sm font-semibold ${fund?.status === "active" ? "text-green-700" : "text-muted-foreground"}`}>
            {fund?.status === "active" ? "Active" : fund?.status || "-"}
          </span>
        </div>
        {/* Transfer date — when the fund's UTMA custody legally hands
            off to the kid. Renders only for UTMA funds with a real
            birthdate (personal funds don't have a transfer date;
            missing birthdate means the date can't be computed yet).
            The warm "Transfers to [child]" framing turns a UTMA legal
            detail into a parent-visible reality without verbose
            explanation. The full age-18 plan UX lives elsewhere;
            this is the calm utility-surface acknowledgment. */}
        {transferDateValid && !isOwnerMode && (
          <div className="flex items-center justify-between gap-4 p-4" data-testid="row-fund-transfer-date">
            <span className="text-sm text-muted-foreground">
              Transfers to {childName || "your child"}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {transferDate!.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
