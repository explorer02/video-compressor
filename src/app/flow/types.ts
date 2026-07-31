import type {
  CompressionOutcome,
  QualityTierId,
  SourceVideo,
} from '../../core/compression/types';
import type { LibraryVideo } from '../../core/videoLibrary';

/**
 * The §3 user flow, as a state machine. Each state carries exactly what that screen needs, so a
 * screen can never render without its data.
 *
 * `selected` deliberately holds only the library row: resolving a `SourceVideo` means a real path,
 * which on iOS round-trips through `PHImageManager.requestAVAsset` (and exports a whole file for
 * slow-motion clips). That cost belongs to starting a compression, not to tapping a row.
 */
export type FlowState =
  | { name: 'library' }
  | { name: 'selected'; video: LibraryVideo }
  | {
      name: 'compressing';
      video: LibraryVideo;
      source: SourceVideo;
      tier: QualityTierId;
    }
  | { name: 'preview'; outcome: CompressionOutcome };

export type FlowStateName = FlowState['name'];

export type FlowActions = {
  select: (video: LibraryVideo) => void;
  startCompressing: (source: SourceVideo, tier: QualityTierId) => void;
  showPreview: (outcome: CompressionOutcome) => void;
  backToLibrary: () => void;
  /** Return to the tier picker — used by Cancel and by retry after a failed or suspended job. */
  backToSelection: () => void;
};

export type Flow = {
  state: FlowState;
  actions: FlowActions;
};
