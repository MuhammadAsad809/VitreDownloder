"""
Unit tests for Vitre Downloader: URL validation, sanitization, collision avoidance, and tool detection.
"""

import os
import unittest
import tempfile

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
from vitre_downloader.errors import InvalidURLError, classify_error, ToolNotFoundError


class TestVitreDownloader(unittest.TestCase):

    def test_clean_url(self):
        # Adding protocol
        self.assertEqual(clean_url("youtube.com/watch?v=123"), "https://youtube.com/watch?v=123")
        # Stripping tracking query params for Instagram / TikTok
        ig_url = "https://www.instagram.com/reel/C12345/?igsh=abc123xyz&utm_source=ig_web_copy_link"
        self.assertEqual(clean_url(ig_url), "https://www.instagram.com/reel/C12345/")

        yt_short = "https://youtu.be/abc1234?si=tracker123"
        self.assertEqual(clean_url(yt_short), "https://youtu.be/abc1234")

    def test_sanitize_filename(self):
        dirty = 'My Video: "Episode 1" <HD> / Special? *Part 1* | 100%'
        clean = sanitize_filename(dirty)
        self.assertNotIn(":", clean)
        self.assertNotIn('"', clean)
        self.assertNotIn("<", clean)
        self.assertNotIn(">", clean)
        self.assertNotIn("/", clean)
        self.assertNotIn("?", clean)
        self.assertNotIn("*", clean)
        self.assertNotIn("|", clean)
        self.assertEqual(clean, "My Video Episode 1 HD Special Part 1 100%")

        # Test truncation
        long_name = "A" * 200
        self.assertEqual(len(sanitize_filename(long_name, max_length=50)), 50)

    def test_non_conflicting_path(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            file1 = os.path.join(tmpdir, "video.mp4")
            with open(file1, "w") as f:
                f.write("content")

            # First collision should become video (1).mp4
            alt1 = get_non_conflicting_path(file1)
            self.assertEqual(alt1, os.path.join(tmpdir, "video (1).mp4"))

            # Create video (1).mp4 and test second collision
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
            # Missing file
            valid, err = verify_output_file(test_file)
            self.assertFalse(valid)

            # Tiny file (< 1024 bytes)
            with open(test_file, "w") as f:
                f.write("small")
            valid, err = verify_output_file(test_file, min_bytes=100)
            self.assertFalse(valid)

            # Valid file
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
        self.assertIn("ffmpeg", diag["tools"])
        self.assertIn("aria2c", diag["tools"])

    def test_error_classification(self):
        err = Exception("Sign in to confirm you're not a bot")
        classified = classify_error(err)
        self.assertIn("bot verification", classified.user_friendly)

        err2 = Exception("No space left on device")
        classified2 = classify_error(err2)
        self.assertIn("disk space", classified2.user_friendly)


if __name__ == "__main__":
    unittest.main()
