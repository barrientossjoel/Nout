/**
 * Haptic feedback utility for mobile environments (APK/Android & iOS)
 * Follows Google Material Design 3 and Apple Human Interface Guidelines for tactile feedback.
 */
export type HapticFeedbackType = 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export function triggerHaptic(type: HapticFeedbackType = 'light'): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) {
    return;
  }

  try {
    switch (type) {
      case 'selection':
        navigator.vibrate(8);
        break;
      case 'light':
        navigator.vibrate(15);
        break;
      case 'medium':
        navigator.vibrate(25);
        break;
      case 'heavy':
        navigator.vibrate(40);
        break;
      case 'success':
        navigator.vibrate([10, 50, 20]);
        break;
      case 'warning':
        navigator.vibrate([20, 40, 20]);
        break;
      case 'error':
        navigator.vibrate([40, 60, 40]);
        break;
      default:
        navigator.vibrate(12);
        break;
    }
  } catch {
    // Graceful fallback on environments where vibration is restricted
  }
}
