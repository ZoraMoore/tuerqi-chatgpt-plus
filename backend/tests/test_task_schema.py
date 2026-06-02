import asyncio
import sys
import unittest
from pathlib import Path

from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.routes.tasks import create_task  # noqa: E402
from app.schemas.tasks import CreateTaskRequest  # noqa: E402


class FakeUpstreamClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, dict[str, object] | None]] = []

    async def request(
        self,
        method: str,
        path: str,
        json_body: dict[str, object] | None = None,
    ) -> dict[str, object]:
        self.calls.append((method, path, json_body))
        return {"success": True, "task_id": "00000000-0000-0000-0000-000000000000"}


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

    def test_accepts_claude_org_id_without_access_token(self) -> None:
        payload = CreateTaskRequest(
            card_key=" claude123 ",
            org_id="a1b2c3d4-1234-1234-1234-123456789abc",
        )

        self.assertEqual(payload.card_key, "CLAUDE123")
        self.assertEqual(payload.org_id, "a1b2c3d4-1234-1234-1234-123456789abc")
        self.assertIsNone(payload.access_token)

    def test_rejects_invalid_claude_org_id(self) -> None:
        with self.assertRaises(ValidationError):
            CreateTaskRequest(card_key="CLAUDE123", org_id="not-a-uuid")

    def test_rejects_task_without_gpt_token_or_claude_org_id(self) -> None:
        with self.assertRaises(ValidationError):
            CreateTaskRequest(card_key="CLAUDE123")

    def test_claude_task_forwards_only_card_key_and_org_id(self) -> None:
        payload = CreateTaskRequest(
            card_key=" claude123 ",
            org_id="a1b2c3d4-1234-1234-1234-123456789abc",
            idp="ignored",
            force_recharge=True,
        )
        upstream = FakeUpstreamClient()

        asyncio.run(create_task(payload, upstream))

        self.assertEqual(
            upstream.calls,
            [
                (
                    "POST",
                    "/api/tasks",
                    {
                        "card_key": "CLAUDE123",
                        "org_id": "a1b2c3d4-1234-1234-1234-123456789abc",
                    },
                )
            ],
        )


if __name__ == "__main__":
    unittest.main()
