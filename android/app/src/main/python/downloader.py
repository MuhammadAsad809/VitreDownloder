import json
import os
import random
import certifi
import yt_dlp

os.environ["SSL_CERT_FILE"] = certifi.where()

def _ua_for(url: str) -> str:
    if any(x in url for x in ("tiktok.com", "vm.tiktok.com", "vt.tiktok.com")):
        # Short / fake UA often bypasses TikTok challenge
        return "abc"
    if "instagram.com" in url:
        return "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    # YouTube / others
    return "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"


def _opts(url: str, for_download: bool = False):
    is_youtube = "youtube.com" in url or "youtu.be" in url
    is_tiktok = any(x in url for x in ("tiktok.com", "vm.tiktok.com", "vt.tiktok.com"))
    is_instagram = "instagram.com" in url

    opts = {
        "quiet": True,
        "no_warnings": True,
        "cachedir": False,
        "noplaylist": True,
        "retries": 5,
        "fragment_retries": 5,
        "socket_timeout": 30,
        "http_headers": {
            "User-Agent": _ua_for(url),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "*/*",
        },
    }

    if is_youtube:
        # Try multiple clients – one of them usually works
        opts["extractor_args"] = {
            "youtube": {
                "player_client": ["android", "ios", "tv", "mweb"],
            }
        }
        if for_download:
            # Very flexible format string with many fallbacks
            opts["format"] = "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio/best/bestvideo+bestaudio"
            opts["merge_output_format"] = "mp4"
        # IMPORTANT: for info extraction do NOT set format at all

    elif is_tiktok:
        opts["http_headers"]["User-Agent"] = "abc"
        if for_download:
            opts["format"] = "best"

    elif is_instagram:
        # Instagram almost always needs login for reliable access.
        # These options help a bit for public content.
        opts["http_headers"].update({
            "X-IG-App-ID": "936619743392459",
            "X-ASBD-ID": "129477",
            "Origin": "https://www.instagram.com",
            "Referer": "https://www.instagram.com/",
        })
        if for_download:
            opts["format"] = "best"

    else:
        if for_download:
            opts["format"] = "best[ext=mp4]/best"

    return opts


def get_media_info(url: str) -> str:
    """Metadata only – never request a specific format."""
    # Clean tracking params that sometimes break extractors
    clean_url = url.split("?")[0] if "tiktok.com" in url or "instagram.com" in url else url

    ydl_opts = {
        **_opts(clean_url, for_download=False),
        "skip_download": True,
        "extract_flat": False,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            meta = ydl.extract_info(clean_url, download=False)
            if not meta:
                return json.dumps({"success": False, "error": "Unable to extract info from this URL."})

            formats_list = []
            for f in meta.get("formats") or []:
                if not f.get("url") and not f.get("fragments"):
                    continue
                vcodec = f.get("vcodec") or "none"
                acodec = f.get("acodec") or "none"
                height = f.get("height") or 0
                width = f.get("width") or 0
                resolution = f.get("resolution") or (f"{width}x{height}" if height else "audio")

                formats_list.append({
                    "format_id": str(f.get("format_id") or "unknown"),
                    "ext": f.get("ext") or "mp4",
                    "resolution": resolution,
                    "filesize": f.get("filesize") or f.get("filesize_approx") or 0,
                    "has_video": vcodec != "none",
                    "has_audio": acodec != "none",
                    "quality_note": f.get("format_note") or f.get("format") or "",
                })

            formats_list.sort(
                key=lambda x: (x["has_video"] and x["has_audio"], x.get("filesize") or 0),
                reverse=True,
            )

            return json.dumps({
                "success": True,
                "id": meta.get("id") or "",
                "title": meta.get("title") or "Untitled Media",
                "thumbnail": meta.get("thumbnail") or "",
                "duration": meta.get("duration") or 0,
                "extractor": meta.get("extractor") or "",
                "formats": formats_list,
            })
    except Exception as e:
        err = str(e)
        # Friendlier messages
        if "login required" in err.lower() or "rate-limit" in err.lower():
            err = "Login/cookies required for this Instagram content. Public posts sometimes work; private/rate-limited ones need account cookies."
        elif "sign in to confirm" in err.lower() or "not a bot" in err.lower():
            err = "YouTube bot check. Try mobile data instead of Wi-Fi, or try again later."
        elif "webpage video data" in err.lower():
            err = "TikTok blocked extraction. Try another video or update yt-dlp."
        return json.dumps({"success": False, "error": err})


def download_media_file(url: str, format_id: str, output_directory: str, progress_callback=None) -> str:
    def emit_progress(payload: str):
        if not progress_callback:
            return
        try:
            if hasattr(progress_callback, "onProgress"):
                progress_callback.onProgress(payload)
            elif callable(progress_callback):
                progress_callback(payload)
        except Exception:
            pass

    def progress_hook(d):
        if not progress_callback:
            return
        if d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
            speed = d.get("speed") or 0
            percent = (downloaded / total * 100.0) if total > 0 else 0.0
            emit_progress(json.dumps({
                "status": "downloading",
                "downloaded": downloaded,
                "total": total,
                "percent": round(percent, 2),
                "speed": speed or 0,
                "eta": d.get("eta") or 0,
            }))
        elif d.get("status") == "finished":
            emit_progress(json.dumps({"status": "finished", "percent": 100.0}))

    clean_url = url.split("?")[0] if "tiktok.com" in url or "instagram.com" in url else url

    if format_id and format_id not in ("best", "unknown", ""):
        chosen = f"{format_id}/best[ext=mp4]/best"
    else:
        chosen = "best[ext=mp4]/bestvideo+bestaudio/best"

    ydl_opts = {
        **_opts(clean_url, for_download=True),
        "format": chosen,
        "outtmpl": os.path.join(output_directory, "%(title).100s.%(ext)s"),
        "progress_hooks": [progress_hook],
        "merge_output_format": "mp4",
    }

    try:
        os.makedirs(output_directory, exist_ok=True)
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_url, download=True)
            path = ydl.prepare_filename(info)
            return json.dumps({
                "success": True,
                "filePath": path,
                "title": info.get("title") or "",
            })
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})
