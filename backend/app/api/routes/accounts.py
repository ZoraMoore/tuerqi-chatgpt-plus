from typing import Any

from fastapi import APIRouter, Depends

from app.schemas.accounts import AccessTokenRequest
from app.services.upstream_client import UpstreamClient, get_upstream_client


router = APIRouter()


@router.post("/parse-token")
async def parse_token(
    payload: AccessTokenRequest,
    upstream: UpstreamClient = Depends(get_upstream_client),
) -> Any:
    return await upstream.request(
        "POST",
        "/api/parse-token",
        {"access_token": payload.access_token},
    )


@router.post("/check")
async def check_account(
    payload: AccessTokenRequest,
    upstream: UpstreamClient = Depends(get_upstream_client),
) -> Any:
    return await upstream.request(
        "POST",
        "/api/check-account",
        {"access_token": payload.access_token},
    )
