import json
import os
import sys
import certifi
import yt_dlp

# Enforce bundled CA bundle inside Android sandbox
os.environ["SSL_CERT_FILE"] = certifi.where()

def get_media_info(url: str) -> str:
    """
    Extracts video metadata without downloading.
    Returns a serialized JSON string.
    """
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'skip_download': True,
        'ignoreerrors': False,
        'noplaylist': True,
        'cachedir': False,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            meta = ydl.extract_info(url, download=False)
            if not meta:
                return json.dumps({"success": False, "error": "Unable to extract info from this URL."})

            formats_list = []
            for f in meta.get("formats", []):
                url_format = f.get("url")
                if not url_format:
                    continue

                vcodec = f.get("vcodec", "none")
                acodec = f.get("acodec", "none")
                has_video = vcodec != "none" and vcodec is not None
                has_audio = acodec != "none" and acodec is not None

                formats_list.append({
                    "format_id": f.get("format_id", "unknown"),
                    "ext": f.get("ext", "mp4"),
                    "resolution": f.get("resolution") or f"{f.get('width', 0)}x{f.get('height', 0)}",
                    "filesize": f.get("filesize") or f.get("filesize_approx") or 0,
                    "has_video": has_video,
                    "has_audio": has_audio,
                    "quality_note": f.get("format_note", "") or f.get("format", "")
                })

            result = {
                "success": True,
                "id": meta.get("id", ""),
                "title": meta.get("title", "Untitled Media"),
                "thumbnail": meta.get("thumbnail", ""),
                "duration": meta.get("duration", 0),
                "extractor": meta.get("extractor", ""),
                "formats": formats_list
            }
            return json.dumps(result)
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


def download_media_file(url: str, format_id: str, output_directory: str, progress_callback=None) -> str:
    """
    Downloads media directly to target output_directory on device.
    """
    def progress_hook(d):
        if progress_callback and d.get('status') == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
            downloaded = d.get('downloaded_bytes') or 0
            speed = d.get('speed') or 0
            eta = d.get('eta') or 0
            percent = (downloaded / total * 100.0) if total > 0 else 0.0

            payload = json.dumps({
                "status": "downloading",
                "downloaded": downloaded,
                "total": total,
                "percent": round(percent, 2),
                "speed": speed,
                "eta": eta
            })
            progress_callback(payload)
        elif progress_callback and d.get('status') == 'finished':
            progress_callback(json.dumps({"status": "finished", "percent": 100.0}))

    chosen_format = format_id if format_id and format_id != "best" else "best[ext=mp4]/best"
    outtmpl = os.path.join(output_directory, '%(title).100s.%(ext)s')

    ydl_opts = {
        'format': chosen_format,
        'outtmpl': outtmpl,
        'quiet': True,
        'no_warnings': True,
        'cachedir': False,
        'progress_hooks': [progress_hook],
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
    }

    try:
        os.makedirs(output_directory, exist_ok=True)
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(url, download=True)
            saved_file = ydl.prepare_filename(info_dict)

            return json.dumps({
                "success": True,
                "filePath": saved_file,
                "title": info_dict.get("title", "")
            })
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})
