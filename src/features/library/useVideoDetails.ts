import { useEffect, useState } from 'react';

import {
  MediaTools,
  mediaToolsCapabilities,
} from '../../../modules/media-tools';
import type { LibraryVideo } from '../../core/videoLibrary';

export type VideoDetails = {
  /** Epoch milliseconds of capture, falling back to the library's own creation time. */
  capturedAt: number | null;
  modifiedAt: number | null;
  folder: string | null;
  /** Frames per second, when the platform can report it without resolving the file. */
  frameRate: number | null;
};

/**
 * The facts about a video that the media store knows but a list row does not show.
 *
 * Reads through `readVideoProperties` — one cursor — rather than `readSourceVideo`, which resolves
 * a real path and is the expensive call reserved for actually starting a compression.
 */
export function useVideoDetails(video: LibraryVideo): VideoDetails {
  const [folder, setFolder] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<number | null>(null);
  const [frameRate, setFrameRate] = useState<number | null>(null);

  useEffect(() => {
    if (!mediaToolsCapabilities.videoProperties) return;

    let active = true;
    void (async () => {
      try {
        const properties = await MediaTools.readVideoProperties(video.id);
        if (!active || !properties) return;

        setFolder(properties.folder);
        setCapturedAt(properties.capturedAtMs);
        setFrameRate(properties.frameRate);
      } catch (error) {
        console.warn('[library] could not read video details', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [video.id]);

  return {
    capturedAt: capturedAt ?? video.createdAt,
    modifiedAt: video.modifiedAt,
    folder,
    frameRate,
  };
}
