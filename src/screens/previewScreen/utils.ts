import { Platform } from 'react-native';

import type { CompressionOutcome } from '../../core/compression/types';
import { formatBytes } from '../../core/format';

/** What replacing is worth, on the button that does it — the screen's one number that matters. */
export function replaceLabel(outcome: CompressionOutcome): string {
  const freed = outcome.source.sizeBytes - outcome.outputSizeBytes;
  if (freed <= 0) return 'Replace original';

  return Platform.OS === 'ios'
    ? `Replace original — ${formatBytes(freed)} smaller`
    : `Replace original — free up ${formatBytes(freed)}`;
}
