package com.vitre.downloader

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "VitreDownloader"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        // fabricEnabled = false because newArchEnabled=false in gradle.properties
        DefaultReactActivityDelegate(this, mainComponentName, false)
}
