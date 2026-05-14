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
> Still open: 5-6 surfaces use `--kora-gold` for text (vs icons or
> backgrounds) in contexts that would benefit from gold-ink
> migration:
> - `client/src/components/ActionItemCard.tsx:93` (icon-as-text on
>   gold-tinted circle; icons have looser WCAG requirements)
> - `client/src/components/ui/premium-list-item.tsx:79+164` (avatar
>   wrappers; same icon-vs-text consideration)
> - `client/src/components/ui/live-ticker.tsx:268+293` (decorative
>   animation moment on dark evergreen background; gold-light
>   would be the right migration target here, not gold-ink)
> - `client/src/components/ui/share-kit.tsx:366` (Sparkles icon)
> - `client/src/pages/ActivityDetail.tsx:48+224` (Gift icon + chat
>   icon; same icon consideration)
>
> Decision: leave icon usages as-is (looser WCAG threshold for
> non-text); the live-ticker decorative case needs the gold-light
> alternative not gold-ink. The audit closes on "text on cream/tinted-
> gold" coverage being fixed.

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
