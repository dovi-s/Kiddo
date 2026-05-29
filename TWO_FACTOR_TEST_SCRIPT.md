# Two-Factor Auth — Founder Validation Script

> Run this ONCE on a real account after deploy. It's the one flow I couldn't
> test in the build env (no authenticator app / no interactive login). Until it
> passes, treat 2FA as unverified. **No existing user is affected meanwhile** —
> the login gate only activates for accounts that opt in, so anyone who doesn't
> run this is on the unchanged login path.
>
> You'll need an authenticator app (Google Authenticator, Authy, or 1Password).
> Best on a test/staging account first; if anything is wrong you have the
> recovery path in §6.

## 1. Enroll
1. Sign in, go to **Account → Security**. You should see a "Two-factor
   authentication" card reading **off**.
2. Tap **Turn on two-factor**. A QR code + a manual key + a code field appear.
3. Scan the QR with your authenticator app (or type the key). The app should now
   show a rotating 6-digit code for "Kiddo:<your-email>".
4. Type the current 6-digit code → **Verify & turn on**.
   - ✅ PASS: the card flips to a gold "Save your backup codes" panel.
   - ❌ FAIL: "That code did not match." → your phone clock may be off (enable
     automatic time), or the secret was mistyped. Re-scan and retry.

## 2. Backup codes
1. The panel shows 10 codes. Tap **Copy codes**, paste them somewhere safe.
2. Tap **I've saved them**. The card now reads **on**.

## 3. The real test — log out and back in
1. Log out.
2. Sign in with email + password.
   - ✅ PASS: you are NOT logged straight in — a "Two-factor verification" dialog
     asks for a code.
   - ❌ FAIL (logged straight in): the gate didn't fire — STOP and report.
3. Enter the current authenticator code → **Verify and sign in**.
   - ✅ PASS: you land on the dashboard.

## 4. Negative checks (prove it actually blocks)
1. Log out, sign in with password, enter a **wrong** code (e.g. 000000).
   - ✅ PASS: "That code didn't match," no session created.
2. Wait out the dialog ~5+ min then try a code.
   - ✅ PASS: "Your sign-in step expired" (the pending step times out).

## 5. Backup code + disable
1. Log out, sign in with password, and at the 2FA dialog enter **one of your
   backup codes** instead of the app code.
   - ✅ PASS: you sign in. That code is now spent (single-use) — confirm the same
     backup code is REJECTED on a later login.
2. Go to **Account → Security → Turn off**, enter a current app code (or another
   backup code) → **Turn off**.
   - ✅ PASS: card returns to **off**; next login needs no code.

## 6. Recovery (if you ever lock yourself out)
- Use a **backup code** at the login dialog (§5).
- If backup codes are also lost, an admin can clear 2FA in the DB:
  ```sql
  UPDATE users
  SET totp_enabled = false, totp_secret = NULL,
      totp_pending_secret = NULL, totp_backup_codes = NULL
  WHERE email = '<your-email>';
  ```
  Next login then needs only the password.

## 7. Audit trail (optional verification)
After enabling/disabling, confirm rows landed in `audit_logs`:
```sql
SELECT action, created_at FROM audit_logs
WHERE action IN ('totp_enabled','totp_disabled') ORDER BY created_at DESC LIMIT 5;
```

## What "pass" means
§1–§5 all ✅ → 2FA is validated end-to-end. Update
`SECURITY_AND_COMPLIANCE_POSTURE.md` to drop the "founder test pending" caveat.
