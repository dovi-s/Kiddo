// Two-factor authentication (TOTP) management — parent account Security tab.
// Backed by /api/auth/2fa/{status,setup,enable,disable} (see server/totp.ts,
// RFC 6238). Enrollment never enables 2FA until a live code is verified; turn-
// off requires a current code or a single-use backup code.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { demoBlocked } from "@/lib/demo-block";

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as any)?.error || "Something went wrong") as Error & { data?: any };
    err.data = data;
    throw err;
  }
  return data as any;
}

type Phase = "idle" | "setup" | "backup" | "disable";

export function TwoFactorCard() {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const { data: status, isLoading } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/auth/2fa/status"],
    queryFn: async () => {
      const res = await fetch("/api/auth/2fa/status", { credentials: "include" });
      if (!res.ok) return { enabled: false };
      return res.json();
    },
    staleTime: 30_000,
  });

  const reset = () => { setPhase("idle"); setCode(""); setPassword(""); setNeedsPassword(false); setSetupData(null); };

  const setupMutation = useMutation({
    mutationFn: () => postJson("/api/auth/2fa/setup"),
    onSuccess: (d) => { setSetupData(d); setPhase("setup"); },
    onError: (e: any) => toast({ title: "Could not start setup", description: e.message }),
  });

  const enableMutation = useMutation({
    mutationFn: () => postJson("/api/auth/2fa/enable", { code: code.trim(), currentPassword: password }),
    onSuccess: (d) => {
      if (demoBlocked(d, toast)) return;
      haptic("success");
      setBackupCodes(Array.isArray(d?.backupCodes) ? d.backupCodes : []);
      setCode("");
      setPassword("");
      setNeedsPassword(false);
      setPhase("backup");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/2fa/status"] });
    },
    onError: (e: any) => {
      // Step-up: a password account must confirm its password before 2FA turns
      // on. Reveal the field and let the user re-submit. (OAuth accounts never
      // hit this — the server exempts them.)
      if (e?.data?.needsPassword) {
        setNeedsPassword(true);
        toast({ title: "Confirm your password", description: "Enter your account password to turn on two-factor." });
        return;
      }
      haptic("error");
      toast({ title: "Verification failed", description: e.message });
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => postJson("/api/auth/2fa/disable", { code: code.trim() }),
    onSuccess: (d) => {
      if (demoBlocked(d, toast)) return;
      haptic("success");
      reset();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/2fa/status"] });
      toast({ title: "Two-factor turned off" });
    },
    onError: (e: any) => { haptic("error"); toast({ title: "Could not turn off", description: e.message }); },
  });

  const copyBackup = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — codes are visible to copy manually */ }
  };

  const enabled = Boolean(status?.enabled);

  return (
    <div className="kiddo-card p-5" data-testid="card-two-factor">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${enabled ? "bg-[hsl(var(--kiddo-evergreen)/0.12)]" : "bg-muted/50"}`}>
          {enabled ? <ShieldCheck size={18} className="text-[hsl(var(--kiddo-evergreen))]" /> : <ShieldOff size={18} className="text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">Two-factor authentication</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            {isLoading
              ? "Checking status..."
              : enabled
                ? "On. You'll enter a code from your authenticator app each time you sign in."
                : "Add a second step at sign-in with an authenticator app (Google Authenticator, Authy, 1Password)."}
          </p>

          {/* IDLE */}
          {!isLoading && phase === "idle" && (
            <div className="mt-3">
              {enabled ? (
                <button
                  type="button"
                  onClick={() => { setPhase("disable"); }}
                  className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-destructive/50"
                  data-testid="button-2fa-disable-start"
                >
                  Turn off
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { haptic("selection"); setupMutation.mutate(); }}
                  disabled={setupMutation.isPending}
                  className="rounded-xl bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
                  data-testid="button-2fa-enable-start"
                >
                  {setupMutation.isPending ? "Starting..." : "Turn on two-factor"}
                </button>
              )}
            </div>
          )}

          {/* SETUP — show QR + secret + verify */}
          {phase === "setup" && setupData && (
            <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-semibold text-foreground">1. Scan with your authenticator app</p>
              <div className="mt-3 flex justify-center rounded-lg bg-white p-3">
                <QRCodeSVG value={setupData.otpauthUri} size={160} />
              </div>
              <p className="mt-3 text-2xs text-muted-foreground">Can't scan? Enter this key manually:</p>
              <p className="mt-1 break-all rounded-lg bg-background px-2 py-1.5 text-center text-xs font-mono tabular-nums text-foreground" data-testid="text-2fa-secret">{setupData.secret}</p>
              <p className="mt-3 text-xs font-semibold text-foreground">2. Enter the 6-digit code it shows</p>
              <input
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-center text-base tracking-[0.3em] tabular-nums outline-none focus:border-[hsl(var(--kiddo-evergreen))]"
                data-testid="input-2fa-enable-code"
              />
              {needsPassword && (
                <>
                  <p className="mt-3 text-xs font-semibold text-foreground">3. Confirm your password</p>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your account password"
                    className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--kiddo-evergreen))]"
                    data-testid="input-2fa-enable-password"
                  />
                </>
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={reset} className="flex-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground">Cancel</button>
                <button
                  type="button"
                  onClick={() => enableMutation.mutate()}
                  disabled={!code.trim() || (needsPassword && !password) || enableMutation.isPending}
                  className="flex-1 rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
                  data-testid="button-2fa-enable-confirm"
                >
                  {enableMutation.isPending ? "Verifying..." : "Verify & turn on"}
                </button>
              </div>
            </div>
          )}

          {/* BACKUP CODES — shown once */}
          {phase === "backup" && (
            <div className="mt-4 rounded-xl border border-[hsl(var(--kiddo-gold)/0.4)] bg-[hsl(var(--kiddo-gold)/0.06)] p-4">
              <p className="text-xs font-bold text-foreground">Save your backup codes</p>
              <p className="mt-1 text-2xs text-muted-foreground leading-relaxed">
                Each works once if you lose your authenticator. Store them somewhere safe. You won't see them again.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {backupCodes.map((c) => (
                  <span key={c} className="rounded bg-background px-2 py-1 text-center text-xs font-mono tabular-nums text-foreground">{c}</span>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={copyBackup} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground">
                  {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copied" : "Copy codes"}
                </button>
                <button type="button" onClick={reset} className="flex-1 rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background" data-testid="button-2fa-backup-done">
                  I've saved them
                </button>
              </div>
            </div>
          )}

          {/* DISABLE — require a code */}
          {phase === "disable" && (
            <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-semibold text-foreground">Enter a code to turn off two-factor</p>
              <p className="mt-1 text-2xs text-muted-foreground">A current authenticator code or a backup code.</p>
              <input
                inputMode="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-center text-base tracking-[0.2em] tabular-nums outline-none focus:border-destructive"
                data-testid="input-2fa-disable-code"
              />
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={reset} className="flex-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground">Cancel</button>
                <button
                  type="button"
                  onClick={() => disableMutation.mutate()}
                  disabled={!code.trim() || disableMutation.isPending}
                  className="flex-1 rounded-xl bg-destructive px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  data-testid="button-2fa-disable-confirm"
                >
                  {disableMutation.isPending ? "Turning off..." : "Turn off"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
