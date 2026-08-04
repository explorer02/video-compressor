import {
  Asset,
  AssetField,
  MediaType,
  Query,
  addListener,
  type AssetMetadata,
  type EventSubscription,
} from 'expo-media-library';

import {
  MediaTools,
  mediaToolsCapabilities,
  type AppliedMetadataReport,
  type GeoLocation,
} from '../../../modules/media-tools';
import type {
  LibraryVideo,
  SortDirection,
  VideoAssetId,
  VideoPage,
} from './types';

/**
 * The only module that talks to expo-media-library. Everything above depends on `LibraryVideo`, so
 * migrating away from this library — or working around one of its gaps — happens here alone.
 *
 * Two properties of the current class-based API drive the design:
 * - `exeForMetadata()` reads straight from the media store without resolving paths or decoding
 *   files, which is what keeps a 1,000-video list cheap.
 * - `AssetField` has no size member, so the media store cannot sort by file size on either
 *   platform. That sort is built on top of this module, not inside it.
 */

/** Sorts the media store can perform itself. Sorting by size is layered on top (see `sizeIndex`). */
export type MediaStoreSortKey = 'createdAt' | 'modifiedAt';

export type ListVideosOptions = {
  key: MediaStoreSortKey;
  direction: SortDirection;
  limit: number;
  offset: number;
};

const SORT_FIELDS: Record<MediaStoreSortKey, AssetField> = {
  createdAt: AssetField.CREATION_TIME,
  modifiedAt: AssetField.MODIFICATION_TIME,
};

export async function listVideos(
  options: ListVideosOptions
): Promise<VideoPage> {
  const metadata = await videoQuery()
    .orderBy({
      key: SORT_FIELDS[options.key],
      ascending: options.direction === 'asc',
    })
    .limit(options.limit)
    .offset(options.offset)
    .exeForMetadata();

  return {
    videos: metadata.map(toLibraryVideo),
    // The media store gives no total, so a short page is the only end-of-list signal.
    hasMore: metadata.length === options.limit,
  };
}

/** Every video id in the library, cheapest possible read. Feeds the header count and size index. */
export async function listAllVideoIds(): Promise<VideoAssetId[]> {
  const metadata = await videoQuery().exeForMetadata();
  return metadata.map(entry => entry.id);
}

/**
 * Every video, in one read. Feeds the paths that cannot be paged by the media store — sorting or
 * filtering by size — so the ordering is applied here rather than left undefined.
 */
export async function listAllVideos(
  order?: Pick<ListVideosOptions, 'key' | 'direction'>
): Promise<LibraryVideo[]> {
  const query = videoQuery();
  const metadata = await (
    order
      ? query.orderBy({
          key: SORT_FIELDS[order.key],
          ascending: order.direction === 'asc',
        })
      : query
  ).exeForMetadata();

  return metadata.map(toLibraryVideo);
}

/**
 * A local filesystem path the compressor can read.
 *
 * Expensive on iOS — it round-trips through `PHImageManager.requestAVAsset`, and for slow-motion
 * clips it exports a whole new file. Call it once per compression, never per list row.
 */
export async function resolveLocalPath(id: VideoAssetId): Promise<string> {
  return new Asset(id).getUri();
}

/**
 * A source `expo-image` can render a poster frame from.
 *
 * The asset id is already such a URI on both platforms — `content://…` on Android and `ph://…` on
 * iOS — so rows need no native round-trip at all, and both image pipelines serve these from the
 * OS thumbnail cache rather than decoding the video.
 */
export function thumbnailSource(id: VideoAssetId): string {
  return id;
}

/**
 * A source `expo-video` can play.
 *
 * As with thumbnails, the asset id is already playable on both platforms — `content://` goes
 * straight to ExoPlayer, and expo-video's player constructor accepts `ph://` — so previewing a
 * library video costs nothing and never pays `resolveLocalPath`'s export.
 */
export function playbackSource(id: VideoAssetId): string {
  return id;
}

export async function assetExists(id: VideoAssetId): Promise<boolean> {
  try {
    await new Asset(id).getFilename();
    return true;
  } catch {
    return false;
  }
}

export type SaveTarget = {
  filename: string;
  /** The folder to save into, when the platform can choose one. */
  folder?: string;
  capturedAtMs?: number;
  modifiedAtMs?: number;
  /** Carried where the platform can store it (iOS); elsewhere reported as skipped. */
  location?: GeoLocation;
};

export type SavedToLibrary = {
  assetId: VideoAssetId;
  /**
   * What the save itself carried, when the platform sets metadata as the asset is created.
   * Null means a plain create happened and the caller owns the write-back pass.
   */
  carried: AppliedMetadataReport | null;
};

/**
 * Saves a finished encode into the gallery.
 *
 * Where the platform can do it, everything — folder, dates, location — is set as the asset is
 * created, because a media store honours the values a row is born with but is free to ignore the
 * same columns on a later update. That is the difference between the dates sticking and not.
 * Elsewhere this falls back to a plain create, and the caller writes metadata afterwards.
 */
export async function saveToLibrary(
  filePath: string,
  target?: SaveTarget
): Promise<SavedToLibrary> {
  if (mediaToolsCapabilities.librarySave && target) {
    const { assetId, report } = await MediaTools.saveVideo({
      path: filePath,
      filename: target.filename,
      ...(target.folder ? { folder: target.folder } : {}),
      ...(target.capturedAtMs !== undefined
        ? { capturedAtMs: target.capturedAtMs }
        : {}),
      ...(target.modifiedAtMs !== undefined
        ? { modifiedAtMs: target.modifiedAtMs }
        : {}),
      ...(target.location ?? {}),
    });
    return { assetId, carried: report };
  }

  const asset = await Asset.create(filePath);
  return { assetId: asset.id, carried: null };
}

/**
 * Deletes assets, showing the OS confirmation dialog the platform requires.
 *
 * Resolves to void whether the user confirmed or cancelled, so callers that need to know must
 * re-check with `assetExists`.
 */
export async function deleteAssets(ids: VideoAssetId[]): Promise<void> {
  await Asset.delete(ids.map(id => new Asset(id)));
}

/**
 * Fires whenever the library changes. Android reports no detail, so callers treat every event as
 * "something changed, reload" rather than trying to patch individual rows.
 */
export function subscribeToLibraryChanges(
  onChange: () => void
): EventSubscription {
  return addListener(() => onChange());
}

function videoQuery(): Query {
  return new Query().eq(AssetField.MEDIA_TYPE, MediaType.VIDEO);
}

function toLibraryVideo(metadata: AssetMetadata): LibraryVideo {
  return {
    id: metadata.id,
    filename: metadata.filename ?? 'Untitled video',
    durationMs: metadata.duration,
    width: metadata.width,
    height: metadata.height,
    createdAt: metadata.creationTime,
    modifiedAt: metadata.modificationTime,
  };
}
