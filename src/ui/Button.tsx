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

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
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
  disabled = false,
  busy = false,
  hint,
  style,
}: ButtonProps) {
  const inert = disabled || busy;
  const palette = palettes[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy }}
      disabled={inert}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
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
        <AppText variant="bodyStrong" style={{ color: palette.text }}>
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

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  labels: { alignItems: 'center' },
  hint: { opacity: 0.85, marginTop: 2 },
  inert: { opacity: 0.45 },
});
