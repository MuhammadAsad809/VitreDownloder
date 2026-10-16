"""
FFmpeg post-processing: stream merging, audio extraction & conversion to MP3.
"""

import os
import subprocess
from typing import Optional, Dict, Any

from .detector import detect_environment
from .errors import ToolNotFoundError, ProcessingError
from .utils import verify_output_file, get_non_conflicting_path


class MediaProcessor:
    """Manages audio conversion, video-audio merging, and media stream copying."""

    def __init__(self, ffmpeg_path: Optional[str] = None):
        detector = detect_environment()
        self.ffmpeg_path = ffmpeg_path or detector.ffmpeg_path

    def _require_ffmpeg(self):
        if not self.ffmpeg_path or not os.path.exists(self.ffmpeg_path):
            raise ToolNotFoundError(
                "FFmpeg binary not found.",
                "FFmpeg is required for merging or converting media. "
                "Install it in Termux using 'pkg install ffmpeg'."
            )

    def convert_to_mp3(
        self,
        input_file: str,
        output_file: Optional[str] = None,
        bitrate: str = "192k",
        keep_original: bool = False,
    ) -> str:
        """
        Convert an audio or video file to MP3 with specified bitrate (e.g. 128k, 192k, 320k).
        """
        self._require_ffmpeg()

        if not os.path.exists(input_file):
            raise ProcessingError(f"Input file not found: {input_file}")

        if not output_file:
            base, _ = os.path.splitext(input_file)
            output_file = f"{base}.mp3"

        output_file = get_non_conflicting_path(output_file)

        # -y: overwrite candidate, -vn: disable video, -c:a libmp3lame, -b:a bitrate
        cmd = [
            self.ffmpeg_path,
            "-y",
            "-i", input_file,
            "-vn",
            "-codec:a", "libmp3lame",
            "-b:a", bitrate,
            "-q:a", "0",
            output_file,
        ]

        try:
            res = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=300,
            )
            if res.returncode != 0:
                raise ProcessingError(
                    f"FFmpeg audio conversion failed: {res.stderr[:200]}",
                    f"Failed to convert audio to MP3: {res.stderr[:150]}"
                )

            valid, err = verify_output_file(output_file)
            if not valid:
                raise ProcessingError(f"Verification failed: {err}")

            if not keep_original and os.path.abspath(input_file) != os.path.abspath(output_file):
                try:
                    os.remove(input_file)
                except OSError:
                    pass

            return output_file
        except subprocess.TimeoutExpired:
            raise ProcessingError("FFmpeg audio conversion timed out.")
        except Exception as e:
            if isinstance(e, ProcessingError):
                raise
            raise ProcessingError(f"Audio processing error: {e}")

    def merge_streams(
        self,
        video_file: str,
        audio_file: str,
        output_file: str,
        stream_copy: bool = True,
    ) -> str:
        """
        Merge separate video and audio files into a single container without quality loss.
        Uses stream copying (-c copy) when possible to avoid re-encoding.
        """
        self._require_ffmpeg()

        if not os.path.exists(video_file):
            raise ProcessingError(f"Video file not found: {video_file}")
        if not os.path.exists(audio_file):
            raise ProcessingError(f"Audio file not found: {audio_file}")

        output_file = get_non_conflicting_path(output_file)

        codec_args = ["-c", "copy"] if stream_copy else ["-c:v", "libx264", "-c:a", "aac"]

        cmd = [
            self.ffmpeg_path,
            "-y",
            "-i", video_file,
            "-i", audio_file,
            *codec_args,
            output_file,
        ]

        try:
            res = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=600,
            )
            if res.returncode != 0:
                # If stream copy failed (incompatible containers), retry with re-encode
                if stream_copy:
                    return self.merge_streams(video_file, audio_file, output_file, stream_copy=False)
                raise ProcessingError(
                    f"FFmpeg stream merging failed: {res.stderr[:200]}",
                    f"Failed to merge video and audio streams: {res.stderr[:150]}"
                )

            valid, err = verify_output_file(output_file)
            if not valid:
                raise ProcessingError(f"Verification failed: {err}")

            # Clean temporary inputs
            for temp in (video_file, audio_file):
                try:
                    os.remove(temp)
                except OSError:
                    pass

            return output_file
        except subprocess.TimeoutExpired:
            raise ProcessingError("FFmpeg stream merging timed out.")
        except Exception as e:
            if isinstance(e, ProcessingError):
                raise
            raise ProcessingError(f"Stream merge error: {e}")
