import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme';
import { AppText } from './AppText';

type ToastTone = 'neutral' | 'success' | 'danger';

type Toast = { message: string; tone: ToastTone };

type ToastApi = {
  show: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const VISIBLE_MS = 3200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: ToastTone = 'neutral') => {
    setToast({ message, tone });
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setToast(null), VISIBLE_MS);
  }, []);

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    []
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? <ToastBanner toast={toast} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside a ToastProvider');
  return api;
}

function ToastBanner({ toast }: { toast: Toast }) {
  const insets = useSafeAreaInsets();
  // useState's lazy initializer, not useRef: the value is read during render (it feeds the style).
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [opacity, toast]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          bottom: insets.bottom + spacing.xl,
          backgroundColor: toneColor[toast.tone],
          opacity,
        },
      ]}
    >
      <AppText variant="bodyStrong" tone="inverted">
        {toast.message}
      </AppText>
    </Animated.View>
  );
}

const toneColor: Record<ToastTone, string> = {
  neutral: colors.media,
  success: colors.success,
  danger: colors.danger,
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
  },
});
