from typing import Any

from fastapi import APIRouter, Depends, Path

from app.schemas.cards import BatchCardQueryRequest, ReplaceCardRequest
from app.services.upstream_client import UpstreamClient, get_upstream_client


router = APIRouter()


@router.get("/{card_code}")
async def get_card_status(
    card_code: str = Path(min_length=1, max_length=100),
    upstream: UpstreamClient = Depends(get_upstream_client),
) -> Any:
    normalized = card_code.strip().upper()
    return await upstream.request("GET", f"/api/card-keys/{normalized}")


@router.post("/batch-query")
async def batch_query_cards(
    payload: BatchCardQueryRequest,
    upstream: UpstreamClient = Depends(get_upstream_client),
) -> Any:
    return await upstream.request(
        "POST",
        "/api/card-keys/batch-query",
        {"card_keys": payload.card_keys},
    )


@router.post("/replace")
async def replace_card(
    payload: ReplaceCardRequest,
    upstream: UpstreamClient = Depends(get_upstream_client),
) -> Any:
    return await upstream.request(
        "POST",
        "/api/card-keys/replace",
        {"old_card_key": payload.old_card_key},
    )
