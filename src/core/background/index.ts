import { PermissionsAndroid, Platform } from 'react-native';
import { Video } from 'react-native-compressor';

import {
  MediaTools,
  mediaToolsCapabilities,
} from '../../../modules/media-tools';

/**
 * Keeps a compression alive while the app is backgrounded (§7).
 *
 * Two strategies behind one call site:
 * - **Android** runs a foreground service with a live progress notification and no time limit —
 *   react-native-compressor provides only a partial wake lock, so the service is ours.
 * - **iOS** has no such service; the job rides the compressor's own background task
 *   (`UIApplication.beginBackgroundTask`), which buys a bounded window — roughly 30 seconds to a
 *   few minutes — after the app leaves the screen. When the OS calls time, `onSuspended` lets the
 *   owner stop the encoder cleanly instead of being frozen mid-write.
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

export type BackgroundSessionOptions = {
  /**
   * The OS ended the background window while work was still running — iOS in practice. The owner
   * should stop its encoder cleanly; recovery is the §10 interrupted-job path.
   */
  onSuspended?: () => void;
};

/**
 * One session must span one whole unit of user-visible work (a single compression, or an entire
 * batch). Starting and stopping the service per batch item raced Android's startForeground
 * obligation — a stop landing between `startForegroundService()` and its delivery leaves the
 * obligation unmet, and ~10 s later the system kills the app with
 * ForegroundServiceDidNotStartInTimeException. The same one-session rule keeps iOS inside the
 * compressor's one-background-task-at-a-time limit.
 */
export function beginBackgroundSession(
  initialTitle: string,
  options: BackgroundSessionOptions = {}
): BackgroundSession {
  return mediaToolsCapabilities.foregroundService
    ? beginServiceSession(initialTitle)
    : beginBackgroundTaskSession(options);
}

/** Android: the media-tools foreground service, §7's notification included. */
function beginServiceSession(initialTitle: string): BackgroundSession {
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

/**
 * iOS (and any platform without a service): the compressor's background task keeps the process
 * running for the OS's bounded window. There is no notification surface here by design — §7's
 * progress notification is an Android concept — so `update` has nothing to post.
 */
function beginBackgroundTaskSession({
  onSuspended,
}: BackgroundSessionOptions): BackgroundSession {
  let ended = false;

  void Promise.resolve(
    Video.activateBackgroundTask(() => {
      // Expiry after end() is just the OS reclaiming a window nobody needs anymore.
      if (!ended) onSuspended?.();
    })
  ).catch(reportFailure);

  return {
    update: () => {},
    end: () => {
      if (ended) return;
      ended = true;
      void Promise.resolve(Video.deactivateBackgroundTask()).catch(
        reportFailure
      );
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
