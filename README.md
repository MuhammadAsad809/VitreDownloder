# Vitre Downloader (Android & Python CLI)

An advanced, modern video and audio downloader powered by **React Native 0.73.6**, **Tamagui**, **Liquid Glass**, **Python 3**, **yt-dlp**, and **FFmpeg**.

---

## Features

- **Multi-Platform Video Extraction**: Fast metadata analysis for YouTube, Instagram Reels, TikTok, and web video sources with no paid APIs, no tracking cookies, and no remote backend servers.
- **Selective Quality & Format Downloads**:
  - Full HD (1080p, 720p, 480p, 360p) with automatic stream merging via FFmpeg.
  - High-bitrate audio extraction and conversion to MP3 (128k, 192k, 320k).
  - Cover art and thumbnail image extraction.
- **Polished Glass & Tamagui UI**:
  - **Home**: Real-time URL analyzer, quality preset chips, and animated download progress.
  - **Downloads**: Persistent download history, instant search, category filtering (Videos, Audio, Images), and file actions (Open, Share, Copy Path, Delete).
  - **Settings**: Default quality preferences, storage directory inspector, dark emerald theme accents, and engine health diagnostics.
- **Standalone Termux & Linux CLI**: Fully functional Python package and command-line tool runnable directly inside Termux or desktop Linux.
- **Reliable Storage & File Safety**:
  - Organized folder structure: `/storage/emulated/0/Download/Vitre/Videos` and `.../Audio`.
  - Non-conflicting filename resolution (never accidentally overwrites existing files).
  - Full output verification (checks file existence and playable byte threshold).

---

## Android App (React Native + Chaquopy)

The mobile app runs yt-dlp on-device through Chaquopy (Embedded Python 3.11):
- **Native Bridge**: `PythonBridgeModule.kt` manages background coroutines and emits download progress events (`onDownloadProgress`).
- **Persistence**: `@react-native-async-storage/async-storage` retains completed downloads and user configuration across app restarts.
- **Glass Aesthetics**: Translucent surfaces, dark emerald palette, and ambient glowing backgrounds.

---

## Termux Installation Guide

To run the Python engine and CLI directly on your Android phone using Termux:

### 1. Update Packages & Set Up Storage
```bash
pkg update
termux-setup-storage
```
> [!NOTE]
> Tap **Allow** when the system prompt requests storage access. This links `/storage/emulated/0` to `~/storage/shared`.

### 2. Install Core Dependencies
```bash
pkg install python ffmpeg aria2 git
```

### 3. Install Python Dependencies
```bash
pip install -r requirements.txt
```

---

## Python CLI Usage & Examples

You can execute the Vitre CLI using `python3 -m vitre_downloader.cli`:

### 1. System Diagnostics
Check whether FFmpeg, FFprobe, and aria2c are detected, and inspect default storage paths:
```bash
python3 -m vitre_downloader.cli info
```

### 2. Analyze Media URL
Inspect video title, duration, uploader, thumbnail, and all available stream formats:
```bash
python3 -m vitre_downloader.cli analyze "https://www.youtube.com/watch?v=jNQXAC9IVRw"
```

### 3. Download Video (Quality Presets)
```bash
# Best available quality (merges video + audio)
python3 -m vitre_downloader.cli download "https://www.youtube.com/watch?v=jNQXAC9IVRw" --quality best

# 720p HD Video
python3 -m vitre_downloader.cli download "https://www.youtube.com/watch?v=jNQXAC9IVRw" -q 720

# Accelerated download with aria2c
python3 -m vitre_downloader.cli download "https://www.youtube.com/watch?v=jNQXAC9IVRw" --aria2
```

### 4. Extract Audio and Convert to MP3
```bash
# Convert to 192k MP3 (default)
python3 -m vitre_downloader.cli audio "https://www.youtube.com/watch?v=jNQXAC9IVRw"

# Convert to 320k High-Definition MP3
python3 -m vitre_downloader.cli audio "https://www.youtube.com/watch?v=jNQXAC9IVRw" -b 320k
```

---

## Running Unit Tests

Run the test suite covering URL cleaning, filename sanitization, collision handling, and tool detection:
```bash
python3 -m unittest tests/test_vitre.py
```

---

## Troubleshooting

- **FFmpeg not found**:
  Run `pkg install ffmpeg`. Stream merging and MP3 conversion require FFmpeg.
- **Permission Denied when saving to storage**:
  Run `termux-setup-storage` and ensure Termux has storage permission in Android App Info settings.
- **YouTube bot check / Sign in to confirm**:
  YouTube occasionally rate-limits IP addresses or Wi-Fi subnets. Switch between Wi-Fi and mobile data or retry after a few minutes.
