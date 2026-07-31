import { Platform } from 'react-native';
import { File } from 'expo-file-system';

import {
  MediaTools,
  mediaToolsCapabilities,
} from '../../../modules/media-tools';
import { resolveLocalPath, type VideoAssetId } from '../videoLibrary';

/**
 * Reads asset file sizes. Neither expo-media-library API exposes a size, so this is the seam where
 * that gap is filled — and the reason `sizeIndex` never talks to a platform directly.
 */
export type AssetSizeReader = {
  /** False when this platform has no usable implementation yet; callers degrade rather than block. */
  readonly available: boolean;
  readonly unavailableReason: string | null;
  read(ids: VideoAssetId[]): Promise<Map<VideoAssetId, number>>;
};

/** One media-store cursor for the whole batch — the fast path, and the only one that scales. */
const nativeSizeReader: AssetSizeReader = {
  available: true,
  unavailableReason: null,

  async read(ids) {
    const sizes = await MediaTools.readAssetSizes(ids);
    return new Map(Object.entries(sizes));
  },
};

/**
 * Filesystem stat via the asset's resolved path — the fallback when the native reader is absent.
 *
 * Android only, deliberately. On Android an asset resolves to a plain `file://` path and a stat is
 * effectively free. On iOS the same call goes through `PHImageManager.requestAVAsset`, which for a
 * slow-motion clip *exports an entire new file* — unacceptable just to learn a size.
 */
const filesystemSizeReader: AssetSizeReader = {
  available: Platform.OS === 'android',
  unavailableReason:
    Platform.OS === 'android'
      ? null
      : 'File sizes need the native media-tools reader on this platform.',

  async read(ids) {
    const sizes = new Map<VideoAssetId, number>();

    for (const id of ids) {
      try {
        const file = new File(await resolveLocalPath(id));
        if (file.exists && file.size > 0) sizes.set(id, file.size);
      } catch {
        // A stale or unreadable asset simply has no size; the row omits it.
      }
    }

    return sizes;
  },
};

export const assetSizeReader: AssetSizeReader =
  mediaToolsCapabilities.assetSizes ? nativeSizeReader : filesystemSizeReader;
