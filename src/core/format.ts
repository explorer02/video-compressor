/** Presentation helpers shared by every screen. Formatting lives here, not in components. */

const KB = 1000;
const MB = KB * 1000;
const GB = MB * 1000;

/** Decimal units, matching what gallery apps and OS storage screens show. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes >= GB) return `${round(bytes / GB, 1)} GB`;
  if (bytes >= MB) return `${round(bytes / MB, bytes < 10 * MB ? 1 : 0)} MB`;
  if (bytes >= KB) return `${round(bytes / KB, 0)} KB`;
  return `${bytes} B`;
}

/** "0:42", "3:07", "1:02:03" — the badge format gallery apps use. */
export function formatDurationClock(durationMs: number | null): string {
  if (durationMs === null || !Number.isFinite(durationMs)) return '—';

  const totalSeconds = Math.round(durationMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/** Spoken duration for stat rows, e.g. "1 min 22 s". */
export function formatDurationWords(durationMs: number | null): string {
  if (durationMs === null || !Number.isFinite(durationMs)) return '—';

  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}

export function formatDate(epochMs: number | null): string {
  if (epochMs === null || !Number.isFinite(epochMs)) return '—';
  return new Date(epochMs).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Date and time, for the detail rows where "when exactly" is the point. */
export function formatDateTime(epochMs: number | null): string {
  if (epochMs === null || !Number.isFinite(epochMs)) return '—';
  return new Date(epochMs).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Where a file lives, in the form a gallery app shows: the last two folders of its directory.
 * A full path is too long to read on a phone and its leading segments are identical for every asset.
 */
export function formatFolder(path: string | null): string {
  if (!path) return '—';

  const segments = decodeURI(path)
    .replace(/^\w+:\/\//, '')
    .split('/')
    .filter(Boolean);
  const directory = segments.slice(0, -1);
  return directory.length === 0 ? '—' : directory.slice(-2).join('/');
}

export function formatCoordinates(
  location: { latitude: number; longitude: number } | null
): string | null {
  if (!location) return null;
  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
}

export function formatResolution(
  width: number | null,
  height: number | null
): string {
  return width && height ? `${width} × ${height}` : '—';
}

/** Whole-percent saving, e.g. "86% smaller". Negative savings return null. */
export function formatSavingPercent(
  originalBytes: number,
  compressedBytes: number
): string | null {
  if (originalBytes <= 0 || compressedBytes >= originalBytes) return null;
  const saved = 1 - compressedBytes / originalBytes;
  return `${Math.round(saved * 100)}%`;
}

function round(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}
