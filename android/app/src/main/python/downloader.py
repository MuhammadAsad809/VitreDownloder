import json
import os
import time
import shutil
import urllib.request
import http.cookiejar
import certifi
import yt_dlp

os.environ["SSL_CERT_FILE"] = certifi.where()

# Optional parth_dl import for Instagram no-login fallback
try:
    import parth_dl
except ImportError:
    parth_dl = None


def _get_active_cookie_file(force_refresh: bool = False) -> str:
    """
    Returns path to an active cookie file (user-supplied cookies.txt or auto-generated guest session).
    """
    # 1. User-supplied cookies take precedence
    custom_candidates = [
        "/storage/emulated/0/Download/Vitre/cookies.txt",
        "/storage/emulated/0/Download/cookies.txt",
        "/storage/emulated/0/Documents/cookies.txt",
        os.path.join(os.environ.get("HOME", "/data/user/0/com.agy/files"), "cookies.txt"),
    ]
    if not force_refresh:
        for p in custom_candidates:
            if os.path.exists(p) and os.path.isfile(p) and os.path.getsize(p) > 50:
                return p

    # 2. Automated guest visitor session cookie cache
    cache_dir = os.path.join(os.environ.get("HOME", "/data/user/0/com.agy/files"), ".vitre")
    os.makedirs(cache_dir, exist_ok=True)
    guest_path = os.path.join(cache_dir, "yt_cookies.txt")

    needs_refresh = (
        force_refresh
        or not os.path.exists(guest_path)
        or os.path.getsize(guest_path) < 50
        or (time.time() - os.path.getmtime(guest_path)) > 86400
    )

    if needs_refresh:
        try:
            jar = http.cookiejar.MozillaCookieJar(guest_path)
            opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
            req = urllib.request.Request(
                "https://www.youtube.com",
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/123.0.0.0 Safari/537.36"
                    ),
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
            )
            with opener.open(req, timeout=10) as resp:
                jar.save(ignore_discard=True, ignore_expires=True)
        except Exception:
            pass

    if os.path.exists(guest_path) and os.path.getsize(guest_path) >= 50:
        return guest_path
    return ""


def _configure_anti_bot(ydl_opts: dict, force_refresh: bool = False):
    """Attach active cookie jar and JS challenge runtime to prevent bot checks."""
    cookie_path = _get_active_cookie_file(force_refresh=force_refresh)
    if cookie_path:
        ydl_opts["cookiefile"] = cookie_path

    node_bin = shutil.which("node") or "/data/user/0/com.agy/files/usr/bin/node"
    if node_bin and os.path.exists(node_bin):
        ydl_opts["js_runtimes"] = {"node": {}}
        ydl_opts["remote_components"] = {"ejs:github"}



def _clean_url(url: str) -> str:
    """Normalize and strip tracking / session query parameters."""
    if not url:
        return ""
    clean = url.strip()
    if not clean.startswith("http://") and not clean.startswith("https://"):
        clean = "https://" + clean
    if any(domain in clean for domain in ("instagram.com", "tiktok.com", "youtu.be")):
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
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
    )


def _classify_error(e: Exception, is_instagram: bool = False) -> str:
    err = str(e)
    lower = err.lower()
    if is_instagram:
        return "Public content only / try another link"
    if "ffmpeg is not installed" in lower or "requires ffmpeg" in lower:
        return "FFmpeg is required to merge video and audio streams at high resolution."
    if "sign in to confirm" in lower or "not a bot" in lower:
        return "YouTube bot check. Try mobile data instead of Wi-Fi, or try again later."
    if "the page needs to be reloaded" in lower:
        return "YouTube temporarily challenged this request. Please try again or switch to mobile data."
    if "webpage video data" in lower:
        return "TikTok blocked extraction. Try another video link."
    if "unsupported url" in lower:
        return "This URL format is not supported or recognized."
    if "no space left" in lower:
        return "Insufficient device storage space."
    return err[:180]


def _build_format_selector(format_id: str, is_audio: bool = False) -> str:
    """Construct dynamic format string (bv*+ba/b default, or height-limited)."""
    if is_audio or format_id == "audio":
        return "bestaudio/best"
    q = (format_id or "").lower().replace("p", "").strip()
    if q in ("1080", "720", "480", "360", "240", "144"):
        return f"bv*[height<={q}]+ba/b[height<={q}]"
    if q == "best" or not q:
        return "bv*+ba/b"
    return f"{format_id}+ba/{format_id}/bv*+ba/b"


def get_media_info(url: str) -> str:
    """Extract metadata without artificial 360p or player_client format locks."""
    clean_url = _clean_url(url)
    is_instagram = "instagram.com" in clean_url

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
                    "formats": [
                        {"format_id": "best", "ext": "mp4", "resolution": "Best Quality", "height": 1080, "filesize": 0, "has_video": True, "has_audio": True, "fps": 30, "quality_note": "Reel (HD)"},
                        {"format_id": "audio", "ext": "m4a", "resolution": "Audio Only", "height": 0, "filesize": 0, "has_video": False, "has_audio": True, "fps": 0, "quality_note": "Original Audio"},
                        {"format_id": "thumbnail", "ext": "jpg", "resolution": "Thumbnail Only", "height": 0, "filesize": 0, "has_video": False, "has_audio": False, "fps": 0, "quality_note": "Cover Image"},
                    ],
                })
        except Exception:
            pass

    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "noplaylist": True,
        "cachedir": False,
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

    _configure_anti_bot(ydl_opts)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            meta = ydl.extract_info(clean_url, download=False)
            if not meta:
                return json.dumps({"success": False, "error": "No media info found at this URL."})
    except Exception as e:
        err_str = str(e).lower()
        if any(k in err_str for k in ("bot", "429", "sign in", "page needs to be reloaded")):
            # Invalidate stale cookies, fetch a fresh visitor session and retry once
            _configure_anti_bot(ydl_opts, force_refresh=True)
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl_retry:
                    meta = ydl_retry.extract_info(clean_url, download=False)
            except Exception as e2:
                return json.dumps({"success": False, "error": _classify_error(e2, is_instagram)})
        else:
            return json.dumps({"success": False, "error": _classify_error(e, is_instagram)})

    try:
        formats = []
        for f in meta.get("formats") or []:
            ext = (f.get("ext") or "").lower()
            if ext in ("mhtml", "jpg", "png", "webp"):
                continue
            vcodec = f.get("vcodec") or "none"
            acodec = f.get("acodec") or "none"
            if vcodec == "none" and acodec == "none":
                continue
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

        unique_formats = {}
        for item in formats:
            key = item["format_id"]
            if key and (key not in unique_formats or item["filesize"] > unique_formats[key]["filesize"]):
                unique_formats[key] = item
        formats = list(unique_formats.values())
        formats.sort(key=lambda x: (x["has_video"], x["height"], x["has_audio"], x["filesize"]), reverse=True)

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
        return json.dumps({"success": False, "error": _classify_error(e, is_instagram)})


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
    is_audio = format_id == "audio"

    sub_folder = "Audio" if is_audio else ("Images" if format_id == "thumbnail" else "Videos")
    effective_dir = os.path.join(output_directory, sub_folder)
    os.makedirs(effective_dir, exist_ok=True)

    if format_id == "thumbnail":
        ydl_opts = {
            "quiet": True,
            "skip_download": True,
            "writethumbnail": True,
            "outtmpl": os.path.join(effective_dir, "%(title).100s.%(ext)s"),
            "http_headers": {
                "User-Agent": _ua_for(clean_url),
            },
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(clean_url, download=True)
                title = info.get("title") or "thumbnail"
                saved_thumb = None
                for fname in os.listdir(effective_dir):
                    if any(fname.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp")):
                        saved_thumb = os.path.join(effective_dir, fname)
                        break
                emit_progress(json.dumps({"status": "finished", "percent": 100.0}))
                return json.dumps({
                    "success": True,
                    "filePath": saved_thumb or effective_dir,
                    "title": f"{title} (Thumbnail)",
                    "category": "image",
                    "actualResolution": "Original Image",
                    "actualHeight": 0,
                })
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    if is_instagram and parth_dl:
        try:
            result = parth_dl.download(clean_url, output_path=effective_dir)
            if result:
                path = str(result)
                emit_progress(json.dumps({"status": "finished", "percent": 100.0}))
                return json.dumps({
                    "success": True,
                    "filePath": path,
                    "title": os.path.basename(path),
                    "category": "video",
                    "actualResolution": "1080p",
                    "actualHeight": 1080,
                })
        except Exception:
            pass

    # Dynamic format selection based on user-selected quality
    chosen = _build_format_selector(format_id, is_audio)

    # Detect if ffmpeg binary is available
    ffmpeg_bin = shutil.which("ffmpeg")

    # If separate video and audio streams are required but FFmpeg is missing, report clear error
    if "+" in chosen and not ffmpeg_bin:
        return json.dumps({
            "success": False,
            "error": "FFmpeg is required to merge separate video and audio streams. Please install FFmpeg to download at this quality."
        })

    ydl_opts = {
        "quiet": True,
        "noplaylist": True,
        "cachedir": False,
        "format": chosen,
        "format_sort": ["res", "ext:mp4:m4a"],
        "outtmpl": os.path.join(effective_dir, "%(title).100s.%(ext)s"),
        "progress_hooks": [progress_hook],
        "http_headers": {
            "User-Agent": _ua_for(clean_url),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "*/*",
        },
    }

    if ffmpeg_bin:
        ydl_opts["ffmpeg_location"] = ffmpeg_bin
        if not is_audio:
            ydl_opts["merge_output_format"] = "mp4"

    if is_instagram:
        ydl_opts["http_headers"].update({
            "X-IG-App-ID": "936619743392459",
            "X-ASBD-ID": "129477",
            "Origin": "https://www.instagram.com",
            "Referer": "https://www.instagram.com/",
        })

    _configure_anti_bot(ydl_opts)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_url, download=True)
    except Exception as e:
        err_str = str(e).lower()
        if any(k in err_str for k in ("bot", "429", "sign in", "page needs to be reloaded")):
            # Invalidate stale cookies, fetch a fresh visitor session and retry once
            _configure_anti_bot(ydl_opts, force_refresh=True)
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl_retry:
                    info = ydl_retry.extract_info(clean_url, download=True)
            except Exception as e2:
                return json.dumps({"success": False, "error": _classify_error(e2, is_instagram)})
        else:
            return json.dumps({"success": False, "error": _classify_error(e, is_instagram)})

    try:
        path = ydl.prepare_filename(info)
        if not os.path.exists(path):
            base, _ = os.path.splitext(path)
            candidates = [base + ext for ext in (".mp4", ".webm", ".mkv", ".m4a", ".opus", ".mp3")]
            path = next((candidate for candidate in candidates if os.path.exists(candidate)), "")
            if not path or not os.path.isfile(path) or os.path.getsize(path) <= 0:
                return json.dumps({"success": False, "error": "The downloader finished without creating a valid file."})

            file_size = os.path.getsize(path)

            # Determine actual downloaded resolution
            req_formats = info.get("requested_formats")
            if req_formats:
                vf = req_formats[0]
                actual_height = vf.get("height") or info.get("height") or 0
                actual_res = vf.get("resolution") or (f"{actual_height}p" if actual_height else "audio")
                chosen_format_id = "+".join(str(f.get("format_id")) for f in req_formats)
            else:
                actual_height = info.get("height") or 0
                actual_res = info.get("resolution") or (f"{actual_height}p" if actual_height else "audio")
                chosen_format_id = str(info.get("format_id") or format_id)

            return json.dumps({
                "success": True,
                "filePath": path,
                "title": info.get("title") or "",
                "thumbnail": info.get("thumbnail") or "",
                "duration": info.get("duration") or 0,
                "fileSize": file_size,
                "category": "audio" if is_audio else "video",
                "ext": os.path.splitext(path)[1].lstrip("."),
                "actualResolution": actual_res,
                "actualHeight": actual_height,
                "formatId": chosen_format_id,
            })
    except Exception as e:
        return json.dumps({"success": False, "error": _classify_error(e, is_instagram)})
