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
/** What happens to each video of a batch when its compression succeeds. */
export type BatchSaveAction = 'copy' | 'replace';

/** How copies carry metadata; batch replacements always keep the original's (§3.4). */
export type BatchCopyMetadata = 'original' | 'fresh';

export type BatchPlanItem = {
  video: LibraryVideo;
  action: BatchSaveAction;
};

export type BatchPlan = {
  items: BatchPlanItem[];
  tier: QualityTierId;
  copyMetadata: BatchCopyMetadata;
};

export type FlowState =
  | { name: 'library' }
  | { name: 'selected'; video: LibraryVideo }
  | {
      name: 'compressing';
      video: LibraryVideo;
      source: SourceVideo;
      tier: QualityTierId;
    }
  | { name: 'preview'; outcome: CompressionOutcome }
  | { name: 'batchSetup'; videos: LibraryVideo[] }
  | { name: 'batchCompressing'; plan: BatchPlan };

export type FlowStateName = FlowState['name'];

export type FlowActions = {
  select: (video: LibraryVideo) => void;
  startCompressing: (source: SourceVideo, tier: QualityTierId) => void;
  showPreview: (outcome: CompressionOutcome) => void;
  backToLibrary: () => void;
  /** Return to the tier picker — used by Cancel and by retry after a failed or suspended job. */
  backToSelection: () => void;
  /** The multi-select "Compress" entry point: choose tier and per-video actions first. */
  startBatchSetup: (videos: LibraryVideo[]) => void;
  startBatch: (plan: BatchPlan) => void;
};

export type Flow = {
  state: FlowState;
  actions: FlowActions;
};
