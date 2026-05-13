// Biometric (Face ID / Touch ID / Fingerprint) wrapper for the Kiddo
// mobile app. Single source of truth for the smart-lock policy.
//
// Per FACE_ID_SPEC.md: banking-app-style biometric gate on top of the
// existing session. Off by default; user opts in from Settings. Once
// on, prompts on cold launch + after 5 minutes background.
//
// This file hides expo-local-authentication and expo-secure-store
// behind a small API surface. Callers (App.tsx, LockScreen.tsx,
// DashboardScreen.tsx settings toggle) never import those libraries
// directly — they go through this wrapper. Two reasons:
//   1. The 5-minute window is a single constant we can tune in one place.
//   2. Future surface swaps (e.g. add a custom PIN fallback later) stay
//      contained to this module.
//
// Notes for testing per the spec: Face ID requires a real device or the
// iOS simulator's "Hardware → Face ID/Touch ID" menu. Won't run in
// Expo Go (native module) — the wrapper detects that case and surfaces
// a friendly "Face ID isn't available in this build" message instead
// of throwing.

import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

// Keys live in SecureStore (encrypted Keychain on iOS, EncryptedSharedPreferences
// on Android). AsyncStorage isn't encrypted by default — kept the preference
// in SecureStore for defense-in-depth even though "biometric on/off" isn't a
// secret per se.
const KEY_BIOMETRIC_ENABLED = "kiddo_biometric_enabled";
const KEY_LAST_ACTIVE_AT = "kiddo_last_active_at_ms";

// 5 minutes per FACE_ID_SPEC.md decision. Industry norm (Robinhood,
// Acorns, Greenlight). Change this constant — not the call sites — if
// the policy ever revisits.
export const BACKGROUND_RELOCK_MS = 5 * 60 * 1000;

export type BiometricCapability = {
  supported: boolean;
  // "enrolled" means the user has an actual face/finger registered with
  // the OS. A device CAN support biometrics (has the hardware) but have
  // no enrollment — in which case authenticateAsync silently falls
  // through to device passcode, or fails if no passcode is set either.
  enrolled: boolean;
  // Human-readable reason for the disabled state. Surfaced verbatim on
  // the Settings toggle when supported=false so the user knows what
  // to fix on their device.
  reason?: string;
};

export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return {
        supported: false,
        enrolled: false,
        reason: "This device doesn't support Face ID or fingerprint.",
      };
    }
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      return {
        supported: false,
        enrolled: false,
        reason: "Set up Face ID or fingerprint in your device settings first.",
      };
    }
    return { supported: true, enrolled: true };
  } catch (err) {
    // Expo Go path lands here — the native module isn't bundled. Don't
    // crash the app; just disable the toggle gracefully.
    return {
      supported: false,
      enrolled: false,
      reason: "Face ID isn't available in this build.",
    };
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(KEY_BIOMETRIC_ENABLED);
    return raw === "1";
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(on: boolean): Promise<void> {
  try {
    if (on) {
      await SecureStore.setItemAsync(KEY_BIOMETRIC_ENABLED, "1");
    } else {
      await SecureStore.deleteItemAsync(KEY_BIOMETRIC_ENABLED);
    }
  } catch {
    // SecureStore failures are non-fatal — the lock just won't engage
    // on next launch. The toggle UI will refresh and show the actual
    // persisted state when the user reopens Settings.
  }
}

export type AuthResult =
  | { success: true }
  | { success: false; reason: "cancelled" | "lockout" | "unsupported" | "unknown"; message?: string };

export async function authenticate(promptMessage: string): Promise<AuthResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      // Cancel label appears alongside the Face ID prompt sheet. Keep
      // it neutral — "Cancel" not "Sign out", because cancelling and
      // signing out are two different decisions. The LockScreen surfaces
      // a separate Sign-out button for that case.
      cancelLabel: "Cancel",
      // disableDeviceFallback=false → after 2 failed Face ID attempts,
      // the system offers device passcode as a fallback. That's the
      // expected banking-app behavior and matches the spec.
      disableDeviceFallback: false,
      // 3 retries before lockout. Beyond that the OS itself locks
      // biometric for a cooldown period — system-managed, we just
      // surface the result.
    });
    if (result.success) return { success: true };
    // expo-local-authentication error codes for SDK 54:
    //   "user_cancel" lives in the runtime but isn't part of the typed
    //   union — the union currently lists "authentication_failed" /
    //   "user_fallback" / "not_available" / etc. We treat
    //   "authentication_failed" + "user_fallback" as soft cancellations
    //   so the LockScreen's "Try again" button stays the recovery,
    //   not a red-banner error.
    const err = String(result.error || "");
    if (err === "authentication_failed" || err === "user_fallback" || err.toLowerCase().includes("cancel")) {
      return { success: false, reason: "cancelled" };
    }
    if (err === "not_enrolled" || err === "passcode_not_set" || err === "not_available") {
      return {
        success: false,
        reason: "unsupported",
        message: "Set up Face ID or a passcode on this device first.",
      };
    }
    if (err.toLowerCase().includes("lockout")) {
      return { success: false, reason: "lockout", message: "Too many attempts. Try again later or use your passcode." };
    }
    return { success: false, reason: "unknown", message: err || "Couldn't verify your identity." };
  } catch (err) {
    // Native module missing (Expo Go) — same friendly degrade as
    // getBiometricCapability above.
    return {
      success: false,
      reason: "unsupported",
      message: "Face ID isn't available in this build.",
    };
  }
}

// Background-time tracking. Called from App.tsx AppState listener:
//   - On AppState "background"  → recordAppActiveAt() stamps now()
//   - On AppState "active"      → getSecondsSinceLastActive() decides
//                                  whether to push to the locked screen
//
// SecureStore persists across process restarts. We deliberately CLEAR
// the timestamp on every cold launch via clearLastActive() in App.tsx's
// boot path — cold launches always lock when the toggle is on, regardless
// of when the user last had the app active. This matches the spec
// ("process restart invalidates the 'last active' timestamp").
export async function recordAppActiveAt(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY_LAST_ACTIVE_AT, String(Date.now()));
  } catch {
    // Non-fatal; worst case the next foreground prompts unnecessarily.
  }
}

export async function getMillisSinceLastActive(): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(KEY_LAST_ACTIVE_AT);
    if (!raw) return Number.POSITIVE_INFINITY;
    const stamp = Number(raw);
    if (!Number.isFinite(stamp)) return Number.POSITIVE_INFINITY;
    return Math.max(0, Date.now() - stamp);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export async function clearLastActive(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY_LAST_ACTIVE_AT);
  } catch {
    // Non-fatal.
  }
}
