# Keep React Native classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.soloader.** { *; }

# Keep application classes
-keep class com.vitre.downloader.** { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep Python/Chaquopy related classes
-keep class com.chaquo.python.** { *; }

# Keep Google AdMob and Consent SDK classes
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.android.gms.internal.consent_sdk.** { *; }
-keep class com.google.ads.mediation.** { *; }

