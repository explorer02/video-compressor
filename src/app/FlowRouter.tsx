import { useEffect } from 'react';

import { useMediaAccess } from '../core/videoLibrary';
import { workspace } from '../core/workspace';
import { BatchCompressingScreen } from '../screens/batchCompressingScreen';
import { BatchSetupScreen } from '../screens/batchSetupScreen';
import { CompressingScreen } from '../screens/compressingScreen';
import { LibraryScreen } from '../screens/libraryScreen';
import { PermissionGateScreen } from '../screens/permissionGateScreen';
import { PreviewScreen } from '../screens/previewScreen';
import { SelectedScreen } from '../screens/selectedScreen';
import { useToast } from '../ui';
import { useFlow } from './flow/FlowProvider';

/**
 * Renders the §3 state machine. There is no navigation library: the flow is linear and every
 * transition is already modelled in `FlowState`, so a router here is just a switch. Hardware back
 * belongs to each screen — what it means differs per state (cancel while compressing, plain
 * navigation elsewhere).
 */
export function FlowRouter() {
  const access = useMediaAccess();
  const { state, actions } = useFlow();

  useInterruptedJobNotice();

  if (access.access !== 'granted' && access.access !== 'limited') {
    return <PermissionGateScreen access={access} />;
  }

  switch (state.name) {
    case 'library':
      return (
        <LibraryScreen
          access={access}
          onSelect={actions.select}
          onCompressMany={actions.startBatchSetup}
        />
      );
    case 'batchSetup':
      return (
        <BatchSetupScreen
          videos={state.videos}
          onBack={actions.backToLibrary}
          onStart={actions.startBatch}
        />
      );
    case 'batchCompressing':
      return (
        <BatchCompressingScreen
          plan={state.plan}
          onDone={actions.backToLibrary}
        />
      );
    case 'selected':
      return (
        <SelectedScreen
          video={state.video}
          onBack={actions.backToLibrary}
          onStart={actions.startCompressing}
        />
      );
    case 'compressing':
      return (
        <CompressingScreen
          video={state.video}
          source={state.source}
          tier={state.tier}
          onCompleted={actions.showPreview}
          onCancelled={actions.backToSelection}
        />
      );
    case 'preview':
      return (
        <PreviewScreen
          outcome={state.outcome}
          onFinished={actions.backToLibrary}
        />
      );
  }
}

/**
 * §10: a job that was running when the app stopped leaves temp files behind. Clearing them and
 * saying so is the honest recovery — the user can start the compression again from the library.
 */
function useInterruptedJobNotice(): void {
  const toast = useToast();

  useEffect(() => {
    const interrupted = workspace.recoverOnLaunch();
    if (interrupted) {
      toast.show(
        interrupted.batch
          ? `A batch was interrupted at video ${interrupted.batch.index} of ${interrupted.batch.total} — videos finished earlier are already saved.`
          : 'A compression was interrupted — you can start it again.'
      );
    }
  }, [toast]);
}
