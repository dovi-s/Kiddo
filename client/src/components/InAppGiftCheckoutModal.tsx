// In-app gift checkout modal (CHECKOUT_IN_APP_SPEC.md). Flag-gated, additive: when
// IN_APP_CHECKOUT is on, the gift flow opens THIS instead of redirecting to hosted
// Stripe (GiftCheckout.tsx). Everything before it — the rich amount step, the
// fee-transparent funding picker, the Memory Book note — is unchanged; this only
// replaces the "leave the app to type your card" moment with the embedded Payment
// Element (card + Apple/Google Pay + Link, no redirect). On success it navigates to the
// same GiftSuccess payoff. PCI stays SAQ-A (Stripe iframe). The actual charge settles
// via the guarded source:'in_app' webhook branch.
import { useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { X } from "lucide-react";
import { kiddoStripeAppearance } from "@/lib/stripe-appearance";

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

function PayBody({ successPath, amountLabel }: { successPath: string; amountLabel: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    setErr(null);
    // redirect: "if_required" keeps cards + wallets IN-APP; no hosted page.
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (error) { setErr(error.message || "Payment failed"); setBusy(false); return; }
    if (paymentIntent && paymentIntent.status === "succeeded") {
      // Same navigation the hosted flow uses — GiftSuccess reads the params on load.
      window.location.href = successPath;
      return;
    }
    setErr("Couldn't finish. Please try again.");
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: "accordion" }} />
      <button
        type="button"
        onClick={pay}
        disabled={busy || !stripe}
        className="w-full rounded-2xl bg-[hsl(var(--kiddo-evergreen))] px-5 py-3.5 font-bold text-white transition-colors hover:bg-[hsl(var(--kiddo-evergreen-deep))] disabled:opacity-60"
        data-testid="inapp-gift-pay"
      >
        {busy ? "Sending…" : `Send ${amountLabel}`}
      </button>
      {err && <p className="text-sm text-amber-700" data-testid="inapp-gift-error">{err}</p>}
      <p className="text-center text-[11px] text-muted-foreground">Secure, in-app. No redirect.</p>
    </div>
  );
}

export function InAppGiftCheckoutModal({
  clientSecret,
  successPath,
  amountLabel,
  onClose,
}: {
  clientSecret: string;
  successPath: string;
  amountLabel: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Complete your gift"
    >
      <div
        className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-foreground">Complete your gift</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-[hsl(var(--kiddo-cream))]"
            data-testid="inapp-gift-close"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <Elements stripe={getStripe()} options={{ clientSecret, appearance: kiddoStripeAppearance }}>
          <PayBody successPath={successPath} amountLabel={amountLabel} />
        </Elements>
      </div>
    </div>
  );
}
