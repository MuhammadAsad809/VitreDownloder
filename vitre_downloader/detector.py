"""
Environment, platform, and dependency detection (FFmpeg, FFprobe, aria2c, Termux).
"""

import os
import shutil
import subprocess
import platform
from typing import Dict, Any, Optional


class ToolDetector:
    """Detects installed system binaries and platform paths."""

    def __init__(self):
        self._ffmpeg_path = shutil.which("ffmpeg")
        self._ffprobe_path = shutil.which("ffprobe")
        self._aria2c_path = shutil.which("aria2c")

    @property
    def has_ffmpeg(self) -> bool:
        return self._ffmpeg_path is not None

    @property
    def has_ffprobe(self) -> bool:
        return self._ffprobe_path is not None

    @property
    def has_aria2(self) -> bool:
        return self._aria2c_path is not None

    @property
    def ffmpeg_path(self) -> Optional[str]:
        return self._ffmpeg_path

    @property
    def ffprobe_path(self) -> Optional[str]:
        return self._ffprobe_path

    @property
    def aria2c_path(self) -> Optional[str]:
        return self._aria2c_path

    def get_tool_version(self, tool_name: str) -> Optional[str]:
        """Retrieve version banner for a given tool (ffmpeg, ffprobe, aria2c)."""
        bin_path = shutil.which(tool_name)
        if not bin_path:
            return None
        try:
            res = subprocess.run(
                [bin_path, "-version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=3,
            )
            first_line = (res.stdout or res.stderr).splitlines()[0]
            return first_line.strip()
        except Exception:
            return "Installed (version unknown)"

    def is_android_termux(self) -> bool:
        """Check if running inside Android Termux / AGY environment."""
        if os.path.exists("/data/data/com.termux/files") or os.path.exists("/data/user/0/com.agy/files"):
            return True
        if "ANDROID_ROOT" in os.environ or "TERMUX_VERSION" in os.environ:
            return True
        return False

    def get_default_storage_dir(self) -> str:
        """Return the best storage directory based on current OS and permissions."""
        # 1. Android public Download directory
        android_download = "/storage/emulated/0/Download/Vitre"
        if os.path.exists("/storage/emulated/0/Download"):
            try:
                os.makedirs(android_download, exist_ok=True)
                test_file = os.path.join(android_download, ".test_write")
                with open(test_file, "w") as f:
                    f.write("ok")
                os.remove(test_file)
                return android_download
            except OSError:
                pass

        # 2. Termux ~/storage/downloads symlink
        termux_storage = os.path.expanduser("~/storage/downloads/Vitre")
        if os.path.exists(os.path.expanduser("~/storage/downloads")):
            try:
                os.makedirs(termux_storage, exist_ok=True)
                return termux_storage
            except OSError:
                pass

        # 3. Standard user home Downloads or Vitre folder
        home_downloads = os.path.expanduser("~/Downloads/Vitre")
        try:
            os.makedirs(home_downloads, exist_ok=True)
            return home_downloads
        except OSError:
            pass

        fallback = os.path.expanduser("~/Vitre")
        os.makedirs(fallback, exist_ok=True)
        return fallback

    def get_category_dir(self, category: str = "video") -> str:
        """Return directory separated by media type (video vs audio)."""
        base = self.get_default_storage_dir()
        sub = "Audio" if category.lower() == "audio" else "Videos"
        path = os.path.join(base, sub)
        os.makedirs(path, exist_ok=True)
        return path

    def diagnose(self) -> Dict[str, Any]:
        """Return a structured diagnostic summary."""
        return {
            "platform": platform.platform(),
            "is_android": self.is_android_termux(),
            "default_storage": self.get_default_storage_dir(),
            "tools": {
                "ffmpeg": {
                    "installed": self.has_ffmpeg,
                    "path": self._ffmpeg_path,
                    "version": self.get_tool_version("ffmpeg"),
                },
                "ffprobe": {
                    "installed": self.has_ffprobe,
                    "path": self._ffprobe_path,
                    "version": self.get_tool_version("ffprobe"),
                },
                "aria2c": {
                    "installed": self.has_aria2,
                    "path": self._aria2c_path,
                    "version": self.get_tool_version("aria2c"),
                },
            },
        }


def detect_environment() -> ToolDetector:
    """Helper factory returning initialized ToolDetector."""
    return ToolDetector()
