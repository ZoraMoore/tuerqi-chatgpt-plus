from collections.abc import AsyncIterator
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings


class UpstreamClient:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.upstream_base_url,
            timeout=settings.request_timeout_seconds,
            headers={"Content-Type": "application/json"},
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def request(
        self,
        method: str,
        path: str,
        json_body: dict[str, Any] | None = None,
    ) -> Any:
        try:
            response = await self._client.request(method, path, json=json_body)
        except httpx.TimeoutException as exc:
            raise HTTPException(status_code=504, detail={"message": "上游服务请求超时"}) from exc
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail={"message": "上游服务暂不可用"}) from exc

        data = self._parse_response(response)
        if response.is_error:
            raise HTTPException(status_code=response.status_code, detail=data)
        return data

    @staticmethod
    def _parse_response(response: httpx.Response) -> Any:
        if not response.content:
            return {}
        try:
            return response.json()
        except ValueError:
            return {"message": response.text}


async def get_upstream_client() -> AsyncIterator[UpstreamClient]:
    client = UpstreamClient()
    try:
        yield client
    finally:
        await client.close()
