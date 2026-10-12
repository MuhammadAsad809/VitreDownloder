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
    """Strip tracking and session query parameters."""
    if not url:
        return ""
    clean = url.strip()
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
    return (
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    )


def _get_ydl_opts(url: str, for_download: bool = False, output_dir: str = "", progress_hook=None):
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
        opts["extractor_args"] = {
            "youtube": {
                "player_client": ["tv", "mweb", "android"],
            }
        }
        if for_download:
            # High quality 1080p/720p priority format selector
            opts["format"] = (
                "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/"
                "bestvideo[height<=1080]+bestaudio/"
                "best[height<=1080]/"
                "best"
            )
            opts["merge_output_format"] = "mp4"

    elif is_tiktok:
        opts["http_headers"]["User-Agent"] = "abc"
        if for_download:
            opts["format"] = "best"

    elif is_instagram:
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

    if for_download:
        if output_dir:
            opts["outtmpl"] = os.path.join(output_dir, "%(title).100s.%(ext)s")
        if progress_hook:
            opts["progress_hooks"] = [progress_hook]
    else:
        opts["skip_download"] = True
        opts["extract_flat"] = False

    return opts


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
                return json.dumps({
                    "success": True,
                    "id": getattr(info, "shortcode", "") or "",
                    "title": str(title)[:100],
                    "thumbnail": thumb,
                    "duration": 0,
                    "extractor": "instagram",
                    "formats": [{
                        "format_id": "best",
                        "ext": "mp4",
                        "resolution": "HD",
                        "filesize": 0,
                        "has_video": True,
                        "has_audio": True,
                        "quality_note": "Public Reel",
                    }],
                })
        except Exception:
            pass  # Fallback to yt-dlp below

    opts = _get_ydl_opts(clean_url, for_download=False)

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
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
        if is_instagram:
            return json.dumps({
                "success": False,
                "error": "Public content only / try another link",
            })
        if "sign in to confirm" in err.lower() or "not a bot" in err.lower():
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

    ydl_opts = _get_ydl_opts(
        clean_url,
        for_download=True,
        output_dir=output_directory,
        progress_hook=progress_hook,
    )

    # Allow custom format_id if selected and not default/best
    if format_id and format_id not in ("best", "unknown", ""):
        ydl_opts["format"] = f"{format_id}/best[ext=mp4]/best"

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_url, download=True)
            path = ydl.prepare_filename(info)
            # When yt-dlp merges to mp4, prepare_filename might have original ext
            if not os.path.exists(path):
                base, _ = os.path.splitext(path)
                if os.path.exists(base + ".mp4"):
                    path = base + ".mp4"
            return json.dumps({
                "success": True,
                "filePath": path,
                "title": info.get("title") or "",
            })
    except Exception as e:
        err = str(e)
        if is_instagram:
            err = "Public content only / try another link"
        return json.dumps({"success": False, "error": err})
