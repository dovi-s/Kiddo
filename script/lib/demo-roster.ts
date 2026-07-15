// The Rivera demo "story" data — pure, DB-free, single source of truth.
//
// Both the seed (script/seed-dunphys.ts, writes to Postgres) and the offline
// tuning/test harness (script/demo-portfolio-report.ts, no DB) import this, so
// the casting/notes/amounts that drive the demo can be verified and tuned
// without a database.
//
// DESIGN PRINCIPLES (the demo is the tutorial — users imitate what they see):
//   • Notes are SHORT, warm, and UNSIGNED. The Memory Book card already shows
//     the sender's name, so signing ("— Cam") is redundant AND teaches real
//     gifters they must perform. Many gifts have NO note at all — modeling
//     "drop $25, one line or nothing, done" (the low-friction behavior the
//     gifter loop lives on).
//   • Real ANONYMOUS / one-off long-tail givers (coworkers, neighbors, a
//     godparent, "a friend") with odd amounts and usually no note — funds that
//     have been used for years collect a long tail, not a tidy cast of 7.
//   • Notes VARY per kid (no verbatim paragraph repeated across siblings — a
//     demo explorer hops between funds and would spot the template).
//   • Aspiration comes from the TOTAL, not the per-gift size. Small gifts
//     ($20–$100) + real historical compounding = an impressive balance.
//   • Gifts CLUSTER on occasions (birthday month, December holidays,
//     graduation), the way real giving actually spikes.

export type GiftSpec = {
  senderName: string;
  senderEmail?: string; // family have accounts; one-off long-tail givers don't
  amount: number;
  selectedTicker?: string; // single-stock pick; undefined = managed mix (auto-invest)
  message?: string; // undefined/empty = no note (intentionally common)
  hasAudio?: boolean;
  createdAt: string; // ISO
  // "recurring" = a Marcus auto-invest cycle; "parent_one_time" = a Marcus one-off
  // top-up (his own money, NOT an external gift — no self-thank-you).
  kind?: "recurring" | "parent_one_time";
  isAnonymous?: boolean; // explicit privacy flag (never inferred from name)
  // Tags the gift to a gifting occasion so the Memory Book's occasions strip
  // groups it (e.g. "Birthday · N gifts"). Only true GIFTING occasions —
  // NOT fund savings-goals like College Fund, whose dashboard progress is the
  // whole fund and would clash with a gift-attribution total.
  occasion?: "birthday" | "holiday";
};

export type KidStory = {
  firstName: string;
  ageYears: number;
  birthdate: string; // YYYY-MM-DD
  recurringAmount: number;
  recurringPaused: boolean;
  pronoun: "he" | "she" | "they";
  majorityAge: number;
  strategy: "growth" | "balanced" | "conservative";
};

// ── date helpers (deterministic; no Math.random) ──────────────────────────
// Deterministic, VARIED time-of-day so seeded entries don't all inherit one
// clock time (isoYearsMonthsAgo used to carry the reset-run's exact time — e.g.
// "3:40 AM" on every Memory Book row; onMonth hardcoded noon). Spread across a
// realistic 8am–8pm UTC window, ordered by the entry's own params so it stays
// reproducible run-to-run. Only the time-of-day varies; the date is untouched.
//
// ONE frozen clock for the whole seed run. Every relative date derives from this
// single instant, so a long reseed that happens to cross a UTC midnight can't
// split cycles across two calendar days (the [8,9] artifact). Exported so
// seed-dunphys anchors the failure + next-run to the exact same "now".
export const SEED_NOW = new Date();

function seededClock(seed: number): { h: number; m: number; s: number } {
  const n = Math.abs(Math.round(seed));
  return { h: 8 + ((n * 7 + 3) % 13), m: (n * 17 + 29) % 60, s: (n * 31 + 7) % 60 };
}

function isoYearsMonthsAgo(yearsAgo: number, monthsAgo = 0): string {
  // Build entirely in UTC (like onMonth below). The old version mixed local
  // get/setFullYear/setMonth with setUTCHours, so across a DST boundary the
  // calendar DAY rolled for some months (a monthly cycle landing on the 8th in
  // summer but the 9th in winter) and pushed the "Started" stat off by a day.
  // Pure Date.UTC pins every cycle to the same day-of-month. Date.UTC normalizes
  // a negative month by rolling the year back, so month subtraction is safe.
  const now = SEED_NOW;
  const { h, m, s } = seededClock(yearsAgo * 13 + monthsAgo * 7 + 1);
  return new Date(Date.UTC(
    now.getUTCFullYear() - yearsAgo,
    now.getUTCMonth() - monthsAgo,
    now.getUTCDate(),
    h, m, s,
  )).toISOString();
}

// Pin an occasion gift to a specific calendar month `yearsAgo` years back,
// guaranteeing a past date (if this year's occurrence is still in the future,
// step back one more year). `day` varies per gifter so same-month gifts get
// distinct, deterministically-ordered timestamps.
function onMonth(yearsAgo: number, month: number, day = 15): string {
  const now = SEED_NOW;
  const thisYear = new Date(Date.UTC(now.getUTCFullYear(), month, day, 12, 0, 0));
  const anchorYear = thisYear.getTime() > now.getTime() ? now.getFullYear() - 1 : now.getFullYear();
  const { h, m, s } = seededClock(yearsAgo * 400 + month * 31 + day);
  return new Date(Date.UTC(anchorYear - yearsAgo, month, day, h, m, s)).toISOString();
}

// Pick from a rotating list, OFFSET per kid so the most-recent entry differs
// across siblings (kills the "same note on every kid" tell). Empty string =
// deliberately no note.
function rotate(list: string[], index: number, kidOffset: number): string {
  return list[(index + kidOffset) % list.length];
}

// A small per-kid offset derived from the name so rotations diverge.
// NOT mod 7: the old per-step (h+c)%7 hash collapsed to charSum%7, and by
// coincidence "Mia"(499), "Nora"(394), "Theo"(401) are ALL ≡ 2 mod 7 —
// every kid got the same offset and the anti-template rotation was a no-op
// for the exact three names it was built for. charSum%8 gives 3/2/1.
function kidOffset(firstName: string): number {
  let h = 0;
  for (const ch of firstName) h += ch.charCodeAt(0);
  return h % 8;
}

// ── the schedule ──────────────────────────────────────────────────────────
export function giftsForKid(kid: KidStory): GiftSpec[] {
  const list: GiftSpec[] = [];
  const age = kid.ageYears;
  const off = kidOffset(kid.firstName);
  const birthMonth = Number(kid.birthdate.slice(5, 7)) - 1;
  // The fund was opened around age 4 (the first gift). Cap the lookback at 18
  // years so the oldest gift stays inside the price fixture (2005+) and reads
  // as "started when they were little," not "at birth."
  const fundAge = Math.min(Math.max(age - 4, 1), 18);

  // Sofia (Abuela) — annual DIS birthday from age 4, voice memo. Effusive,
  // bilingual, gender-neutral Spanish (no mijo/mija on a shared list), NEVER
  // signed. Several years just the voice memo, no written note.
  const gloriaNotes = [
    "feliz cumpleaños mi amor!! te amo te amo ❤",
    "",
    "para tu futuro mi vida. besos",
    "",
    "abuela te quiere muchisimo",
    "",
    "llamame ok? te amo",
    "",
  ];
  for (let a = 0; a < fundAge; a++) {
    list.push({
      senderName: "Sofia Rivera",
      senderEmail: "sofia@riverafamily.com",
      // `a` counts years AGO (a=0 is the most recent birthday), so the
      // amount must DECREASE with `a` for her gift to grow as the kid ages.
      // The old `a < 6 ? 75 : ... : 125` read backwards: $125 to a
      // five-year-old, $75 to a near-adult.
      amount: a < 6 ? 125 : a < 11 ? 100 : 75,
      selectedTicker: "DIS",
      message: rotate(gloriaNotes, a, off) || undefined,
      hasAudio: true,
      occasion: "birthday",
      createdAt: onMonth(a, birthMonth, 12),
    });
  }

  // Cam (Uncle) — annual DIS birthday from age 4. Warm, a little theatrical but
  // real, never signed, mostly blank.
  const camNotes = [
    "happy birthday!! 🎉",
    "",
    "more Disney money, obviously 😄",
    "",
    // The signature love-mark — quoted on /demo and in DUNPHY_DEMO_SPEC.md,
    // so it must actually exist in every kid's book (all three funds are old
    // enough to cycle the full rotation).
    "because magic is always a good investment",
    "",
    "don't tell David i went bigger this year",
    "",
  ];
  for (let a = 0; a < fundAge; a++) {
    list.push({
      senderName: "Chris Bennett",
      senderEmail: "chris@riverafamily.com",
      // Same years-ago direction as Sofia: grows toward the present.
      amount: a < 6 ? 100 : 75,
      selectedTicker: "DIS",
      message: rotate(camNotes, a, off) || undefined,
      occasion: "birthday",
      createdAt: onMonth(a, birthMonth, 20),
    });
  }

  // David (Uncle) — annual AAPL birthday from age 5. The brief one; mostly
  // no note at all.
  // David (Uncle) — annual AAPL birthday from age 5. Dry, terse, mostly
  // nothing at all.
  // No "kiddo" in gift notes — on a product literally named Kiddo it reads
  // as planted branding, not a real uncle.
  const mitchNotes = ["", "Happy birthday.", "", "", "Apple again. you'll thank me.", "", "another year, another share.", ""];
  for (let a = 0; a < fundAge; a++) {
    list.push({
      senderName: "David Rivera",
      senderEmail: "david@riverafamily.com",
      amount: 60,
      selectedTicker: "AAPL",
      message: rotate(mitchNotes, a, off) || undefined,
      occasion: "birthday",
      createdAt: onMonth(a, birthMonth, 6),
    });
  }

  // Robert (Grandpa) — a bigger GOOGL gift every ~3 years (birthday or Christmas).
  // Spaced out so the fund isn't dominated by one stock — relatives give
  // occasionally, the managed mix is the backbone. Terse, warm, unsigned.
  // Robert (Grandpa) — gruff, old-school, brief. Sometimes signs "Grandpa".
  const jayNotes = ["Happy birthday.", "Merry Christmas. Grandpa", "Proud of you, kid.", "", "Buy low. Grandpa"];
  for (let a = 1; a < fundAge; a += 3) {
    // The date must follow the ROTATED message, not the raw index — the old
    // `idx === 1` check ignored the kid offset, which stamped "Merry
    // Christmas. Grandpa" onto birthday-month gifts.
    const msg = rotate(jayNotes, (a - 1) / 3, off) || undefined;
    const isChristmas = !!msg && msg.startsWith("Merry Christmas");
    // Robert's FIRST (oldest) gift went into the diversified managed mix —
    // old-school "don't put it all in one basket" — and his LATER gifts are
    // his signature GOOGL picks. Gives his gifter dashboard a realistic
    // "Managed mix · Google" strip instead of a lone Google logo, and is the
    // one place the managed-mix pill gets exercised on that surface. Keeps the
    // other gifters' single-stock signatures intact (Sofia→DIS, etc.).
    // 2026-06-05.
    const jayManagedMix = a === 1;
    list.push({
      senderName: "Robert Rivera",
      senderEmail: "robert@riverafamily.com",
      amount: 200,
      selectedTicker: jayManagedMix ? undefined : "GOOGL",
      message: jayManagedMix ? "Don't put it all in one basket, kid. Grandpa" : msg,
      createdAt: isChristmas ? onMonth(a, 11, 22) : onMonth(a, birthMonth, 25),
      // Grandpa's "Merry Christmas" gifts cluster into the Holiday occasion; his
      // birthday-month gifts stay in the main fund (unchanged).
      occasion: isChristmas ? "holiday" : undefined,
    });
  }

  // Leo (step-uncle, young) — small RBLX gifts, recent only (RBLX IPO'd
  // Mar 2021, and Leo only started gifting recently). Cocky but short.
  // Leo (step-uncle, precocious teen) — RBLX, recent only. Dry, a little
  // pompous, short.
  const mannyNotes = ["you're welcome.", "", "invest it, don't blow it"];
  if (age >= 10) {
    list.push({
      senderName: "Leo Rivera",
      senderEmail: "leo@riverafamily.com",
      amount: 50,
      selectedTicker: "RBLX",
      message: rotate(mannyNotes, 0, off) || undefined,
      createdAt: isoYearsMonthsAgo(0, 2),
    });
    if (age >= 12) {
      list.push({
        senderName: "Leo Rivera",
        senderEmail: "leo@riverafamily.com",
        amount: 50,
        selectedTicker: "RBLX",
        message: rotate(mannyNotes, 1, off) || undefined,
        createdAt: isoYearsMonthsAgo(1, 6),
      });
    }
  }

  // Marcus (Dad) — the recurring auto-investor ("shows up every month"). Managed
  // mix, no ticker. Modeled as one gift per monthly cycle; the seed links these
  // to the parent_contribution and stamps the Memory Book ONCE (first cycle).
  // The mix backbone: Elena (lead custodian) auto-invested for years. Active
  // funds run through last month; paused ones (near/after handoff) stopped a few
  // months back.
  // Note varies per kid (the seed supplies the single first-cycle note).
  // Active funds start at offset 0 (most recent cycle = CURRENT month) so a
  // freshly-seeded demo's default "Last 30 days" money summary actually shows
  // "You added" — at offset 1 the latest contribution landed ~31 days back,
  // just outside the window, and an active monthly contributor read as $0.
  // Paused/handed-off funds stay at offset 3 (stopped a few months back).
  // Theo carries the seeded "charge missed" (added in seed-dunphys). A monthly
  // plan can't both succeed AND fail in the same month, so Theo's most recent
  // SUCCESS is last month (offset 1), leaving THIS month open for the failed
  // charge on the same cadence day. His "You added (30 days)" therefore reads $0,
  // which is the honest consequence of a missed charge, not a bug. Every other
  // active kid stays at offset 0 (a success this month, so their 30-day summary
  // shows "You added").
  const recurringStartOffset = kid.recurringPaused ? 3 : (kid.firstName === "Theo" ? 1 : 0);
  const recurringCycles = (kid.recurringPaused ? Math.min(fundAge, 14) : Math.min(fundAge, 7)) * 12;
  for (let i = 0; i < recurringCycles; i++) {
    list.push({
      // The recurring backbone is the LEAD custodian's (Elena, post-2026-06-11
      // role flip — moms are the day-to-day primary user). This is what makes the
      // viewer's "Your part of {kid}'s story · N investments over Y years" line
      // AGREE with the active $100/month schedule: the cycles count toward the
      // viewer's own total instead of being credited to the co-parent. Marcus
      // (co-parent) keeps his signed one-time top-ups below.
      senderName: "Elena Rivera",
      senderEmail: "elena@riverafamily.com",
      amount: kid.recurringAmount,
      message: undefined, // the seed supplies the single first-cycle note
      createdAt: isoYearsMonthsAgo(0, recurringStartOffset + i),
      kind: "recurring",
    });
  }

  // Marcus (Dad, co-parent) — occasional ONE-TIME top-ups on top of Elena's
  // monthly recurring, the way a real engaged co-parent does (a birthday extra,
  // a good-bonus month). Signed "dad" — these stay his.
  // Single-stock picks (so the dashboard's "one-time investment" card shows a
  // logo + "now worth"), his own money (kind parent_one_time → not an external
  // gift). Most recent is RECENT for active funds (shows fresh + in the 30-day
  // breakdown); for paused/handed-off funds the top-ups predate the handoff.
  // ticker set → a real-company pick (must be in shared/stock-picks.ts — the
  // managed-mix ETFs VTI/VXUS/BND are NOT pickable and must never appear here,
  // or the demo manufactures an "impossible" pick the real product would reject
  // and the dashboard splits it confusingly out of the managed mix). ticker
  // omitted → the gift goes into the managed mix, where a parent's "little
  // extra" realistically lands.
  const parentOneTimes: Array<{ amount: number; ticker?: string; message?: string; yearsAgo: number; monthsAgo: number }> =
    kid.recurringPaused
      ? [
          { amount: 200, ticker: "AAPL", message: "proud of you. a little extra for the fund. dad", yearsAgo: 1, monthsAgo: 4 },
          { amount: 150, message: "bonus came through, adding a bit. dad", yearsAgo: 3, monthsAgo: 0 },
          { amount: 250, ticker: "GOOGL", message: "big year. added a bit more. dad", yearsAgo: 5, monthsAgo: 0 },
        ]
      : [
          { amount: 200, ticker: "AAPL", message: "adding a little extra this month bud. dad", yearsAgo: 0, monthsAgo: 1 },
          { amount: 150, message: "good bonus this year, threw some in. dad", yearsAgo: 1, monthsAgo: 5 },
          { amount: 200, ticker: "AAPL", yearsAgo: 3, monthsAgo: 0 },
        ];
  for (const p of parentOneTimes) {
    if (p.yearsAgo > fundAge) continue; // never predate the fund
    list.push({
      senderName: "Marcus Rivera",
      senderEmail: "marcus@riverafamily.com",
      amount: p.amount,
      selectedTicker: p.ticker,
      message: p.message,
      createdAt: isoYearsMonthsAgo(p.yearsAgo, p.monthsAgo),
      kind: "parent_one_time",
    });
  }

  // ── Per-kid personality picks ──────────────────────────────────────────
  // The family gifters above give their SIGNATURE stock to every grandkid
  // (Sofia/Cam → Disney, David → Apple, Robert → Google, Leo → Roblox), so
  // without this every fund's "What {kid} owns" looks identical. These are the
  // picks that make each kid's holdings feel like THEM, drawn from the wider
  // catalog (shared/stock-picks.ts): Marcus's own one-time buys in the thing each
  // kid is into. IPO-constrained tickers are dated RECENT so the seed always
  // finds a real price (allocateGift throws on a pre-IPO date) — DUOL IPO'd
  // Jul 2021, SPOT Apr 2018; NTDOY/MCD/AMZN/NFLX/NKE/SBUX have deep history.
  // Every ticker is a pickable single stock, never an index ETF.
  const personalityPicks: Array<{ amount: number; ticker: string; message?: string; yearsAgo: number; monthsAgo: number }> =
    kid.firstName === "Theo" // the gamer
      ? [
          { amount: 100, ticker: "NTDOY", message: "you basically live on this thing, might as well own a piece. dad", yearsAgo: 8, monthsAgo: 0 },
          { amount: 50, ticker: "MCD", yearsAgo: 4, monthsAgo: 1 },
        ]
      : kid.firstName === "Nora" // ambitious, college-bound
        ? [
            { amount: 150, ticker: "AMZN", message: "for the future business major. dad", yearsAgo: 5, monthsAgo: 2 },
            { amount: 100, ticker: "NFLX", yearsAgo: 7, monthsAgo: 0 },
            { amount: 75, ticker: "DUOL", message: "your spanish streak inspired this one. dad", yearsAgo: 4, monthsAgo: 0 },
          ]
        : kid.firstName === "Mia" // graduated, her own taste
          ? [
              { amount: 150, ticker: "NKE", yearsAgo: 14, monthsAgo: 0 },
              { amount: 100, ticker: "SBUX", message: "your second home. dad", yearsAgo: 9, monthsAgo: 0 },
              { amount: 100, ticker: "SPOT", yearsAgo: 2, monthsAgo: 4 },
            ]
          : [];
  for (const p of personalityPicks) {
    if (p.yearsAgo > fundAge) continue; // never predate the fund
    list.push({
      senderName: "Marcus Rivera",
      senderEmail: "marcus@riverafamily.com",
      amount: p.amount,
      selectedTicker: p.ticker,
      message: p.message,
      createdAt: isoYearsMonthsAgo(p.yearsAgo, p.monthsAgo),
      kind: "parent_one_time",
    });
  }

  // Elena (Mom) — occasional managed-mix add, short or blank, never signed.
  // (No "miss you!" — it rotates onto Theo's fund too, and he's 13 and lives
  // at home.)
  const claireNotes = ["❤", "", "love you sweetheart", "", "for college. or whatever you choose"];
  let cIdx = 0;
  for (let m = 6; m < fundAge * 12; m += 16) {
    list.push({
      senderName: "Elena Rivera",
      senderEmail: "elena@riverafamily.com",
      amount: 100,
      message: rotate(claireNotes, cIdx++, off) || undefined,
      createdAt: isoYearsMonthsAgo(Math.floor(m / 12), m % 12),
    });
  }

  // ── The long tail: anonymous & one-off givers ──────────────────────────
  // Funds used for years collect givers beyond the core family — coworkers,
  // neighbors, a godparent, "a friend." Mostly managed mix, odd amounts,
  // usually NO note, clustered on occasions. Count scales with the fund's age.
  // These have NO senderEmail (they're not app users — gifts store the name
  // directly), and several are truly anonymous.
  const longTail: Array<{ name: string; amount: number; message?: string; yearsAgo: number; month: number; day: number; ticker?: string }> = [
    { name: "Auntie Sarah", amount: 100, message: "happy birthday from your godmother ❤", yearsAgo: Math.max(1, age - 4), month: birthMonth, day: 14 },
    { name: "The Johnsons", amount: 50, yearsAgo: Math.max(1, age - 7), month: 11, day: 18 },
    { name: "Aunt Pam", amount: 30, message: "Happy birthday!!", yearsAgo: Math.max(1, age - 9), month: birthMonth, day: 16 },
    { name: "Marcus's office", amount: 100, message: "from the whole office! 🎉", yearsAgo: Math.max(0, age - 11), month: 11, day: 20 },
    { name: "Anonymous", amount: 20, yearsAgo: Math.max(0, age - 5), month: birthMonth, day: 13 },
    { name: "The Nguyens next door", amount: 25, yearsAgo: Math.max(0, age - 6), month: birthMonth, day: 17 },
    { name: "Uncle Joe", amount: 40, yearsAgo: Math.max(1, age - 8), month: 11, day: 23 },
    { name: "Helen Park", amount: 50, message: "thinking of you on your birthday", yearsAgo: Math.max(0, age - 3), month: birthMonth, day: 19 },
    { name: "Grandpa's friend Earl", amount: 30, yearsAgo: Math.max(1, age - 10), month: birthMonth, day: 11 },
    { name: "The book club", amount: 60, yearsAgo: Math.max(0, age - 2), month: 11, day: 19 },
    { name: "Coach Mike", amount: 25, message: "great season. proud of you", yearsAgo: Math.max(0, age - 4), month: 8, day: 9 },
    { name: "Anonymous", amount: 35, yearsAgo: Math.max(0, age - 1), month: birthMonth, day: 21 },
  ];
  // Older funds show more of the tail (longer life = more one-offs).
  const tailCount = age >= 18 ? longTail.length : age >= 14 ? 9 : 5;
  for (let i = 0; i < tailCount; i++) {
    const t = longTail[(i + off) % longTail.length];
    list.push({
      senderName: t.name,
      amount: t.amount,
      selectedTicker: t.ticker,
      message: t.message,
      isAnonymous: t.name === "Anonymous",
      createdAt: onMonth(Math.min(fundAge, t.yearsAgo), t.month, t.day),
      // December (month 11) one-offs are holiday gifts → the Holiday occasion.
      occasion: t.month === 11 ? "holiday" : undefined,
    });
  }

  // Graduation cluster for the older kids (the real occasion spike at ~18).
  if (age >= 18) {
    const gradYearsAgo = age - 18;
    list.push({ senderName: "Robert Rivera", senderEmail: "robert@riverafamily.com", amount: 250, selectedTicker: "GOOGL", message: "Congrats kid. Grandpa", createdAt: onMonth(gradYearsAgo, 5, 14) });
    list.push({ senderName: "The Johnsons", amount: 75, message: "CONGRATS GRAD!! 🎓", createdAt: onMonth(gradYearsAgo, 5, 16) });
    list.push({ senderName: "Auntie Sarah", amount: 100, createdAt: onMonth(gradYearsAgo, 5, 17) });
  }

  // A FRESH gift, ~2 days ago, so the newest activity isn't months old and the
  // "a gift just came in" moment has a real top-of-feed entry. Pronoun/ticker
  // per kid; short unsigned note.
  const fresh: Record<string, { senderName: string; senderEmail: string; amount: number; ticker: string; message?: string; hasAudio?: boolean }> = {
    Mia: { senderName: "Sofia Rivera", senderEmail: "sofia@riverafamily.com", amount: 75, ticker: "DIS", message: "pensando en ti hoy mi amor ❤ llamame", hasAudio: true },
    Nora: { senderName: "Robert Rivera", senderEmail: "robert@riverafamily.com", amount: 250, ticker: "GOOGL", message: "Almost there, kid. Grandpa" },
    Theo: { senderName: "Leo Rivera", senderEmail: "leo@riverafamily.com", amount: 50, ticker: "RBLX" },
  };
  const f = fresh[kid.firstName];
  if (f) {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    list.push({ senderName: f.senderName, senderEmail: f.senderEmail, amount: f.amount, selectedTicker: f.ticker, message: f.message, hasAudio: f.hasAudio, createdAt: d.toISOString() });
  }

  return list;
}

// The per-kid recurring note (varies per kid; the seed stamps it once on the
// first cycle). Elena's voice — the recurring backbone is the lead custodian's
// (see the recurring block above), so this note is signed "mom".
export function recurringNoteFor(kid: { firstName: string }): string {
  const byName: Record<string, string> = {
    Theo: "a little every month, like clockwork. love you bug. mom",
    Nora: "every month, same as always. so proud of you. mom",
    Mia: "a little every month, all these years. love, mom",
  };
  return byName[kid.firstName] ?? `a little every month. mom`;
}

// The co-parent (Elena) timeline note — varies per kid (no verbatim repeat).
export function momNoteFor(kid: { firstName: string }): string {
  const byName: Record<string, string> = {
    Theo: "you're getting so big i can't stand it. love you bug. mom",
    Nora: "so proud of you. i've been sneaking little notes in here for years. love you. mom",
    Mia: "this is yours now baby girl. i saved everything so you could see how many people love you. mom",
  };
  return byName[kid.firstName] ?? `love you so much. mom`;
}

// The sealed "for when this is yours" letter — varies per kid. No em-dashes
// (locked copy rule), no LinkedIn-inspirational tone — just a real dad.
export function sealedLetterFor(kid: { firstName: string }): string {
  const byName: Record<string, string> = {
    Nora: "Nora, if you're reading this you're 21 and this is yours now. We started it when you were tiny. Don't spend it all at once, but have a little fun with it too. Love, Dad",
    Mia: "Mia. It's yours now. We put in a little every month for years, and so did a lot of people who love you. Do something good with it. We're proud of you. Dad",
  };
  return byName[kid.firstName] ?? `${kid.firstName}, one day this is yours. Make it count. Love, Dad`;
}

// Glide-path: the product automatically de-risks the managed index sleeve as
// the child nears majority. NOT discretionary trading — these are the only
// position changes after a gift buys in. Growth→Balanced at 13, Balanced→
// Conservative at 16, dated on the child's birthday at that age.
export function rebalancesForKid(kid: KidStory): Array<{ date: string; to: "balanced" | "conservative" }> {
  const out: Array<{ date: string; to: "balanced" | "conservative" }> = [];
  const order = { growth: 0, balanced: 1, conservative: 2 } as const;
  const bday = new Date(kid.birthdate);
  const atAge = (years: number) => {
    const d = new Date(bday);
    d.setFullYear(d.getFullYear() + years);
    return d.toISOString();
  };
  if (kid.ageYears >= 13 && order[kid.strategy] >= order.balanced) out.push({ date: atAge(13), to: "balanced" });
  if (kid.ageYears >= 16 && order[kid.strategy] >= order.conservative) out.push({ date: atAge(16), to: "conservative" });
  return out;
}
