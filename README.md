# Vitre Downloader (React Native + Chaquopy + yt-dlp)

A 100% on-device, serverless Android media downloader. It embeds Python 3.11 with `yt-dlp` directly inside the Android process via **Chaquopy**, allowing direct extraction and downloads from YouTube, Instagram, TikTok, and other platforms without relying on an external backend.

---

## Architecture

- **Frontend:** React Native (TypeScript) with a dark-mode theme, live clipboard paste, video card preview, format selector, and download progress bar.
- **Native Bridge:** Kotlin Native Module (`PythonBridgeModule.kt`) executing Python functions asynchronously on coroutine background threads (`Dispatchers.IO`).
- **Python Engine:** Embedded Python 3.11 running `yt-dlp` with `certifi` (`downloader.py`).
- **Storage:** Downloads save directly to the device's public `Downloads/Vitre/` directory.
- **CI / Build:** GitHub Actions workflow (`.github/workflows/build-apk.yml`) that compiles the APK in the cloud.

---

## How to Build the APK using GitHub Actions

You don't need Android Studio or Gradle installed on your phone. You can build the APK directly using GitHub:

1. **Create a GitHub Repository:**
   Create a new GitHub repository (public or private).

2. **Push this project to GitHub:**
   ```bash
   cd vitre-app
   git init
   git add .
   git commit -m "Initial commit of Vitre React Native + Chaquopy app"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
   git push -u origin main
   ```

3. **Download the APK:**
   - Go to your repository on GitHub.
   - Click the **Actions** tab.
   - Click the **Build Android APK (Chaquopy + yt-dlp)** workflow run.
   - Under **Artifacts** at the bottom of the run summary, download `vitre-app-debug-apk`.
   - Install the resulting `app-debug.apk` onto your Android phone.

---

## Project Structure

```
vitre-app/
├── .github/
│   └── workflows/
│       └── build-apk.yml            # CI workflow to build APK
├── android/
│   ├── app/
│   │   ├── build.gradle             # Chaquopy + Python 3.11 + yt-dlp setup
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml  # Permissions (Storage & Network)
│   │   │   ├── java/com/vitre/downloader/
│   │   │   │   ├── MainActivity.kt
│   │   │   │   ├── MainApplication.kt
│   │   │   │   ├── PythonBridgeModule.kt   # Bridge module
│   │   │   │   └── PythonBridgePackage.kt  # Package registry
│   │   │   └── python/
│   │   │       └── downloader.py           # yt-dlp extraction & download
│   │   └── proguard-rules.pro
│   ├── build.gradle                 # Chaquopy maven & plugin configuration
│   ├── gradle.properties
│   ├── gradlew
│   └── settings.gradle
├── src/
│   └── App.tsx                      # React Native UI
├── package.json
├── index.js
├── babel.config.js
├── metro.config.js
└── tsconfig.json
```
