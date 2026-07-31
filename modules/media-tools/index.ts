import { requireNativeModule } from 'expo';

/**
 * `media-tools` — the four capabilities no JavaScript dependency in this project can provide.
 *
 * Both platforms register the same function names. Where a platform has no implementation yet it
 * says so through `capabilities` and returns an empty result, so callers branch on the answer
 * rather than on `Platform.OS`.
 */

export type MediaToolsCapabilities = {
  videoProperties: boolean;
  assetSizes: boolean;
  captureDateWriteBack: boolean;
  locationWriteBack: boolean;
  foregroundService: boolean;
};

export type GeoLocation = { latitude: number; longitude: number };

export type NativeVideoProperties = {
  sizeBytes: number | null;
  frameRate: number | null;
  rotationDegrees: number;
  bitrate: number | null;
  capturedAtMs: number | null;
  location: GeoLocation | null;
};

export type MetadataField = 'capturedAt' | 'location';

export type AppliedMetadataReport = {
  applied: MetadataField[];
  skipped: { field: MetadataField; reason: string }[];
};

export type ServiceNotification = {
  title: string;
  text: string;
  /** Whole percent, 0–100. */
  progress: number;
};

type MediaToolsNative = {
  getCapabilities: () => MediaToolsCapabilities;
  readVideoProperties: (
    assetId: string
  ) => Promise<NativeVideoProperties | null>;
  readAssetSizes: (assetIds: string[]) => Promise<Record<string, number>>;
  applyAssetMetadata: (
    assetId: string,
    metadata: { capturedAtMs?: number; latitude?: number; longitude?: number }
  ) => Promise<AppliedMetadataReport>;
  startCompressionService: (options: ServiceNotification) => Promise<void>;
  updateCompressionProgress: (options: ServiceNotification) => Promise<void>;
  stopCompressionService: () => Promise<void>;
};

const native = requireNativeModule<MediaToolsNative>('MediaTools');

export const MediaTools = native;

export const mediaToolsCapabilities: MediaToolsCapabilities =
  native.getCapabilities();
