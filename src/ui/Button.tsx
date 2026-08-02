import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '../theme';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

/** `sm` is for buttons that sit inside a bar rather than owning a row of their own. */
type Size = 'md' | 'sm';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  busy?: boolean;
  /** Secondary line under the label, e.g. "Original capture date + location". */
  hint?: string;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  busy = false,
  hint,
  style,
}: ButtonProps) {
  const inert = disabled || busy;
  const palette = palettes[variant];
  const metrics = sizes[size];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy }}
      disabled={inert}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        metrics.container,
        {
          backgroundColor:
            pressed && !inert ? palette.pressed : palette.background,
        },
        palette.border ? { borderWidth: 1, borderColor: palette.border } : null,
        inert ? styles.inert : null,
        style,
      ]}
    >
      <View style={styles.labels}>
        <AppText variant={metrics.label} style={{ color: palette.text }}>
          {label}
        </AppText>
        {hint ? (
          <AppText
            variant="caption"
            style={[styles.hint, { color: palette.text }]}
          >
            {hint}
          </AppText>
        ) : null}
      </View>
      {busy ? <ActivityIndicator color={palette.text} /> : null}
    </Pressable>
  );
}

const palettes: Record<
  Variant,
  { background: string; pressed: string; text: string; border?: string }
> = {
  primary: {
    background: colors.accent,
    pressed: colors.accentPressed,
    text: colors.textInverted,
  },
  secondary: {
    background: colors.background,
    pressed: colors.surface,
    text: colors.text,
    border: colors.border,
  },
  danger: {
    background: colors.dangerSoft,
    pressed: colors.surfaceSunken,
    text: colors.danger,
  },
  ghost: {
    background: 'transparent',
    pressed: colors.surface,
    text: colors.accent,
  },
};

const sizes: Record<
  Size,
  { container: ViewStyle; label: 'bodyStrong' | 'captionStrong' }
> = {
  md: {
    container: {
      minHeight: 48,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
    },
    label: 'bodyStrong',
  },
  sm: {
    container: {
      minHeight: 36,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
    },
    label: 'captionStrong',
  },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  labels: { alignItems: 'center' },
  hint: { opacity: 0.85, marginTop: 2 },
  inert: { opacity: 0.45 },
});
