# Custodian — Source of Truth

> Created 2026-05-28. Purpose: end the Alpaca-vs-DriveWealth confusion by stating
> exactly what each source says, what's actually agreed, the one decision that's
> open, and the rule for customer-facing copy until that decision is made AND
> wired. This doc does **not** pick the custodian — it makes the split visible so
> the call gets made once and sticks.

---

## 1. The conflict (why it feels confusing)

Three layers disagree:

| Source | Says | Last touched |
|---|---|---|
| `ARCHITECTURE_2026.md` (self-described "canonical," "supersedes prior proposals") | **Alpaca** is the BD-of-record. Claims "Verified: UTMA + UGMA supported." | 2026-05-26 |
| `CLAUDE.md` (provider-boundary doctrine — the repo's standing instruction) | Frames **DriveWealth** as the custody scaffold / swap candidate; "when the real DriveWealth client is built…" | 2026-05-26 |
| Shipped code + all customer-facing copy + the interface files (`server/driveWealthAccountSetup.ts`, `custodianTransfer.ts`) | **DriveWealth**, everywhere. Zero Alpaca in user-facing copy. | ongoing |

So the *newest* doc picked Alpaca; the *doctrine* doc and *all shipped copy* say
DriveWealth. Nobody is wrong on purpose — the decision moved in one doc and never
propagated.

## 2. What's actually agreed (not in dispute)

- **The custodian is swappable, behind an interface.** Both `ARCHITECTURE_2026.md`
  and `CLAUDE.md` agree: no raw vendor calls in `routes.ts`; the custodian lives
  behind `driveWealthAccountSetup.ts` / `custodianTransfer.ts` so Alpaca-vs-DW is
  a swap, not a rebuild. (The interface name is historical; it is meant to be
  vendor-agnostic.)
- **Nothing is wired yet.** No real custodian API client exists. `submitToDriveWealth`
  is a scaffold stub. No account opens, no order is placed, no 1099 is issued today.
- **Kiddo is not the broker-dealer or the adviser.** The custodian is. Kiddo is the
  product/experience/Memory-Book/gifting layer.

## 3. The one open decision (and what gates it)

**Decision:** Alpaca or DriveWealth (or Apex) as the live custodian.

Gated by, in order:
1. **UTMA custodial support verified in writing** with the chosen vendor's compliance
   team. `ARCHITECTURE_2026.md` asserts Alpaca supports UTMA — that is unconfirmed,
   and EarlyBird used **Apex**, not Alpaca. Do not treat "verified" as verified.
2. **The RIA / AUM legal determination** (the lawyer memo; see the AUM-lawyer
   engagement brief in memory). The 0.10% post-handoff AUM fee is what triggers
   adviser status — this gates launch regardless of custodian.
3. **Wiring** — replacing the scaffold stub with a real authenticated client.

Until #1–#3 are done, **no customer-facing surface should name a specific custodian
in the present tense.**

## 4. Copy rule until locked AND wired

You already have a correct canonical string in the codebase (used in `Home.tsx`,
`GiftCheckout.tsx`, `Legal.tsx`, `FAQ.tsx`, `Security.tsx`):

> "When investing is live, securities are held by our broker-dealer partner,
> [NAME], LLC (Member FINRA/SIPC), not by Kiddo. SIPC protects against
> broker-dealer failure, not market losses."

Two rules:
- **Conditional, not present tense.** "When investing is live, …" — never
  "investments are held by …" while the integration is a stub.
- **Entity-agnostic until locked.** Use "our broker-dealer partner" (no name), OR
  the chosen name once #1–#3 above are done. Do not hard-name DriveWealth *or*
  Alpaca in a way that has to be re-edited later.

Also fix: `Pricing.tsx:94` "SIPC-**insured**" → SIPC *protects/covers* (it is not
insurance), and attribute to the broker-dealer.

## 5. Inventory — customer-facing custodian mentions

**Already correct (conditional, "when investing is live") — leave as-is, this is the model:**
`Home.tsx:826-827` · `FAQ.tsx:199-201,215` · `GiftCheckout.tsx:1548,1947` ·
`Legal.tsx:83,175,179` · `Security.tsx:37,42,90` · `Compare.tsx:457` ("SIPC at launch")

**Present-tense — assert live custody that doesn't exist yet (FIX these):**
- Global / high-blast-radius: `components/layout/Footer.tsx:88` · `server/templates/baseTemplate.ts:162` (every email) · `server/gifterNotificationWorker.ts:772,846` (gifter emails) · `App.tsx:224` + `Security.tsx:11` (SEO meta)
- Pages: `About.tsx:153` · `Account.tsx:1723` · `FundSnapshot.tsx:602` · `Pricing.tsx:94` · `CalculatorAt18.tsx:416` · `UtmaByState.tsx:107` · `Login.tsx:373` · `TrumpAccountVsUtma.tsx:327` · `RobuxVsUtma.tsx:226` · `TaxDocuments.tsx:1035,1037,1050,1067`
- Mobile: `apps/mobile/src/screens/DashboardScreen.tsx:484,592` · `GifterFlowScreen.tsx:260`

**Code comments / internal (no action — accurately note "not yet wired"):**
`server/driveWealthAccountSetup.ts` (scaffold) · `routes.ts:3512` (`TODO(custody): once Alpaca/DriveWealth is live`) · `TaxDocuments.tsx:43-51` · `Footer.tsx:98` (references an "entity-agnostic" readiness doc — matches this rule)

## 6. To unblock a clean one-pass fix

Make the §3 decision (or just decide "stay entity-agnostic for launch"). Then a
single pass brings every §5 present-tense line onto the canonical conditional
string. Doing it before the decision risks editing ~20 legal lines twice.

## 7. STATUS — copy decision made + sweep DONE (2026-05-28)

**Decision for launch:** stay **entity-agnostic** (§4 rule 2). No customer-facing
surface names a custodian. The vendor decision (§3: Alpaca / DriveWealth / Apex)
is **still open** and still gated by UTMA-verification-in-writing + the RIA/AUM
lawyer memo + wiring — but copy no longer blocks on it.

**Done this pass:** every rendered customer-facing custodian mention across web +
mobile + email templates now reads "our broker-dealer partner (Member FINRA/SIPC)",
conditional on "when investing is live." Includes the full §5 present-tense list,
the doc-blessed conditional-but-named lines (Home/FAQ/Legal/GiftCheckout/Security/
Compare/GiftSuccess/Settings/education/ux-foundations/trust strips), the email
footer (baseTemplate) + gifter/year-end/tax-season emails, and the privacy-policy
processor lines. Firm-specific external links (drivewealth.com, firm-named
BrokerCheck) removed/genericized. `npm run check` + `mobile:check` green.

**Remaining `DriveWealth` references are intentional:** code comments, the
`driveWealthAccountSetup.ts` scaffold + its type names, and internal TODOs — none
rendered to users. Verified by grep.

**When the custodian IS locked + wired:** one find/replace of "our broker-dealer
partner" → "[NAME], LLC (Member FINRA/SIPC)" across customer copy completes it.
No re-editing churn — that's the whole point of going agnostic now.
