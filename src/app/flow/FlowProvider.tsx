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
import type { LibraryVideo } from '../../core/videoLibrary/types';
import type { Flow, FlowState } from './types';

const FlowContext = createContext<Flow | null>(null);

const LIBRARY: FlowState = { name: 'library' };

export function FlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlowState>(LIBRARY);

  const flow = useMemo<Flow>(
    () => ({
      state,
      actions: {
        select: (video: LibraryVideo, source: SourceVideo) =>
          setState({ name: 'selected', video, source }),

        startCompressing: (tier: QualityTierId) =>
          setState(current =>
            current.name === 'selected'
              ? {
                  name: 'compressing',
                  video: current.video,
                  source: current.source,
                  tier,
                }
              : current
          ),

        showPreview: (outcome: CompressionOutcome) =>
          setState({ name: 'preview', outcome }),

        backToLibrary: () => setState(LIBRARY),

        backToSelection: () =>
          setState(current => {
            const selection = selectionOf(current);
            return selection ? { name: 'selected', ...selection } : LIBRARY;
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

/** Every state past `library` knows which video it came from — this is where it lives. */
function selectionOf(
  state: FlowState
): { video: LibraryVideo; source: SourceVideo } | null {
  switch (state.name) {
    case 'selected':
    case 'compressing':
      return { video: state.video, source: state.source };
    case 'preview':
      return { video: state.outcome.video, source: state.outcome.source };
    case 'library':
      return null;
  }
}
