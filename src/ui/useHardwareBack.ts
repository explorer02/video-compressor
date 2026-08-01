import { useEffect } from 'react';
import { BackHandler } from 'react-native';

/**
 * Runs `handler` when Android's hardware back is pressed, swallowing the default (exit the app).
 * Pass `null` to leave the default in place — each screen owns what back means for it.
 */
export function useHardwareBack(handler: (() => void) | null): void {
  useEffect(() => {
    if (!handler) return;

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        handler();
        return true;
      }
    );
    return () => subscription.remove();
  }, [handler]);
}
