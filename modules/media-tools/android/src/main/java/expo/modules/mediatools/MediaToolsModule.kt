package expo.modules.mediatools

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/**
 * The four things the app needs that no JavaScript dependency can provide (§7, §8):
 * source video properties, batched asset sizes, capture metadata write-back, and a foreground
 * service for background compression.
 *
 * The TypeScript surface is identical on both platforms; the iOS implementation reports its
 * capabilities as false until it is written, so callers branch on the result, never on the platform.
 */
class MediaToolsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("MediaTools")

    Function("getCapabilities") {
      mapOf(
        "videoProperties" to true,
        "assetSizes" to true,
        "captureDateWriteBack" to true,
        // MediaStore's LATITUDE/LONGITUDE columns were removed in Android 10 and nothing here can
        // write an ISO-6709 atom into the MP4, so location genuinely cannot be carried over.
        "locationWriteBack" to false,
        "foregroundService" to true
      )
    }

    AsyncFunction("readVideoProperties") { assetId: String ->
      readVideoProperties(assetId)
    }

    AsyncFunction("readAssetSizes") { assetIds: List<String> ->
      readAssetSizes(assetIds)
    }

    AsyncFunction("applyAssetMetadata") { assetId: String, metadata: AssetMetadataInput ->
      applyAssetMetadata(assetId, metadata)
    }

    AsyncFunction("startCompressionService") { options: ServiceNotification ->
      sendToService(CompressionForegroundService.ACTION_START, options)
    }

    AsyncFunction("updateCompressionProgress") { options: ServiceNotification ->
      sendToService(CompressionForegroundService.ACTION_UPDATE, options)
    }

    AsyncFunction("stopCompressionService") {
      context.startService(
        Intent(context, CompressionForegroundService::class.java).apply {
          action = CompressionForegroundService.ACTION_STOP
        }
      )
    }
  }

  // MARK: - Source properties

  private fun readVideoProperties(assetId: String): Map<String, Any?>? {
    val uri = Uri.parse(assetId)
    val retriever = MediaMetadataRetriever()

    return try {
      retriever.setDataSource(context, uri)

      mapOf(
        "sizeBytes" to querySize(uri),
        "frameRate" to retriever.extract(MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE)
          ?.toFloatOrNull()
          ?: deriveFrameRate(retriever),
        "rotationDegrees" to
          (retriever.extract(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0),
        "bitrate" to retriever.extract(MediaMetadataRetriever.METADATA_KEY_BITRATE)?.toIntOrNull(),
        "capturedAtMs" to queryCapturedAt(uri),
        "location" to parseIso6709(
          retriever.extract(MediaMetadataRetriever.METADATA_KEY_LOCATION)
        )
      )
    } catch (error: Exception) {
      // A stale or unreadable asset simply has no properties; the caller falls back.
      null
    } finally {
      retriever.release()
    }
  }

  /** Frame count over duration — the capture-framerate key is absent on plenty of devices. */
  private fun deriveFrameRate(retriever: MediaMetadataRetriever): Float? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return null

    val frames = retriever.extract(MediaMetadataRetriever.METADATA_KEY_VIDEO_FRAME_COUNT)
      ?.toIntOrNull() ?: return null
    val durationMs = retriever.extract(MediaMetadataRetriever.METADATA_KEY_DURATION)
      ?.toLongOrNull() ?: return null
    if (durationMs <= 0) return null

    return frames * 1000f / durationMs
  }

  private fun MediaMetadataRetriever.extract(key: Int): String? = extractMetadata(key)

  // MARK: - Sizes

  /** One cursor for the whole batch — the media store already indexes SIZE. */
  private fun readAssetSizes(assetIds: List<String>): Map<String, Double> {
    if (assetIds.isEmpty()) return emptyMap()

    val byRowId = assetIds.mapNotNull { id ->
      runCatching { ContentUris.parseId(Uri.parse(id)) }.getOrNull()?.let { it to id }
    }.toMap()
    if (byRowId.isEmpty()) return emptyMap()

    val placeholders = byRowId.keys.joinToString(",") { "?" }
    val sizes = mutableMapOf<String, Double>()

    context.contentResolver.query(
      MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
      arrayOf(MediaStore.Video.Media._ID, MediaStore.Video.Media.SIZE),
      "${MediaStore.Video.Media._ID} IN ($placeholders)",
      byRowId.keys.map { it.toString() }.toTypedArray(),
      null
    )?.use { cursor ->
      val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID)
      val sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE)

      while (cursor.moveToNext()) {
        val assetId = byRowId[cursor.getLong(idColumn)] ?: continue
        val size = cursor.getLong(sizeColumn)
        if (size > 0) sizes[assetId] = size.toDouble()
      }
    }

    return sizes
  }

  private fun querySize(uri: Uri): Double? = queryLong(uri, MediaStore.Video.Media.SIZE)?.toDouble()

  private fun queryCapturedAt(uri: Uri): Double? =
    queryLong(uri, MediaStore.Video.Media.DATE_TAKEN)?.takeIf { it > 0 }?.toDouble()

  private fun queryLong(uri: Uri, column: String): Long? =
    context.contentResolver.query(uri, arrayOf(column), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getLong(0) else null
    }

  // MARK: - Metadata write-back

  /**
   * §8: carries the original capture date onto a newly saved asset.
   *
   * Location cannot follow it. `MediaStore.Video.Media.LATITUDE`/`LONGITUDE` were removed in
   * Android 10, and writing an ISO-6709 `©xyz` atom into the MP4 would need a muxer we do not
   * have — so it is reported as skipped rather than silently dropped.
   */
  private fun applyAssetMetadata(
    assetId: String,
    metadata: AssetMetadataInput
  ): Map<String, Any> {
    val applied = mutableListOf<String>()
    val skipped = mutableListOf<Map<String, String>>()

    metadata.capturedAtMs?.let { capturedAt ->
      val values = ContentValues().apply {
        put(MediaStore.Video.Media.DATE_TAKEN, capturedAt.toLong())
      }
      val updated = runCatching {
        context.contentResolver.update(Uri.parse(assetId), values, null, null)
      }.getOrDefault(0)

      if (updated > 0) applied.add("capturedAt")
      else skipped.add(field("capturedAt", "The media store rejected the capture date update."))
    }

    if (metadata.latitude != null && metadata.longitude != null) {
      skipped.add(
        field(
          "location",
          "Android removed the media store's location columns in Android 10."
        )
      )
    }

    return mapOf("applied" to applied, "skipped" to skipped)
  }

  private fun field(name: String, reason: String) = mapOf("field" to name, "reason" to reason)

  // MARK: - Foreground service

  private fun sendToService(action: String, options: ServiceNotification) {
    val intent = Intent(context, CompressionForegroundService::class.java).apply {
      this.action = action
      putExtra(CompressionForegroundService.EXTRA_TITLE, options.title)
      putExtra(CompressionForegroundService.EXTRA_TEXT, options.text)
      putExtra(CompressionForegroundService.EXTRA_PROGRESS, options.progress)
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent)
    } else {
      context.startService(intent)
    }
  }
}

class ServiceNotification : Record {
  @Field val title: String = "Compressing video"

  @Field val text: String = ""

  @Field val progress: Int = 0
}

class AssetMetadataInput : Record {
  @Field val capturedAtMs: Double? = null

  @Field val latitude: Double? = null

  @Field val longitude: Double? = null
}

private fun parseIso6709(value: String?): Map<String, Double>? {
  if (value.isNullOrBlank()) return null

  // e.g. "+52.3676+004.9041/" — sign-prefixed latitude then longitude.
  val match = Regex("([+-]\\d+\\.?\\d*)([+-]\\d+\\.?\\d*)").find(value) ?: return null
  val latitude = match.groupValues[1].toDoubleOrNull() ?: return null
  val longitude = match.groupValues[2].toDoubleOrNull() ?: return null

  return mapOf("latitude" to latitude, "longitude" to longitude)
}
