// 1099 plain-English walkthrough. Per AGE_18_HANDOFF_SPEC.md
// bucket 3 (annual 1099 walkthrough page).
//
// Linked from:
//   1. The Settings → Money → Tax docs button (when user is a kid-owner)
//   2. TaxDocuments.tsx (when a 1099 is present)
//   3. Future: the annual "your 1099 is ready" email
//
// What this page covers: the two 1099 forms a kid-owner gets in
// January, what each line means in plain English, how the LTCG vs
// short-term distinction shows up, where the cost-basis came from,
// and what to actually do with the form. Designed to be readable in
// under 5 minutes. Same vocabulary as the Age18Welcome screen 3
// tax primer but with form-line-specific detail.

import { Link } from "wouter";
import { ArrowLeft, FileText, Receipt, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TaxDocsExplainer() {
  return (
    <div className="kiddo-app-page md:ml-[264px] pb-24 md:pb-8">
      <main className="kiddo-canvas px-4 py-6 space-y-6 max-w-2xl mx-auto">
        <Link href="/tax-documents">
          <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={14} />
            Back to tax documents
          </a>
        </Link>

        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <FileText size={14} className="text-primary" />
            <span>Tax docs, in plain English</span>
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
            What your 1099 actually says.
          </h1>
          <p className="text-base text-foreground/80 leading-relaxed">
            Every January, Kiddo ships you two forms. Here's what each one means
            and what to do with it. Five-minute read.
          </p>
        </header>

        <Section
          icon={<Receipt size={16} />}
          title="1099-DIV: your dividends"
          body={
            <>
              <p>
                Companies you own (like Apple, Disney, Vanguard funds) pay you a small
                slice of their profits four times a year. That's a dividend. The 1099-DIV
                is the IRS's record of how much you got over the whole year.
              </p>
              <p>
                Two lines matter most:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Box 1a. Total ordinary dividends.</strong>{" "}
                  Everything you got. Taxed at your regular income rate unless
                  Box 1b applies.
                </li>
                <li>
                  <strong>Box 1b. Qualified dividends.</strong>{" "}
                  The part of Box 1a that gets the gentler long-term capital
                  gains rate. Most of yours will land here because you held
                  the stocks long enough.
                </li>
              </ul>
            </>
          }
        />

        <Section
          icon={<TrendingUp size={16} />}
          title="1099-B: your sales"
          body={
            <>
              <p>
                Every time you moved a stock to cash this year, that sale shows up here.
                The form lists each sale and tells the IRS:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>What you sold.</strong> Ticker, shares, sale date.
                </li>
                <li>
                  <strong>Cost basis.</strong> What was paid for those shares
                  originally. Could be from gifts that came in years ago.
                  Kiddo tracks this automatically.
                </li>
                <li>
                  <strong>Proceeds.</strong> What you actually got from the sale.
                </li>
                <li>
                  <strong>Gain or loss.</strong> Proceeds minus cost basis. This
                  is the number you're taxed on.
                </li>
                <li>
                  <strong>Short-term vs long-term.</strong> Held over a year =
                  long-term (gentler tax). Under a year = short-term (regular
                  income tax). Same gain, very different bill.
                </li>
              </ul>
              <p className="pt-1">
                One thing to know about losses: if you sell at a loss and buy
                the same stock back within 30 days, the loss doesn't count this
                year. It moves into the new shares' cost basis instead (called
                a "wash sale"). Tax software catches this automatically; if
                you're filing by hand it shows up on the 1099-B with a code W.
              </p>
            </>
          }
        />

        <Section
          icon={<AlertCircle size={16} />}
          title="If you're under 19 (or in college)"
          body={
            <>
              <p>
                There's one wrinkle worth knowing about before you file. It's
                called the "Kiddie Tax" and it applies if you're under 19, or
                under 24 and a full-time student claimed as a dependent.
              </p>
              <p>
                The first chunk of your unearned income (dividends + capital
                gains) gets taxed at your rate. Anything above the threshold
                (around $2,500 for 2024 to 2025; adjusts each year) gets taxed
                at your parents' rate, which is usually higher than yours.
              </p>
              <p>
                In practice: if your 1099-DIV plus your 1099-B gains add up to
                more than the threshold, the math on the upper portion follows
                a different rate. Tax software handles it automatically if you
                check the dependent box during the filing flow. If you're
                filing your own return for the first time, this is the line
                item that surprises people most.
              </p>
              <p>
                Once you're 19 (or 24 if you stayed in college as a dependent),
                the Kiddie Tax stops applying and your income is taxed at your
                rate again.
              </p>
            </>
          }
        />

        <Section
          icon={<AlertCircle size={16} />}
          title="What to actually do with these"
          body={
            <>
              <p>
                Two paths, depending on how you file:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Tax software (TurboTax, FreeTaxUSA, Cash App Taxes).</strong>{" "}
                  Most will import directly from Kiddo's brokerage. If not, type
                  the numbers from each form into the matching screens. They walk
                  you through it.
                </li>
                <li>
                  <strong>An accountant.</strong>{" "}
                  Hand them both forms. They handle the rest.
                </li>
              </ul>
              <p className="pt-2">
                Federal forms only cover federal tax. Your state might charge
                its own capital gains tax (most do; nine states don't). Tax
                software handles state automatically.
              </p>
            </>
          }
        />

        <Section
          icon={<Receipt size={16} />}
          title="The cost-basis question"
          body={
            <>
              <p>
                "How much did I pay for this?" is the most-Googled tax question
                for first-time investors. For you, the answer is: Kiddo tracks it
                from the moment each gift was invested.
              </p>
              <p>
                When grandma sent $500 at your 10th birthday and it bought about
                3 shares of Disney at $166/share, that $166/share is the cost
                basis for those shares (Kiddo invests in fractional shares too,
                so the math lands at 3.012 shares; the cost basis is the same
                per-share number either way). When you sell, the difference
                between $166 and the sale price is your gain. Kiddo's brokerage
                reports this to the IRS automatically; you don't need to track
                it yourself.
              </p>
              <p>
                If you ever see "cost basis: unknown" on a sale (rare, but
                possible for very old positions), you'll need to figure it out
                yourself before filing. If you can't, the safe default is $0,
                which means 100% of the sale gets taxed as gain. Email us first
                if this comes up; we can usually reconstruct the basis from
                your gift records.
              </p>
            </>
          }
        />

        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm font-semibold">Still confused?</p>
          <p className="text-sm text-foreground/70 leading-relaxed">
            Email{" "}
            <a href="mailto:hello@kiddofund.com" className="text-primary underline-offset-2 hover:underline">
              hello@kiddofund.com
            </a>{" "}
            before April 1. We'll walk you through your specific numbers. No appointment,
            no charge.
          </p>
          <Link href="/tax-documents">
            <Button variant="outline" size="sm" className="rounded-xl">
              Back to tax documents
            </Button>
          </Link>
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-4">
          This is general education, not personal tax advice. Your specific situation
          might be different. When in doubt, ask a CPA.
        </p>
      </main>
    </div>
  );
}

function Section({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </span>
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
      </div>
      <div className="space-y-3 text-sm text-foreground/80 leading-relaxed">
        {body}
      </div>
    </section>
  );
}
