// In-app embedded checkout PREVIEW (CHECKOUT_IN_APP_SPEC.md, Phase 1: on-session
// deposit). Flag-gated (IN_APP_CHECKOUT) — registered only when on. Proves the thesis:
// the payment happens INSIDE the app via Stripe's embedded Payment Element — card +
// native Apple/Google Pay + Link, NO hosted redirect — and the method is vaulted for a
// one-tap next time. The actual charge is confirmed against Stripe TEST mode (use a
// 4242… test card); Apple Pay's express button only renders on a Stripe-verified
// production domain (not localhost), so locally you'll see the card/Link element.
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, ExpressCheckoutElement, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { kiddoStripeAppearance } from "@/lib/stripe-appearance";

// Fetch the publishable key once (the server already exposes it) and memoize loadStripe.
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = fetch("/api/stripe/publishable-key")
      .then((r) => r.json())
      .then((d) => (d?.publishableKey ? loadStripe(String(d.publishableKey)) : null))
      .catch(() => null);
  }
  return stripePromise;
}

const fmt = (n: number) => `$${n}`;
const AMOUNTS = [25, 50, 100, 250];

function PayForm({ amount, onDone }: { amount: number; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Whether ANY wallet (Apple Pay / Google Pay / Link) is available on this device +
  // domain. Drives the "one-tap first, card tucked under" layout. Apple Pay only
  // resolves true on a Stripe-verified production domain + a real device.
  const [hasExpress, setHasExpress] = useState(false);

  // redirect: "if_required" keeps cards + wallets IN-APP; only truly redirect-only
  // rails would leave. No hosted Checkout page.
  const confirm = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setMsg(null);
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    setSubmitting(false);
    if (error) { setMsg(error.message || "Payment failed"); return; }
    if (paymentIntent && paymentIntent.status === "succeeded") { onDone(); return; }
    setMsg(`Status: ${paymentIntent?.status ?? "needs another step"}`);
  };

  return (
    <div className="space-y-4">
      {/* ONE-TAP FIRST — Apple Pay / Google Pay / Link. This is the stupid-simple
          surface: a wallet tap (Face ID), no typing. The card form is tucked below
          for everyone else. (Locally you may see only Link or nothing here — Apple
          Pay needs a verified production domain.) */}
      <ExpressCheckoutElement
        onReady={(e) => setHasExpress(Boolean((e as any)?.availablePaymentMethods))}
        onConfirm={() => confirm()}
      />
      {hasExpress && (
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60" data-testid="checkout-or">
          <span className="h-px flex-1 bg-[hsl(var(--kiddo-border))]" />
          or pay with card
          <span className="h-px flex-1 bg-[hsl(var(--kiddo-border))]" />
        </div>
      )}
      {/* accordion (not a tab-wall): one method open, the rest collapsed. */}
      <PaymentElement options={{ layout: "accordion" }} />
      <button
        type="button"
        onClick={confirm}
        disabled={submitting || !stripe}
        className="w-full rounded-2xl bg-[hsl(var(--kiddo-evergreen))] px-5 py-3.5 font-bold text-white transition-colors hover:bg-[hsl(var(--kiddo-evergreen-deep))] disabled:opacity-50"
        data-testid="checkout-pay"
      >
        {submitting ? "Adding…" : `Add ${fmt(amount)} to the fund`}
      </button>
      {msg && <p className="text-sm text-amber-700" data-testid="checkout-msg">{msg}</p>}
      <p className="text-center text-[11px] text-muted-foreground">Saved for next time.</p>
    </div>
  );
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function CheckoutPreview() {
  const [, setLocation] = useLocation();
  const [amount, setAmount] = useState(50);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // RETURN-USER one tap: a previously vaulted method. When present, the whole flow
  // collapses to "Add $50 with •••• 4242" — no element, no form. The single biggest
  // loop-compounding lever (Amazon "Buy now" / Acorns silent deposit).
  const [savedMethod, setSavedMethod] = useState<{ id: string; brand: string; last4: string } | null>(null);
  const [forceNew, setForceNew] = useState(false);
  const [oneTapLoading, setOneTapLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/checkout/payment-methods", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { methods: [] }))
      .then((d) => { if (alive && Array.isArray(d?.methods) && d.methods[0]?.id) setSavedMethod(d.methods[0]); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // First-time: create a PaymentIntent, then render the element.
  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/checkout/payment-intent", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ amount }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d?.error || "Couldn't start checkout"); return; }
      setClientSecret(d.clientSecret);
    } catch { setError("Couldn't reach the server"); } finally { setLoading(false); }
  };

  // Return-user: charge the saved method on-session, no element. 3DS via handleNextAction.
  const oneTap = async () => {
    if (!savedMethod) return;
    setOneTapLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/checkout/charge-saved", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ amount, paymentMethodId: savedMethod.id }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d?.error || "Couldn't add to the fund"); return; }
      if (d.status === "succeeded") { setDone(true); return; }
      if (d.clientSecret) {
        const stripe = await getStripe();
        const res = await stripe?.handleNextAction({ clientSecret: d.clientSecret });
        if (res?.error) { setError(res.error.message || "Couldn't confirm"); return; }
        if (res?.paymentIntent?.status === "succeeded") { setDone(true); return; }
      }
      setError("Couldn't finish. Try a different way.");
    } catch { setError("Couldn't reach the server"); } finally { setOneTapLoading(false); }
  };

  const showOneTap = !!savedMethod && !forceNew;
  const brandLabel = savedMethod ? `${cap(savedMethod.brand)} •••• ${savedMethod.last4}` : "";

  return (
    <div className="min-h-screen bg-[hsl(var(--kiddo-cream))] px-5 py-10">
      <div className="mx-auto max-w-md">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--kiddo-evergreen))]">
          Add to the fund
        </p>
        <h1 className="font-heading mt-1 text-3xl font-bold text-foreground">How much?</h1>
        <p className="mt-1 text-sm text-muted-foreground">It goes straight into the fund.</p>

        {done ? (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center">
            <p className="font-heading text-xl font-bold text-emerald-700">{fmt(amount)} added</p>
            <p className="mt-1 text-sm text-emerald-700/80">It's in the fund.</p>
            <button
              type="button"
              onClick={() => setLocation("/staging")}
              className="mt-5 rounded-2xl border border-[hsl(var(--kiddo-border))] px-5 py-3 font-semibold text-foreground hover:bg-white"
            >
              Back to the dashboard
            </button>
          </div>
        ) : !clientSecret ? (
          <>
            <div className="mt-7 flex flex-wrap gap-2">
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmount(a)}
                  aria-pressed={amount === a}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    amount === a
                      ? "bg-[hsl(var(--kiddo-evergreen))] text-white"
                      : "border border-[hsl(var(--kiddo-border))] text-muted-foreground hover:bg-white"
                  }`}
                  data-testid={`checkout-amount-${a}`}
                >
                  {fmt(a)}
                </button>
              ))}
            </div>

            {showOneTap ? (
              // RETURN USER — one tap, no form.
              <>
                <button
                  type="button"
                  onClick={oneTap}
                  disabled={oneTapLoading}
                  className="mt-6 w-full rounded-2xl bg-[hsl(var(--kiddo-evergreen))] px-5 py-3.5 font-bold text-white transition-colors hover:bg-[hsl(var(--kiddo-evergreen-deep))] disabled:opacity-50"
                  data-testid="checkout-onetap"
                >
                  {oneTapLoading ? "Adding…" : `Add ${fmt(amount)} with ${brandLabel}`}
                </button>
                <button
                  type="button"
                  onClick={() => setForceNew(true)}
                  className="mt-3 w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
                  data-testid="checkout-usenew"
                >
                  Use a different way
                </button>
              </>
            ) : (
              // FIRST TIME (or chose "different way") — go to the element.
              <button
                type="button"
                onClick={start}
                disabled={loading}
                className="mt-6 w-full rounded-2xl bg-[hsl(var(--kiddo-gold))] px-5 py-3.5 font-bold text-white transition-colors hover:opacity-95 disabled:opacity-50"
                data-testid="checkout-continue"
              >
                {loading ? "…" : `Add ${fmt(amount)}`}
              </button>
            )}
            {error && <p className="mt-3 text-sm text-amber-700" data-testid="checkout-error">{error}</p>}
          </>
        ) : (
          <div className="mt-7">
            <Elements stripe={getStripe()} options={{ clientSecret, appearance: kiddoStripeAppearance }}>
              <PayForm amount={amount} onDone={() => setDone(true)} />
            </Elements>
          </div>
        )}
      </div>
    </div>
  );
}
