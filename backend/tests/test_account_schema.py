import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas.accounts import AccessTokenRequest  # noqa: E402


class AccessTokenRequestTest(unittest.TestCase):
    def test_plain_token_is_kept(self) -> None:
        payload = AccessTokenRequest(access_token="  plain-token  ")

        self.assertEqual(payload.access_token, "plain-token")

    def test_extracts_access_token_from_json_input(self) -> None:
        payload = AccessTokenRequest(
            access_token='{"WARNING_BANNER":"do not share","accessToken":"json-token"}',
        )

        self.assertEqual(payload.access_token, "json-token")

    def test_extracts_access_token_from_key_value_fragment(self) -> None:
        payload = AccessTokenRequest(access_token='"accessToken":"fragment-token"')

        self.assertEqual(payload.access_token, "fragment-token")

    def test_extracts_snake_case_access_token_from_json_input(self) -> None:
        payload = AccessTokenRequest(access_token='{"access_token":"snake-token"}')

        self.assertEqual(payload.access_token, "snake-token")

    def test_extracts_access_token_before_length_validation(self) -> None:
        wrapped_token = '{"WARNING_BANNER":"' + ("x" * 60000) + '","accessToken":"json-token"}'

        payload = AccessTokenRequest(access_token=wrapped_token)

        self.assertEqual(payload.access_token, "json-token")

    def test_extracts_access_token_from_json_encoded_string(self) -> None:
        payload = AccessTokenRequest(access_token='"{\\"accessToken\\":\\"encoded-token\\"}"')

        self.assertEqual(payload.access_token, "encoded-token")

    def test_extracts_access_token_from_escaped_key_value_fragment(self) -> None:
        payload = AccessTokenRequest(access_token='\\"accessToken\\":\\"escaped-token\\"')

        self.assertEqual(payload.access_token, "escaped-token")


if __name__ == "__main__":
    unittest.main()
