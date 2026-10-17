"""
URL validation and media metadata extraction using yt-dlp Python API.
"""

import os
import certifi
from typing import Dict, Any, List, Optional
import yt_dlp

from .utils import clean_url, format_bytes, format_duration
from .errors import InvalidURLError, classify_error
from .cookies import configure_ydl_anti_bot_opts

os.environ["SSL_CERT_FILE"] = certifi.where()


def _get_user_agent(url: str) -> str:
    """Return an appropriate user agent to avoid bot challenges."""
    if any(x in url for x in ("tiktok.com", "vm.tiktok.com", "vt.tiktok.com")):
        return "abc"
    if "instagram.com" in url:
        return (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        )
    # Default to iOS mobile UA for YouTube to prevent desktop "Page reload" error
    return (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
    )


class MediaAnalyzer:
    """Analyzes and extracts rich media info without downloading files."""

    @staticmethod
    def validate_url(url: str) -> str:
        """Validate media URL and return normalized URL string."""
        if not url or not isinstance(url, str):
            raise InvalidURLError("URL must be a non-empty string.")
        cleaned = clean_url(url)
        if not cleaned.startswith("http://") and not cleaned.startswith("https://"):
            raise InvalidURLError(f"Invalid URL protocol: '{url}'")
        if "." not in cleaned.split("/")[2]:
            raise InvalidURLError(f"Invalid domain in URL: '{url}'")
        return cleaned

    def extract_info(self, url: str) -> Dict[str, Any]:
        """
        Extract complete metadata and format list for the given URL.
        Returns a structured dictionary.
        """
        cleaned_url = self.validate_url(url)
        is_instagram = "instagram.com" in cleaned_url

        ydl_opts = {
            "quiet": True,
            "skip_download": True,
            "noplaylist": True,
            "cachedir": False,
            "http_headers": {
                "User-Agent": _get_user_agent(cleaned_url),
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "*/*",
            },
        }

        if is_instagram:
            ydl_opts["http_headers"].update({
                "X-IG-App-ID": "936619743392459",
                "X-ASBD-ID": "129477",
                "Origin": "https://www.instagram.com",
                "Referer": "https://www.instagram.com/",
            })

        configure_ydl_anti_bot_opts(ydl_opts, cleaned_url)

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                raw_info = ydl.extract_info(cleaned_url, download=False)
                if not raw_info:
                    raise InvalidURLError("No metadata found for the provided URL.")

                return self._parse_metadata(raw_info, cleaned_url)
        except Exception as e:
            err_str = str(e).lower()
            if any(k in err_str for k in ("bot", "429", "sign in", "page needs to be reloaded", "format is not available")):
                # Invalidate stale cookies, fetch a fresh visitor session and retry once
                configure_ydl_anti_bot_opts(ydl_opts, cleaned_url, force_refresh_cookies=True)
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl_retry:
                        raw_info = ydl_retry.extract_info(cleaned_url, download=False)
                        if raw_info:
                            return self._parse_metadata(raw_info, cleaned_url)
                except Exception:
                    pass
            raise classify_error(e, cleaned_url)

    def _parse_metadata(self, meta: Dict[str, Any], url: str) -> Dict[str, Any]:
        """Normalize raw yt-dlp metadata into clean structured schema."""
        formats = meta.get("formats") or []
        parsed_formats: List[Dict[str, Any]] = []

        for f in formats:
            ext = (f.get("ext") or "").lower()
            if ext in ("mhtml", "jpg", "png", "webp"):
                continue

            vcodec = f.get("vcodec") or "none"
            acodec = f.get("acodec") or "none"
            if vcodec == "none" and acodec == "none":
                continue

            # Need valid stream URL or fragments
            if not f.get("url") and not f.get("fragments"):
                continue

            height = f.get("height") or 0
            width = f.get("width") or 0
            has_video = vcodec != "none"
            has_audio = acodec != "none"
            filesize = f.get("filesize") or f.get("filesize_approx") or 0

            res_label = f.get("resolution") or (f"{width}x{height}" if height else ("Audio" if has_audio else "unknown"))

            parsed_formats.append({
                "format_id": str(f.get("format_id")),
                "ext": ext or "mp4",
                "resolution": res_label,
                "height": height,
                "width": width,
                "filesize": filesize,
                "filesize_human": format_bytes(filesize),
                "has_video": has_video,
                "has_audio": has_audio,
                "vcodec": vcodec,
                "acodec": acodec,
                "fps": f.get("fps") or 0,
                "abr": f.get("abr") or 0,
                "tbr": f.get("tbr") or 0,
                "quality_note": f.get("format_note") or "",
            })

        # Sort formats: video with highest height first, then audio streams
        parsed_formats.sort(
            key=lambda x: (x["has_video"], x["height"], x["filesize"]),
            reverse=True
        )

        # Select highest resolution thumbnail
        thumbnails = meta.get("thumbnails") or []
        thumb_url = meta.get("thumbnail") or (thumbnails[-1].get("url") if thumbnails else "")

        duration = meta.get("duration") or 0

        return {
            "id": meta.get("id") or "",
            "title": meta.get("title") or "Untitled Media",
            "uploader": meta.get("uploader") or meta.get("channel") or meta.get("creator") or "Unknown",
            "duration": duration,
            "duration_human": format_duration(duration),
            "thumbnail": thumb_url,
            "extractor": meta.get("extractor") or "generic",
            "webpage_url": meta.get("webpage_url") or url,
            "formats": parsed_formats,
            "video_formats": [f for f in parsed_formats if f["has_video"] and f["height"] > 0],
            "audio_formats": [f for f in parsed_formats if f["has_audio"] and not f["has_video"]],
        }
