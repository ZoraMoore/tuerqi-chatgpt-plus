import asyncio

import sys

import unittest

from pathlib import Path

from typing import Any



from pydantic import ValidationError





sys.path.insert(0, str(Path(__file__).resolve().parents[1]))



from app.api.routes.cards import batch_query_cards  # noqa: E402

from app.schemas.cards import BatchCardQueryRequest  # noqa: E402





PUBLIC_LINK = "http://chatgpt.scienceedu.me/recharge?code=GFSO7XQSTBSIWDK2"

UPSTREAM_LINK = "https://987ai.vip/recharge?code=GFSO7XQSTBSIWDK2"





class FakeUpstreamClient:

    def __init__(self, response: dict[str, Any]) -> None:

        self.response = response

        self.calls: list[tuple[str, str, dict[str, Any] | None]] = []



    async def request(

        self,

        method: str,

        path: str,

        json_body: dict[str, Any] | None = None,

    ) -> dict[str, Any]:

        self.calls.append((method, path, json_body))

        return self.response





class CardQueryLinksTest(unittest.TestCase):

    def test_public_recharge_link_input_is_normalized_for_upstream(self) -> None:

        payload = BatchCardQueryRequest(card_keys=[PUBLIC_LINK])

        upstream = FakeUpstreamClient({"success": True, "data": []})



        asyncio.run(batch_query_cards(payload, upstream))



        self.assertEqual(upstream.calls[0][2], {"card_keys": ["GFSO7XQSTBSIWDK2"]})



    def test_upstream_recharge_link_input_is_rejected(self) -> None:

        with self.assertRaises(ValidationError):

            BatchCardQueryRequest(card_keys=[UPSTREAM_LINK])



    def test_batch_query_response_rewrites_upstream_fields_to_public_links(self) -> None:

        payload = BatchCardQueryRequest(card_keys=["GFSO7XQSTBSIWDK2"])

        upstream = FakeUpstreamClient(

            {

                "success": True,

                "message": "查询成功",

                "data": [

                    {

                        "card_key": "GFSO7XQSTBSIWDK2",

                        "status": 1,

                        "status_text": "已使用",

                        "user_id": "alimoeini20001578@gmail.com",

                        "account_id": "",

                        "used_at": "2026-05-21 05:13:12",

                        "link": UPSTREAM_LINK,

                    }

                ],

            }

        )



        result = asyncio.run(batch_query_cards(payload, upstream))



        self.assertEqual(result["data"][0]["card_key"], PUBLIC_LINK)

        self.assertEqual(result["data"][0]["link"], PUBLIC_LINK)





if __name__ == "__main__":

    unittest.main()

