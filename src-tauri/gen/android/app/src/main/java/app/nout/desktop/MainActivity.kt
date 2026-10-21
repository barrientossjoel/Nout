package app.nout.desktop

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.enableEdgeToEdge
import androidx.core.content.FileProvider
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : TauriActivity() {

  companion object {
    private const val TAG = "NoutUpdater"
    private var instance: MainActivity? = null

    @JvmStatic
    fun updateApp(apkUrl: String) {
      val activity = instance ?: return
      activity.downloadAndInstall(apkUrl)
    }

    @JvmStatic
    fun openUrl(url: String) {
      val activity = instance ?: return
      activity.runOnUiThread {
        try {
          val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          activity.startActivity(intent)
        } catch (_: Exception) {}
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
    Thread {
      try {
        val cacheFile = File(cacheDir, "nout-update.apk")
        if (cacheFile.exists()) {
          cacheFile.delete()
        }

        var currentUrl = apkUrl
        var redirects = 0
        var connection: HttpURLConnection

        while (true) {
          val url = URL(currentUrl)
          connection = url.openConnection() as HttpURLConnection
          connection.instanceFollowRedirects = true
          connection.connectTimeout = 25000
          connection.readTimeout = 60000
          connection.setRequestProperty("User-Agent", "Nout-Android-Updater")

          val status = connection.responseCode
          if (status in 300..399 && redirects < 6) {
            val redirectLocation = connection.getHeaderField("Location") ?: break
            currentUrl = redirectLocation
            connection.disconnect()
            redirects++
          } else {
            break
          }
        }

        connection.inputStream.use { input ->
          cacheFile.outputStream().use { output ->
            input.copyTo(output)
          }
        }
        connection.disconnect()

        Log.i(TAG, "Update downloaded successfully (${cacheFile.length()} bytes)")
        runOnUiThread {
          installApk(cacheFile)
        }
      } catch (e: Exception) {
        Log.e(TAG, "Failed to download update: ${e.message}", e)
      }
    }.start()
  }

  private fun installApk(file: File) {
    if (!file.exists() || file.length() == 0L) {
      Log.e(TAG, "Cannot install empty or missing file")
      return
    }

    // Attempt PackageInstaller self-update (API 31+ allows non-interactive updates)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      try {
        val packageInstaller = packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
          setAppPackageName(packageName)
          setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        }

        val sessionId = packageInstaller.createSession(params)
        val session = packageInstaller.openSession(sessionId)

        file.inputStream().use { input ->
          session.openWrite("nout_update", 0, file.length()).use { output ->
            input.copyTo(output)
            session.fsync(output)
          }
        }

        val action = "$packageName.ACTION_INSTALL_COMMIT"
        val intent = Intent(action).setPackage(packageName)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        val pendingIntent = PendingIntent.getBroadcast(this, sessionId, intent, flags)

        val receiver = object : BroadcastReceiver() {
          override fun onReceive(context: Context, resIntent: Intent) {
            if (resIntent.action == action) {
              val status = resIntent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
              if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                val confirmIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                  resIntent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                } else {
                  @Suppress("DEPRECATION")
                  resIntent.getParcelableExtra(Intent.EXTRA_INTENT)
                }
                confirmIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                confirmIntent?.let { startActivity(it) }
              }
              try {
                unregisterReceiver(this)
              } catch (_: Exception) {}
            }
          }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          registerReceiver(receiver, IntentFilter(action), RECEIVER_EXPORTED)
        } else {
          registerReceiver(receiver, IntentFilter(action))
        }

        session.commit(pendingIntent.intentSender)
        session.close()
        return
      } catch (e: Exception) {
        Log.w(TAG, "PackageInstaller session failed, falling back to FileProvider intent: ${e.message}")
      }
    }

    // Standard fallback: Intent ACTION_VIEW via FileProvider
    try {
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
    } catch (e: Exception) {
      Log.e(TAG, "Fallback install intent failed: ${e.message}", e)
    }
  }
}

