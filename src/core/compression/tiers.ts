import { Platform } from 'react-native';

import type { LibraryVideo } from '../videoLibrary';
import type { QualityTierId } from './types';

/**
 * The §5 quality tiers, and the arithmetic that turns them into an estimate and an eligibility
 * verdict. Every bitrate and resolution number in the app comes from this table.
 */

/**
 * Audio's contribution to the §6 estimate — a platform fact, not a capability, hence the one
 * `Platform.select` in this file. Android remuxes the source track untouched, so 128 kbps stands
 * in for a typical camera AAC track. iOS always re-encodes and the app pins its exporter to
 * 256 kbps (see patches/), so estimating at 128 would undershoot every iOS output by ~1 MB/min.
 */
const ESTIMATE_AUDIO_KBPS = Platform.select({ ios: 256, default: 128 });

export type CompressionMethod = 'auto' | 'manual';

export type QualityTier = {
  id: QualityTierId;
  label: string;
  tagline: string;
  /** Longest output edge in pixels; the short edge follows from the source aspect ratio. */
  longEdge: number;
  videoKbps: number;
  audioKbps: number;
  /**
   * `auto` reproduces the library's WhatsApp-style ladder and ignores an explicit bitrate;
   * `manual` honours `videoKbps`.
   */
  method: CompressionMethod;
};

const FULL_HD: QualityTier = {
  id: 'fullHd',
  label: 'Full HD · 1080p',
  tagline: 'Best quality',
  longEdge: 1920,
  videoKbps: 4500,
  audioKbps: ESTIMATE_AUDIO_KBPS,
  method: 'manual',
};

/**
 * `manual`, not `auto`, despite §5's implementation column.
 *
 * In `auto` the library ignores the bitrate we pass and applies its own envelope, which ceilings a
 * 1280px target at 2.0 Mbps and aims for ~1.5 Mbps — sized for chat playback, and visibly softer
 * than this tier promises. `manual` is the documented way to control the bitrate, and it is what
 * makes the 2.5 Mbps in §5's table actually take effect.
 */
const HD: QualityTier = {
  id: 'hd',
  label: 'HD · 720p',
  tagline: 'Great for sharing',
  longEdge: 1280,
  videoKbps: 2500,
  audioKbps: ESTIMATE_AUDIO_KBPS,
  method: 'manual',
};

/**
 * The library's `auto` mode, which reproduces WhatsApp's envelope: 720p, ~1.2–2.0 Mbps, and never
 * more than 95% of the source bitrate. `auto` ignores any bitrate we pass, so `videoKbps` here
 * feeds only the §6 estimate — 2000 is the envelope's 720p ceiling, where big sources land.
 */
const WHATSAPP: QualityTier = {
  id: 'whatsApp',
  label: 'WhatsApp · 720p',
  tagline: 'Chat-app size',
  longEdge: 1280,
  videoKbps: 2000,
  audioKbps: ESTIMATE_AUDIO_KBPS,
  method: 'auto',
};

/** Smallest first — the §3.2 picker reads as a size ladder. */
export const QUALITY_TIERS: QualityTier[] = [WHATSAPP, HD, FULL_HD];

export const DEFAULT_TIER_ID: QualityTierId = HD.id;

/** Assumed until the native module can report the real frame rate. */
export const ASSUMED_FRAME_RATE = 30;

const REFERENCE_FRAME_RATE = 30;

/** A 60 fps source needs more bits for the same quality — but never more than double. */
const MAX_FRAME_RATE_MULTIPLIER = 2;

export type TierSourceFacts = {
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sizeBytes: number | null;
  frameRate: number;
};

export type TierEligibility =
  | { eligible: true; estimatedBytes: number | null }
  | { eligible: false; reason: string };

export function tierById(id: QualityTierId): QualityTier {
  const tier = QUALITY_TIERS.find(candidate => candidate.id === id);
  if (!tier) throw new Error(`Unknown quality tier: ${id}`);
  return tier;
}

export function sourceFactsFrom(
  video: LibraryVideo,
  sizeBytes: number | null,
  frameRate: number = ASSUMED_FRAME_RATE
): TierSourceFacts {
  return {
    width: video.width,
    height: video.height,
    durationMs: video.durationMs,
    sizeBytes,
    frameRate,
  };
}

/** §6: `duration × (video + audio kbps) ÷ 8000`, in bytes. */
export function estimateOutputBytes(
  tier: QualityTier,
  facts: TierSourceFacts
): number | null {
  if (facts.durationMs === null || facts.durationMs <= 0) return null;

  const seconds = facts.durationMs / 1000;
  const totalKbps = effectiveVideoKbps(tier, facts.frameRate) + tier.audioKbps;
  return Math.round((seconds * totalKbps * 1000) / 8);
}

/**
 * The bitrate this tier will actually target.
 *
 * Only `manual` tiers scale with frame rate: in `auto` mode the library picks its own ladder and
 * ignores the bitrate we pass, so pretending otherwise would make the estimate worse, not better.
 */
export function effectiveVideoKbps(
  tier: QualityTier,
  frameRate: number
): number {
  if (tier.method !== 'manual') return tier.videoKbps;

  const multiplier = clamp(
    frameRate / REFERENCE_FRAME_RATE,
    1,
    MAX_FRAME_RATE_MULTIPLIER
  );
  return Math.round(tier.videoKbps * multiplier);
}

/**
 * §5: a tier is disabled when the source is already at or below both its resolution and its
 * bitrate, or when compressing could not make the file smaller. Output is never upscaled and never
 * larger than the source.
 */
export function evaluateTier(
  tier: QualityTier,
  facts: TierSourceFacts
): TierEligibility {
  const estimatedBytes = estimateOutputBytes(tier, facts);
  const sourceLongEdge = longEdgeOf(facts);

  // A tier below the source's resolution would be advertising a size it cannot produce — output is
  // clamped to the source, so "Full HD · 1080p" on a 720p video is a label, not a result. Strictly
  // less than, so a source sitting exactly at a tier's resolution can still be compressed to it.
  if (sourceLongEdge !== null && sourceLongEdge < tier.longEdge) {
    return {
      eligible: false,
      reason: `Source is only ${sourceLongEdge}px`,
    };
  }

  if (sourceLongEdge !== null && sourceLongEdge <= tier.longEdge) {
    const sourceKbps = totalSourceKbps(facts);
    const tierKbps = effectiveVideoKbps(tier, facts.frameRate) + tier.audioKbps;

    if (sourceKbps !== null && sourceKbps <= tierKbps) {
      return {
        eligible: false,
        reason: `Already ${sourceLongEdge}px and no higher bitrate`,
      };
    }
  }

  if (
    facts.sizeBytes !== null &&
    estimatedBytes !== null &&
    estimatedBytes >= facts.sizeBytes
  ) {
    return { eligible: false, reason: 'Would not make the file smaller' };
  }

  return { eligible: true, estimatedBytes };
}

/** True when no tier can improve on the source (§5's "Already optimized"). */
export function isAlreadyOptimized(facts: TierSourceFacts): boolean {
  return QUALITY_TIERS.every(tier => !evaluateTier(tier, facts).eligible);
}

/** The output dimensions for a tier, preserving aspect ratio and never upscaling (§5). */
export function outputLongEdge(
  tier: QualityTier,
  facts: TierSourceFacts
): number {
  const sourceLongEdge = longEdgeOf(facts);
  return sourceLongEdge === null
    ? tier.longEdge
    : Math.min(tier.longEdge, sourceLongEdge);
}

function longEdgeOf(facts: TierSourceFacts): number | null {
  if (!facts.width || !facts.height) return null;
  return Math.max(facts.width, facts.height);
}

function totalSourceKbps(facts: TierSourceFacts): number | null {
  if (!facts.sizeBytes || !facts.durationMs || facts.durationMs <= 0)
    return null;
  return (facts.sizeBytes * 8) / (facts.durationMs / 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
