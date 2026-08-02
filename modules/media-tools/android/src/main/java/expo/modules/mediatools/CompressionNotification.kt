package expo.modules.mediatools

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat

/** What the §7 progress notification says at one moment. */
internal data class CompressionStatus(
  val title: String,
  /** Whole percent, 0–100. */
  val percent: Int,
  /** e.g. "1 min 12 s elapsed". */
  val elapsed: String,
  /** e.g. "2 min 5 s left". */
  val remaining: String
)

/**
 * The single progress notification a compression shows, and the only place that posts it.
 *
 * The foreground service owns the notification's lifetime; progress updates are posted straight
 * through the notification manager. That split matters: Android 12+ refuses
 * `startForegroundService` from the background, so re-delivering an intent to the service is not a
 * way to update progress while the app is backgrounded — `notify()` on the service's own id is,
 * and it updates the very same notification in place.
 *
 * The body is a custom layout: percent on the left, time remaining on the right, elapsed time
 * under the bar — an arrangement the stock template cannot produce.
 */
internal object CompressionNotification {
  const val ID = 4711

  private const val CHANNEL_ID = "compresshd.compression"

  fun build(context: Context, status: CompressionStatus): Notification {
    ensureChannel(context)

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      // The template fields back the custom layout: accessibility services and any surface that
      // cannot inflate RemoteViews (watches, older shades) read these instead.
      .setContentTitle(status.title)
      .setContentText("${status.percent}% · ${status.remaining}")
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setProgress(100, status.percent.coerceIn(0, 100), false)
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
      .setCustomContentView(statusView(context, status))
      .setCustomBigContentView(statusView(context, status))

    // §7: tapping the notification reopens the app, which is still in the Compressing state.
    launchIntent(context)?.let { builder.setContentIntent(it) }

    return builder.build()
  }

  /** Updates the live notification in place, from the foreground or the background alike. */
  fun post(context: Context, status: CompressionStatus) {
    manager(context).notify(ID, build(context, status))
  }

  fun cancel(context: Context) {
    manager(context).cancel(ID)
  }

  private fun statusView(context: Context, status: CompressionStatus): RemoteViews =
    RemoteViews(context.packageName, R.layout.notification_compression).apply {
      setTextViewText(R.id.notification_title, status.title)
      setTextViewText(R.id.notification_percent, "${status.percent.coerceIn(0, 100)}%")
      setTextViewText(R.id.notification_remaining, status.remaining)
      setTextViewText(R.id.notification_elapsed, status.elapsed)
      setProgressBar(R.id.notification_progress, 100, status.percent.coerceIn(0, 100), false)
    }

  private fun launchIntent(context: Context): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    return PendingIntent.getActivity(
      context,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Video compression",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Progress while a video is being compressed"
      setShowBadge(false)
    }
    manager(context).createNotificationChannel(channel)
  }

  private fun manager(context: Context): NotificationManager =
    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
}
