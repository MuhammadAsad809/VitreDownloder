import json
import os
import certifi
import yt_dlp

os.environ["SSL_CERT_FILE"] = certifi.where()

# Optional parth_dl import for Instagram no-login fallback
try:
    import parth_dl
except ImportError:
    parth_dl = None


def _clean_url(url: str) -> str:
    """Normalize and strip tracking / session query parameters."""
    if not url:
        return ""
    clean = url.strip()
    # Prepend https:// if user pasted without protocol (e.g. youtu.be/...)
    if not clean.startswith("http://") and not clean.startswith("https://"):
        clean = "https://" + clean
    # Strip tracking parameters for short links
    if "instagram.com" in clean or "tiktok.com" in clean or "youtu.be" in clean:
        clean = clean.split("?")[0]
    return clean


def _ua_for(url: str) -> str:
    if any(x in url for x in ("tiktok.com", "vm.tiktok.com", "vt.tiktok.com")):
        return "abc"
    if "instagram.com" in url:
        return (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        )
    # Use iOS mobile User-Agent for YouTube to avoid desktop web "The page needs to be reloaded" challenge
    return (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
    )


def get_media_info(url: str) -> str:
    """Extract metadata only (no format lock on info extract)."""
    clean_url = _clean_url(url)
    is_instagram = "instagram.com" in clean_url

    # Check parth-dl for Instagram first if available
    if is_instagram and parth_dl:
        try:
            info = parth_dl.get_info(clean_url)
            if info:
                title = getattr(info, "caption", "") or getattr(info, "shortcode", "") or "Instagram Reel"
                thumb = getattr(info, "thumbnail_url", "") or ""
                # parth-dl is useful for Instagram downloads, but its info object does
                # not reliably expose streams. Never invent formats here; let yt-dlp
                # provide the real stream list below when possible.
                if thumb and not isinstance(thumb, str):
                    thumb = str(thumb)
                if thumb:
                    return json.dumps({
                        "success": True,
                        "id": getattr(info, "shortcode", "") or "",
                        "title": str(title)[:100],
                        "thumbnail": thumb,
                        "duration": 0,
                        "extractor": "instagram",
                        "formats": [],
                    })
        except Exception:
            pass  # Fallback to yt-dlp below

    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "noplaylist": True,
        "cachedir": False,
        "extractor_args": {
            "youtube": {
                # Use mobile and app clients (ios, android, mweb) which do NOT hit "The page needs to be reloaded"
                "player_client": ["ios", "android", "mweb"],
            }
        },
        "http_headers": {
            "User-Agent": _ua_for(clean_url),
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

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            meta = ydl.extract_info(clean_url, download=False)
            if not meta:
                return json.dumps({"success": False, "error": "No media info found at this URL."})

            formats = []
            for f in meta.get("formats") or []:
                ext = (f.get("ext") or "").lower()
                # Skip storyboards / images / mhtml / subtitle only
                if ext in ("mhtml", "jpg", "png", "webp"):
                    continue
                vcodec = f.get("vcodec") or "none"
                acodec = f.get("acodec") or "none"
                if vcodec == "none" and acodec == "none":
                    continue
                # Need url or fragments to be a downloadable stream
                if not f.get("url") and not f.get("fragments"):
                    continue

                height = f.get("height") or 0
                width = f.get("width") or 0
                has_video = vcodec != "none"
                has_audio = acodec != "none"
                res_label = f.get("resolution") or (f"{width}x{height}" if height else ("Audio" if has_audio else "unknown"))

                formats.append({
                    "format_id": str(f.get("format_id")),
                    "ext": ext or "mp4",
                    "resolution": res_label,
                    "height": height,
                    "filesize": f.get("filesize") or f.get("filesize_approx") or 0,
                    "has_video": has_video,
                    "has_audio": has_audio,
                    "fps": f.get("fps") or 0,
                    "quality_note": f.get("format_note") or "",
                })

            # Keep every usable real format, but remove duplicate format IDs and
            # image/storyboard entries. Adaptive streams remain selectable by ID.
            unique_formats = {}
            for item in formats:
                key = item["format_id"]
                if key and (key not in unique_formats or item["filesize"] > unique_formats[key]["filesize"]):
                    unique_formats[key] = item
            formats = list(unique_formats.values())
            formats.sort(key=lambda x: (x["has_video"], x["height"], x["has_audio"], x["filesize"]), reverse=True)

            # Prefer a valid HTTPS thumbnail, then choose the largest available
            # candidate. Some Instagram responses contain empty or expiring values.
            thumbnails = meta.get("thumbnails") or []
            valid_thumbnails = [t.get("url") for t in thumbnails if isinstance(t, dict) and str(t.get("url", "")).startswith(("http://", "https://"))]
            thumb_url = meta.get("thumbnail") if str(meta.get("thumbnail", "")).startswith(("http://", "https://")) else (valid_thumbnails[-1] if valid_thumbnails else "")

            return json.dumps({
                "success": True,
                "id": meta.get("id") or "",
                "title": meta.get("title") or "Untitled Media",
                "thumbnail": thumb_url or "",
                "duration": meta.get("duration") or 0,
                "extractor": meta.get("extractor") or "",
                "formats": formats,
            })
    except Exception as e:
        err = str(e)
        if is_instagram:
            return json.dumps({
                "success": False,
                "error": "Public content only / try another link",
            })
        if "the page needs to be reloaded" in err.lower():
            err = "YouTube temporarily challenged this request. Please try again or switch between mobile data/Wi-Fi."
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

    clean_url = _clean_url(url)
    is_instagram = "instagram.com" in clean_url
    os.makedirs(output_directory, exist_ok=True)

    # THUMBNAIL ONLY mode
    if format_id == "thumbnail":
        ydl_opts = {
            "quiet": True,
            "skip_download": True,
            "writethumbnail": True,
            "outtmpl": os.path.join(output_directory, "%(title).100s.%(ext)s"),
            "http_headers": {
                "User-Agent": _ua_for(clean_url),
            },
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(clean_url, download=True)
                title = info.get("title") or "thumbnail"
                saved_thumb = None
                for fname in os.listdir(output_directory):
                    if any(fname.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp")):
                        saved_thumb = os.path.join(output_directory, fname)
                        break
                emit_progress(json.dumps({"status": "finished", "percent": 100.0}))
                return json.dumps({
                    "success": True,
                    "filePath": saved_thumb or output_directory,
                    "title": f"{title} (Thumbnail)",
                })
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    # Try parth-dl for Instagram download if available
    if is_instagram and parth_dl:
        try:
            result = parth_dl.download(clean_url, output_path=output_directory)
            if result:
                path = str(result)
                emit_progress(json.dumps({"status": "finished", "percent": 100.0}))
                return json.dumps({
                    "success": True,
                    "filePath": path,
                    "title": os.path.basename(path),
                })
        except Exception:
            pass  # Fallback to yt-dlp

    # Quality presets from UI
    presets = {
        "best": "bestvideo*+bestaudio/best",
        "1080": "bestvideo[height<=1080]+bestaudio/bestvideo+bestaudio/best",
        "720": "bestvideo[height<=720]+bestaudio/bestvideo+bestaudio/best",
        "480": "bestvideo[height<=480]+bestaudio/bestvideo+bestaudio/best",
        "360": "bestvideo[height<=360]+bestaudio/bestvideo+bestaudio/best",
        "audio": "bestaudio/best",
    }

    if format_id in presets:
        chosen = presets[format_id]
    elif format_id and format_id not in ("unknown", ""):
        chosen = f"{format_id}/bestvideo*+bestaudio/best"
    else:
        chosen = "bestvideo*+bestaudio/best"

    ydl_opts = {
        "quiet": True,
        "noplaylist": True,
        "cachedir": False,
        "format": chosen,
        "outtmpl": os.path.join(output_directory, "%(title).100s.%(ext)s"),
        "merge_output_format": "mp4",
        "writethumbnail": True,
        "writesubtitles": False,
        "progress_hooks": [progress_hook],
        "extractor_args": {
            "youtube": {
                "player_client": ["ios", "android", "mweb"],
            }
        },
        "http_headers": {
            "User-Agent": _ua_for(clean_url),
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

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_url, download=True)
            path = ydl.prepare_filename(info)
            if not os.path.exists(path):
                base, _ = os.path.splitext(path)
                candidates = [base + ext for ext in (".mp4", ".webm", ".mkv", ".m4a", ".opus")]
                path = next((candidate for candidate in candidates if os.path.exists(candidate)), "")
            if not path or not os.path.isfile(path) or os.path.getsize(path) <= 0:
                return json.dumps({"success": False, "error": "The downloader finished without creating a valid file."})
            return json.dumps({
                "success": True,
                "filePath": path,
                "title": info.get("title") or "",
                "thumbnail": info.get("thumbnail") or "",
                "ext": os.path.splitext(path)[1].lstrip("."),
                "filesize": os.path.getsize(path),
                "resolution": info.get("resolution") or "",
            })
    except Exception as e:
        err = str(e)
        if is_instagram:
            err = "Public content only / try another link"
        elif "the page needs to be reloaded" in err.lower():
            err = "YouTube temporarily challenged this request. Please try again or switch between mobile data/Wi-Fi."
        return json.dumps({"success": False, "error": err})
