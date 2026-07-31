import { StyleSheet, View } from 'react-native';

import type { MediaAccessState } from '../core/videoLibrary';
import { spacing } from '../theme';
import { AppText, Button, Screen } from '../ui';

/**
 * Shown while access is undetermined or denied (§9). A denial that the OS will no longer prompt for
 * can only be undone in Settings, so the action changes rather than repeating a prompt that will
 * never appear.
 */
export function PermissionGateScreen({ access }: { access: MediaAccessState }) {
  const exhausted = !access.canAskAgain;

  return (
    <Screen>
      <View style={styles.body}>
        <AppText variant="title">Let CompressHD see your videos</AppText>
        <AppText variant="body" tone="muted">
          CompressHD browses the videos already on this device so you can pick
          one and shrink it. Nothing is uploaded — every video stays on your
          phone.
        </AppText>

        <Button
          label={exhausted ? 'Open settings' : 'Allow video access'}
          onPress={() => {
            if (exhausted) void access.openSettings();
            else void access.request();
          }}
        />

        {exhausted ? (
          <AppText variant="caption" tone="muted">
            Video access is currently turned off for CompressHD.
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
});
