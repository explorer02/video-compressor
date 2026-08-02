package expo.modules.mediatools

import java.io.File
import java.io.RandomAccessFile

/**
 * Writes capture/modified times into an MP4's own header atoms (`mvhd`, `tkhd`, `mdhd`).
 *
 * The media store's date columns are not durable: publishing a row triggers a scan — an
 * asynchronous one — that re-derives `DATE_TAKEN` from the file's `creation_time`, and the encoder
 * writes that as "now". A date that lives only in the columns is a date waiting to be overwritten;
 * the one inside the file is the one every scan, and every app that reads the file directly,
 * agrees on.
 *
 * The timestamps sit at fixed offsets inside their atoms, so this is an in-place patch of a few
 * header bytes — no re-muxing, and the media data is never touched.
 */
internal object Mp4Dates {
  /** MP4 timestamps count seconds from 1904-01-01, not the Unix epoch. */
  private const val SECONDS_1904_TO_1970 = 2_082_844_800L

  /** Atoms that nest the timed ones: moov → trak → mdia. */
  private val CONTAINERS = setOf("moov", "trak", "mdia")

  /** Full boxes whose payload starts version(1) flags(3) creation modification. */
  private val TIMED = setOf("mvhd", "tkhd", "mdhd")

  /**
   * Returns how many atoms were patched — 0 means the file was left untouched. A malformed box
   * stops the walk rather than risking a write at a wrong offset.
   */
  fun apply(file: File, creationMs: Long, modificationMs: Long): Int =
    RandomAccessFile(file, "rw").use { raf ->
      patchRange(raf, 0, raf.length(), creationMs, modificationMs)
    }

  private fun patchRange(
    raf: RandomAccessFile,
    start: Long,
    end: Long,
    creationMs: Long,
    modificationMs: Long
  ): Int {
    var offset = start
    var patched = 0

    while (offset + 8 <= end) {
      raf.seek(offset)
      var headerSize = 8L
      var boxSize = readUInt32(raf)
      val type = readType(raf)

      when (boxSize) {
        0L -> boxSize = end - offset // "to the end of the enclosing box"
        1L -> {
          boxSize = raf.readLong() // 64-bit size follows the type
          headerSize = 16L
        }
      }
      if (boxSize < headerSize || offset + boxSize > end) return patched

      when (type) {
        in CONTAINERS ->
          patched += patchRange(raf, offset + headerSize, offset + boxSize, creationMs, modificationMs)
        in TIMED ->
          if (patchTimedBox(raf, offset + headerSize, creationMs, modificationMs)) patched++
      }

      offset += boxSize
    }

    return patched
  }

  private fun patchTimedBox(
    raf: RandomAccessFile,
    payload: Long,
    creationMs: Long,
    modificationMs: Long
  ): Boolean {
    raf.seek(payload)
    val version = raf.readByte().toInt()
    val creation = creationMs / 1000 + SECONDS_1904_TO_1970
    val modification = modificationMs / 1000 + SECONDS_1904_TO_1970

    when (version) {
      0 -> {
        raf.seek(payload + 4)
        // Long.toInt() keeps the low 32 bits — exactly the unsigned encoding these fields use.
        raf.writeInt(creation.toInt())
        raf.writeInt(modification.toInt())
      }
      1 -> {
        raf.seek(payload + 4)
        raf.writeLong(creation)
        raf.writeLong(modification)
      }
      else -> return false
    }
    return true
  }

  private fun readUInt32(raf: RandomAccessFile): Long = raf.readInt().toLong() and 0xFFFFFFFFL

  private fun readType(raf: RandomAccessFile): String {
    val bytes = ByteArray(4)
    raf.readFully(bytes)
    return String(bytes, Charsets.US_ASCII)
  }
}
