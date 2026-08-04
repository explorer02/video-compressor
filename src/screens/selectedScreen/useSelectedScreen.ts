import { useToastedDeletion } from '../../features/library/useToastedDeletion';
import { useHardwareBack } from '../../ui';
import { useStartCompression } from './hooks/useStartCompression';
import { useTierChoice } from './hooks/useTierChoice';
import type { SelectedScreenProps } from './SelectedScreen';

/** All of the selected-video state and verbs; the screen component only renders them. */
export function useSelectedScreen({
  video,
  onBack,
  onStart,
}: SelectedScreenProps) {
  useHardwareBack(onBack);

  const choice = useTierChoice(video);
  const { start, resolving } = useStartCompression({
    video,
    tier: choice.tier,
    onStart,
    onBack,
  });
  const deletion = useToastedDeletion({ onDeleted: onBack });

  return { ...choice, start, resolving, deletion };
}
