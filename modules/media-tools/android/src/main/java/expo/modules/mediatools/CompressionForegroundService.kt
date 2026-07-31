package expo.modules.mediatools

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Keeps compression running when the app is backgrounded (§7), with a live progress notification.
 *
 * react-native-compressor ships no foreground service of its own — on Android it takes only a
 * partial wake lock, which does not survive the process being backgrounded for long — so the
 * unlimited-duration guarantee has to come from here.
 */
class CompressionForegroundService : Service() {
  companion object {
    const val ACTION_START = "expo.modules.mediatools.START"
    const val ACTION_UPDATE = "expo.modules.mediatools.UPDATE"
    const val ACTION_STOP = "expo.modules.mediatools.STOP"

    const val EXTRA_TITLE = "title"
    const val EXTRA_TEXT = "text"
    const val EXTRA_PROGRESS = "progress"

    private const val CHANNEL_ID = "compresshd.compression"
    private const val NOTIFICATION_ID = 4711
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> startForegroundWith(buildNotification(intent))
      ACTION_UPDATE -> notificationManager().notify(NOTIFICATION_ID, buildNotification(intent))
      ACTION_STOP -> {
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
      }
    }
    // The job is driven from JS; if the process dies the work is gone, so do not resurrect it.
    return START_NOT_STICKY
  }

  private fun startForegroundWith(notification: Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING
      )
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun buildNotification(intent: Intent): Notification {
    ensureChannel()

    val progress = intent.getIntExtra(EXTRA_PROGRESS, 0)
    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(intent.getStringExtra(EXTRA_TITLE) ?: "Compressing video")
      .setContentText(intent.getStringExtra(EXTRA_TEXT) ?: "")
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setProgress(100, progress.coerceIn(0, 100), false)

    // §7: tapping the notification reopens the app, which is still in the Compressing state.
    launchIntent()?.let { builder.setContentIntent(it) }

    return builder.build()
  }

  private fun launchIntent(): PendingIntent? {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    return PendingIntent.getActivity(
      this,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Video compression",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Progress while a video is being compressed"
      setShowBadge(false)
    }
    notificationManager().createNotificationChannel(channel)
  }

  private fun notificationManager(): NotificationManager =
    getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
}
