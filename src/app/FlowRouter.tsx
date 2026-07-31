import { useEffect } from 'react';
import { BackHandler } from 'react-native';

import { useMediaAccess } from '../core/videoLibrary';
import { workspace } from '../core/workspace';
import { CompressingScreen } from '../screens/CompressingScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { PermissionGateScreen } from '../screens/PermissionGateScreen';
import { PreviewScreen } from '../screens/PreviewScreen';
import { SelectedScreen } from '../screens/SelectedScreen';
import { useToast } from '../ui';
import { useFlow } from './flow/FlowProvider';

/**
 * Renders the §3 state machine. There is no navigation library: the flow is linear and every
 * transition is already modelled in `FlowState`, so a router here is a switch plus a back handler.
 */
export function FlowRouter() {
  const access = useMediaAccess();
  const { state, actions } = useFlow();

  useAndroidBack(state.name !== 'library', actions.backToLibrary);
  useInterruptedJobNotice();

  if (access.access !== 'granted' && access.access !== 'limited') {
    return <PermissionGateScreen access={access} />;
  }

  switch (state.name) {
    case 'library':
      return <LibraryScreen access={access} onSelect={actions.select} />;
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

/** Android's hardware back walks the flow rather than closing the app. */
function useAndroidBack(active: boolean, onBack: () => void): void {
  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onBack();
        return true;
      }
    );
    return () => subscription.remove();
  }, [active, onBack]);
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
      toast.show('A compression was interrupted — you can start it again.');
    }
  }, [toast]);
}
