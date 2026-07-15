// Read-only simulation of the journey replay's caption-vs-reveal-edge sync,
// using the REAL Luke snapshots and the exact lab logic (zero baseline +
// span-sized resampling + beat selection + MIN_GAP time spacing). For each
// caption: its scheduled fire time, and the VALUE the linear reveal edge sits
// on at that moment — verifying/refuting "it says Crossed $10k at the $20k
// mark".
import { db } from "../server/db";
import { funds, gifts, events, parentContributions, fundSnapshots } from "../shared/schema";
import { eq, asc } from "drizzle-orm";

const JOURNEY_MS = 9000;
const MIN_GAP = 950;

async function main() {
  const allFunds = await db.select().from(funds);
  const fund = allFunds.find((f: any) => String(f.recipientFirstName || "").toLowerCase().includes("luke"))!;
  const snaps = await db.select().from(fundSnapshots).where(eq(fundSnapshots.fundId, fund.id)).orderBy(asc(fundSnapshots.snapshotDate));

  // trendData replica: points -> resample -> zero baseline.
  let pts = snaps.map((s: any) => ({ ts: new Date(s.snapshotDate).getTime(), value: parseFloat(String(s.totalValue || "0")) }));
  const spanMs = pts[pts.length - 1].ts - pts[0].ts;
  const bucketOf = spanMs > 2.5 * 365.25 * 86400000
    ? (ts: number) => { const d = new Date(ts); return `${d.getUTCFullYear()}-${d.getUTCMonth()}`; }
    : spanMs > 200 * 86400000 ? (ts: number) => String(Math.floor(ts / (7 * 86400000))) : null;
  if (bucketOf) pts = pts.filter((p, i) => i === pts.length - 1 || bucketOf(p.ts) !== bucketOf(pts[i + 1].ts));
  const createdTs = new Date(fund.createdAt as any).getTime();
  if (createdTs < pts[0].ts) pts = [{ ts: createdTs, value: 0 }, ...pts];
  const n = pts.length;
  console.log(`trendData points: ${n} | span ${new Date(pts[0].ts).toISOString().slice(0, 10)} -> ${new Date(pts[n - 1].ts).toISOString().slice(0, 10)}`);

  const fracForTs = (ts: number) => { let idx = 0; for (let i = 0; i < n; i++) { if (pts[i].ts <= ts) idx = i; else break; } return idx / (n - 1); };

  type Beat = { frac: number; label: string; priority: number };
  const beats: Beat[] = [
    { frac: 0, label: "Where it began", priority: 0 },
    { frac: 1, label: "Today", priority: 0 },
  ];
  const giftRows = (await db.select().from(gifts).where(eq(gifts.fundId, fund.id)))
    .map((g: any) => ({ ts: new Date(g.createdAt).getTime(), amt: parseFloat(String(g.netAmount || g.amount || "0")), rec: !!g.parentContributionId, name: g.senderName, eventId: g.eventId }))
    .filter((g) => g.ts > 0 && g.amt > 0)
    .sort((a, b) => a.ts - b.ts);
  beats.push({ frac: fracForTs(giftRows[0].ts), label: `The first gift ($${giftRows[0].amt} ${giftRows[0].name})`, priority: 1 });
  const contribs = await db.select().from(parentContributions).where(eq(parentContributions.fundId, fund.id));
  const firstRec = contribs.map((c: any) => new Date(c.createdAt).getTime()).sort((a, b) => a - b)[0];
  if (firstRec) beats.push({ frac: fracForTs(firstRec), label: "Recurring begins", priority: 2 });
  const biggest = giftRows.filter((g) => !g.rec).sort((a, b) => b.amt - a.amt)[0];
  if (biggest && biggest.ts !== giftRows[0].ts && biggest.amt >= 100) beats.push({ frac: fracForTs(biggest.ts), label: `Biggest ($${biggest.amt} ${biggest.name})`, priority: 2 });
  const evts = await db.select().from(events).where(eq(events.fundId, fund.id));
  const nowTs = Date.now();
  for (const e of evts as any[]) {
    const own = giftRows.filter((g) => String(g.eventId || "") === String(e.id) && g.ts <= nowTs).map((g) => g.ts).sort((a, b) => a - b);
    const anchor = own.length ? own[Math.floor(own.length / 2)] : (e.eventDate ? new Date(e.eventDate).getTime() : 0);
    const vol = parseFloat(String(e.giftVolume || "0"));
    if (anchor > pts[0].ts && anchor <= nowTs && vol > 0 && e.name) beats.push({ frac: fracForTs(anchor), label: `${e.name} ($${vol})`, priority: 3 });
  }
  for (const t of [1000, 2500, 5000, 10000, 25000]) {
    const idx = pts.findIndex((p, i) => p.value >= t && (i === 0 || pts[i - 1].value < t));
    if (idx > 0) beats.push({ frac: idx / (n - 1), label: `Crossed $${t / 1000}k`, priority: 4 });
  }
  beats.sort((a, b) => a.frac - b.frac || a.priority - b.priority);
  // budget trim (max 8, drop highest priority number)
  while (beats.length > 8) {
    let worstIdx = -1, worstP = 0;
    beats.forEach((b, i) => { if (b.priority > worstP) { worstP = b.priority; worstIdx = i; } });
    if (worstIdx < 0) break;
    beats.splice(worstIdx, 1);
  }

  console.log("\ncaption                                | trueAt(ms) | firesAt(ms) | edge value @fire | value @true pos");
  let lastAt = -Infinity;
  for (const b of beats) {
    const trueAt = Math.round(b.frac * JOURNEY_MS);
    const at = Math.max(trueAt, lastAt + MIN_GAP);
    lastAt = at;
    const edgeIdx = Math.min(n - 1, Math.round((at / JOURNEY_MS) * (n - 1)));
    const trueIdx = Math.min(n - 1, Math.round(b.frac * (n - 1)));
    console.log(`${b.label.padEnd(38)} | ${String(trueAt).padStart(10)} | ${String(at).padStart(11)} | $${Math.round(pts[edgeIdx].value).toLocaleString().padStart(8)} | $${Math.round(pts[trueIdx].value).toLocaleString().padStart(8)}`);
  }
  process.exit(0);
}

void main();
