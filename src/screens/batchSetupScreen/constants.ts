import type { BatchCopyMetadata } from '../../app/flow/types';
import { canCarryLocation } from '../../core/metadata';
import type { Segment } from '../../ui';

/** §7 promises ≥ 2× real-time, so half the total footage duration is an honest rough guess. */
export const ASSUMED_REALTIME_RATIO = 2;

export const COPY_METADATA_SEGMENTS: Segment<BatchCopyMetadata>[] = [
  {
    value: 'original',
    label: 'Original dates',
    // Location only where the platform can store it (§8) — promising it on Android would be false.
    detail: canCarryLocation
      ? 'Copies keep the capture date and location'
      : 'Copies keep the capture date',
  },
  {
    value: 'fresh',
    label: 'Fresh metadata',
    detail: 'Copies are dated today, location not carried over',
  },
];
