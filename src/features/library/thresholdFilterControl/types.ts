import type { FilterDirection } from '../../../core/videoLibrary';

export type ThresholdFilter = {
  direction: FilterDirection;
  threshold: number;
} | null;

export type ThresholdFilterControlProps = {
  value: ThresholdFilter;
  /** Offered cut-offs, ascending, in whatever unit `formatThreshold` renders. */
  thresholds: number[];
  /** Chip and sheet wording when no filter is active, e.g. "Any size". */
  anyLabel: string;
  formatThreshold: (threshold: number) => string;
  /** Direction the sheet opens with before any filter exists. */
  defaultDirection?: FilterDirection;
  disabled?: boolean;
  onChange: (filter: ThresholdFilter) => void;
};
