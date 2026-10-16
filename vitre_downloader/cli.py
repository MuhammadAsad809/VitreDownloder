"""
Command-Line Interface (CLI) for Vitre Downloader.
Supports interactive mode, direct download, metadata analysis, audio extraction, and diagnostics.
"""

import sys
import os
import argparse
import time
from typing import Dict, Any

from .detector import detect_environment
from .analyzer import MediaAnalyzer
from .downloader import MediaDownloader
from .processor import MediaProcessor
from .utils import format_bytes, format_duration
from .errors import VitreError


def _render_progress_bar(data: Dict[str, Any]):
    """Renders a single-line terminal progress bar."""
    status = data.get("status")
    if status == "downloading":
        percent = data.get("percent", 0.0)
        speed_str = data.get("speed_human", "0 B/s")
        downloaded_str = data.get("downloaded_human", "0 B")
        total_str = data.get("total_human", "0 B")
        eta_secs = data.get("eta", 0)
        eta_str = f"ETA: {format_duration(eta_secs)}" if eta_secs else "ETA: --:--"

        bar_len = 25
        filled = int(round(bar_len * percent / 100))
        bar = "█" * filled + "░" * (bar_len - filled)

        line = f"\r\033[32m[{bar}]\033[0m {percent:5.1f}% | {speed_str} | {downloaded_str}/{total_str} | {eta_str}"
        sys.stdout.write(line)
        sys.stdout.flush()
    elif status == "finished":
        sys.stdout.write(f"\r\033[32m[█████████████████████████] 100.0%\033[0m | Download complete!          \n")
        sys.stdout.flush()


def cmd_diagnose():
    """Print system environment, tools, and storage paths."""
    detector = detect_environment()
    diag = detector.diagnose()

    print("\n\033[1;36m=== Vitre Downloader System Diagnostics ===\033[0m")
    print(f"Platform:        {diag['platform']}")
    print(f"Android / Termux: {'Yes' if diag['is_android'] else 'No'}")
    print(f"Default Storage: {diag['default_storage']}")
    print("\n\033[1mExternal Tools Status:\033[0m")

    for tool_name, info in diag["tools"].items():
        status_icon = "\033[32m✔ INSTALLED\033[0m" if info["installed"] else "\033[33m✘ NOT FOUND\033[0m"
        print(f"  • {tool_name:<8} {status_icon}")
        if info["installed"]:
            print(f"    Path:    {info['path']}")
            print(f"    Version: {info['version']}")
        else:
            hint = "pkg install ffmpeg" if "ff" in tool_name else "pkg install aria2"
            print(f"    Hint:    Run '{hint}' to enable full functionality.")
    print("")


def cmd_analyze(url: str):
    """Analyze URL and print metadata and available formats."""
    print(f"\n\033[1;34mAnalyzing media URL:\033[0m {url}")
    analyzer = MediaAnalyzer()
    try:
        info = analyzer.extract_info(url)
    except VitreError as e:
        print(f"\033[31mError: {e}\033[0m")
        sys.exit(1)

    print("\n\033[1;32m=== Media Details ===\033[0m")
    print(f"Title:       {info['title']}")
    print(f"Uploader:    {info['uploader']}")
    print(f"Duration:    {info['duration_human']}")
    print(f"Platform:    {info['extractor'].upper()}")
    if info.get("thumbnail"):
        print(f"Thumbnail:   {info['thumbnail']}")

    video_fmts = info.get("video_formats", [])
    if video_fmts:
        print("\n\033[1;33mAvailable Video Qualities:\033[0m")
        print(f"{'Format ID':<12} {'Resolution':<14} {'Ext':<6} {'Size':<10} {'FPS':<6} {'Note'}")
        print("-" * 65)
        for f in video_fmts[:12]:
            print(f"{f['format_id']:<12} {f['resolution']:<14} {f['ext']:<6} {f['filesize_human']:<10} {f['fps']:<6} {f['quality_note']}")

    audio_fmts = info.get("audio_formats", [])
    if audio_fmts:
        print("\n\033[1;33mAvailable Audio Streams:\033[0m")
        print(f"{'Format ID':<12} {'Resolution':<14} {'Ext':<6} {'Size':<10} {'Bitrate':<8}")
        print("-" * 65)
        for f in audio_fmts[:6]:
            print(f"{f['format_id']:<12} {f['resolution']:<14} {f['ext']:<6} {f['filesize_human']:<10} {f['abr']}k")
    print("")


def cmd_download(url: str, quality: str = "best", audio_only: bool = False, bitrate: str = "192k", use_aria2: bool = False, out_dir: str = None):
    """Download video or audio with live progress."""
    mode = "Audio (MP3)" if audio_only else f"Video ({quality})"
    print(f"\n\033[1;32mStarting {mode} download:\033[0m {url}")

    downloader = MediaDownloader(
        output_dir=out_dir,
        use_aria2=use_aria2,
        progress_callback=_render_progress_bar
    )

    try:
        result = downloader.download(
            url=url,
            quality=quality,
            audio_only=audio_only,
            audio_bitrate=bitrate,
        )
        print("\n\033[1;32m✔ Download Finished Successfully!\033[0m")
        print(f"Title:     {result['title']}")
        print(f"Saved to:  \033[1;36m{result['file_path']}\033[0m")
        print(f"File Size: {result['file_size_human']}")
        print(f"Duration:  {format_duration(result['duration'])}")
        print("")
    except VitreError as e:
        print(f"\n\033[31mDownload Error: {e}\033[0m")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        prog="vitre",
        description="Vitre Downloader - Modern CLI for downloading videos and audio using yt-dlp & FFmpeg."
    )
    subparsers = parser.add_subparsers(dest="command", help="Sub-commands")

    # Diagnose command
    subparsers.add_parser("info", help="Display system diagnostics and detected tools (FFmpeg, aria2)")

    # Analyze command
    analyze_parser = subparsers.add_parser("analyze", help="Extract and inspect video information and stream formats")
    analyze_parser.add_argument("url", help="Media URL to analyze (YouTube, Instagram, TikTok, etc.)")

    # Download command
    dl_parser = subparsers.add_parser("download", help="Download video in selected quality")
    dl_parser.add_argument("url", help="Media URL to download")
    dl_parser.add_argument("-q", "--quality", default="best", help="Quality preset (best, 1080, 720, 480, 360, or format_id)")
    dl_parser.add_argument("-o", "--output", default=None, help="Custom output directory")
    dl_parser.add_argument("--aria2", action="store_true", help="Use aria2c external accelerator if installed")

    # Audio command
    audio_parser = subparsers.add_parser("audio", help="Download audio and convert to MP3")
    audio_parser.add_argument("url", help="Media URL to download audio from")
    audio_parser.add_argument("-b", "--bitrate", default="192k", help="MP3 audio bitrate (e.g. 128k, 192k, 320k)")
    audio_parser.add_argument("-o", "--output", default=None, help="Custom output directory")
    audio_parser.add_argument("--aria2", action="store_true", help="Use aria2c external accelerator if installed")

    args = parser.parse_args()

    if args.command == "info":
        cmd_diagnose()
    elif args.command == "analyze":
        cmd_analyze(args.url)
    elif args.command == "download":
        cmd_download(
            url=args.url,
            quality=args.quality,
            audio_only=False,
            use_aria2=args.aria2,
            out_dir=args.output
        )
    elif args.command == "audio":
        cmd_download(
            url=args.url,
            quality="audio",
            audio_only=True,
            bitrate=args.bitrate,
            use_aria2=args.aria2,
            out_dir=args.output
        )
    else:
        # If no arguments given, show help and diagnose
        parser.print_help()
        cmd_diagnose()


if __name__ == "__main__":
    main()
