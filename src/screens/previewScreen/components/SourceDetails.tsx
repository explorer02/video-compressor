import type { CompressionOutcome } from '../../../core/compression/types';
import {
  formatCoordinates,
  formatDateTime,
  formatFolder,
  formatResolution,
} from '../../../core/format';
import { DetailList } from '../../../ui';

/**
 * What the original was, next to the size comparison — the facts a "keep original metadata" save
 * is promising to carry forward, so the user can see them before choosing.
 */
export function SourceDetails({ outcome }: { outcome: CompressionOutcome }) {
  const { source, video } = outcome;
  const coordinates = formatCoordinates(source.location);

  return (
    <DetailList
      heading="ORIGINAL"
      items={[
        { label: 'Created', value: formatDateTime(source.capturedAt) },
        { label: 'Modified', value: formatDateTime(source.modifiedAt) },
        { label: 'Folder', value: formatFolder(source.folder ?? source.path) },
        { label: 'Filename', value: video.filename },
        {
          label: 'Resolution',
          value: formatResolution(source.width, source.height),
        },
        ...(coordinates ? [{ label: 'Location', value: coordinates }] : []),
      ]}
    />
  );
}
