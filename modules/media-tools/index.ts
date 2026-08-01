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

export type MetadataField = 'capturedAt' | 'modifiedAt' | 'location';

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
    metadata: {
      capturedAtMs?: number;
      modifiedAtMs?: number;
      latitude?: number;
      longitude?: number;
    }
  ) => Promise<AppliedMetadataReport>;
  startCompressionService: (options: ServiceNotification) => Promise<void>;
  updateCompressionProgress: (options: ServiceNotification) => Promise<void>;
  stopCompressionService: () => Promise<void>;
};

const NO_CAPABILITIES: MediaToolsCapabilities = {
  videoProperties: false,
  assetSizes: false,
  captureDateWriteBack: false,
  locationWriteBack: false,
  foregroundService: false,
};

export const MediaTools = requireNativeModule<MediaToolsNative>('MediaTools');

/**
 * Read once at startup. If the native side is missing — a JS bundle running against a build that
 * predates this module — every capability reads false and the app degrades instead of crashing on
 * import.
 */
export const mediaToolsCapabilities: MediaToolsCapabilities =
  readCapabilities();

function readCapabilities(): MediaToolsCapabilities {
  try {
    return MediaTools.getCapabilities();
  } catch (error) {
    console.warn('[media-tools] native module unavailable', error);
    return NO_CAPABILITIES;
  }
}
