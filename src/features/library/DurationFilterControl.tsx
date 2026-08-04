import { formatDurationWords } from '../../core/format';
import {
  DURATION_FILTER_THRESHOLDS,
  type DurationFilter,
} from '../../core/videoLibrary';
import {
  ThresholdFilterControl,
  thresholdFilterLabel,
  type ThresholdFilter,
} from './thresholdFilterControl';

export type DurationFilterControlProps = {
  value: DurationFilter;
  onChange: (filter: DurationFilter) => void;
};

export function durationFilterLabel(filter: DurationFilter): string {
  return thresholdFilterLabel(
    toThreshold(filter),
    'Any length',
    formatDurationWords
  );
}

/**
 * The §4 length filter — a unit adapter over the shared threshold-filter sheet. Opens on "Under"
 * because finding the shorts is the common case; duration needs no index, so it is never disabled.
 */
export function DurationFilterControl({
  value,
  onChange,
}: DurationFilterControlProps) {
  return (
    <ThresholdFilterControl
      value={toThreshold(value)}
      thresholds={DURATION_FILTER_THRESHOLDS}
      anyLabel="Any length"
      formatThreshold={formatDurationWords}
      defaultDirection="under"
      onChange={filter =>
        onChange(
          filter === null
            ? null
            : { direction: filter.direction, ms: filter.threshold }
        )
      }
    />
  );
}

function toThreshold(filter: DurationFilter): ThresholdFilter {
  return filter === null
    ? null
    : { direction: filter.direction, threshold: filter.ms };
}
