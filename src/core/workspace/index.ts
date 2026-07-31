import { Directory, File, Paths } from 'expo-file-system';

import { openJsonStore } from '../storage';
import type { QualityTierId } from '../compression/types';
import type { VideoAssetId } from '../videoLibrary';

/**
 * Owns every temporary file the app produces, and the record of the job that produced it.
 *
 * Compressed output lives here until the user saves or discards it, which is what makes §10's
 * "temp files cleaned on next launch" and §7's suspended-job recovery possible: anything still on
 * disk at startup belongs to a job that never finished.
 */

const WORKSPACE = 'compresshd-work';
const STORE = 'workspace';
const ACTIVE_JOB_KEY = 'activeJob';

/** Compressing needs room for the output alongside the source, plus headroom for the muxer. */
const FREE_SPACE_SAFETY_FACTOR = 1.5;

export type ActiveJob = {
  assetId: VideoAssetId;
  tierId: QualityTierId;
  startedAt: number;
};

export const workspace = {
  /**
   * Clears leftovers and reports the job that was running when the app last stopped, so the UI can
   * offer a retry (§7, §10). Call once at startup.
   */
  recoverOnLaunch(): ActiveJob | null {
    const interrupted = readActiveJob();
    clearActiveJob();
    emptyWorkspace();
    return interrupted;
  },

  markJobStarted(job: ActiveJob): void {
    openJsonStore(STORE).set(ACTIVE_JOB_KEY, job);
    openJsonStore(STORE).flush();
  },

  markJobFinished(): void {
    clearActiveJob();
  },

  /** Moves a finished encode out of the compressor's cache and into space we control. */
  adopt(producedPath: string, filename: string): File {
    const destination = new File(workspaceDirectory(), filename);
    if (destination.exists) destination.delete();

    const produced = new File(producedPath);
    produced.moveSync(destination);
    return destination;
  },

  discard(path: string): void {
    try {
      const file = new File(path);
      if (file.exists) file.delete();
    } catch (error) {
      console.warn('[workspace] failed to discard temp file', error);
    }
  },

  freeBytes(): number {
    return Paths.availableDiskSpace;
  },

  /** §10: fail before starting rather than part-way through a long encode. */
  hasRoomFor(estimatedBytes: number | null): boolean {
    if (estimatedBytes === null) return true;
    return Paths.availableDiskSpace > estimatedBytes * FREE_SPACE_SAFETY_FACTOR;
  },
};

function workspaceDirectory(): Directory {
  const directory = new Directory(Paths.cache, WORKSPACE);
  if (!directory.exists)
    directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function emptyWorkspace(): void {
  try {
    for (const entry of workspaceDirectory().list()) entry.delete();
  } catch (error) {
    console.warn('[workspace] failed to clear temp files', error);
  }
}

function readActiveJob(): ActiveJob | null {
  const stored = openJsonStore(STORE).get<unknown>(ACTIVE_JOB_KEY);
  return isActiveJob(stored) ? stored : null;
}

function clearActiveJob(): void {
  openJsonStore(STORE).remove(ACTIVE_JOB_KEY);
  openJsonStore(STORE).flush();
}

function isActiveJob(value: unknown): value is ActiveJob {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ActiveJob>;
  return (
    typeof candidate.assetId === 'string' &&
    typeof candidate.tierId === 'string' &&
    typeof candidate.startedAt === 'number'
  );
}
