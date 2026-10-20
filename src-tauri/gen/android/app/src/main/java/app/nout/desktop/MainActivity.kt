package app.nout.desktop

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import androidx.activity.enableEdgeToEdge
import androidx.core.content.FileProvider
import java.io.File

class MainActivity : TauriActivity() {

  companion object {
    private var instance: MainActivity? = null

    @JvmStatic
    fun updateApp(apkUrl: String) {
      val activity = instance ?: return
      activity.runOnUiThread {
        activity.downloadAndInstall(apkUrl)
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    instance = this
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onDestroy() {
    if (instance == this) {
      instance = null
    }
    super.onDestroy()
  }

  private fun downloadAndInstall(apkUrl: String) {
    val fileName = "nout-update.apk"
    val destinationFile = File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), fileName)
    if (destinationFile.exists()) {
      destinationFile.delete()
    }

    val request = DownloadManager.Request(Uri.parse(apkUrl)).apply {
      setTitle("Nout Update")
      setDescription("Descargando actualización...")
      setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
      setDestinationUri(Uri.fromFile(destinationFile))
      setMimeType("application/vnd.android.package-archive")
    }

    val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    val downloadId = manager.enqueue(request)

    val onComplete = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
        if (id == downloadId) {
          try {
            unregisterReceiver(this)
          } catch (_: Exception) {}
          installApk(destinationFile)
        }
      }
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(onComplete, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), RECEIVER_EXPORTED)
    } else {
      registerReceiver(onComplete, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE))
    }
  }

  private fun installApk(file: File) {
    if (!file.exists()) return

    val apkUri = FileProvider.getUriForFile(
      this,
      "$packageName.fileprovider",
      file
    )

    val installIntent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(apkUri, "application/vnd.android.package-archive")
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    startActivity(installIntent)
  }
}
