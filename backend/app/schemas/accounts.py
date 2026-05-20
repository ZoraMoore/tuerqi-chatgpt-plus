from pydantic import BaseModel, Field, field_validator


class AccessTokenRequest(BaseModel):
    access_token: str = Field(min_length=1, max_length=50000)

    @field_validator("access_token")
    @classmethod
    def normalize_access_token(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Access Token 不能为空")
        return cleaned
