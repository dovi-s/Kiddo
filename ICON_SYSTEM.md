# Kiddo Icon System

**Why this exists:** the app grew multiple parallel "systems" for the same concept — 5 occasion maps (1 Lucide glyph + 4 disagreeing emoji maps), holdings drawn as emoji *or* logos split by surface, "managed mix" drawn 3 ways, the up-arrow doing triple duty, voice-notes/empty-states/milestones on emoji next to Lucide. Result: "so many random icons everywhere." The fix is not per-screen. It's **one concept = one mark = one source of truth**, applied at the shared chokepoints so every surface updates at once.

## The rule

Every concept below has exactly ONE mark. No mark is reused for two concepts. Emoji survive ONLY for the rare occasion "long tail" (cultural traditions) where no crafted glyph exists, and only as a fallback.

| Concept | The one mark | Source of truth |
|---|---|---|
| **Individual company holding** (AAPL, DIS, BBW…) | real ticker **logo** | `StockLogo` (Parqet by symbol) |
| **Broad-market category** (VTI/VOO=US, VXUS=Intl, BND/AGG=Bonds, Cash) | **AssetToken** (skyline / globe / treasury / coin) | `AssetToken` — rendered *inside* `StockLogo` so it's automatic everywhere |
| **Managed mix** (the auto basket) | **`Layers`** basket tile | `ManagedMixIcon` |
| **Strategy tier** — in the SELECTOR only (Growth/Balanced/Conservative/Custom) | Lucide **TrendingUp / Scale / Shield / Sliders** | `lib/strategy.ts` `STRATEGY_ICONS` |
| **Money gain** ("+$X growth") | **`TrendingUp`** — and nothing else reuses it | inline |
| **Whole portfolio** ("What you own") | **pie** | inline (`PieChart`) |
| **Occasion** (birthday, holiday, graduation, baby, just-because, custom, + goals) | Lucide glyph (Cake/Gift/GraduationCap/Baby/Heart/Pencil/Car/Home/Plane/Briefcase/Umbrella) | `renderOccasionGlyph` — emoji fallback ONLY for traditions |
| **Voice note** | Lucide **`Mic`** | inline |
| **Section / utility** (bank, tax, recurring, alerts, memory-type, empty-states) | Lucide, one weight | inline, but no emoji |

## The chokepoints (edit these, not 30 call sites)

1. **`StockLogo`** (~83 call sites, the #1 lever): render `AssetToken` for category tickers *inside* it (`hasAssetToken(upper) → <AssetToken/>`), size-gated (token ≥ ~22px, logo below). → VTI/VXUS/BND consistent on **every** holdings surface (dashboard, settings "Where gifts go", "Today vs target", activity, recurring allocation grid, memory pills, gift pages) in one edit. Kills the Vanguard-collision everywhere.
2. **Occasion mark**: route every occasion render through `renderOccasionGlyph(...) || emoji`. Replace the 4 duplicate emoji maps' render sites (`event-cover-themes` consumers, `CreateEventSheet` header + chip + preview, `MemoryBook` occasion strip, `GiftCheckout` occasion meta + CTA, `GiftSuccess` chip) so the glyph shows everywhere; keep ONE emoji map (the tradition long tail) as fallback. Delete the other three inline maps.
3. **`ManagedMixIcon`** everywhere managed-mix shows: `Activity.tsx` (contribution rows 3221, schedule 4548, detail hero 5151), `DetailHistoryModal` leading, `RecurringEditSheet` (import the component instead of re-hardcoding `Layers`). Stop passing `STRATEGY_ICONS[tier]` as a managed-mix stand-in.
4. **Strategy forks**: dashboards each redeclare a local `STRATEGY_ICONS`; consolidate to `lib/strategy.ts` so the tier icons have one home. (Keep the Lucide marks — founder-approved.)
5. **Emoji → Lucide** at the leaf sites the glyph system doesn't cover: voice-note 🎙 → `Mic`; MemoryBook empty-states (✏️📷🌟🎁📌📅🌱) → their Lucide entry-type equivalents; Activity milestone rows (🌱💚🤲🎂🎙️📷⭐) + onboarding checklist → Lucide; InvestCash/AddFund 🌱 success → Lucide `Sprout`.

## Deliberate keeps / open calls (founder decides)

- **Kid View younger-mode company emoji** (DIS🏰 AAPL🍎 …, ~40 hand-mapped) — likely an intentional *playful* choice for young kids. Recommend KEEP (Kid View is a different register). Flag, don't auto-change.
- **Strategy "Growth" tier = `TrendingUp`** overlaps with money-gain, but only inside the self-contained selector (no gain arrow adjacent). Recommend KEEP (founder loves it); the collision is eliminated by never reusing it as a managed-mix stand-in (chokepoint 3).

## Cleanup

- Delete **`HoldingLogo.tsx` + `holding-logos.ts` (`TICKER_DOMAIN`)** — zero importers, dead (Clearbit path superseded by Parqet `StockLogo`).
- Remove `STRATEGY_EMOJI`, `event-cover-themes` extra maps' render usage once the glyph is routed everywhere.

## Order of application

Chokepoint 1 (StockLogo) → biggest visible win, one edit. Then 3 (ManagedMixIcon), then 2 (occasion routing — most sites but one function), then 5 (leaf emoji), then 4 (strategy consolidation), then cleanup. Verify each on `/staging` before promoting to Lab.
