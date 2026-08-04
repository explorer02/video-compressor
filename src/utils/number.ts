export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Progress fractions from native callbacks can be NaN or out of range — never trust them raw. */
export function clamp01(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return clamp(fraction, 0, 1);
}
