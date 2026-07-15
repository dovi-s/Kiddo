# Demo audio assets — Sofia Rivera voice memos

Files expected here for the Rivera demo to render Sofia's voice-memo
gifts. Set the `DEMO_AUDIO_ENABLED=1` env var when running the seed
(or the nightly reset) to wire these URLs onto the seeded memory
entries; without the flag, Sofia's entries stay text-only.

## Required files

| File | Used by | Approximate spoken script |
|---|---|---|
| `gloria-haley.mp3` | Sofia → Mia gifts | "Mi amor Mia, never forget your familia. Te amo, mi nieta." |
| `gloria-alex.mp3` | Sofia → Nora gifts | "Para ti, Nora. Con todo mi amor. Read the prospectus, mi vida." |
| `gloria-luke.mp3` | Sofia → Theo gifts | "Mi Theo. Be brave, be smart, be Rivera." |

The exact script can vary — these are guidelines, not requirements.
The Spanish-language inflection matters more than the literal words.

## File spec

- Format: MP3, 128 kbps, mono is fine
- Length: under 30 seconds per file (these are voice memos, not
  podcasts)
- Loudness: -16 LUFS roughly (matches typical phone-recorded memo
  loudness; loud enough to be heard on a laptop, not jarring when
  the page autoplays the player UI)
- File size budget: under 500 KB each (3 files × 500 KB = 1.5 MB
  added to the production bundle, acceptable for a demo asset)

## How to record

Quickest path is Fiverr — a Latina voice actor with a soft, motherly
delivery. Search "Spanish voiceover grandmother" or "abuela voiceover."
Typical cost: $15–30 for all three short clips.

Alternative: a real person in the user's network records on their phone.
Quality difference vs Fiverr is small for clips this short.

## Enabling

Once files are in this directory:

```bash
# Re-seed with audio
DEMO_AUDIO_ENABLED=1 npm run reset:dunphys
```

Or set `DEMO_AUDIO_ENABLED=1` in the Render env vars and wait for the
next nightly reset to pick up the change.

## Why gated behind a flag

Without the audio files present, the player UI would render a working
control that 404s on play — worse UX than no player at all. The flag
ensures the seed only writes `audioUrl` values when production has
the assets to serve.

## Legal note

The Rivera family is an original, fictional cast. Any voice memos
recorded for the demo (e.g. "Sofia Rivera") should be an original
delivery, not an impression of any real performer. Keeps the demo on
the right side of the publicity-rights line.
