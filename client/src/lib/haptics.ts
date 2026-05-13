type HapticIntensity = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' | 'gift' | 'milestone';

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

export function haptic(intensity: HapticIntensity = 'light'): void {
  if (!_userHasInteracted) return;
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
