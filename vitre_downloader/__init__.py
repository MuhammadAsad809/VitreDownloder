"""
Vitre Downloader - Advanced Video and Audio Downloader
Powered by Python 3, yt-dlp, and FFmpeg.
"""

__version__ = "1.0.0"
__author__ = "Vitre Project"

from .detector import detect_environment, ToolDetector
from .analyzer import MediaAnalyzer
from .downloader import MediaDownloader
from .processor import MediaProcessor
from .errors import VitreError, ToolNotFoundError, DownloadError, ExtractionError

__all__ = [
    "detect_environment",
    "ToolDetector",
    "MediaAnalyzer",
    "MediaDownloader",
    "MediaProcessor",
    "VitreError",
    "ToolNotFoundError",
    "DownloadError",
    "ExtractionError",
]
