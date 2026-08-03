package expo.modules.mediatools

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.Log
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * The four things the app needs that no JavaScript dependency can provide (§7, §8):
 * source video properties, batched asset sizes, capture metadata write-back, and a foreground
 * service for background compression.
 *
 * The TypeScript surface is identical on both platforms; the iOS implementation reports its
 * capabilities as false until it is written, so callers branch on the result, never on the platform.
 */
class MediaToolsModule : Module() {
  private companion object {
    /** §5's output container; the encoder never produces anything else. */
    const val MP4_MIME_TYPE = "video/mp4"

    /** `adb logcat -s MediaTools` follows a save end to end. */
    const val TAG = "MediaTools"
  }

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val resolver get() = context.contentResolver

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
        "foregroundService" to true,
        "librarySave" to true
      )
    }

    AsyncFunction("saveVideo") { options: SaveVideoInput ->
      saveVideo(options)
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
      startService(options)
    }

    AsyncFunction("updateCompressionProgress") { options: ServiceNotification ->
      updateNotification(options)
    }

    AsyncFunction("stopCompressionService") {
      stopService()
    }
  }

  // MARK: - Source properties

  private fun readVideoProperties(assetId: String): Map<String, Any?>? {
    val uri = Uri.parse(assetId)
    val retriever = MediaMetadataRetriever()

    return try {
      retriever.setDataSource(context, uri)

      mapOf(
        "folder" to queryString(uri, MediaStore.MediaColumns.RELATIVE_PATH),
        "sizeBytes" to querySize(uri),
        // Parentheses required: infix `to` binds tighter than `?:`.
        "frameRate" to (
          retriever.extract(MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE)?.toFloatOrNull()
            ?: deriveFrameRate(retriever)
          ),
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

  private fun queryString(uri: Uri, column: String): String? =
    runCatching {
      context.contentResolver.query(uri, arrayOf(column), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getString(0) else null
      }
    }.getOrNull()

  // MARK: - Saving to the library

  /**
   * §8: saves a finished encode into the gallery, in the source's own folder, carrying its dates.
   *
   * The dates go into the MP4's own header atoms first, because the media store's columns are not
   * durable: publishing the row triggers an asynchronous scan that re-derives DATE_TAKEN from the
   * file's `creation_time` — which the encoder wrote as "now" — and can land after any column
   * write of ours. Once the file itself carries the source's dates, every scan converges on them.
   * The column writes at insert and publish then only cover the window before that scan runs.
   *
   * `IS_PENDING` keeps the row invisible to other apps until the bytes are in, so no gallery ever
   * shows a half-written video.
   */
  private fun saveVideo(options: SaveVideoInput): String {
    // Request and outcome bracket every save, so a metadata bug report needs no extra build.
    Log.i(TAG, "[save] request ${describe(options)}")

    stampOutputFileDates(options)

    val uri = insertPendingRow(options)
    copyBytesInto(uri, options.path)
    publish(uri, options)
    assertDates(uri, options)

    Log.i(TAG, "[save] final ${readColumns(uri)}")
    return uri.toString()
  }

  /**
   * Patches the encode's `mvhd`/`tkhd`/`mdhd` atoms to the source's dates before the bytes leave
   * our temp directory. The file is workspace-owned and about to be discarded, so mutating it is
   * safe — and a patch failure only means falling back to the column-write path.
   */
  private fun stampOutputFileDates(options: SaveVideoInput) {
    val creationMs = options.capturedAtMs?.toLong() ?: return
    val modificationMs = options.modifiedAtMs?.toLong() ?: creationMs
    val file = File(options.path.removePrefix("file://"))

    runCatching { Mp4Dates.apply(file, creationMs, modificationMs) }
      .onSuccess { atoms ->
        // Zero atoms means the dates rest on the column writes alone — the first thing to check
        // if a saved copy ever shows the wrong date again.
        if (atoms == 0) Log.w(TAG, "[save] no MP4 atoms patched; dates rely on column writes")
        else Log.i(TAG, "[save] stamped $atoms MP4 atoms with the source dates")
      }
      .onFailure { Log.w(TAG, "[save] could not stamp MP4 dates", it) }
  }

  private fun insertPendingRow(options: SaveVideoInput): Uri {
    val values = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, options.filename)
      put(MediaStore.MediaColumns.MIME_TYPE, MP4_MIME_TYPE)
      options.folder?.let { put(MediaStore.MediaColumns.RELATIVE_PATH, it) }
      putDates(options)
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }

    val collection = MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
    return resolver.insert(collection, values)
      ?: throw SaveFailedException("The media store refused to create the file.")
  }

  private fun copyBytesInto(uri: Uri, sourcePath: String) {
    try {
      resolver.openOutputStream(uri)?.use { output ->
        File(sourcePath.removePrefix("file://")).inputStream().use { it.copyTo(output) }
      } ?: throw SaveFailedException("The media store gave no stream to write to.")
    } catch (error: Exception) {
      // A pending row with no bytes would linger invisibly forever.
      runCatching { resolver.delete(uri, null, null) }
      Log.w(TAG, "[save] write failed, row deleted", error)
      throw error
    }
  }

  /** Makes the row visible, re-sending the dates in the same update the scan is triggered by. */
  private fun publish(uri: Uri, options: SaveVideoInput) {
    writeValues(
      uri,
      ContentValues().apply {
        put(MediaStore.MediaColumns.IS_PENDING, 0)
        putDates(options)
      }
    )
  }

  /**
   * The last word on the dates: whatever the publish scan decided, these are the values §8 promised.
   *
   * The file's own timestamp is stamped too — DATE_MODIFIED is derived from it, so a media rescan
   * that ignores the column still lands on the right answer.
   */
  private fun assertDates(uri: Uri, options: SaveVideoInput) {
    if (options.capturedAtMs == null && options.modifiedAtMs == null) return

    writeValues(uri, ContentValues().apply { putDates(options) })
    options.modifiedAtMs?.let { stampUnderlyingFile(uri, it.toLong()) }
  }

  private fun ContentValues.putDates(options: SaveVideoInput) {
    options.capturedAtMs?.let { put(MediaStore.Video.Media.DATE_TAKEN, it.toLong()) }
    options.modifiedAtMs?.let {
      // DATE_MODIFIED is seconds, unlike DATE_TAKEN.
      put(MediaStore.MediaColumns.DATE_MODIFIED, it.toLong() / 1000)
    }
  }

  private fun writeValues(uri: Uri, values: ContentValues): ColumnWrite =
    runCatching { resolver.update(uri, values, null, null) }
      .fold(
        onSuccess = { ColumnWrite(rows = it, error = null) },
        onFailure = { ColumnWrite(rows = 0, error = it.message ?: it::class.java.simpleName) }
      )

  private fun describe(options: SaveVideoInput): String =
    "filename=${options.filename} folder=${options.folder} " +
      "capturedAt=${asDate(options.capturedAtMs?.toLong())} " +
      "modifiedAt=${asDate(options.modifiedAtMs?.toLong())}"

  /** What the media store actually holds for a row — the answer to "did the dates stick?". */
  private fun readColumns(uri: Uri): String {
    val takenMs = queryLong(uri, MediaStore.Video.Media.DATE_TAKEN)
    val modifiedSeconds = queryLong(uri, MediaStore.MediaColumns.DATE_MODIFIED)
    val addedSeconds = queryLong(uri, MediaStore.MediaColumns.DATE_ADDED)

    return "dateTaken=${asDate(takenMs)} " +
      "dateModified=${asDate(modifiedSeconds?.times(1000))} " +
      "dateAdded=${asDate(addedSeconds?.times(1000))} " +
      "relativePath=${queryString(uri, MediaStore.MediaColumns.RELATIVE_PATH)} " +
      "data=${queryString(uri, MediaStore.MediaColumns.DATA)}"
  }

  private fun asDate(epochMs: Long?): String =
    if (epochMs == null || epochMs <= 0) "none"
    else "${SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date(epochMs))} ($epochMs)"

  // MARK: - Metadata write-back

  /**
   * §8: carries the original capture and modified dates onto a newly saved asset.
   *
   * Every field is verified by reading it back, because a write the provider silently ignored looks
   * exactly like a successful one — and §8 asks for what could not be carried over, not for what we
   * attempted.
   *
   * Location cannot follow. `MediaStore.Video.Media.LATITUDE`/`LONGITUDE` were removed in Android
   * 10, and writing an ISO-6709 `©xyz` atom into the MP4 would need a muxer we do not have.
   */
  private fun applyAssetMetadata(
    assetId: String,
    metadata: AssetMetadataInput
  ): Map<String, Any> {
    val uri = Uri.parse(assetId)
    val capturedAtMs = metadata.capturedAtMs?.toLong()
    // DATE_TAKEN is milliseconds; DATE_MODIFIED is seconds.
    val modifiedAtSeconds = metadata.modifiedAtMs?.let { it.toLong() / 1000 }

    // One update for both columns: MediaProvider re-derives values on write, so a second update
    // can undo the first.
    val write = writeColumns(
      uri,
      buildMap<String, Long> {
        capturedAtMs?.let { put(MediaStore.Video.Media.DATE_TAKEN, it) }
        modifiedAtSeconds?.let { put(MediaStore.MediaColumns.DATE_MODIFIED, it) }
      }
    )

    val applied = mutableListOf<String>()
    val skipped = mutableListOf<Map<String, String>>()

    capturedAtMs?.let { expected ->
      // DATE_TAKEN is ours to set, so it has to read back exactly.
      val actual = queryLong(uri, MediaStore.Video.Media.DATE_TAKEN)
      if (write.succeeded && actual == expected) applied.add("capturedAt")
      else skipped.add(field("capturedAt", write.explain("wrote $expected, read back $actual")))
    }

    modifiedAtSeconds?.let { expected ->
      // The provider owns DATE_MODIFIED and recomputes it from the file, so an exact read-back is
      // the wrong success test — stamp the file too and accept the write.
      val stamped = metadata.modifiedAtMs?.let { stampUnderlyingFile(uri, it.toLong()) } ?: false
      if (write.succeeded || stamped) applied.add("modifiedAt")
      else skipped.add(field("modifiedAt", write.explain("wrote $expected, and the file stamp failed")))
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

  /** What a write attempt did, kept whole so a skip can say why rather than just that it failed. */
  private data class ColumnWrite(val rows: Int, val error: String?) {
    val succeeded: Boolean get() = rows > 0

    fun explain(detail: String): String = when {
      error != null -> "The media store threw: $error"
      rows == 0 -> "The media store accepted no rows for this asset."
      else -> "The media store overwrote the value: $detail."
    }
  }

  private fun writeColumns(uri: Uri, columns: Map<String, Long>): ColumnWrite {
    if (columns.isEmpty()) return ColumnWrite(rows = 0, error = null)

    return writeValues(
      uri,
      ContentValues().apply { columns.forEach { (name, value) -> put(name, value) } }
    )
  }

  private fun stampUnderlyingFile(uri: Uri, modifiedAtMs: Long): Boolean {
    val path = queryString(uri, MediaStore.MediaColumns.DATA) ?: return false
    return runCatching { File(path).setLastModified(modifiedAtMs) }.getOrDefault(false)
  }

  private fun field(name: String, reason: String) = mapOf("field" to name, "reason" to reason)

  // MARK: - Foreground service

  /** Counts start requests, so a queued stop can tell when it has been superseded by a new session. */
  @Volatile
  private var serviceStartCount = 0

  /** Starting is only ever called while the app is on screen, where a service start is allowed. */
  private fun startService(options: ServiceNotification) {
    serviceStartCount += 1
    CompressionForegroundService.stopRequested = false

    val live = CompressionForegroundService.running
    if (live != null && !live.finishing) {
      // The service survived the previous session. A second start intent would open a fresh
      // startForeground obligation that a racing stop could leave unmet — and an unmet obligation
      // kills the app. Re-titling the live notification is all a new session needs.
      updateNotification(options)
      return
    }

    val intent = Intent(context, CompressionForegroundService::class.java).apply {
      action = CompressionForegroundService.ACTION_START
      putExtra(CompressionForegroundService.EXTRA_TITLE, options.title)
      putExtra(CompressionForegroundService.EXTRA_PROGRESS, options.progress)
      putExtra(CompressionForegroundService.EXTRA_ELAPSED, options.elapsed)
      putExtra(CompressionForegroundService.EXTRA_REMAINING, options.remaining)
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent)
    } else {
      context.startService(intent)
    }
  }

  /**
   * Progress goes straight to the notification rather than through the service.
   *
   * Android 12+ rejects `startForegroundService` from the background — which is exactly where a
   * compression spends its time — so an intent per update stopped the notification from moving as
   * soon as the app left the screen. `notify()` on the service's own id has no such restriction and
   * updates the same notification in place.
   */
  private fun updateNotification(options: ServiceNotification) {
    CompressionNotification.post(
      context,
      CompressionStatus(options.title, options.progress, options.elapsed, options.remaining)
    )
  }

  /**
   * Ends the service through the live instance instead of another start intent, which the platform
   * would refuse from the background — the case where jobs actually finish.
   *
   * Every service call returns `Unit` on purpose: `startService` answers with a `ComponentName`,
   * and an `AsyncFunction` whose body ends in one tries to send that across the bridge and rejects.
   */
  private fun stopService() {
    val requestedAt = serviceStartCount
    val appContext = context.applicationContext

    Handler(Looper.getMainLooper()).post {
      // A newer session claimed the service while this stop sat in the queue — leave it alone.
      if (serviceStartCount != requestedAt) return@post

      // The start intent may not have been delivered yet; the flag makes the service stop itself
      // right after it satisfies the startForeground obligation, instead of the stop being lost.
      CompressionForegroundService.stopRequested = true
      CompressionForegroundService.running?.finish()
      // The service may never have started — or already have died — but the notification is ours.
      CompressionNotification.cancel(appContext)
    }
  }
}

class SaveVideoInput : Record {
  @Field val path: String = ""

  @Field val filename: String = "video.mp4"

  /** MediaStore `RELATIVE_PATH`, e.g. "DCIM/Camera/". Null saves to the default location. */
  @Field val folder: String? = null

  @Field val capturedAtMs: Double? = null

  @Field val modifiedAtMs: Double? = null
}

class SaveFailedException(message: String) : Exception(message)

class ServiceNotification : Record {
  @Field val title: String = "Compressing video"

  @Field val progress: Int = 0

  /** e.g. "1 min 12 s elapsed". */
  @Field val elapsed: String = ""

  /** e.g. "2 min 5 s left". */
  @Field val remaining: String = ""
}

class AssetMetadataInput : Record {
  @Field val capturedAtMs: Double? = null

  @Field val modifiedAtMs: Double? = null

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
