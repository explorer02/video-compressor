import type { BatchSaveAction } from '../../../app/flow/types';
import type { LibraryVideo } from '../../../core/videoLibrary';

export type BatchItemPhase =
  'pending' | 'compressing' | 'saving' | 'done' | 'skipped' | 'failed';

export type BatchItem = {
  video: LibraryVideo;
  action: BatchSaveAction;
  phase: BatchItemPhase;
  /** 0–1, meaningful while compressing. */
  progress: number;
  sourceSizeBytes: number | null;
  outputSizeBytes: number | null;
  /** Replace items only: null until the system dialog resolves, then whether it really happened. */
  replaced: boolean | null;
  /** Why the item was skipped or failed. */
  note: string | null;
};

export type BatchJobPhase = 'running' | 'replacing' | 'finished';

export type BatchJob = {
  items: BatchItem[];
  phase: BatchJobPhase;
  /** True when the user stopped the queue early; finished items are already saved. */
  cancelled: boolean;
  /** Duration-weighted, across the whole batch. */
  overallProgress: number;
  elapsedMs: number;
  etaMs: number | null;
  savedBytes: number;
  compressedCount: number;
  cancel: () => void;
};
