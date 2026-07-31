import ExpoModulesCore

/**
 * iOS side of `media-tools`.
 *
 * Every function the Android implementation exposes exists here with the same name and signature,
 * so no caller ever branches on the platform. The bodies are not implemented yet: CompressHD ships
 * Android first, and `getCapabilities` reports that honestly rather than returning plausible
 * wrong values.
 *
 * Filling these in is the whole of the remaining iOS work:
 * - `readVideoProperties`  → `PHImageManager.requestAVAsset`, `AVAssetTrack.nominalFrameRate`,
 *                            `estimatedDataRate`, `preferredTransform`, `PHAsset.creationDate`
 *                            and `.location`.
 * - `readAssetSizes`       → `PHAssetResource` file size, falling back to a `URLResourceValues`
 *                            stat, which is what unlocks sorting the browser by file size.
 * - `applyAssetMetadata`   → `PHAssetChangeRequest.creationDate` / `.location` on the saved asset.
 * - Service functions      → no-ops by design; iOS has no foreground service. Background
 *                            continuation uses the compressor's own background task instead.
 */
public class MediaToolsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MediaTools")

    Function("getCapabilities") { () -> [String: Bool] in
      [
        "videoProperties": false,
        "assetSizes": false,
        "captureDateWriteBack": false,
        "locationWriteBack": false,
        "foregroundService": false
      ]
    }

    AsyncFunction("readVideoProperties") { (_: String) -> [String: Any]? in
      nil
    }

    AsyncFunction("readAssetSizes") { (_: [String]) -> [String: Double] in
      [:]
    }

    AsyncFunction("applyAssetMetadata") { (_: String, _: AssetMetadataInput) -> [String: Any] in
      [
        "applied": [String](),
        "skipped": [
          ["field": "capturedAt", "reason": Self.notImplemented],
          ["field": "location", "reason": Self.notImplemented]
        ]
      ]
    }

    AsyncFunction("startCompressionService") { (_: ServiceNotification) in }

    AsyncFunction("updateCompressionProgress") { (_: ServiceNotification) in }

    AsyncFunction("stopCompressionService") { }
  }

  private static let notImplemented =
    "Metadata write-back is not implemented on iOS yet."
}

struct ServiceNotification: Record {
  @Field var title: String = "Compressing video"

  @Field var text: String = ""

  @Field var progress: Int = 0
}

struct AssetMetadataInput: Record {
  @Field var capturedAtMs: Double?

  @Field var latitude: Double?

  @Field var longitude: Double?
}
