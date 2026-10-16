"""
Utility helpers for URL normalization, filename sanitization, formatting, and file verification.
"""

import os
import re
from typing import Tuple


def clean_url(url: str) -> str:
    """Normalize and strip query parameters for short/sharing URLs."""
    if not url:
        return ""
    clean = url.strip()
    if not clean.startswith("http://") and not clean.startswith("https://"):
        clean = "https://" + clean
    # Strip tracking parameters for common video sites
    if any(domain in clean for domain in ("instagram.com", "tiktok.com", "youtu.be")):
        clean = clean.split("?")[0]
    return clean


def sanitize_filename(name: str, max_length: int = 120) -> str:
    """
    Sanitize string to be safe for Android, Linux, Windows, and macOS filesystems.
    Removes invalid characters: \\ / : * ? " < > | and non-printable control characters.
    """
    if not name:
        return "media"
    # Remove invalid characters
    sanitized = re.sub(r'[\\/*?:"<>|]', "", name)
    # Remove control characters
    sanitized = re.sub(r'[\x00-\x1f\x7f-\x9f]', "", sanitized)
    # Collapse consecutive whitespace
    sanitized = re.sub(r'\s+', " ", sanitized).strip()
    if not sanitized:
        sanitized = "media"
    # Truncate to safe length
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length].rstrip()
    return sanitized


def get_non_conflicting_path(target_path: str) -> str:
    """
    If target_path already exists, return target_path with a numbered suffix (e.g., 'title (1).mp4').
    Prevents accidental overwrites.
    """
    if not os.path.exists(target_path):
        return target_path

    directory, filename = os.path.split(target_path)
    base, ext = os.path.splitext(filename)
    counter = 1

    while True:
        candidate = os.path.join(directory, f"{base} ({counter}){ext}")
        if not os.path.exists(candidate):
            return candidate
        counter += 1


def format_bytes(num_bytes: int) -> str:
    """Format byte count into human-readable string (e.g., '14.5 MB')."""
    if not num_bytes or num_bytes <= 0:
        return "0 B"
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if abs(num_bytes) < 1024.0:
            return f"{num_bytes:.1f} {unit}" if unit != "B" else f"{int(num_bytes)} B"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f} PB"


def format_duration(seconds: float) -> str:
    """Format duration in seconds into 'MM:SS' or 'HH:MM:SS'."""
    if not seconds or seconds <= 0:
        return "00:00"
    total_secs = int(round(seconds))
    hours = total_secs // 3600
    minutes = (total_secs % 3600) // 60
    secs = total_secs % 60
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def verify_output_file(file_path: str, min_bytes: int = 1024) -> Tuple[bool, str]:
    """
    Verifies that the downloaded or converted media file exists, is non-empty,
    and meets minimum size threshold.
    """
    if not file_path:
        return False, "File path is empty."
    if not os.path.exists(file_path):
        return False, f"Output file does not exist: {file_path}"
    try:
        size = os.path.getsize(file_path)
        if size < min_bytes:
            return False, f"File size too small ({size} bytes), likely corrupted."
        return True, ""
    except OSError as e:
        return False, f"Error accessing file: {e}"
