// Passkey management UI for Settings → Account. Per FACE_ID_SPEC.md.
//
// Two surfaces inside one card:
//   1. A list of registered passkeys with nickname + last-used + delete
//   2. An "Add passkey" button that triggers the WebAuthn registration
//      flow (server → options → browser prompt → verify)
//
// The browser-side ceremony uses @simplewebauthn/browser which handles
// the JSON ↔ buffer conversion the WebAuthn spec requires. Without
// that wrapper, hand-rolling the encoding is fiddly + security-
// sensitive.

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { startRegistration } from "@simplewebauthn/browser";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Passkey = {
  id: string;
  nickname: string | null;
  transports: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

export function PasskeyManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [nickname, setNickname] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useQuery<{ passkeys: Passkey[] }>({
    queryKey: ["/api/me/passkeys"],
    queryFn: async () => {
      const res = await fetch("/api/me/passkeys", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load passkeys");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/me/passkeys/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove passkey");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/passkeys"] });
      toast({ title: "Passkey removed" });
    },
    onError: (err) => {
      toast({ title: "Could not remove", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    },
  });

  const handleAdd = async () => {
    if (adding) return;
    setAdding(true);
    try {
      // Step 1: get options from server.
      const optsRes = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
        credentials: "include",
      });
      if (!optsRes.ok) throw new Error("Could not start registration");
      const options = await optsRes.json();

      // Step 2: invoke the browser ceremony. This is where Face ID /
      // Touch ID / Windows Hello prompts the user.
      const attestation = await startRegistration({ optionsJSON: options });

      // Step 3: send back to server for verification + storage.
      const verifyRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...attestation, nickname: nickname.trim() || undefined }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err?.error || "Verification failed");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/me/passkeys"] });
      setShowAdd(false);
      setNickname("");
      toast({ title: "Passkey added", description: "You can now sign in with this device." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add passkey";
      // Common failures: user cancelled the OS prompt, no platform
      // authenticator available, same authenticator already registered.
      // Surface the system message; it's usually clear enough.
      toast({ title: "Couldn't add passkey", description: message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  if (isLoading) return null;

  const passkeys = data?.passkeys || [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-primary" />
          <h3 className="font-heading text-base font-semibold text-foreground">Passkeys</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Sign in with Face ID, Touch ID, Windows Hello, or a security key. No password needed.
          Your account password keeps working as a fallback.
        </p>
      </div>

      {passkeys.length > 0 && (
        <ul className="space-y-2">
          {passkeys.map((p) => {
            const lastUsed = p.lastUsedAt
              ? new Date(p.lastUsedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "Never";
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {p.nickname || "Unnamed passkey"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Last used {lastUsed}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(p.id)}
                  disabled={deleteMutation.isPending}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1.5"
                  aria-label="Remove passkey"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!showAdd ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(true)}
          className="rounded-xl"
        >
          <Plus size={14} className="mr-1.5" />
          Add a passkey
        </Button>
      ) : (
        <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
          <label htmlFor="passkey-nickname" className="text-xs font-medium text-foreground">
            Name this passkey (optional)
          </label>
          <Input
            id="passkey-nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="MacBook Pro, iPhone, etc."
            autoComplete="off"
            maxLength={50}
          />
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setShowAdd(false); setNickname(""); }}
              disabled={adding}
              className="flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={adding}
              className="flex-1 rounded-xl"
            >
              {adding ? "Setting up..." : "Set up with Face ID"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
