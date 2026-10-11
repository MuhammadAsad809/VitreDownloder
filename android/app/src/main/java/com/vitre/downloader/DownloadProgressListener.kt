package com.vitre.downloader

interface DownloadProgressListener {
    fun onProgress(payloadJson: String)
}
