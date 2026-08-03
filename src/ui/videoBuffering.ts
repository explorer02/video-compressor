import type { VideoPlayer } from 'expo-video';

/**
 * Caps how much a player pre-buffers.
 *
 * ExoPlayer's default is ~50 s of forward buffer held as 64 KB chunks on the Java heap. Local
 * camera footage runs 30–100 Mbps, so one open player could balloon to 200–600 MB and hit
 * Android's 256 MB per-app heap limit — the OOM crashes traced back to exactly this (heap dump:
 * ~160 MB of media3 `Allocation` chunks). Gallery files replenish at disk speed, so a few
 * seconds of buffer plays back just as smoothly.
 */
export function capPlayerBuffering(player: VideoPlayer): void {
  player.bufferOptions = {
    preferredForwardBufferDuration: 5,
    // Android only: the hard byte cap that protects the heap from high-bitrate sources.
    maxBufferBytes: 24 * 1024 * 1024,
    // False so the byte cap wins when the two limits disagree.
    prioritizeTimeOverSizeThreshold: false,
  };
}
