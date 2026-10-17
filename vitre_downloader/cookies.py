"""
Session and anti-bot mitigation module for Vitre Downloader.
Handles automatic YouTube visitor session cookies, user-supplied cookies,
JS runtime detection for n-challenge solving, and automatic session renewal.
"""

import os
import time
import shutil
import logging
import urllib.request
import http.cookiejar
from typing import Optional, Dict, Any

logger = logging.getLogger("vitre.cookies")

COOKIE_CACHE_LIFETIME = 86400  # 24 hours


def get_default_cookie_path() -> str:
    """Return persistent path for guest cookies."""
    base_dir = os.environ.get("HOME") or os.environ.get("TMPDIR") or "/tmp"
    cache_dir = os.path.join(base_dir, ".vitre")
    os.makedirs(cache_dir, exist_ok=True)
    return os.path.join(cache_dir, "yt_cookies.txt")


def find_custom_cookie_file() -> Optional[str]:
    """Look for user-provided cookies.txt in common device paths."""
    candidates = [
        os.path.join(os.getcwd(), "cookies.txt"),
        "/storage/emulated/0/Download/Vitre/cookies.txt",
        "/storage/emulated/0/Download/cookies.txt",
        "/storage/emulated/0/Documents/cookies.txt",
        os.path.join(os.environ.get("HOME", ""), "cookies.txt"),
    ]
    for path in candidates:
        if os.path.exists(path) and os.path.isfile(path) and os.path.getsize(path) > 50:
            return path
    return None


def fetch_guest_cookies(output_path: str) -> bool:
    """
    Fetch an anonymous guest visitor session from YouTube.
    Establishes VISITOR_INFO1_LIVE, YSC, and security tokens to prevent 429 bot checks.
    """
    try:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        jar = http.cookiejar.MozillaCookieJar(output_path)
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
            logger.info("Successfully refreshed YouTube visitor session cookies.")
            return True
    except Exception as e:
        logger.warning(f"Could not establish YouTube guest session: {e}")
        return False


def get_active_cookie_file(force_refresh: bool = False) -> Optional[str]:
    """
    Returns the path to an active cookie file (custom or auto-managed guest session).
    """
    # 1. Custom user cookies take priority
    custom = find_custom_cookie_file()
    if custom and not force_refresh:
        return custom

    # 2. Auto guest session cookie cache
    guest_path = get_default_cookie_path()
    needs_refresh = (
        force_refresh
        or not os.path.exists(guest_path)
        or os.path.getsize(guest_path) < 50
        or (time.time() - os.path.getmtime(guest_path)) > COOKIE_CACHE_LIFETIME
    )

    if needs_refresh:
        fetch_guest_cookies(guest_path)

    if os.path.exists(guest_path) and os.path.getsize(guest_path) >= 50:
        return guest_path

    return None


def configure_ydl_anti_bot_opts(
    ydl_opts: Dict[str, Any],
    url: str = "",
    force_refresh_cookies: bool = False
) -> None:
    """
    Configures anti-bot mechanisms in ydl_opts:
    - Auto-generated guest cookies or user-supplied cookies.txt
    - JS challenge solver runtime (node, deno, or quickjs)
    """
    cookie_path = get_active_cookie_file(force_refresh=force_refresh_cookies)
    if cookie_path:
        ydl_opts["cookiefile"] = cookie_path

    # Enable JavaScript runtime for yt-dlp n-challenge / signature deciphering
    node_bin = shutil.which("node") or "/data/user/0/com.agy/files/usr/bin/node"
    deno_bin = shutil.which("deno")
    quickjs_bin = shutil.which("quickjs")

    if node_bin and os.path.exists(node_bin):
        ydl_opts["js_runtimes"] = {"node": {}}
        ydl_opts["remote_components"] = {"ejs:github"}
    elif deno_bin and os.path.exists(deno_bin):
        ydl_opts["js_runtimes"] = {"deno": {}}
        ydl_opts["remote_components"] = {"ejs:github"}
    elif quickjs_bin and os.path.exists(quickjs_bin):
        ydl_opts["js_runtimes"] = {"quickjs": {}}
        ydl_opts["remote_components"] = {"ejs:github"}
