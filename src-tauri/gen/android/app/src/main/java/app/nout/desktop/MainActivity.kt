package app.nout.desktop

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
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

    try {
      // 1. En Android 8.0+ (API 26+), validar si la app tiene permiso para instalar paquetes desconocidos
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        if (!packageManager.canRequestPackageInstalls()) {
          Log.i(TAG, "Permiso canRequestPackageInstalls no otorgado. Abriendo ajustes del sistema...")
          val settingsIntent = Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:$packageName")
          ).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          startActivity(settingsIntent)
          return
        }
      }

      // 2. Abrir el instalador oficial de paquetes de Android vía FileProvider
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
      Log.i(TAG, "Instalador del sistema iniciado con éxito")
    } catch (e: Exception) {
      Log.e(TAG, "Error al iniciar el instalador de Android: ${e.message}", e)
    }
  }
}
