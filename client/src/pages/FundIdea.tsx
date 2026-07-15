// Kid-initiated "Fund Idea" — v1: LOCAL-ONLY, zero-PII teen exploration.
//
// This is the safest defensible slice from the advisory panel (see
// KID_FUND_IDEA_SPEC.md + COUNSEL_Q_KID_ONBOARDING.md): a 13+ teen sketches a fund
// IDEA (a name + tickers from the neutral allowlist) and sees a family-framed,
// read-only projection. NOTHING is collected or sent — the draft lives only in
// localStorage on this device. A grown-up makes it real. The route is registered
// ONLY when the KID_INITIATED_ONBOARDING flag is on (default off), and even then it
// must stay off for real teens until counsel clears the gates.
//
// Hard rules enforced here: no PII inputs; no "you own / it's real / your account"
// language (strictly future/conditional); family-framed projection only (never
// personalized to the minor); no reminders / urgency / scarcity; the experience is
// complete WITHOUT a parent (no friction-gated payoff).
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { STOCK_PICKS } from "@shared/stock-picks";
import { projectFundValue } from "@shared/projection";
import { PROJECTION_DISCLAIMER } from "@shared/legal-copy";

const DRAFT_KEY = "kiddo.fundIdea.v1";
const AGE_KEY = "kiddo.fundIdea.age13.v1";
const PROJECTION_YEARS = 15; // generic illustration horizon — no DOB, no PII
const MONTHLY_CHOICES = [10, 25, 50, 100];

type Draft = { fundName: string; tickers: string[]; monthly: number };

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return {
        fundName: typeof d.fundName === "string" ? d.fundName : "",
        tickers: Array.isArray(d.tickers) ? d.tickers.filter((t: unknown) => typeof t === "string") : [],
        monthly: MONTHLY_CHOICES.includes(d.monthly) ? d.monthly : 25,
      };
    }
  } catch {
    /* ignore corrupt draft */
  }
  return { fundName: "", tickers: [], monthly: 25 };
}

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function FundIdea() {
  const [, setLocation] = useLocation();
  const [ageOk, setAgeOk] = useState<boolean | null>(() => {
    try {
      return localStorage.getItem(AGE_KEY) === "1" ? true : null;
    } catch {
      return null;
    }
  });
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [showedParent, setShowedParent] = useState(false);

  // Persist the draft locally (zero PII — a name + tickers + a number). Never sent.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* storage full / disabled — fine, it's just a convenience */
    }
  }, [draft]);

  const toggleTicker = (ticker: string) =>
    setDraft((d) => ({
      ...d,
      tickers: d.tickers.includes(ticker)
        ? d.tickers.filter((t) => t !== ticker)
        : d.tickers.length >= 5
          ? d.tickers
          : [...d.tickers, ticker],
    }));

  // Family-framed projection: "if your family added $X/mo …". Generic horizon, no
  // DOB, never "YOUR fund will be worth". Read-only.
  const projected = useMemo(
    () => projectFundValue({ startingValue: 0, monthlyContribution: draft.monthly, yearsAhead: PROJECTION_YEARS }),
    [draft.monthly],
  );

  const confirmAge = (ok: boolean) => {
    if (ok) {
      try {
        localStorage.setItem(AGE_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    setAgeOk(ok);
  };

  // ── 13+ self-attestation gate ──────────────────────────────────────────────
  if (ageOk === null) {
    return (
      <Shell>
        <div className="mx-auto max-w-md text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--kiddo-evergreen))]">
            Quick check
          </p>
          <h1 className="font-heading mt-2 text-2xl font-bold text-foreground">Are you 13 or older?</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This is a place to dream up a fund idea. Nothing here is a real account, and nothing you
            type is saved anywhere but on this device.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => confirmAge(true)}
              className="rounded-2xl bg-[hsl(var(--kiddo-evergreen))] px-5 py-3 font-semibold text-white transition-colors hover:bg-[hsl(var(--kiddo-evergreen-deep))]"
              data-testid="fundidea-age-yes"
            >
              Yes, I'm 13 or older
            </button>
            <button
              type="button"
              onClick={() => confirmAge(false)}
              className="rounded-2xl border border-[hsl(var(--kiddo-border))] px-5 py-3 font-semibold text-foreground transition-colors hover:bg-[hsl(var(--kiddo-cream))]"
              data-testid="fundidea-age-no"
            >
              Not yet
            </button>
          </div>
        </div>
      </Shell>
    );
  }
  if (ageOk === false) {
    return (
      <Shell>
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">Ask a grown-up</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            A parent or guardian can set up a fund with you on Kiddo. Show them this page and they can
            take it from here.
          </p>
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="mt-6 rounded-2xl border border-[hsl(var(--kiddo-border))] px-5 py-3 font-semibold text-foreground transition-colors hover:bg-[hsl(var(--kiddo-cream))]"
          >
            Back to Kiddo
          </button>
        </div>
      </Shell>
    );
  }

  // ── The "show a parent" calm hand-off (complete, no pressure) ───────────────
  if (showedParent) {
    return (
      <Shell>
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">Show a grown-up</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Here's your idea{draft.fundName ? `, "${draft.fundName}"` : ""}. A parent or guardian can
            open Kiddo and make it real. They'll set up the account, add the details, and choose what
            to put in. Until then, your idea is saved right here on this device.
          </p>
          <button
            type="button"
            onClick={() => setShowedParent(false)}
            className="mt-6 rounded-2xl bg-[hsl(var(--kiddo-evergreen))] px-5 py-3 font-semibold text-white transition-colors hover:bg-[hsl(var(--kiddo-evergreen-deep))]"
          >
            Keep tweaking
          </button>
        </div>
      </Shell>
    );
  }

  // ── The idea builder ────────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="mx-auto max-w-lg">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--kiddo-evergreen))]">
          Your fund idea
        </p>
        <h1 className="font-heading mt-1 text-3xl font-bold leading-tight text-foreground">
          Dream up a fund.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a name and what you'd invest in. A grown-up can make it real later. This is just your
          idea for now.
        </p>

        {/* Name */}
        <label className="mt-7 block text-sm font-semibold text-foreground" htmlFor="fundidea-name">
          Name it
        </label>
        <input
          id="fundidea-name"
          value={draft.fundName}
          onChange={(e) => setDraft((d) => ({ ...d, fundName: e.target.value.slice(0, 40) }))}
          placeholder="My future fund"
          className="mt-2 w-full rounded-2xl border border-[hsl(var(--kiddo-border))] bg-white px-4 py-3 text-foreground outline-none focus:border-[hsl(var(--kiddo-evergreen))]"
          data-testid="fundidea-name-input"
        />

        {/* Tickers */}
        <p className="mt-7 text-sm font-semibold text-foreground">What would you invest in?</p>
        <p className="text-xs text-muted-foreground">Pick up to 5.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STOCK_PICKS.map((s) => {
            const on = draft.tickers.includes(s.ticker);
            return (
              <button
                key={s.ticker}
                type="button"
                onClick={() => toggleTicker(s.ticker)}
                aria-pressed={on}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  on
                    ? "border-[hsl(var(--kiddo-evergreen))] bg-[hsl(var(--kiddo-evergreen)/0.10)] text-foreground"
                    : "border-[hsl(var(--kiddo-border))] text-muted-foreground hover:bg-[hsl(var(--kiddo-cream))]"
                }`}
                data-testid={`fundidea-ticker-${s.ticker}`}
              >
                <span aria-hidden>{s.emoji}</span>
                {s.name}
              </button>
            );
          })}
        </div>

        {/* Family-framed projection */}
        <div className="mt-8 rounded-2xl bg-[hsl(var(--kiddo-evergreen))] p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">
            If your family added
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MONTHLY_CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, monthly: m }))}
                aria-pressed={draft.monthly === m}
                className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
                  draft.monthly === m ? "bg-white text-[hsl(var(--kiddo-evergreen))]" : "bg-white/15 text-white hover:bg-white/25"
                }`}
                data-testid={`fundidea-monthly-${m}`}
              >
                ${m}/mo
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-white/80">
            in {PROJECTION_YEARS} years it could grow to about
          </p>
          <p className="font-heading text-4xl font-bold tabular-nums" data-testid="fundidea-projection">
            ~{fmtUsd(projected)}
          </p>
          <p className="mt-3 text-2xs leading-relaxed text-white/55">{PROJECTION_DISCLAIMER}</p>
        </div>

        {/* Calm, optional hand-off — never gated, never pressured */}
        <button
          type="button"
          onClick={() => setShowedParent(true)}
          className="mt-6 w-full rounded-2xl bg-[hsl(var(--kiddo-gold))] px-5 py-3.5 font-bold text-white transition-colors hover:opacity-95"
          data-testid="fundidea-show-parent"
        >
          Show a grown-up
        </button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          A parent or guardian makes it real. Nothing here is a real account yet.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[hsl(var(--kiddo-cream))] px-5 py-10">{children}</div>
  );
}
