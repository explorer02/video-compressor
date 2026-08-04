import type { ThresholdFilter } from './types';

/** The chip and sheet share one wording for a filter, so the list always reads as filtered. */
export function thresholdFilterLabel(
  filter: ThresholdFilter,
  anyLabel: string,
  formatThreshold: (threshold: number) => string
): string {
  if (filter === null) return anyLabel;
  const sign = filter.direction === 'atLeast' ? '≥' : '<';
  return `${sign} ${formatThreshold(filter.threshold)}`;
}
