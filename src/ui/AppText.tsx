import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors, typography, type TypographyVariant } from '../theme';

type Tone = 'default' | 'muted' | 'inverted' | 'accent' | 'danger' | 'success';

const toneColor: Record<Tone, string> = {
  default: colors.text,
  muted: colors.textMuted,
  inverted: colors.textInverted,
  accent: colors.accent,
  danger: colors.danger,
  success: colors.success,
};

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  tone?: Tone;
};

export function AppText({
  variant = 'body',
  tone = 'default',
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        typography[variant] as TextStyle,
        { color: toneColor[tone] },
        style,
      ]}
    />
  );
}
