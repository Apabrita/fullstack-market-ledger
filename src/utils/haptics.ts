import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const triggerHaptic = async (type: 'success' | 'heavy' | 'light' | 'warning') => {
  if (typeof window === 'undefined' || !(window as any).Capacitor?.isNativePlatform()) {
    // Optionally fallback to standard web vibration API
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'success') navigator.vibrate([100, 50, 100]);
      if (type === 'heavy') navigator.vibrate(200);
      if (type === 'light') navigator.vibrate(50);
      if (type === 'warning') navigator.vibrate([50, 50, 50, 50]);
    }
    return;
  }

  try {
    switch (type) {
      case 'success':
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case 'warning':
        await Haptics.notification({ type: NotificationType.Warning });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
    }
  } catch (e) {
    console.error('Haptics failed', e);
  }
};
