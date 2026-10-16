"""
Media download orchestrator with yt-dlp Python API, progress hooks, and aria2 acceleration.
"""

import os
import json
import certifi
from typing import Optional, Callable, Dict, Any
import yt_dlp

from .detector import detect_environment
from .analyzer import _get_user_agent, MediaAnalyzer
from .processor import MediaProcessor
from .utils import (
    clean_url,
    sanitize_filename,
    get_non_conflicting_path,
    format_bytes,
    verify_output_file,
)
from .errors import classify_error, DownloadError

os.environ["SSL_CERT_FILE"] = certifi.where()


class MediaDownloader:
    """Manages downloading video, audio, and thumbnails with yt-dlp."""

    def __init__(
        self,
        output_dir: Optional[str] = None,
        use_aria2: bool = False,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        self.detector = detect_environment()
        self.base_output_dir = output_dir or self.detector.get_default_storage_dir()
        self.use_aria2 = use_aria2 and self.detector.has_aria2
        self.progress_callback = progress_callback
        self.processor = MediaProcessor(self.detector.ffmpeg_path)

    def _progress_hook(self, d: Dict[str, Any]):
        """Internal hook called by yt-dlp during download."""
        if not self.progress_callback:
            return

        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
            speed = d.get("speed") or 0
            percent = (downloaded / total * 100.0) if total > 0 else 0.0
            eta = d.get("eta") or 0

            self.progress_callback({
                "status": "downloading",
                "percent": round(percent, 2),
                "downloaded_bytes": downloaded,
                "total_bytes": total,
                "downloaded_human": format_bytes(downloaded),
                "total_human": format_bytes(total),
                "speed": speed,
                "speed_human": f"{format_bytes(speed)}/s" if speed else "0 B/s",
                "eta": eta,
                "filename": os.path.basename(d.get("filename") or ""),
            })
        elif status == "finished":
            self.progress_callback({
                "status": "finished",
                "percent": 100.0,
                "filename": os.path.basename(d.get("filename") or ""),
            })

    def download(
        self,
        url: str,
        quality: str = "best",
        audio_only: bool = False,
        audio_format: str = "mp3",
        audio_bitrate: str = "192k",
    ) -> Dict[str, Any]:
        """
        Download media with specified options.
        - quality: 'best', '1080', '720', '480', '360', or a raw format_id.
        - audio_only: True to extract and convert audio to MP3.
        - audio_bitrate: Bitrate for converted MP3 (e.g. '192k', '320k').
        """
        cleaned_url = MediaAnalyzer.validate_url(url)
        is_audio = audio_only or quality == "audio"

        # Determine target folder: separate Videos and Audio
        target_dir = self.detector.get_category_dir("audio" if is_audio else "video")
        os.makedirs(target_dir, exist_ok=True)

        # Preset quality strings
        presets = {
            "best": "bestvideo*+bestaudio/best",
            "1080": "bestvideo[height<=1080]+bestaudio/bestvideo+bestaudio/best",
            "720": "bestvideo[height<=720]+bestaudio/bestvideo+bestaudio/best",
            "480": "bestvideo[height<=480]+bestaudio/bestvideo+bestaudio/best",
            "360": "bestvideo[height<=360]+bestaudio/bestvideo+bestaudio/best",
            "audio": "bestaudio/best",
        }

        if is_audio:
            chosen_format = "bestaudio/best"
        elif quality in presets:
            chosen_format = presets[quality]
        elif quality and quality not in ("unknown", ""):
            chosen_format = f"{quality}/bestvideo*+bestaudio/best"
        else:
            chosen_format = "bestvideo*+bestaudio/best"

        # If FFmpeg is NOT installed, adjust format selection to prefer pre-merged single files
        if not self.detector.has_ffmpeg and not is_audio:
            chosen_format = "best[ext=mp4]/best"

        ydl_opts = {
            "quiet": True,
            "noplaylist": True,
            "cachedir": False,
            "format": chosen_format,
            "outtmpl": os.path.join(target_dir, "%(title).100s.%(ext)s"),
            "progress_hooks": [self._progress_hook],
            "extractor_args": {
                "youtube": {
                    "player_client": ["ios", "android", "mweb"],
                }
            },
            "http_headers": {
                "User-Agent": _get_user_agent(cleaned_url),
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "*/*",
            },
        }

        # Instagram headers
        if "instagram.com" in cleaned_url:
            ydl_opts["http_headers"].update({
                "X-IG-App-ID": "936619743392459",
                "X-ASBD-ID": "129477",
                "Origin": "https://www.instagram.com",
                "Referer": "https://www.instagram.com/",
            })

        # External aria2 accelerator if requested and installed
        if self.use_aria2:
            ydl_opts["external_downloader"] = self.detector.aria2c_path
            ydl_opts["external_downloader_args"] = ["-s", "8", "-x", "8", "-k", "1M"]

        # If FFmpeg is present, specify merge container
        if self.detector.has_ffmpeg:
            ydl_opts["ffmpeg_location"] = self.detector.ffmpeg_path
            if not is_audio:
                ydl_opts["merge_output_format"] = "mp4"

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(cleaned_url, download=True)
                if not info:
                    raise DownloadError("No media information retrieved.")

                raw_path = ydl.prepare_filename(info)
                # Resolve possible container change (e.g., .webm merged into .mp4)
                final_path = raw_path
                if not os.path.exists(final_path):
                    base, _ = os.path.splitext(final_path)
                    for candidate_ext in [".mp4", ".mkv", ".webm", ".m4a", ".mp3"]:
                        if os.path.exists(base + candidate_ext):
                            final_path = base + candidate_ext
                            break

                # Post-process audio to MP3 if requested and FFmpeg available
                if is_audio and audio_format == "mp3" and self.detector.has_ffmpeg:
                    if not final_path.lower().endswith(".mp3"):
                        final_path = self.processor.convert_to_mp3(
                            final_path,
                            bitrate=audio_bitrate,
                            keep_original=False
                        )

                # Verify final output file
                valid, err = verify_output_file(final_path)
                if not valid:
                    raise DownloadError(f"Downloaded file validation failed: {err}")

                file_size = os.path.getsize(final_path)
                title = info.get("title") or os.path.basename(final_path)

                return {
                    "success": True,
                    "file_path": final_path,
                    "title": title,
                    "file_size": file_size,
                    "file_size_human": format_bytes(file_size),
                    "duration": info.get("duration") or 0,
                    "format_id": quality,
                    "category": "audio" if is_audio else "video",
                    "thumbnail": info.get("thumbnail") or "",
                }
        except Exception as e:
            raise classify_error(e, cleaned_url)
