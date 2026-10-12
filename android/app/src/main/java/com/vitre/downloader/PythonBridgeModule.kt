package com.vitre.downloader

import android.os.Environment
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File

class PythonBridgeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val moduleScope = CoroutineScope(Dispatchers.IO)

    override fun getName(): String = "PythonBridgeModule"

    private fun ensurePythonInitialized(): Python {
        if (!Python.isStarted()) {
            Python.start(AndroidPlatform(reactContext))
        }
        return Python.getInstance()
    }

    private fun sendEvent(eventName: String, params: Any?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun fetchMediaInfo(url: String, promise: Promise) {
        moduleScope.launch {
            try {
                val py = ensurePythonInitialized()
                val downloaderModule = py.getModule("downloader")
                val responseJsonStr = downloaderModule.callAttr("get_media_info", url).toString()

                val json = JSONObject(responseJsonStr)
                if (json.getBoolean("success")) {
                    withContext(Dispatchers.Main) {
                        promise.resolve(responseJsonStr)
                    }
                } else {
                    withContext(Dispatchers.Main) {
                        promise.reject("FETCH_ERROR", json.optString("error", "Failed to retrieve info"))
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("INTERNAL_EXCEPTION", e.localizedMessage, e)
                }
            }
        }
    }

    @ReactMethod
    fun downloadMedia(url: String, formatId: String, promise: Promise) {
        moduleScope.launch {
            try {
                val py = ensurePythonInitialized()
                val downloaderModule = py.getModule("downloader")

                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val targetDir = File(downloadsDir, "Vitre").absolutePath

                val listener = object : DownloadProgressListener {
                    override fun onProgress(payloadJson: String) {
                        sendEvent("onDownloadProgress", payloadJson)
                    }
                }

                val responseJsonStr = downloaderModule.callAttr(
                    "download_media_file",
                    url,
                    formatId,
                    targetDir,
                    listener
                ).toString()

                val json = JSONObject(responseJsonStr)
                if (json.getBoolean("success")) {
                    withContext(Dispatchers.Main) {
                        promise.resolve(responseJsonStr)
                    }
                } else {
                    withContext(Dispatchers.Main) {
                        promise.reject("DOWNLOAD_ERROR", json.optString("error", "Download failed"))
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("INTERNAL_EXCEPTION", e.localizedMessage, e)
                }
            }
        }
    }

    @ReactMethod
    @Suppress("UNUSED_PARAMETER")
    fun addListener(eventName: String) {
        // Required for React Native NativeEventEmitter
    }

    @ReactMethod
    @Suppress("UNUSED_PARAMETER")
    fun removeListeners(count: Int) {
        // Required for React Native NativeEventEmitter
    }
}
