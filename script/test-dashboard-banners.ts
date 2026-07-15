// Unit test for the dashboard banner priority/cap (shared/lib pure function).
// Run: npx tsx script/test-dashboard-banners.ts
import { pickBanners, type BannerId } from "../client/src/lib/dashboard-banners";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}`);
  }
}

const all = (...ids: BannerId[]) => Object.fromEntries(ids.map((id) => [id, true]));

// 1. Every celebration eligible → only the rarest (kidAt18) shows.
{
  const p = pickBanners(all("kidAt18", "coparentAccepted", "birthday", "milestone", "plusFirstMedia"));
  check("celebrations cap to one", p.winningCelebration === "kidAt18");
  check("lesser celebrations suppressed", !p.show("birthday") && !p.show("milestone") && !p.show("plusFirstMedia") && !p.show("coparentAccepted"));
}

// 2. No rare moment → the next-rarest eligible celebration wins.
{
  const p = pickBanners(all("birthday", "milestone", "plusFirstMedia"));
  check("birthday beats milestone/media", p.winningCelebration === "birthday" && p.show("birthday") && !p.show("milestone"));
}

// 3. A needs-you blocker suppresses ALL nudges, but not setup or the celebration.
{
  const p = pickBanners(all("actionItems", "setupProgress", "birthday", "digest", "recurringRequests", "plusUpgrade"));
  check("needs-you shown", p.show("actionItems"));
  check("setup shown alongside needs-you", p.show("setupProgress"));
  check("celebration shown alongside needs-you", p.show("birthday"));
  check("nudges suppressed by needs-you", !p.show("digest") && !p.show("recurringRequests") && !p.show("plusUpgrade"));
}

// 4. No blocker → nudges flow through.
{
  const p = pickBanners(all("digest", "recurringRequests", "plusUpgrade"));
  check("nudges show when no blocker", p.show("digest") && p.show("recurringRequests") && p.show("plusUpgrade"));
}

// 5. Closed-fund counts as a needs-you blocker for nudge suppression.
{
  const p = pickBanners(all("closedFund", "plusUpgrade"));
  check("closed-fund suppresses nudges", p.show("closedFund") && !p.show("plusUpgrade"));
}

// 6. Nothing eligible → nothing allowed.
{
  const p = pickBanners({});
  check("empty in, empty out", p.allowed.size === 0 && p.winningCelebration === null);
}

// 7. Realistic worst case (return + birthday + co-parent + milestone + media + nudges)
//    collapses to: one celebration (co-parent, rarer than birthday) + the nudges.
{
  const p = pickBanners(all("coparentAccepted", "birthday", "milestone", "plusFirstMedia", "digest", "recurringRequests"));
  const shown = [...p.allowed];
  check("worst case keeps one celebration", p.winningCelebration === "coparentAccepted");
  check("worst case collapses to <=3 cards", shown.length <= 3);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
