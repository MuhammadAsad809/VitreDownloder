"""
Unit tests for Vitre Downloader: URL validation, sanitization, collision avoidance,
format construction, and YouTube quality resolution acceptance tests.
"""

import os
import unittest
import tempfile
import yt_dlp

from vitre_downloader.utils import (
    clean_url,
    sanitize_filename,
    get_non_conflicting_path,
    format_bytes,
    format_duration,
    verify_output_file,
)
from vitre_downloader.detector import ToolDetector, detect_environment
from vitre_downloader.analyzer import MediaAnalyzer
from vitre_downloader.downloader import build_format_selector
from vitre_downloader.errors import InvalidURLError, classify_error, ToolNotFoundError


class TestVitreDownloader(unittest.TestCase):

    def test_clean_url(self):
        self.assertEqual(clean_url("youtube.com/watch?v=123"), "https://youtube.com/watch?v=123")
        ig_url = "https://www.instagram.com/reel/C12345/?igsh=abc123xyz&utm_source=ig_web_copy_link"
        self.assertEqual(clean_url(ig_url), "https://www.instagram.com/reel/C12345/")
        yt_short = "https://youtu.be/abc1234?si=tracker123"
        self.assertEqual(clean_url(yt_short), "https://youtu.be/abc1234")

    def test_sanitize_filename(self):
        dirty = 'My Video: "Episode 1" <HD> / Special? *Part 1* | 100%'
        clean = sanitize_filename(dirty)
        for char in [":", '"', "<", ">", "/", "?", "*", "|"]:
            self.assertNotIn(char, clean)
        self.assertEqual(clean, "My Video Episode 1 HD Special Part 1 100%")

        long_name = "A" * 200
        self.assertEqual(len(sanitize_filename(long_name, max_length=50)), 50)

    def test_non_conflicting_path(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            file1 = os.path.join(tmpdir, "video.mp4")
            with open(file1, "w") as f:
                f.write("content")

            alt1 = get_non_conflicting_path(file1)
            self.assertEqual(alt1, os.path.join(tmpdir, "video (1).mp4"))

            with open(alt1, "w") as f:
                f.write("content 2")
            alt2 = get_non_conflicting_path(file1)
            self.assertEqual(alt2, os.path.join(tmpdir, "video (2).mp4"))

    def test_format_bytes(self):
        self.assertEqual(format_bytes(0), "0 B")
        self.assertEqual(format_bytes(1024), "1.0 KB")
        self.assertEqual(format_bytes(1048576 * 15), "15.0 MB")
        self.assertEqual(format_bytes(1073741824 * 2.5), "2.5 GB")

    def test_format_duration(self):
        self.assertEqual(format_duration(0), "00:00")
        self.assertEqual(format_duration(65), "01:05")
        self.assertEqual(format_duration(3665), "1:01:05")

    def test_verify_output_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = os.path.join(tmpdir, "sample.mp4")
            valid, _ = verify_output_file(test_file)
            self.assertFalse(valid)

            with open(test_file, "w") as f:
                f.write("small")
            valid, _ = verify_output_file(test_file, min_bytes=100)
            self.assertFalse(valid)

            with open(test_file, "wb") as f:
                f.write(b"x" * 2048)
            valid, err = verify_output_file(test_file, min_bytes=1024)
            self.assertTrue(valid)
            self.assertEqual(err, "")

    def test_validate_url(self):
        analyzer = MediaAnalyzer()
        with self.assertRaises(InvalidURLError):
            analyzer.validate_url("")

        with self.assertRaises(InvalidURLError):
            analyzer.validate_url("not_a_valid_url")

        valid = analyzer.validate_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        self.assertTrue(valid.startswith("https://"))

    def test_detector(self):
        detector = detect_environment()
        diag = detector.diagnose()
        self.assertIn("platform", diag)
        self.assertIn("tools", diag)

    def test_error_classification(self):
        err = Exception("Sign in to confirm you're not a bot")
        classified = classify_error(err)
        self.assertIn("bot verification", classified.user_friendly)

        err2 = Exception("No space left on device")
        classified2 = classify_error(err2)
        self.assertIn("disk space", classified2.user_friendly)

    def test_build_format_selector(self):
        """Verify dynamic format selector adheres to requirements."""
        # Requirement 3: Default is bv*+ba/b
        self.assertEqual(build_format_selector("best"), "bv*+ba/b")
        self.assertEqual(build_format_selector(""), "bv*+ba/b")

        # Requirement 4 & 5: bv*[height<=H]+ba/b[height<=H]
        self.assertEqual(build_format_selector("1080"), "bv*[height<=1080]+ba/b[height<=1080]")
        self.assertEqual(build_format_selector("1080p"), "bv*[height<=1080]+ba/b[height<=1080]")
        self.assertEqual(build_format_selector("720"), "bv*[height<=720]+ba/b[height<=720]")
        self.assertEqual(build_format_selector("720p"), "bv*[height<=720]+ba/b[height<=720]")
        self.assertEqual(build_format_selector("480"), "bv*[height<=480]+ba/b[height<=480]")
        self.assertEqual(build_format_selector("360"), "bv*[height<=360]+ba/b[height<=360]")
        self.assertEqual(build_format_selector("240"), "bv*[height<=240]+ba/b[height<=240]")
        self.assertEqual(build_format_selector("144"), "bv*[height<=144]+ba/b[height<=144]")

        # Audio
        self.assertEqual(build_format_selector("audio"), "bestaudio/best")
        self.assertEqual(build_format_selector("anything", is_audio=True), "bestaudio/best")

    def test_youtube_acceptance_iw7h4C_N1ec(self):
        """
        Acceptance test: For YouTube video 'iw7h4C_N1ec',
        verify that 720p selects a 720p format and 1080p selects a 1080p format.
        """
        from vitre_downloader.cookies import configure_ydl_anti_bot_opts, get_active_cookie_file

        url = "https://www.youtube.com/watch?v=iw7h4C_N1ec"
        cookie_file = get_active_cookie_file()
        self.assertIsNotNone(cookie_file, "Active cookie file must be provided")

        ydl_opts = {"quiet": True, "cachedir": False}
        configure_ydl_anti_bot_opts(ydl_opts, url)

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            meta = ydl.extract_info(url, download=False)
            formats = meta.get("formats", [])

        # Check that formats are not artificially limited to 360p
        available_heights = set(f.get("height") or 0 for f in formats if f.get("vcodec") != "none")
        self.assertIn(720, available_heights, "720p must be present in available formats")
        self.assertIn(1080, available_heights, "1080p must be present in available formats")

        # Test 720p selector
        fmt_720 = build_format_selector("720")
        opts_720 = {
            "quiet": True,
            "format": fmt_720,
            "format_sort": ["res", "ext:mp4:m4a"],
        }
        configure_ydl_anti_bot_opts(opts_720, url)
        with yt_dlp.YoutubeDL(opts_720) as ydl_720:
            p_720 = ydl_720.process_ie_result(dict(meta), download=False)
            req_720 = p_720.get("requested_formats")
            self.assertIsNotNone(req_720, "720p selection must request video+audio streams")
            self.assertEqual(len(req_720), 2, "Must request both video and audio stream")
            self.assertEqual(req_720[0].get("height"), 720, "Selected video stream must be 720p")
            self.assertTrue(req_720[1].get("acodec") != "none", "Second stream must be audio")

        # Test 1080p selector
        fmt_1080 = build_format_selector("1080")
        opts_1080 = {
            "quiet": True,
            "format": fmt_1080,
            "format_sort": ["res", "ext:mp4:m4a"],
        }
        configure_ydl_anti_bot_opts(opts_1080, url)
        with yt_dlp.YoutubeDL(opts_1080) as ydl_1080:
            p_1080 = ydl_1080.process_ie_result(dict(meta), download=False)
            req_1080 = p_1080.get("requested_formats")
            self.assertIsNotNone(req_1080, "1080p selection must request video+audio streams")
            self.assertEqual(len(req_1080), 2, "Must request both video and audio stream")
            self.assertEqual(req_1080[0].get("height"), 1080, "Selected video stream must be 1080p")
            self.assertTrue(req_1080[1].get("acodec") != "none", "Second stream must be audio")


if __name__ == "__main__":
    unittest.main()
