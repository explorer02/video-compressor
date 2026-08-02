import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  CompressionOutcome,
  QualityTierId,
  SourceVideo,
} from '../../core/compression/types';
import type { LibraryVideo } from '../../core/videoLibrary';
import type { BatchPlan, Flow, FlowState } from './types';

const FlowContext = createContext<Flow | null>(null);

const LIBRARY: FlowState = { name: 'library' };

export function FlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlowState>(LIBRARY);

  const flow = useMemo<Flow>(
    () => ({
      state,
      actions: {
        select: (video: LibraryVideo) => setState({ name: 'selected', video }),

        startCompressing: (source: SourceVideo, tier: QualityTierId) =>
          setState(current =>
            current.name === 'selected'
              ? { name: 'compressing', video: current.video, source, tier }
              : current
          ),

        showPreview: (outcome: CompressionOutcome) =>
          setState({ name: 'preview', outcome }),

        backToLibrary: () => setState(LIBRARY),

        startBatchSetup: (videos: LibraryVideo[]) =>
          setState(
            videos.length > 0 ? { name: 'batchSetup', videos } : LIBRARY
          ),

        startBatch: (plan: BatchPlan) =>
          setState(current =>
            current.name === 'batchSetup' && plan.items.length > 0
              ? { name: 'batchCompressing', plan }
              : current
          ),

        backToSelection: () =>
          setState(current => {
            const video = videoOf(current);
            return video ? { name: 'selected', video } : LIBRARY;
          }),
      },
    }),
    [state]
  );

  return <FlowContext.Provider value={flow}>{children}</FlowContext.Provider>;
}

export function useFlow(): Flow {
  const flow = useContext(FlowContext);
  if (!flow) throw new Error('useFlow must be used inside a FlowProvider');
  return flow;
}

/** Every single-video state past `library` knows which video it came from; batch states do not. */
function videoOf(state: FlowState): LibraryVideo | null {
  switch (state.name) {
    case 'selected':
    case 'compressing':
      return state.video;
    case 'preview':
      return state.outcome.video;
    case 'library':
    case 'batchSetup':
    case 'batchCompressing':
      return null;
  }
}
