"""
Custom exceptions and error classification for Vitre Downloader.
"""

class VitreError(Exception):
    """Base exception for all Vitre errors."""
    def __init__(self, message: str, user_friendly: str = None):
        super().__init__(message)
        self.user_friendly = user_friendly or message

    def __str__(self):
        return self.user_friendly


class ToolNotFoundError(VitreError):
    """Raised when an external tool (FFmpeg, FFprobe, aria2c) is missing."""
    pass


class InvalidURLError(VitreError):
    """Raised when the provided URL is malformed or unsupported."""
    pass


class ExtractionError(VitreError):
    """Raised when metadata extraction fails."""
    pass


class DownloadError(VitreError):
    """Raised when media download encounters a network or source failure."""
    pass


class ProcessingError(VitreError):
    """Raised when FFmpeg conversion or stream merging fails."""
    pass


class StorageError(VitreError):
    """Raised when insufficient storage or permission issues occur."""
    pass


def classify_error(err: Exception, url: str = "") -> VitreError:
    """Classify arbitrary exceptions into user-friendly Vitre errors without leaking secrets."""
    msg = str(err)
    lower = msg.lower()

    if "unsupported url" in lower or "is not a valid url" in lower:
        return InvalidURLError(
            msg,
            "This URL is not supported or not recognized as a valid media link."
        )
    if "sign in to confirm" in lower or "not a bot" in lower or "bot check" in lower:
        return ExtractionError(
            msg,
            "YouTube bot verification triggered. Try mobile data or wait a few minutes."
        )
    if "the page needs to be reloaded" in lower:
        return ExtractionError(
            msg,
            "YouTube challenged this request. Please retry with mobile client or alternate network."
        )
    if "video unavailable" in lower or "private video" in lower:
        return ExtractionError(
            msg,
            "The requested video is private, removed, or unavailable in your region."
        )
    if "no space left on device" in lower:
        return StorageError(
            msg,
            "Insufficient disk space to save the downloaded media."
        )
    if "permission denied" in lower:
        return StorageError(
            msg,
            "Storage write permission denied. Run 'termux-setup-storage' or grant storage permission in settings."
        )
    if "login required" in lower or "cookies" in lower:
        return ExtractionError(
            msg,
            "This content is private or requires authentication."
        )

    # Clean any local paths or internal keys from error string
    clean_msg = msg.replace("\n", " ").strip()
    if len(clean_msg) > 200:
        clean_msg = clean_msg[:197] + "..."
    return DownloadError(msg, f"Download failed: {clean_msg}")
