import { useCallback, useMemo } from 'react';
import { Linking } from 'react-native';
import {
  PermissionStatus,
  presentPermissionsPicker,
  usePermissions,
  type GranularPermission,
  type PermissionResponse,
} from 'expo-media-library';

import type { MediaAccess } from './types';

/**
 * Video-library access, reduced to what the UI actually branches on.
 *
 * `granularPermissions: ['video']` is load-bearing, not tidiness. expo's Android permission wrapper
 * only reports `accessPrivileges: 'limited'` once every requested granular permission is satisfied,
 * so leaving the default (photo + video + audio) makes an Android 14 user who chose "allow only
 * selected" come back as `'none'` — indistinguishable from a denial.
 */
const VIDEO_ONLY: GranularPermission[] = ['video'];

export type MediaAccessState = {
  access: MediaAccess;
  /** False once the OS will no longer show the prompt — the user must go to Settings. */
  canAskAgain: boolean;
  request: () => Promise<MediaAccess>;
  /** Re-opens the OS picker for partial grants (iOS Limited Photos, Android 14 selected videos). */
  manageAccess: () => Promise<void>;
  openSettings: () => Promise<void>;
};

export function useMediaAccess(): MediaAccessState {
  const [response, requestPermission] = usePermissions({
    granularPermissions: VIDEO_ONLY,
  });

  const request = useCallback(async () => {
    return toMediaAccess(await requestPermission());
  }, [requestPermission]);

  const manageAccess = useCallback(async () => {
    await presentPermissionsPicker(['video']);
  }, []);

  const openSettings = useCallback(async () => {
    await Linking.openSettings();
  }, []);

  return useMemo(
    () => ({
      access: toMediaAccess(response),
      canAskAgain: response?.canAskAgain ?? true,
      request,
      manageAccess,
      openSettings,
    }),
    [manageAccess, openSettings, request, response]
  );
}

function toMediaAccess(response: PermissionResponse | null): MediaAccess {
  if (!response) return 'undetermined';
  if (response.accessPrivileges === 'limited') return 'limited';
  if (response.granted) return 'granted';
  return response.status === PermissionStatus.UNDETERMINED
    ? 'undetermined'
    : 'denied';
}
