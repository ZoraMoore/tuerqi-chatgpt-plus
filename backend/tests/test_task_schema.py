import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas.tasks import CreateTaskRequest  # noqa: E402


class CreateTaskRequestTest(unittest.TestCase):
    def test_extracts_access_token_from_json_input_for_task_creation(self) -> None:
        payload = CreateTaskRequest(
            card_key=" abc123 ",
            access_token='{"WARNING_BANNER":"do not share","accessToken":"json-token"}',
        )

        self.assertEqual(payload.card_key, "ABC123")
        self.assertEqual(payload.access_token, "json-token")

    def test_extracts_access_token_from_escaped_key_value_fragment_for_task_creation(self) -> None:
        payload = CreateTaskRequest(
            card_key="ABC123",
            access_token='\\"accessToken\\":\\"escaped-token\\"',
        )

        self.assertEqual(payload.access_token, "escaped-token")

    def test_extracts_access_token_before_length_validation_for_task_creation(self) -> None:
        wrapped_token = '{"WARNING_BANNER":"' + ("x" * 60000) + '","accessToken":"json-token"}'

        payload = CreateTaskRequest(card_key="ABC123", access_token=wrapped_token)

        self.assertEqual(payload.access_token, "json-token")


if __name__ == "__main__":
    unittest.main()
