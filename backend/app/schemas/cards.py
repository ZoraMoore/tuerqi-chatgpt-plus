from pydantic import BaseModel, Field, field_validator


class BatchCardQueryRequest(BaseModel):
    card_keys: list[str] = Field(min_length=1, max_length=500)

    @field_validator("card_keys")
    @classmethod
    def validate_card_keys(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        for item in value:
            cleaned = item.strip()
            if not cleaned:
                raise ValueError("每条卡密或链接不能为空")
            if len(cleaned) > 500:
                raise ValueError("每条卡密或链接不能超过 500 字符")
            normalized.append(cleaned)
        return normalized


class ReplaceCardRequest(BaseModel):
    old_card_key: str = Field(min_length=1, max_length=100)

    @field_validator("old_card_key")
    @classmethod
    def normalize_old_card_key(cls, value: str) -> str:
        return value.strip().upper()
