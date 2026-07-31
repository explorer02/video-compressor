import type {
  CompressionOutcome,
  QualityTierId,
  SourceVideo,
} from '../../core/compression/types';
import type { LibraryVideo } from '../../core/videoLibrary/types';

/**
 * The §3 user flow, as a state machine. Each state carries exactly what that screen needs, so a
 * screen can never render without its data.
 */
export type FlowState =
  | { name: 'library' }
  | { name: 'selected'; video: LibraryVideo; source: SourceVideo }
  | {
      name: 'compressing';
      video: LibraryVideo;
      source: SourceVideo;
      tier: QualityTierId;
    }
  | { name: 'preview'; outcome: CompressionOutcome };

export type FlowStateName = FlowState['name'];

export type FlowActions = {
  select: (video: LibraryVideo, source: SourceVideo) => void;
  startCompressing: (tier: QualityTierId) => void;
  showPreview: (outcome: CompressionOutcome) => void;
  backToLibrary: () => void;
  /** Return to the tier picker — used by Cancel and by retry after a failed or suspended job. */
  backToSelection: () => void;
};

export type Flow = {
  state: FlowState;
  actions: FlowActions;
};
