import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';

import { spacing, typography, type TypographyVariant } from '../theme';
import { AppText } from './AppText';

const meta = {
  title: 'UI/AppText',
  component: AppText,
} satisfies Meta<typeof AppText>;

export default meta;
type Story = StoryObj<typeof meta>;

const VARIANTS = Object.keys(typography) as TypographyVariant[];

/** Every text style in the app, in one specimen. */
export const Specimen: Story = {
  render: () => (
    <View style={{ gap: spacing.md, padding: spacing.lg }}>
      {VARIANTS.map(variant => (
        <AppText key={variant} variant={variant}>
          {variant} — 2.4 GB → 96 MB
        </AppText>
      ))}
      <AppText tone="muted">tone: muted</AppText>
      <AppText tone="accent">tone: accent</AppText>
    </View>
  ),
};
