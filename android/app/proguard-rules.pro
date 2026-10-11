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
