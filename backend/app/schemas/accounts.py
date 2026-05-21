import json
import re
from typing import Any

from pydantic import BaseModel, Field, field_validator


ACCESS_TOKEN_KEYS = ("accessToken", "access_token")
MAX_ACCESS_TOKEN_LENGTH = 50000
MAX_EXTRACTION_DEPTH = 3
ACCESS_TOKEN_FRAGMENT_RE = re.compile(
    r'["\']?(?:accessToken|access_token)["\']?\s*:\s*["\']([^"\']+)["\']',
    re.IGNORECASE,
)


def extract_access_token(value: str, depth: int = 0) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Access Token 不能为空")

    json_token = _extract_from_json_value(cleaned, depth)
    if json_token:
        return json_token

    for candidate in _fragment_candidates(cleaned):
        fragment_match = ACCESS_TOKEN_FRAGMENT_RE.search(candidate)
        if fragment_match:
            return fragment_match.group(1).strip()

    return cleaned


def _extract_from_json_value(value: str, depth: int) -> str | None:
    if depth >= MAX_EXTRACTION_DEPTH:
        return None

    try:
        parsed: Any = json.loads(value)
    except ValueError:
        return None

    if isinstance(parsed, str) and parsed.strip():
        return extract_access_token(parsed, depth + 1)

    if not isinstance(parsed, dict):
        return None

    for key in ACCESS_TOKEN_KEYS:
        token = parsed.get(key)
        if isinstance(token, str) and token.strip():
            return token.strip()
    return None


def _fragment_candidates(value: str) -> tuple[str, ...]:
    unescaped = value.replace('\\"', '"').replace("\\'", "'")
    if unescaped == value:
        return (value,)
    return (value, unescaped)


class AccessTokenRequest(BaseModel):
    access_token: str = Field(min_length=1)

    @field_validator("access_token", mode="before")
    @classmethod
    def normalize_access_token(cls, value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("Access Token 必须是字符串")

        token = extract_access_token(value)
        if len(token) > MAX_ACCESS_TOKEN_LENGTH:
            raise ValueError(f"Access Token 不能超过 {MAX_ACCESS_TOKEN_LENGTH} 字符")
        return token
