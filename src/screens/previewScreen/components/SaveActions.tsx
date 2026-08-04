import { StyleSheet, View } from 'react-native';

import type { CompressionOutcome } from '../../../core/compression/types';
import {
  canCarryLocation,
  canKeepOriginalMetadata,
} from '../../../core/metadata';
import type { SaveOutcome } from '../../../features/outcome/useSaveOutcome';
import { spacing } from '../../../theme';
import { Button } from '../../../ui';
import { REPLACE_HINT } from '../constants';
import { replaceLabel } from '../utils';

/**
 * The four ways out of the preview (§3.4). Inside the scroll on purpose: a sticky footer of four
 * buttons left the content a few lines of cramped scroll area. The page scrolls as one; the
 * actions end it.
 */
export function SaveActions({
  save,
  outcome,
}: {
  save: SaveOutcome;
  outcome: CompressionOutcome;
}) {
  return (
    <View style={styles.actions}>
      {canKeepOriginalMetadata ? (
        <Button
          label="Save as copy"
          hint={
            canCarryLocation
              ? 'Keeps the original dates and location'
              : 'Keeps the original dates'
          }
          busy={save.busy}
          onPress={() => save.saveCopy('original')}
        />
      ) : null}
      <Button
        label={
          canKeepOriginalMetadata ? 'Save with a new date' : 'Save as copy'
        }
        variant={canKeepOriginalMetadata ? 'secondary' : 'primary'}
        hint="Creation date is today, location not carried over"
        busy={save.busy}
        onPress={() => save.saveCopy('fresh')}
      />
      {/* No in-app confirmation: the OS shows its own unavoidable delete dialog, and a second
          prompt of ours in front of it read as asking twice. The stakes go on the button. */}
      <Button
        label={replaceLabel(outcome)}
        variant="danger"
        hint={REPLACE_HINT}
        disabled={save.busy}
        onPress={save.replaceOriginal}
      />
      <Button
        label="Discard"
        variant="ghost"
        onPress={save.discard}
        disabled={save.busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The scroll content already pads the sides; the top gap comes from the container's own `gap`.
  actions: { gap: spacing.sm },
});
