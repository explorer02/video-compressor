import { useEffect } from 'react';
import { BackHandler } from 'react-native';

import { useMediaAccess } from '../core/videoLibrary';
import { LibraryScreen } from '../screens/LibraryScreen';
import { PermissionGateScreen } from '../screens/PermissionGateScreen';
import { SelectedScreen } from '../screens/SelectedScreen';
import { useFlow } from './flow/FlowProvider';

/**
 * Renders the §3 state machine. There is no navigation library: the flow is linear and every
 * transition is already modelled in `FlowState`, so a router here is a switch plus a back handler.
 */
export function FlowRouter() {
  const access = useMediaAccess();
  const { state, actions } = useFlow();

  useAndroidBack(state.name !== 'library', actions.backToLibrary);

  if (access.access !== 'granted' && access.access !== 'limited') {
    return <PermissionGateScreen access={access} />;
  }

  switch (state.name) {
    case 'library':
      return <LibraryScreen access={access} onSelect={actions.select} />;
    case 'selected':
      return (
        <SelectedScreen video={state.video} onBack={actions.backToLibrary} />
      );
    case 'compressing':
    case 'preview':
      // Unreachable until the compression and preview screens land; nothing can enter these
      // states yet because the tier picker is what starts a job.
      return <LibraryScreen access={access} onSelect={actions.select} />;
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
