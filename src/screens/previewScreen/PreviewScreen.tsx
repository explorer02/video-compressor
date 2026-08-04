import { ScrollView } from 'react-native';

import type { CompressionOutcome } from '../../core/compression/types';
import { playbackSource } from '../../core/videoLibrary';
import { ComparisonStage } from '../../features/outcome/ComparisonStage';
import { useSaveOutcome } from '../../features/outcome/useSaveOutcome';
import { Screen, useHardwareBack, useToast } from '../../ui';
import { SaveActions } from './components/SaveActions';
import { SizeComparison } from './components/SizeComparison';
import { SourceDetails } from './components/SourceDetails';
import { styles } from './styles';

export type PreviewScreenProps = {
  outcome: CompressionOutcome;
  onFinished: () => void;
};

/** §3.4 — watch the result, see what it saved, then decide what happens to it. */
export function PreviewScreen({ outcome, onFinished }: PreviewScreenProps) {
  const toast = useToast();

  const save = useSaveOutcome({
    outcome,
    onSaved: message => {
      toast.show(message, 'success');
      onFinished();
    },
    onDiscarded: onFinished,
    onFailed: message => toast.show(message, 'danger'),
  });

  // Back returns to the library; while a save is in flight there is nothing safe to back out to.
  useHardwareBack(save.busy ? null : onFinished);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {/* One player, two sources: flipping between them on the same scene is what makes a
            quality difference visible, which two small players side by side would not. */}
        <ComparisonStage
          original={playbackSource(outcome.video.id)}
          compressed={outcome.outputPath}
          source={outcome.source}
        />

        <SizeComparison
          sourceBytes={outcome.source.sizeBytes}
          outputBytes={outcome.outputSizeBytes}
        />

        <SourceDetails outcome={outcome} />

        <SaveActions save={save} outcome={outcome} />
      </ScrollView>
    </Screen>
  );
}
