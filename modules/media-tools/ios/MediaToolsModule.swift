import AVFoundation
import CoreLocation
import ExpoModulesCore
import Photos

/**
 * iOS side of `media-tools` (§7, §8): source video properties, batched asset sizes, and a
 * metadata-carrying gallery save. The TypeScript surface is identical to Android's; callers branch
 * on `getCapabilities`, never on the platform.
 *
 * Photos keeps capture date and location in its own database — unlike Android's MediaStore it
 * never re-derives them from the file — so a save sets them in the creation request and they
 * stick. There is no MP4 atom stamping here for the same reason.
 *
 * The service functions are no-ops by design: iOS has no foreground service, and §7's background
 * continuation rides the compressor's own background task instead (see `core/background`).
 */
public class MediaToolsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MediaTools")

    Function("getCapabilities") { () -> [String: Bool] in
      [
        "videoProperties": true,
        "assetSizes": true,
        "captureDateWriteBack": true,
        "locationWriteBack": true,
        "foregroundService": false,
        "librarySave": true
      ]
    }

    AsyncFunction("saveVideo") { (options: SaveVideoInput, promise: Promise) in
      saveVideo(options, promise: promise)
    }

    AsyncFunction("readVideoProperties") { (assetId: String, promise: Promise) in
      readVideoProperties(assetId: assetId, promise: promise)
    }

    AsyncFunction("readAssetSizes") { (assetIds: [String]) -> [String: Double] in
      readAssetSizes(assetIds)
    }

    AsyncFunction("applyAssetMetadata") { (assetId: String, metadata: AssetMetadataInput, promise: Promise) in
      applyAssetMetadata(assetId: assetId, metadata: metadata, promise: promise)
    }

    AsyncFunction("startCompressionService") { (_: ServiceNotification) in }

    AsyncFunction("updateCompressionProgress") { (_: ServiceNotification) in }

    AsyncFunction("stopCompressionService") { }
  }
}

// MARK: - Asset identity

/**
 * The JS layer's asset ids are the `ph://…` URIs expo-media-library hands out (they double as
 * image and player sources). Photos wants the bare local identifier; every function converts on
 * the way in and — crucially — keys results by the exact id it was given, because the size
 * index's map lookups depend on the round trip being identity.
 */
private let phScheme = "ph://"

private func localIdentifier(fromAssetId assetId: String) -> String {
  assetId.hasPrefix(phScheme) ? String(assetId.dropFirst(phScheme.count)) : assetId
}

private func assetId(fromLocalIdentifier identifier: String) -> String {
  phScheme + identifier
}

private func fetchAsset(_ assetId: String) -> PHAsset? {
  PHAsset.fetchAssets(
    withLocalIdentifiers: [localIdentifier(fromAssetId: assetId)],
    options: nil
  ).firstObject
}

// MARK: - Sizes

private func readAssetSizes(_ assetIds: [String]) -> [String: Double] {
  if assetIds.isEmpty { return [:] }

  var inputIds: [String: String] = [:]
  for id in assetIds {
    inputIds[localIdentifier(fromAssetId: id)] = id
  }

  var sizes: [String: Double] = [:]
  let fetched = PHAsset.fetchAssets(withLocalIdentifiers: Array(inputIds.keys), options: nil)
  fetched.enumerateObjects { asset, _, _ in
    guard let inputId = inputIds[asset.localIdentifier] else { return }
    if let size = fileSize(of: asset), size > 0 { sizes[inputId] = size }
  }

  return sizes
}

/**
 * The bytes behind the asset, read from resource metadata alone — no file I/O and no iCloud
 * download, which is what lets the §4 size index sweep a 5,000-video library at background
 * priority. The edited rendition is preferred over the original recording because it is what the
 * user's gallery shows and what a compression would read.
 *
 * `fileSize` is a key the resource answers but the SDK never formalized; the `responds` guard
 * turns a future removal into "size unknown" (sorted last, excluded from filters) instead of an
 * uncatchable KVC exception.
 */
private func fileSize(of asset: PHAsset) -> Double? {
  let resources = PHAssetResource.assetResources(for: asset)
  let resource =
    resources.first { $0.type == .fullSizeVideo }
    ?? resources.first { $0.type == .video }
    ?? resources.first
  guard let resource, resource.responds(to: NSSelectorFromString("fileSize")) else { return nil }
  return (resource.value(forKey: "fileSize") as? NSNumber)?.doubleValue
}

// MARK: - Source properties

/**
 * The capture facts come straight off the `PHAsset`; the track facts (frame rate, rotation,
 * bitrate) need the `AVAsset` — requested WITHOUT network access on purpose. On the Selected
 * screen this keeps an iCloud-offloaded video from downloading just to show its details; on the
 * compression path `resolveLocalPath` has already pulled the bytes down before this runs, so the
 * request is served locally. When the AVAsset genuinely is not available, the track fields read
 * null and the caller falls back to its assumed frame rate.
 */
private func readVideoProperties(assetId: String, promise: Promise) {
  guard let asset = fetchAsset(assetId) else {
    // A stale or deleted asset simply has no properties; the caller falls back.
    promise.resolve(nil)
    return
  }

  let options = PHVideoRequestOptions()
  options.isNetworkAccessAllowed = false
  options.version = .current

  PHImageManager.default().requestAVAsset(forVideo: asset, options: options) { avAsset, _, _ in
    let track = avAsset?.tracks(withMediaType: .video).first

    promise.resolve([
      // iOS albums are not directories: there is no folder to report, and none to save into.
      "folder": NSNull(),
      "sizeBytes": orNull(fileSize(of: asset)),
      "frameRate": orNull(positive(track.map { Double($0.nominalFrameRate) })),
      "rotationDegrees": track.map(rotationDegrees(of:)) ?? 0,
      "bitrate": orNull(positive(track.map { Double($0.estimatedDataRate) }).map { $0.rounded() }),
      "capturedAtMs": orNull(asset.creationDate.map(epochMs(of:))),
      "location": orNull(asset.location.map {
        ["latitude": $0.coordinate.latitude, "longitude": $0.coordinate.longitude]
      })
    ] as [String: Any])
  }
}

/** The track's display rotation, folded to the 0/90/180/270 the pipeline works in. */
private func rotationDegrees(of track: AVAssetTrack) -> Int {
  let transform = track.preferredTransform
  let radians = atan2(Double(transform.b), Double(transform.a))
  let degrees = Int((radians * 180 / .pi).rounded())
  return ((degrees % 360) + 360) % 360
}

// MARK: - Saving to the library

/**
 * §8: saves a finished encode as a new gallery asset carrying the source's capture date and
 * location, both set in the same change block the asset is created in. What could not be carried
 * is reported, not faked: iOS has no settable modification date (`PHAsset.modificationDate` is
 * system-owned) and no folders.
 */
private func saveVideo(_ options: SaveVideoInput, promise: Promise) {
  let url = fileUrl(fromPath: options.path)
  guard FileManager.default.fileExists(atPath: url.path) else {
    promise.reject(SaveFailedException("there is no file at \(url.path)"))
    return
  }

  var placeholderIdentifier: String?

  PHPhotoLibrary.shared().performChanges({
    let creation = PHAssetCreationRequest.forAsset()

    let resourceOptions = PHAssetResourceCreationOptions()
    resourceOptions.originalFilename = options.filename
    // The workspace copy is discarded right after a successful save; moving instead of copying
    // skips holding the video on disk twice.
    resourceOptions.shouldMoveFile = true
    creation.addResource(with: .video, fileURL: url, options: resourceOptions)

    if let capturedAtMs = options.capturedAtMs {
      creation.creationDate = date(fromEpochMs: capturedAtMs)
    }
    if let location = location(latitude: options.latitude, longitude: options.longitude) {
      creation.location = location
    }

    placeholderIdentifier = creation.placeholderForCreatedAsset?.localIdentifier
  }, completionHandler: { success, error in
    guard success, let identifier = placeholderIdentifier else {
      promise.reject(SaveFailedException(
        error?.localizedDescription ?? "the photo library refused the save"
      ))
      return
    }

    promise.resolve([
      "assetId": assetId(fromLocalIdentifier: identifier),
      "report": saveReport(for: options)
    ] as [String: Any])
  })
}

/**
 * What the creation request carried. The change block is atomic — reaching here means Photos
 * accepted every value in it — so the report is built from what was requested, with the fields
 * iOS can never store listed as skipped with the reason.
 */
private func saveReport(for options: SaveVideoInput) -> [String: Any] {
  var applied: [String] = []
  var skipped: [[String: String]] = []

  if options.capturedAtMs != nil { applied.append("capturedAt") }
  if location(latitude: options.latitude, longitude: options.longitude) != nil {
    applied.append("location")
  }
  if options.modifiedAtMs != nil {
    skipped.append(["field": "modifiedAt", "reason": noSettableModifiedDate])
  }

  return ["applied": applied, "skipped": skipped]
}

// MARK: - Metadata write-back

/**
 * §8's fallback path for an asset that already exists: the same fields, written through
 * `PHAssetChangeRequest` and then verified by refetching the asset — a change Photos ignored
 * looks exactly like one it accepted, and the report promises what a gallery will actually show.
 */
private func applyAssetMetadata(assetId: String, metadata: AssetMetadataInput, promise: Promise) {
  guard let asset = fetchAsset(assetId) else {
    promise.resolve(writeBackReport(assetId: assetId, metadata: metadata, failure: "the asset no longer exists"))
    return
  }

  let capturedAt = metadata.capturedAtMs.map(date(fromEpochMs:))
  let newLocation = location(latitude: metadata.latitude, longitude: metadata.longitude)

  PHPhotoLibrary.shared().performChanges({
    let change = PHAssetChangeRequest(for: asset)
    if let capturedAt { change.creationDate = capturedAt }
    if let newLocation { change.location = newLocation }
  }, completionHandler: { success, error in
    promise.resolve(writeBackReport(
      assetId: assetId,
      metadata: metadata,
      failure: success ? nil : (error?.localizedDescription ?? "the photo library refused the change")
    ))
  })
}

private func writeBackReport(
  assetId: String,
  metadata: AssetMetadataInput,
  failure: String?
) -> [String: Any] {
  var applied: [String] = []
  var skipped: [[String: String]] = []
  // One refetch answers every verification below; nil means nothing can have been written.
  let saved = failure == nil ? fetchAsset(assetId) : nil

  if let expectedMs = metadata.capturedAtMs {
    let actualMs = saved?.creationDate.map(epochMs(of:))
    // Photos stores sub-second dates; a written value reads back within rounding.
    if let actualMs, abs(actualMs - expectedMs) < 1000 {
      applied.append("capturedAt")
    } else {
      skipped.append(field("capturedAt", failure.map { "The photo library threw: \($0)" }
        ?? "Wrote \(Int(expectedMs)), read back \(actualMs.map { String(Int($0)) } ?? "nothing")."))
    }
  }

  if metadata.modifiedAtMs != nil {
    skipped.append(field("modifiedAt", noSettableModifiedDate))
  }

  if metadata.latitude != nil && metadata.longitude != nil {
    if saved?.location != nil {
      applied.append("location")
    } else {
      skipped.append(field("location", failure.map { "The photo library threw: \($0)" }
        ?? "The location did not read back from the saved asset."))
    }
  }

  return ["applied": applied, "skipped": skipped]
}

// MARK: - Shared helpers

private let noSettableModifiedDate =
  "iOS does not expose a settable modification date on photo library assets."

private func field(_ name: String, _ reason: String) -> [String: String] {
  ["field": name, "reason": reason]
}

private func epochMs(of date: Date) -> Double {
  date.timeIntervalSince1970 * 1000
}

private func date(fromEpochMs epochMs: Double) -> Date {
  Date(timeIntervalSince1970: epochMs / 1000)
}

private func location(latitude: Double?, longitude: Double?) -> CLLocation? {
  guard let latitude, let longitude else { return nil }
  return CLLocation(latitude: latitude, longitude: longitude)
}

private func fileUrl(fromPath path: String) -> URL {
  if let url = URL(string: path), url.scheme == "file" { return url }
  return URL(fileURLWithPath: path)
}

private func positive(_ value: Double?) -> Double? {
  guard let value, value > 0 else { return nil }
  return value
}

/** Absent facts cross the bridge as explicit nulls, matching the TypeScript nullable fields. */
private func orNull(_ value: Any?) -> Any {
  value ?? NSNull()
}

internal final class SaveFailedException: GenericException<String> {
  override var reason: String {
    "Saving to the photo library failed: \(param)."
  }
}

struct SaveVideoInput: Record {
  @Field var path: String = ""

  @Field var filename: String = "video.mp4"

  /** Android's MediaStore folder; iOS has no folders — albums are not directories — so unused. */
  @Field var folder: String?

  @Field var capturedAtMs: Double?

  @Field var modifiedAtMs: Double?

  @Field var latitude: Double?

  @Field var longitude: Double?
}

struct ServiceNotification: Record {
  @Field var title: String = "Compressing video"

  @Field var progress: Int = 0

  @Field var elapsed: String = ""

  @Field var remaining: String = ""
}

struct AssetMetadataInput: Record {
  @Field var capturedAtMs: Double?

  @Field var modifiedAtMs: Double?

  @Field var latitude: Double?

  @Field var longitude: Double?
}
