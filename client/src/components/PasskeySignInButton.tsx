// Passkey sign-in button for the Login page. Per FACE_ID_SPEC.md.
//
// Self-contained surface: detects whether WebAuthn is available in
// this browser (most modern browsers; older ones get a hidden state),
// fires the browser ceremony on click, posts the assertion to
// /api/auth/passkey/authenticate/verify, and calls onSuccess when
// the server confirms.
//
// Composes alongside the existing password form. If the user has no
// passkey registered for this device, the browser shows a clean
// "no credentials" UI — we surface that as a calm "no passkey on
// this device" toast rather than letting the system message bubble
// up uncontrolled.

import { useEffect, useState } from "react";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onSuccess: () => void;
}

export function PasskeySignInButton({ onSuccess }: Props) {
  const { toast } = useToast();
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Feature detection runs once on mount. browserSupportsWebAuthn
    // returns false on Safari iOS <16, older Chrome, embedded
    // webviews, etc. Hide the button rather than show a broken one.
    try {
      setSupported(browserSupportsWebAuthn());
    } catch {
      setSupported(false);
    }
  }, []);

  if (!supported) return null;

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Step 1: ask server for challenge + allowCredentials.
      const optsRes = await fetch("/api/auth/passkey/authenticate/options", {
        method: "POST",
        credentials: "include",
      });
      if (!optsRes.ok) throw new Error("Could not start passkey sign-in");
      const options = await optsRes.json();

      // Step 2: browser ceremony. The OS picks an available
      // credential (Face ID / Touch ID / Windows Hello / YubiKey).
      const assertion = await startAuthentication({ optionsJSON: options });

      // Step 3: verify on server, which also establishes the session.
      const verifyRes = await fetch("/api/auth/passkey/authenticate/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err?.error || "Passkey sign-in failed");
      }

      onSuccess();
    } catch (err) {
      // User-cancelled or no-credentials returns from startAuthentication
      // as a DOMException with name "NotAllowedError." Soft-handle that;
      // it's not really an error from the user's perspective.
      const message = err instanceof Error ? err.message : "Could not sign in with a passkey";
      const isCancellation = message.includes("NotAllowed") || message.toLowerCase().includes("cancel");
      if (!isCancellation) {
        toast({ title: "Passkey sign-in failed", description: message, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors disabled:opacity-60"
      data-testid="button-login-passkey"
    >
      <KeyRound size={16} className="text-primary" />
      {busy ? "Signing in..." : "Sign in with a passkey"}
    </button>
  );
}
