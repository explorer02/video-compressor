import { formatBytes } from '../../core/format';
import {
  SIZE_FILTER_THRESHOLDS,
  type SizeFilter,
} from '../../core/videoLibrary';
import {
  ThresholdFilterControl,
  thresholdFilterLabel,
  type ThresholdFilter,
} from './ThresholdFilterControl';

export type SizeFilterControlProps = {
  value: SizeFilter;
  disabled?: boolean;
  onChange: (filter: SizeFilter) => void;
};

export function sizeFilterLabel(filter: SizeFilter): string {
  return thresholdFilterLabel(toThreshold(filter), 'Any size', formatBytes);
}

/** The §4 size filter — a unit adapter over the shared threshold-filter sheet. */
export function SizeFilterControl({
  value,
  disabled = false,
  onChange,
}: SizeFilterControlProps) {
  return (
    <ThresholdFilterControl
      value={toThreshold(value)}
      thresholds={SIZE_FILTER_THRESHOLDS}
      anyLabel="Any size"
      formatThreshold={formatBytes}
      disabled={disabled}
      onChange={filter =>
        onChange(
          filter === null
            ? null
            : { direction: filter.direction, bytes: filter.threshold }
        )
      }
    />
  );
}

function toThreshold(filter: SizeFilter): ThresholdFilter {
  return filter === null
    ? null
    : { direction: filter.direction, threshold: filter.bytes };
}
