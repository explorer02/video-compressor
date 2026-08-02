import { useCallback, useEffect, useState } from 'react';

import {
  MediaTools,
  mediaToolsCapabilities,
} from '../../../modules/media-tools';
import { sourceFactsFrom, type TierSourceFacts } from '../../core/compression/tiers';
import { sizeIndex } from '../../core/sizeIndex';
import type { LibraryVideo, VideoAssetId } from '../../core/videoLibrary';

/**
 * Per-video estimate facts for the batch setup screen: sizes from the index, frame rates from one
 * cheap native read per video. Until a frame rate lands, the 30 fps assumption applies — the same
 * progressive honesty the single-video screen has.
 */
export function useBatchSourceFacts(videos: LibraryVideo[]): {
  factsFor: (video: LibraryVideo) => TierSourceFacts;
} {
  const [frameRates, setFrameRates] = useState<
    ReadonlyMap<VideoAssetId, number>
  >(() => new Map());

  useEffect(() => {
    if (!mediaToolsCapabilities.videoProperties) return;

    let active = true;
    void (async () => {
      const rates = new Map<VideoAssetId, number>();
      for (const video of videos) {
        try {
          const properties = await MediaTools.readVideoProperties(video.id);
          if (!active) return;
          if (properties?.frameRate) rates.set(video.id, properties.frameRate);
        } catch (error) {
          console.warn('[batch] could not read video properties', error);
        }
      }
      if (active) setFrameRates(rates);
    })();

    return () => {
      active = false;
    };
  }, [videos]);

  const factsFor = useCallback(
    (video: LibraryVideo) =>
      sourceFactsFrom(video, sizeIndex.get(video), frameRates.get(video.id)),
    [frameRates]
  );

  return { factsFor };
}
