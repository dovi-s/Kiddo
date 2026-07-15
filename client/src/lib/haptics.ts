type HapticIntensity = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' | 'gift' | 'milestone';

// Web-fallback patterns (navigator.vibrate). Android browsers/PWA honor these;
// iOS Safari ignores the Vibration API entirely — which is exactly why the
// native path below matters (the Taptic Engine is the only way an iPhone feels
// the gift moment).
const patterns: Record<HapticIntensity, number[]> = {
  light: [10],
  medium: [20],
  heavy: [30],
  success: [10, 50, 20],
  warning: [30, 50, 30],
  error: [50, 30, 50, 30, 50],
  selection: [5],
  gift: [15, 80, 25],      // double-pulse: something arrived
  milestone: [80, 60, 120], // long warm rumble: applause through the floor
};

let _userHasInteracted = false;
if (typeof document !== 'undefined') {
  const markInteracted = () => { _userHasInteracted = true; };
  document.addEventListener('pointerdown', markInteracted, { once: true, passive: true });
  document.addEventListener('keydown', markInteracted, { once: true, passive: true });
}

// True only inside the Capacitor native shell (iOS/Android app), false on the
// web + installed PWA. Capacitor injects `window.Capacitor`; reading the global
// (vs importing @capacitor/core) keeps the web bundle from eagerly pulling in
// Capacitor.
function isNativeShell(): boolean {
  try {
    return typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

// Lazy-load @capacitor/haptics ONLY in the native shell (dynamic import → its own
// chunk, never fetched on web). Cached after first use.
let _hapticsModule: typeof import('@capacitor/haptics') | null = null;
async function fireNative(intensity: HapticIntensity): Promise<void> {
  try {
    if (!_hapticsModule) _hapticsModule = await import('@capacitor/haptics');
    const { Haptics, ImpactStyle, NotificationType } = _hapticsModule;
    switch (intensity) {
      case 'light': return void Haptics.impact({ style: ImpactStyle.Light });
      case 'medium': return void Haptics.impact({ style: ImpactStyle.Medium });
      case 'heavy': return void Haptics.impact({ style: ImpactStyle.Heavy });
      case 'success': return void Haptics.notification({ type: NotificationType.Success });
      case 'warning': return void Haptics.notification({ type: NotificationType.Warning });
      case 'error': return void Haptics.notification({ type: NotificationType.Error });
      case 'selection': return void Haptics.selectionChanged();
      case 'gift':
        // double-pulse, "something arrived": a firm tap then a soft echo.
        await Haptics.impact({ style: ImpactStyle.Medium });
        setTimeout(() => { void Haptics.impact({ style: ImpactStyle.Light }); }, 90);
        return;
      case 'milestone':
        // warm crescendo, "applause through the floor".
        await Haptics.impact({ style: ImpactStyle.Heavy });
        setTimeout(() => { void Haptics.impact({ style: ImpactStyle.Medium }); }, 70);
        setTimeout(() => { void Haptics.impact({ style: ImpactStyle.Heavy }); }, 150);
        return;
    }
  } catch {
    // Plugin missing/unavailable — silently no-op (no web fallback here; the
    // native shell has no Vibration API to fall back to anyway).
  }
}

export function haptic(intensity: HapticIntensity = 'light'): void {
  if (!_userHasInteracted) return;
  // Native shell → real Taptic Engine (iOS) / native vibrator (Android).
  if (isNativeShell()) {
    void fireNative(intensity);
    return;
  }
  // Web / PWA → Vibration API (Android honors it; iOS browser ignores it).
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(patterns[intensity]);
    } catch {
    }
  }
}

export function hapticOnClick(intensity: HapticIntensity = 'light') {
  return () => haptic(intensity);
}

export function withHaptic<T extends (...args: unknown[]) => unknown>(
  fn: T,
  intensity: HapticIntensity = 'light'
): T {
  return ((...args: unknown[]) => {
    haptic(intensity);
    return fn(...args);
  }) as T;
}
