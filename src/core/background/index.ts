import { PermissionsAndroid, Platform } from 'react-native';

import {
  MediaTools,
  mediaToolsCapabilities,
} from '../../../modules/media-tools';

/**
 * Keeps a compression alive while the app is backgrounded (§7).
 *
 * On Android that means a foreground service with a live progress notification and no time limit —
 * react-native-compressor provides only a partial wake lock, so the service is ours. On a platform
 * with no implementation this degrades to running in the foreground, and the call site is unchanged.
 */

/** Android 13 made posting notifications a runtime permission. */
const NOTIFICATION_PERMISSION_SDK = 33;

/**
 * Asks for notification access, which §7's progress notification needs on Android 13+.
 *
 * The service itself runs either way — only its notification is affected — so this never blocks a
 * compression and never throws.
 */
export async function ensureNotificationPermission(): Promise<void> {
  if (
    Platform.OS !== 'android' ||
    Platform.Version < NOTIFICATION_PERMISSION_SDK
  ) {
    return;
  }

  try {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
  } catch (error) {
    console.warn('[background] notification permission request failed', error);
  }
}

export type BackgroundSession = {
  /** @param progress 0–1. */
  update: (progress: number, detail: string) => void;
  end: () => void;
};

const INERT_SESSION: BackgroundSession = { update: () => {}, end: () => {} };

export function beginBackgroundSession(title: string): BackgroundSession {
  if (!mediaToolsCapabilities.foregroundService) return INERT_SESSION;

  let ended = false;
  void MediaTools.startCompressionService({
    title,
    text: 'Starting…',
    progress: 0,
  }).catch(reportFailure);

  return {
    update: (progress, detail) => {
      if (ended) return;
      void MediaTools.updateCompressionProgress({
        title,
        text: detail,
        progress: toPercent(progress),
      }).catch(reportFailure);
    },
    end: () => {
      if (ended) return;
      ended = true;
      void MediaTools.stopCompressionService().catch(reportFailure);
    },
  };
}

function toPercent(progress: number): number {
  return Math.round(Math.min(Math.max(progress, 0), 1) * 100);
}

/** A missing notification must never fail the compression it is reporting on. */
function reportFailure(error: unknown): void {
  console.warn('[background] compression service call failed', error);
}
