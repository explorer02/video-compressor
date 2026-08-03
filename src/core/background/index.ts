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

/** The time facts the notification lays out around its progress bar. */
export type ProgressTimes = {
  /** e.g. "1 min 12 s elapsed". */
  elapsed: string;
  /** e.g. "2 min 5 s left". */
  remaining: string;
};

export type BackgroundSession = {
  /**
   * Posts the current progress to the notification. Call this from the encoder's own progress
   * events, not from a timer: Android suspends JS timers while the app is backgrounded, which is
   * precisely when the notification is the only thing the user can see.
   *
   * @param progress 0–1.
   * @param title Overrides the session title — a batch session spans many videos and re-titles
   *   the one notification per item, instead of cycling the service itself (see below).
   */
  update: (progress: number, times: ProgressTimes, title?: string) => void;
  end: () => void;
};

const INERT_SESSION: BackgroundSession = { update: () => {}, end: () => {} };

/**
 * One session must span one whole unit of user-visible work (a single compression, or an entire
 * batch). Starting and stopping the service per batch item raced Android's startForeground
 * obligation — a stop landing between `startForegroundService()` and its delivery leaves the
 * obligation unmet, and ~10 s later the system kills the app with
 * ForegroundServiceDidNotStartInTimeException.
 */
export function beginBackgroundSession(
  initialTitle: string
): BackgroundSession {
  if (!mediaToolsCapabilities.foregroundService) return INERT_SESSION;

  let ended = false;
  let posted = '';

  void MediaTools.startCompressionService({
    title: initialTitle,
    progress: 0,
    elapsed: '',
    remaining: 'Starting…',
  }).catch(reportFailure);

  return {
    update: (progress, times, title = initialTitle) => {
      if (ended) return;

      // Repeating a notification the system already shows costs a bridge call and a redraw.
      const percent = toPercent(progress);
      const signature = `${title}:${percent}:${times.elapsed}:${times.remaining}`;
      if (signature === posted) return;
      posted = signature;

      void MediaTools.updateCompressionProgress({
        title,
        progress: percent,
        ...times,
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
