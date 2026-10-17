"""
Media download orchestrator with yt-dlp Python API, dynamic format selection,
FFmpeg stream merging, and aria2 acceleration.
"""

import os
import json
import logging
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
from .errors import classify_error, DownloadError, ToolNotFoundError

os.environ["SSL_CERT_FILE"] = certifi.where()

logger = logging.getLogger("vitre.downloader")


def build_format_selector(quality: str, is_audio: bool = False) -> str:
    """
    Constructs dynamic yt-dlp format selector.
    Default: 'bv*+ba/b'
    Quality level (144p, 240p, 360p, 480p, 720p, 1080p): 'bv*[height<=H]+ba/b[height<=H]'
    """
    if is_audio or quality == "audio":
        return "bestaudio/best"

    q_clean = quality.lower().replace("p", "").strip() if quality else ""

    if q_clean in ("1080", "720", "480", "360", "240", "144"):
        return f"bv*[height<={q_clean}]+ba/b[height<={q_clean}]"

    if q_clean == "best" or not q_clean:
        return "bv*+ba/b"

    # Specific format ID requested
    return f"{quality}+ba/{quality}/bv*+ba/b"


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
        Download media with dynamic quality selection and FFmpeg merging.
        - quality: 'best', '1080', '720', '480', '360', '240', '144', or raw format_id.
        - audio_only: True to extract audio and convert to MP3.
        """
        cleaned_url = MediaAnalyzer.validate_url(url)
        is_audio = audio_only or quality == "audio"

        target_dir = self.detector.get_category_dir("audio" if is_audio else "video")
        os.makedirs(target_dir, exist_ok=True)

        chosen_format = build_format_selector(quality, is_audio)

        # Requirement 7: Report clear error if merging is required but FFmpeg is missing.
        # Do not silently fall back to 360p.
        requires_merging = "+" in chosen_format
        if requires_merging and not self.detector.has_ffmpeg:
            raise ToolNotFoundError(
                "FFmpeg is missing: Merging separate video and audio streams at requested quality "
                f"('{quality}') requires FFmpeg. Please install FFmpeg (e.g. 'pkg install ffmpeg') "
                "or choose an available single-stream format."
            )

        ydl_opts = {
            "quiet": True,
            "noplaylist": True,
            "cachedir": False,
            "format": chosen_format,
            "format_sort": ["res", "ext:mp4:m4a"],
            "outtmpl": os.path.join(target_dir, "%(title).100s.%(ext)s"),
            "progress_hooks": [self._progress_hook],
            "http_headers": {
                "User-Agent": _get_user_agent(cleaned_url),
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "*/*",
            },
        }

        if "instagram.com" in cleaned_url:
            ydl_opts["http_headers"].update({
                "X-IG-App-ID": "936619743392459",
                "X-ASBD-ID": "129477",
                "Origin": "https://www.instagram.com",
                "Referer": "https://www.instagram.com/",
            })

        if self.use_aria2:
            ydl_opts["external_downloader"] = self.detector.aria2c_path
            ydl_opts["external_downloader_args"] = ["-s", "8", "-x", "8", "-k", "1M"]

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
                final_path = raw_path
                if not os.path.exists(final_path):
                    base, _ = os.path.splitext(final_path)
                    for candidate_ext in [".mp4", ".mkv", ".webm", ".m4a", ".mp3"]:
                        if os.path.exists(base + candidate_ext):
                            final_path = base + candidate_ext
                            break

                # Post-process audio to MP3 if requested and FFmpeg is available
                if is_audio and audio_format == "mp3" and self.detector.has_ffmpeg:
                    if not final_path.lower().endswith(".mp3"):
                        final_path = self.processor.convert_to_mp3(
                            final_path,
                            bitrate=audio_bitrate,
                            keep_original=False
                        )

                valid, err = verify_output_file(final_path)
                if not valid:
                    raise DownloadError(f"Downloaded file validation failed: {err}")

                file_size = os.path.getsize(final_path)
                title = info.get("title") or os.path.basename(final_path)

                # Determine actual downloaded resolution
                req_formats = info.get("requested_formats")
                if req_formats:
                    vf = req_formats[0]
                    actual_height = vf.get("height") or info.get("height") or 0
                    actual_res = vf.get("resolution") or (f"{actual_height}p" if actual_height else "audio")
                    selected_id = "+".join(str(f.get("format_id")) for f in req_formats)
                else:
                    actual_height = info.get("height") or 0
                    actual_res = info.get("resolution") or (f"{actual_height}p" if actual_height else "audio")
                    selected_id = str(info.get("format_id") or quality)

                print(f"[Vitre] Downloaded format: {selected_id} | Actual resolution: {actual_res} ({actual_height}p)")

                return {
                    "success": True,
                    "file_path": final_path,
                    "title": title,
                    "file_size": file_size,
                    "file_size_human": format_bytes(file_size),
                    "duration": info.get("duration") or 0,
                    "format_id": selected_id,
                    "requested_quality": quality,
                    "actual_resolution": actual_res,
                    "actual_height": actual_height,
                    "category": "audio" if is_audio else "video",
                    "thumbnail": info.get("thumbnail") or "",
                }
        except Exception as e:
            raise classify_error(e, cleaned_url)
