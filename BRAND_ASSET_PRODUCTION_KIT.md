# Kiddo Brand Asset Production Kit

The executable brief for the assets [BRAND_IDENTITY.md](./BRAND_IDENTITY.md) calls
for. Hand this to a designer or paste the prompts into an image model. Everything
here is specified so the output is *coherent with what already ships*, not a new
look. Nothing in here invents new brand decisions; it produces the assets the
identity doc already decided on.

## The locked inputs (do not deviate)

**Palette (the three-color lock):**
- Evergreen `#1B3A2D` (primary, tiles, the character's body)
- Evergreen-deep `#0E2518` (gradient end only)
- Gold `#C5821E` (CTA fill / decorative; never gold for body text)
- Gold-light `#EDC164` (the sprout on dark; the "warm highlight" gold)
- Cream `#F8F5F0` (backgrounds)
- Ink `#1A1710` (text)
- Three-color lock: evergreen + gold + cream. Everything else derives. No new hues.

**Type:** DM Sans (body), Bricolage Grotesque (headings, -0.2 tracking). Not for
the image assets themselves, but for any lockup that pairs the mark with the word.

**Hard don'ts (enforced by `script/lint-content.cjs` in code; honor them in art):**
- No Sparkles / sparkle iconography. (Remove the one in the planting render.)
- No em-dashes in any baked-in copy.
- No glossy "AI 3D blob" default styling on the *flat* assets (the whole point).
- No new colors, no gradients-as-crutch, no drop-shadow soup.

## Asset 1 — the sprout glyph (DONE; reference for everything else)

Already shipped as `client/public/sprout-glyph.svg` and `<SproutGlyph>`. Gold
(`#EDC164`) sprout, three leaves plus stem, on an evergreen `#1B3A2D` rounded tile
(corner radius ~22%). This is the geometric DNA every other asset inherits. If a
designer retunes the leaf curves, update both the SVG and the component together.

Forms needed (the script `node script/gen-brand-icons.mjs --all` produces the
raster sizes from the vector):
- `favicon.svg` (done), `favicon.png` 32 (done)
- `apple-touch-icon.png` 180, `icon-192.png`, `icon-512.png` (gated on founder
  approving the full app-icon swap)
- `favicon.ico` multi-size (regenerate separately; sharp does not write .ico)

## Asset 2 — the flat 2D character sprite (commission)

The atomic-fidelity version of the mascot: the *same creature* as the 3D render,
redrawn flat so it survives at sticker / small sizes and sheds the AI-blob tell.

**Spec:**
- Flat vector, solid fills, minimal or no gradients. Clean outline allowed if it
  stays legible at 48px.
- Body: evergreen `#1B3A2D`. Sprout on head: gold `#EDC164`, matching the glyph's
  three-leaf shape exactly (this is what ties sprite to favicon).
- Face: minimal, warm, two dot eyes plus a soft mouth. Expressive without words.
  Emotion range only: celebration, encouragement, curiosity, empathy.
- Readable as a 64px sticker and a 512px hero alike.
- Deliver as SVG plus a 1024px PNG, transparent background.

**Image-model prompt (starting point):**
> Flat vector mascot illustration, a small rounded character with a deep evergreen
> (#1B3A2D) body and a gold (#EDC164) three-leaf sprout growing from the top of its
> head, simple friendly face with two dot eyes and a soft smile, holding a small
> wrapped gift, solid flat colors, minimal shading, clean even line weight,
> centered, transparent background, modern premium brand-mascot style, NOT glossy
> 3D, NO sparkles, NO text. Warm and trustworthy, not childish.

Produce a tight sheet of the same character in the four emotions (celebration /
encouragement / curiosity / empathy), identical construction, only the face and
arms changing.

## Asset 3 — the gift-message sticker set (commission)

The viral payload. These ride the gifter loop into other people's phones, so they
are the single highest-leverage recognition asset. 4 to 6 stickers, each built
from the flat sprite (Asset 2) plus the gold glyph.

Suggested set, all on transparent background, ~512px:
1. Character holding a wrapped gift (the core).
2. Character planting a gold coin into soil with a sprout coming up (the metaphor).
3. The bare sprout glyph "growing" with a small gold motion arc (a watermark/seal).
4. Character peeking with a heart (warmth, for a note).
5. Character cheering (milestone / celebration).
6. A simple "+$" gold pill with the sprout (a value-arrival stamp).

Every sticker must carry the gold sprout somewhere, so even cropped it reads Kiddo.
No text baked in (copy lives in the message). No Sparkles.

## Asset 4 — the share / OG image (rebuild + cleanup)

- Delete the stale-name leftovers: `client/public/kado-og-image.png` and
  `client/public/kora-og-image.png` (the live one is `kiddo-og-image.png`).
- Rebuild the OG image to lead with the recognition assets: the gift moment (a
  "Sofia added $75 to Mia's future" card) plus the sprout glyph, on cream, with
  the evergreen wordmark. It should be screenshot-of-the-product honest, not stock.

## Asset 5 — the app-icon set decision (founder picks one)

Pick a single atomic mark and commit:
- **Option A (recommended):** sprout glyph everywhere (favicon + full app-icon set).
  Run `node script/gen-brand-icons.mjs --all`, regenerate `favicon.ico`, retire the
  K monogram. Maximum unmistakability; one shape across every glimpse.
- **Option B:** keep the K monogram as the wordmark/app lockup, sprout as the
  favicon + character motif. Lower disruption, but you stay split at the app-icon
  level (the thing we just diagnosed). Only choose this if you love the K mark.

## Quality bar

Judge every asset on one question from BRAND_IDENTITY.md: *cropped to a corner,
does it still say Kiddo?* If the gold sprout is present and the construction is
clean, yes. If it could be any cute startup, redo it. Best of the best, or do not
ship it.
