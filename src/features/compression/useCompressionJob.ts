import { useCallback, useEffect, useRef, useState } from 'react';
import { useKeepAwake } from 'expo-keep-awake';

import {
  beginBackgroundSession,
  ensureNotificationPermission,
} from '../../core/background';
import { runCompressionJob } from '../../core/compression/runJob';
import { estimateOutputBytes, tierById } from '../../core/compression/tiers';
import type {
  CompressionOutcome,
  QualityTierId,
  SourceVideo,
} from '../../core/compression/types';
import { formatDurationWords } from '../../core/format';
import type { LibraryVideo } from '../../core/videoLibrary';
import { workspace } from '../../core/workspace';

/** Elapsed time ticks often enough to feel live without re-rendering the whole screen constantly. */
const TICK_MS = 500;

/** Below this the remaining-time guess swings wildly; §3.3 only promises a rough ETA. */
const MIN_PROGRESS_FOR_ETA = 0.05;

export type CompressionJob =
  | {
      phase: 'running';
      progress: number;
      elapsedMs: number;
      etaMs: number | null;
    }
  | { phase: 'failed'; message: string };

export type CompressionJobOptions = {
  video: LibraryVideo;
  source: SourceVideo;
  tierId: QualityTierId;
  onCompleted: (outcome: CompressionOutcome) => void;
  onCancelled: () => void;
};

export function useCompressionJob({
  video,
  source,
  tierId,
  onCompleted,
  onCancelled,
}: CompressionJobOptions): { job: CompressionJob; cancel: () => void } {
  useKeepAwake();

  const [job, setJob] = useState<CompressionJob>({
    phase: 'running',
    progress: 0,
    elapsedMs: 0,
    etaMs: null,
  });

  const cancelRun = useRef<(() => void) | null>(null);
  const cancelled = useRef(false);
  const suspended = useRef(false);

  const cancel = useCallback(() => {
    cancelled.current = true;
    cancelRun.current?.();
  }, []);

  useEffect(() => {
    const tier = tierById(tierId);
    const startedAt = Date.now();
    let active = true;
    let progress = 0;

    if (!workspace.hasRoomFor(estimateOutputBytes(tier, source))) {
      // Reported through the same async path as any other failure so the effect body stays clean.
      queueMicrotask(() => {
        if (active) setJob({ phase: 'failed', message: NOT_ENOUGH_SPACE });
      });
      return () => {
        active = false;
      };
    }

    workspace.markJobStarted({ assetId: source.assetId, tierId, startedAt });

    // §7: the job survives backgrounding, and the notification reflects the same progress the
    // screen shows. Tapping it reopens the app, still in the Compressing state.
    //
    // The permission prompt is not awaited: encoding starts immediately either way, and the next
    // progress tick posts the notification once the user has answered.
    void ensureNotificationPermission();
    const background = beginBackgroundSession(`Compressing ${video.filename}`, {
      // §7 iOS: the OS ended the background window. Stop the encoder cleanly now — the failed
      // state below (or, if the OS kills the app regardless, the next launch's interrupted-job
      // toast) is where the retry lives.
      onSuspended: () => {
        suspended.current = true;
        cancelRun.current?.();
      },
    });

    // The screen's own clock, so elapsed time keeps counting between encoder events. It stops
    // while the app is backgrounded — Android suspends JS timers with the activity — which is why
    // it does not drive the notification.
    const ticker = setInterval(() => {
      if (!active) return;
      const elapsedMs = Date.now() - startedAt;
      setJob({
        phase: 'running',
        progress,
        elapsedMs,
        etaMs: estimateEta(elapsedMs, progress),
      });
    }, TICK_MS);

    const run = runCompressionJob(video, source, tierId, fraction => {
      progress = clampProgress(fraction);
      const elapsedMs = Date.now() - startedAt;
      const etaMs = estimateEta(elapsedMs, progress);

      // The screen updates on the event itself, not the next tick — §3.3 shows tenths of a
      // percent, and a 500 ms sample of those reads as stuttering.
      if (active) setJob({ phase: 'running', progress, elapsedMs, etaMs });

      // Encoder events keep arriving in the background, so the notification is posted from here
      // rather than from the ticker above — otherwise it freezes the moment the app leaves screen.
      // Built inline: this callback outlives hot reloads inside the native module, so it must not
      // lean on helpers a swapped-out module instance may no longer hold.
      background.update(progress, {
        elapsed: `${formatDurationWords(elapsedMs)} elapsed`,
        remaining:
          etaMs === null ? 'Estimating…' : `${formatDurationWords(etaMs)} left`,
      });
    });
    cancelRun.current = run.cancel;
    // True once the run reached an outcome (completed, failed, or user-cancelled).
    let settled = false;

    void (async () => {
      try {
        const outcome = await run.outcome;
        if (!active) return;

        settled = true;
        workspace.markJobFinished();
        onCompleted(outcome);
      } catch (error) {
        if (!active) return;

        settled = true;
        workspace.markJobFinished();
        if (cancelled.current) onCancelled();
        else if (suspended.current) {
          setJob({ phase: 'failed', message: SUSPENDED_IN_BACKGROUND });
        } else setJob({ phase: 'failed', message: describe(error) });
      } finally {
        clearInterval(ticker);
        background.end();
      }
    })();

    return () => {
      active = false;
      clearInterval(ticker);
      background.end();
      // Unmounting mid-run (back navigation, a permission flip re-rendering the router) must not
      // leave the native encoder running headless — cancel it and close the job journal so the
      // next launch does not report a compression that was deliberately walked away from.
      if (!settled) {
        run.cancel();
        workspace.markJobFinished();
      }
    };
  }, [onCancelled, onCompleted, source, tierId, video]);

  return { job, cancel };
}

const NOT_ENOUGH_SPACE =
  'Not enough free space on this device to compress this video.';

const SUSPENDED_IN_BACKGROUND =
  'iOS paused this compression in the background. Keep the app open while it runs, or start it again.';

function estimateEta(elapsedMs: number, progress: number): number | null {
  if (progress < MIN_PROGRESS_FOR_ETA) return null;
  return Math.round((elapsedMs / progress) * (1 - progress));
}

function clampProgress(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(Math.max(fraction, 0), 1);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'Compression failed.';
}
