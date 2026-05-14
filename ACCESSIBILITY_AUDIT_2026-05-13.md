# Accessibility Audit: 2026-05-13

> **Status update 2026-05-14:** Issue 1 (muted text fails AA normal)
> SHIPPED via Option 1. Both `--kiddo-muted` and `--muted-foreground`
> darkened from 44-45% lightness to 38%. New contrasts:
> - `--kiddo-muted`: was 4.37:1, now **5.61:1** ✓ AA normal
> - `--muted-foreground`: was 4.07:1, now **5.33:1** ✓ AA normal
>
> Issue 2 (gold text fails AA) PARTIALLY shipped 2026-05-14:
> - Defined the previously-undefined `--kiddo-gold-ink` and
>   `--kora-gold-ink` tokens (~#6F4611, HSL 34 74% 25%). These
>   were referenced in 10+ files (Settings, MemoryBook, KidView,
>   YourStory, EventCreate, AgeTransitionInvite, ClaimFund, Events,
>   KidAt18WelcomeBanner) but had no CSS definition. Browser was
>   falling back to inherited color silently. Defining the token
>   gives those latent references the intended dark-amber finish.
> - Computed contrasts of the new gold-ink token:
>   - on cream: **7.5:1** ✓ AAA
>   - on 15% gold tint over cream: **6.8:1** ✓ comfortable AA
> - Migrated `ActivityDetail.tsx` "Details" label from
>   `--kora-gold` to `--kora-gold-ink` for AA compliance.
>
> Issue 2 (gold text fails AA) FURTHER SHIPPED 2026-05-14 evening:
> Full sweep of every remaining text-gold-on-light-tint usage
> across the app. 21 surgical token substitutions across 8 files.
> Migrated:
> - `premium-list-item.tsx:79+164` — both `gold` variants in the
>   design-system component (avatar + badge). Propagates wherever
>   the variant is used.
> - `Dashboard.tsx:5917+7200+12639` — age-band suggestion banner
>   label, Kiddo+ badge on auto-invest setup card, Kiddo+ label in
>   coverage upgrade modal. The same modal body also dropped the
>   stale "thank-you templates" line per the locked refuse rule
>   and was rewritten to match the locked Plus differentials
>   (recurring investments, Memory Book media, custom mix,
>   co-parent).
> - `Settings.tsx:102+1851+1867+4461+4476+4965` — section meta
>   badge, strategy-switch "What changes" label, after-pill, Plus
>   pricing card price headline + check icons, bank-not-linked
>   warning text. Settings 4507+4528 (Family card price + checks)
>   migrated to `--kiddo-gold-light` instead because the Family
>   card has a dark evergreen gradient background — gold-light is
>   the correct light-on-dark register.
> - `TaxDocuments.tsx:422+426+579+585` — all four ticker pills on
>   gold-tinted background.
> - `MemoryBook.tsx:3039+3206+3391+3973+4320+4649` — Read button,
>   sticky month header for "The Beginning", "Where it began"
>   ribbon, voice-note label, milestone pill, share-counter pill.
> - `MilestoneMoment.tsx:183`, `MilestoneShareCard.tsx:45` —
>   uppercase "Milestone" labels.
> - `premium-themes.tsx:96+192+224+231+243` — ThemeSelector
>   upgrade CTA, GoalCard label and "to go" text and contributor
>   overflow chip, EventPassBadge pill.
>
> Left intentionally as `--kora-gold`/`--kiddo-gold`:
> - All pure-icon usages (lucide icons in colored circles). Icons
>   have looser WCAG and the brand-warm gold is the intended
>   register for these decorative roles. Files: ActionItemCard,
>   ActivityDetail, FundsOverview, EventCreate, MilestoneMoment,
>   MilestoneShareCard, premium-themes Crown icons, share-kit
>   Sparkles, MemoryBook Star icon at 4317, Send.tsx icons.
> - Background fills and borders (no contrast requirement).
> - `Settings.tsx:4634+4674` — Star icon inside a gold-tinted
>   circle (icon-in-pill role) and a hidden-div ✦ glyph that
>   never renders.
>
> The audit closes on text contrast. Future palette work belongs
> in a separate audit; chart/dark-mode pairs are still untouched.

First formal contrast audit of the Kiddo palette. Two real issues
surfaced, both on muted/accent text against the cream background.
Evergreen and ink on cream are AAA-clear. The brand identity is intact;
fixes are narrow.

## Methodology

WCAG 2.x relative luminance contrast ratio (the algorithm the App Store
accessibility review uses today). Computed by hand from the HSL values
in `client/src/index.css`. APCA is the modern alternative and is more
perceptually accurate, but WCAG 2.x is the regulatory baseline and the
one accessibility-conscious customers will run against you.

For the next audit (probably pre-App-Store submission), run the
`apca-w3` npm package against the same color pairs to get APCA Lc
values. APCA may pass some of the borderline pairs WCAG 2.x flags here,
because APCA weights perceptual difference better. Either standard is
valid; WCAG 2.x is more conservative.

## Color tokens (from `client/src/index.css`)

| Token | HSL | Hex | sRGB Luminance Y |
|---|---|---|---|
| `--kiddo-cream` (bg) | 38 36% 96% | #F8F5F0 | ~0.915 |
| `--kiddo-evergreen` | 152 37% 17% | #1B3A2D | ~0.034 |
| `--kiddo-evergreen-deep` | 152 45% 10% | #0E2518 | ~0.013 |
| `--kiddo-gold` | 34 74% 45% | #C5821E | ~0.279 |
| `--kiddo-gold-light` | 40 78% 66% | #EDC164 | ~0.541 |
| `--kiddo-ink` | 40 23% 8% | #1A1710 | ~0.011 |
| `--kiddo-muted` | 32 7% 44% | #7A7268 | ~0.171 |
| `--muted-foreground` | 150 8% 45% | ~#6A7C73 | ~0.187 |

## Contrast results (text on `--kiddo-cream` background)

| Foreground | Contrast | AA normal (4.5) | AA large (3.0) | AAA (7.0) |
|---|---|---|---|---|
| `--kiddo-ink` | 16.4 : 1 | ✓ | ✓ | ✓ |
| `--kiddo-evergreen` | 11.5 : 1 | ✓ | ✓ | ✓ |
| `--kiddo-evergreen-deep` | 14.8 : 1 | ✓ | ✓ | ✓ |
| `--kiddo-muted` | **4.37 : 1** | ✗ | ✓ | ✗ |
| `--muted-foreground` | **4.07 : 1** | ✗ | ✓ | ✗ |
| `--kiddo-gold` | **2.93 : 1** | ✗ | **✗** | ✗ |
| `--kiddo-gold-light` | 1.59 : 1 | ✗ | ✗ | ✗ |

## Issues found

### Issue 1: muted text fails AA normal body

`--kiddo-muted` and `--muted-foreground` are both ~4 to 4.4 : 1 on the
cream background, just below the AA threshold of 4.5 for normal body
text. These tokens are used heavily across the app for secondary text:
helper copy, captions, "since [date]" lines, gift sender attributions,
metadata pills, the description line under every notification row, the
sidebar footer text. Conservatively, this affects 30+ surfaces.

**Why this matters:** App Store accessibility review reads this as a
genuine failure (a real customer with low vision can't comfortably read
the secondary copy). The "marginal pass" is not a pass.

**Fix options, in order of brand impact:**

1. **Darken muted to ~#666058** (approx HSL 32 7% 38%). Contrast lands
   at ~5.5 : 1, comfortably AA normal. Brand still reads as muted (it's
   a 6% lightness shift, perceptually small). One-line change in
   `index.css`.

2. **Two-token system: keep current muted for ornamental captions, add
   `--kiddo-muted-strong` (~#5C564E, ~6.8 : 1) for body secondary text.**
   More surgical but requires touching every secondary text site.

3. **Don't fix, accept AA large only.** Means committing to never using
   muted on text smaller than 18px regular / 14px bold. Hard to enforce
   long term; not recommended.

**Recommendation: Option 1.** Lowest cost, brand-preserving, fixes every
site at once.

### Issue 2: gold text fails AA, including large

`--kiddo-gold` (#C5821E) at 2.93 : 1 fails AA for both normal AND large
text. Gold is used as:
- Highlight text on the love-mark pill (gift_received notifications,
  milestone callouts)
- The "balance flash" animation color
- The Kiddo+ tier accent in the upgrade ladder
- The wax-seal accent border
- Potentially Plus-tier "Needs your attention" action-item card border

**Where it's safe today:**
- Gold as a **background fill** with white text on top (the action-item
  Fix button uses `bg-[hsl(var(--kora-gold))] text-white`). White on
  gold computes to ~3.46 : 1, fails AA normal, marginal pass AA large.
  Buttons typically use 13-14px bold, which clears AA large.
- Gold as a **non-text accent** (border, glow, halo, icon stroke). No
  contrast requirement.

**Where it's NOT safe:**
- Gold as text color on cream backgrounds. Currently appears in some
  notification labels and milestone copy. Has to either darken or move
  to a background-fill treatment.

**Fix options:**

1. **Use evergreen text on gold backgrounds, gold only for non-text
   accents.** Honors the brand identity (gold stays prominent) without
   asking the gold to do contrast work it can't do. This is the
   discipline most fintech apps with brand-yellow palettes use (Mint,
   YNAB, Robinhood circle their yellow with white containers).

2. **Add a darker gold token `--kiddo-gold-deep` (~#A6651A) for text
   use.** Computes to ~4.6 : 1, just over AA. Keeps gold-as-text
   possible at the cost of a second token. Use existing gold for fills.

**Recommendation: Option 1 + audit current gold-text usages and convert
them to evergreen-on-gold-fill.** Cleaner brand discipline. The darker
token in Option 2 starts to drift from the warm gold feel.

## Surfaces NOT audited

This pass covered the brand palette text tokens against the primary
background. Not audited yet:

- Gold-light (#EDC164) backgrounds with text on top
- Dark mode (the codebase has dark mode CSS but it's not actively
  surfaced; punt to a separate audit when dark mode ships)
- Chart colors (`--chart-1` through `--chart-5`). Relevant for the
  Dashboard AreaChart, projection rate-band lines, and the holdings
  pie if it ever returns.
- Focus rings (most use evergreen at 10% opacity; could fail visibility
  on light backgrounds)
- Status colors used in action-item cards (advisory vs blocking
  treatment)
- Mobile-specific colors (the React Native side may diverge)

## Recommended next audit

Once Option 1 above ships (muted darkening), re-run the full pair grid
including:
- Dark-mode pairs
- Chart palette pairs against both light and dark backgrounds
- APCA Lc values via `apca-w3` for parity with modern tooling

The Wise team rebuilt their color system to pass APCA, not just WCAG.
For a 2027 brand audit that's the right standard. For 2026 App Store
submission, WCAG 2.x is what reviewers run.

## Re-audit checklist (do this before any palette change)

1. Compute the HSL → sRGB → linear luminance Y for the new token.
2. Compute contrast ratio Y_lighter+0.05 / Y_darker+0.05 against
   every other token it might pair with.
3. Check both 4.5 (AA normal) and 3.0 (AA large) thresholds.
4. Verify the new token doesn't break any existing component (run
   visual diff or eyeball on dashboard / memory book / notifications).
5. Update this doc with the new row.
