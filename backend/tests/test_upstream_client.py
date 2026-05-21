import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.upstream_client import (  # noqa: E402
    build_curl_args,
    build_stdin_payload,
    build_upstream_headers,
)


class UpstreamClientHeadersTest(unittest.TestCase):
    def test_build_upstream_headers_matches_browser_json_request(self) -> None:
        headers = build_upstream_headers()

        self.assertEqual(headers["Accept"], "application/json")
        self.assertEqual(headers["Content-Type"], "application/json")
        self.assertEqual(headers["Origin"], "https://987ai.vip")
        self.assertEqual(headers["Referer"], "https://987ai.vip/")
        self.assertIn("Mozilla/5.0", headers["User-Agent"])

    def test_build_curl_args_uses_argument_list_with_browser_headers(self) -> None:
        args = build_curl_args(
            curl_binary="curl",
            method="GET",
            url="https://api.987ai.vip/api/card-keys/ABC123",
        )

        self.assertEqual(args[0], "curl")
        self.assertIn("-H", args)
        self.assertIn("Origin: https://987ai.vip", args)
        self.assertIn("Referer: https://987ai.vip/", args)
        self.assertIn("https://api.987ai.vip/api/card-keys/ABC123", args)
        self.assertNotIn("shell=True", " ".join(args))

    def test_build_curl_args_reads_json_body_from_stdin(self) -> None:
        args = build_curl_args(
            curl_binary="curl",
            method="POST",
            url="https://api.987ai.vip/api/parse-token",
            json_body={"access_token": "secret-token"},
        )

        self.assertIn("--data-binary", args)
        self.assertIn("@-", args)
        self.assertNotIn("secret-token", " ".join(args))

    def test_build_stdin_payload_returns_text_for_subprocess_text_mode(self) -> None:
        payload = build_stdin_payload({"access_token": "secret-token", "label": "卡密"})

        self.assertIsInstance(payload, str)
        self.assertIn("secret-token", payload)
        self.assertIn("卡密", payload)


if __name__ == "__main__":
    unittest.main()
