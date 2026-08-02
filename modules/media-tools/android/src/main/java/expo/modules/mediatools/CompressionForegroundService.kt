package expo.modules.mediatools

import android.app.Notification
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Keeps compression running when the app is backgrounded (§7), holding the progress notification
 * open for as long as the encode lasts.
 *
 * react-native-compressor ships no foreground service of its own — on Android it takes only a
 * partial wake lock, which does not survive the process being backgrounded for long — so the
 * unlimited-duration guarantee has to come from here.
 *
 * The service starts and stops the notification; it does not carry progress. Updates are posted
 * directly through [CompressionNotification], because a backgrounded app is not allowed to start a
 * foreground service and so cannot use an intent to say "now at 40%".
 */
class CompressionForegroundService : Service() {
  companion object {
    const val ACTION_START = "expo.modules.mediatools.START"
    const val ACTION_STOP = "expo.modules.mediatools.STOP"

    const val EXTRA_TITLE = "title"
    const val EXTRA_PROGRESS = "progress"
    const val EXTRA_ELAPSED = "elapsed"
    const val EXTRA_REMAINING = "remaining"

    /** Set while the service is live, so ending a job never has to start it again just to stop it. */
    @Volatile
    var running: CompressionForegroundService? = null
      private set
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    running = this
  }

  override fun onDestroy() {
    running = null
    super.onDestroy()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      // Every startForegroundService() delivery obliges a startForeground() call.
      ACTION_START -> startForegroundWith(CompressionNotification.build(this, statusOf(intent)))
      ACTION_STOP -> finish()
    }
    // The job is driven from JS; if the process dies the work is gone, so do not resurrect it.
    return START_NOT_STICKY
  }

  /** Ends the service and removes its notification. Safe to call whether or not it was started. */
  fun finish() {
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun statusOf(intent: Intent) = CompressionStatus(
    title = intent.getStringExtra(EXTRA_TITLE) ?: "Compressing video",
    percent = intent.getIntExtra(EXTRA_PROGRESS, 0),
    elapsed = intent.getStringExtra(EXTRA_ELAPSED) ?: "",
    remaining = intent.getStringExtra(EXTRA_REMAINING) ?: ""
  )

  private fun startForegroundWith(notification: Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
      startForeground(
        CompressionNotification.ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING
      )
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      // mediaProcessing does not exist before API 35; older platforms reject unknown type bits.
      startForeground(
        CompressionNotification.ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
      )
    } else {
      startForeground(CompressionNotification.ID, notification)
    }
  }
}
