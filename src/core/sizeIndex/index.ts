import { openJsonStore } from '../storage';
import type { LibraryVideo, VideoAssetId } from '../videoLibrary';
import { filesystemSizeReader, type AssetSizeReader } from './reader';

/**
 * A lazy, persistent index of asset file sizes (§4).
 *
 * It exists because neither expo-media-library API exposes a file size and `AssetField` has no size
 * member, so the media store cannot even sort by it. Sizes are therefore read once, cached against
 * the asset's modification time, and reused for the lifetime of the install.
 */

const STORE = 'sizeIndex';

/** Small enough that the UI updates while a large library fills in, large enough to stay cheap. */
const BATCH_SIZE = 24;

type SizeEntry = { size: number; modifiedAt: number | null };

const reader: AssetSizeReader = filesystemSizeReader;
const listeners = new Set<() => void>();
const pending = new Set<VideoAssetId>();

export const sizeIndex = {
  available: reader.available,
  unavailableReason: reader.unavailableReason,

  /** Cached size in bytes, or null if it has not been read yet. */
  get(video: LibraryVideo): number | null {
    const entry = readEntry(video.id);
    if (!entry) return null;
    // A re-encoded or edited asset keeps its id but changes size — the timestamp catches that.
    return entry.modifiedAt === video.modifiedAt ? entry.size : null;
  },

  /** Reads any sizes still missing, in batches, notifying subscribers as each batch lands. */
  async ensure(videos: LibraryVideo[]): Promise<void> {
    if (!reader.available) return;

    const missing = videos.filter(
      video => sizeIndex.get(video) === null && !pending.has(video.id)
    );
    if (missing.length === 0) return;

    missing.forEach(video => pending.add(video.id));
    notify();

    try {
      for (let start = 0; start < missing.length; start += BATCH_SIZE) {
        const batch = missing.slice(start, start + BATCH_SIZE);
        const sizes = await reader.read(batch.map(video => video.id));

        for (const video of batch) {
          const size = sizes.get(video.id);
          if (size !== undefined)
            writeEntry(video.id, { size, modifiedAt: video.modifiedAt });
          pending.delete(video.id);
        }
        notify();
      }
    } finally {
      missing.forEach(video => pending.delete(video.id));
      notify();
    }
  },

  /** How many assets are still being read — drives the "Indexing sizes…" affordance. */
  pendingCount(): number {
    return pending.size;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Total bytes known so far. Only meaningful once the whole library has been indexed. */
  knownTotalBytes(): number {
    let total = 0;
    for (const value of Object.values(openJsonStore(STORE).snapshot())) {
      if (isSizeEntry(value)) total += value.size;
    }
    return total;
  },
};

function readEntry(id: VideoAssetId): SizeEntry | null {
  const value = openJsonStore(STORE).get<unknown>(id);
  return isSizeEntry(value) ? value : null;
}

function writeEntry(id: VideoAssetId, entry: SizeEntry): void {
  openJsonStore(STORE).set(id, entry);
}

function isSizeEntry(value: unknown): value is SizeEntry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SizeEntry>;
  return typeof candidate.size === 'number';
}

function notify(): void {
  listeners.forEach(listener => listener());
}
