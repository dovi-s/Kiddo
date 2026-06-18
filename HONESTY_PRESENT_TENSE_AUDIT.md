# Honesty audit — unconditioned present-tense investment claims

**Date:** 2026-06-17
**Constraint:** `INVESTING_LIVE = false` (custodian is a stub). Per CLAUDE.md,
"never imply certainty markets don't give; the brand's trust IS the moat."
Present-tense / SIPC copy is **founder + legal owned** — this doc surfaces the
findings for a batch decision; nothing legal-sensitive was auto-edited.

The canonical fix mechanism already exists: `investingLiveCopy(liveText,
pendingText)` + the FLIP CHECKLIST in `shared/legal-copy.ts`. New hedged,
custodian-agnostic copy should route through it; SIPC/broker/tax wording gets
re-read against the real custodian at flip.

## How to read severity (the key distinction)

The same claim is a different problem depending on **who sees the surface
before investing is live**:

- **NOW (prospect-visible):** marketing / conversion surfaces a prospect reads
  *pre-launch*. A naked present-tense claim here deceives someone who has not
  funded anything. **Fix before launch.**
- **FLIP (in-app, post-funding):** authenticated surfaces a family only reaches
  *after* funding. If the kid view / dashboard are gated so they're only live
  once `INVESTING_LIVE` is true, the present tense becomes true and these are
  re-read items, not rewrites. **Confirm the gating; otherwise treat as NOW.**

---

## NOW — prospect-visible, fix before launch

| File:line | Exact copy | Note | Sev |
|---|---|---|---|
| ~~`GiftCheckout.tsx:1488`~~ ✅ | "Give {nm} a gift that actually grows, in real stocks invested in their name." (birthday) | **FIXED** — routed through `investingLiveCopy()`; custodian-agnostic so it joins the atomic flip. | HIGH |
| ~~`GiftCheckout.tsx:1489`~~ ✅ | "Start them off right with a real investment in their name." (baby shower) | **FIXED** — same. | HIGH |
| ~~`GiftCheckout.tsx:1494`~~ ✅ | "Give a gift that actually grows, in real stocks invested in their name." (fallback) | **FIXED** — same. | HIGH |
| ~~`FundSnapshot.tsx:690`~~ ✅ | Title: "{name}'s fund is invested in real markets." | **FIXED** — routed through `investingLiveCopy()` (pending: "…will invest in real markets once investing is live"), so the title no longer contradicts its own body. | HIGH |
| `About.tsx:110` | Heading: "They watch it grow, in shares they actually own." | Body (L119) is correctly conditioned ("Once investing is live…"), but the **heading** stands naked above it. | HIGH |
| `Compare.tsx:395` | Row label: "Invests in real stocks" (Kiddo = Yes vs savings = No) | Reads as a present capability claim in the comparison grid. | LOW |
| `HowItWorks.tsx:216` | "Small gifts still become real ownership." | Preceded by "when that gift is invested…" (L215); sentence itself reads unconditional. | LOW |

**Suggested conditioning (founder/counsel to confirm wording):**
- GiftCheckout occasion subs → route through `investingLiveCopy()`, e.g. pending
  text "a gift that grows for their future, invested in their name once
  investing is live."
- FundSnapshot title → make it not contradict its body, e.g. neutral
  "How {name}'s fund is invested" (the body already explains the "once live").
- About heading → either condition or soften from present-tense ownership.

---

## FLIP — in-app post-funding; confirm gating, else treat as NOW

| File | Scope | Note |
|---|---|---|
| `KidView.tsx` | `COMPANY_EXPLAINERS` dict (~41 "You own a tiny piece of …" strings) + "What you own" / "What you own right now" section headers (L552, L1190, L1669) | **Not on the flip checklist until now.** No global hedge anywhere on the page. Cleanest fix: condition the **section header** once — that single hedge scopes every per-stock explainer below it, leaving the beloved per-stock copy untouched. Added to the FLIP CHECKLIST in `legal-copy.ts` with a ⚠️. |
| Dashboard / DashboardLab | growth / holdings framing | Already partly hedged via `investingLiveCopy()`; see existing memory note on the investing-live hedge gap. |

---

## Recommendation

1. **Pre-launch:** condition the 7 NOW items (founder/counsel approve wording),
   routing custodian-agnostic ones through `investingLiveCopy()`.
2. **KidView:** decide the approach — one conditioned section header (preserves
   feel, my recommendation) vs confirming the kid view is gated behind
   `INVESTING_LIVE` so the present tense is only ever shown when true.
3. Re-run this audit after the SIPC present-tense pass noted in
   `SECURITY_AUDIT.md` so both close together.
