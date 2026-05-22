from typing import Any

from fastapi import APIRouter, Depends, Path

from app.schemas.cards import BatchCardQueryRequest, ReplaceCardRequest, to_public_recharge_link
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
    result = await upstream.request(
        "POST",
        "/api/card-keys/batch-query",
        {"card_keys": payload.card_keys},
    )
    return rewrite_card_query_response(result)


def rewrite_card_query_response(value: Any) -> Any:
    if isinstance(value, list):
        return [rewrite_card_query_response(item) for item in value]

    if not isinstance(value, dict):
        return value

    rewritten = {key: rewrite_card_query_response(item) for key, item in value.items()}
    if "data" in rewritten and isinstance(rewritten["data"], list):
        rewritten["data"] = [rewrite_card_record(item) for item in rewritten["data"]]
    return rewritten


def rewrite_card_record(record: Any) -> Any:
    if not isinstance(record, dict):
        return record

    rewritten = dict(record)
    source = rewritten.get("link") or rewritten.get("card_key")
    if isinstance(source, str) and source.strip():
        public_link = to_public_recharge_link(source)
        rewritten["link"] = public_link
        rewritten["card_key"] = public_link
    return rewritten


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
