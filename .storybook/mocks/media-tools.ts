/**
 * Browser stand-in for modules/media-tools (aliased in .storybook/main.ts). The real module calls
 * `requireNativeModule` at import time, which throws in a browser. Every capability reads false —
 * the same degraded mode the app uses when the native side is missing — so no MediaTools method
 * is ever reached; the stubs exist only so the object has the expected shape.
 */
import type {
  AppliedMetadataReport,
  MediaToolsCapabilities,
  NativeVideoProperties,
  SaveVideoOptions,
  ServiceNotification,
} from '../../modules/media-tools';

export const mediaToolsCapabilities: MediaToolsCapabilities = {
  videoProperties: false,
  assetSizes: false,
  captureDateWriteBack: false,
  locationWriteBack: false,
  foregroundService: false,
  librarySave: false,
};

export const MediaTools = {
  getCapabilities: (): MediaToolsCapabilities => mediaToolsCapabilities,
  saveVideo: async (_options: SaveVideoOptions): Promise<string> =>
    'mock-saved-asset',
  readVideoProperties: async (
    _assetId: string
  ): Promise<NativeVideoProperties | null> => null,
  readAssetSizes: async (
    _assetIds: string[]
  ): Promise<Record<string, number>> => ({}),
  applyAssetMetadata: async (): Promise<AppliedMetadataReport> => ({
    applied: [],
    skipped: [],
  }),
  startCompressionService: async (
    _options: ServiceNotification
  ): Promise<void> => {},
  updateCompressionProgress: async (
    _options: ServiceNotification
  ): Promise<void> => {},
  stopCompressionService: async (): Promise<void> => {},
};
