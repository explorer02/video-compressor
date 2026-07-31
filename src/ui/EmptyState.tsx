import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

export type EmptyStateProps = {
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <AppText variant="heading" style={styles.centered}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" tone="muted" style={styles.centered}>
          {message}
        </AppText>
      ) : null}
      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  centered: { textAlign: 'center' },
});
