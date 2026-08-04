/** Timing and error wording shared by the single-video and batch compression hooks. */

/** Elapsed time ticks often enough to feel live without re-rendering the whole screen constantly. */
export const TICK_MS = 500;

/**
 * Linear-extrapolation ETA. Null below `minProgress` — the guess swings wildly early on — and at
 * completion, where "0 s left" would outlive the encode by a render.
 */
export function estimateEta(
  elapsedMs: number,
  progress: number,
  minProgress: number
): number | null {
  if (progress < minProgress || progress >= 1) return null;
  return Math.round((elapsedMs / progress) * (1 - progress));
}

export function describeCompressionError(error: unknown): string {
  return error instanceof Error ? error.message : 'Compression failed.';
}
