from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.accounts import MAX_ACCESS_TOKEN_LENGTH, extract_access_token


class CreateTaskRequest(BaseModel):
    card_key: str = Field(min_length=1, max_length=100)
    access_token: str | None = Field(default=None, max_length=MAX_ACCESS_TOKEN_LENGTH)
    org_id: str | None = Field(default=None, max_length=80)
    idp: str = Field(default="", max_length=80)
    force_recharge: bool = False

    @field_validator("card_key")
    @classmethod
    def normalize_card_key(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("access_token", mode="before")
    @classmethod
    def normalize_access_token(cls, value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("Access Token 必须是字符串")
        return extract_access_token(value)

    @field_validator("org_id")
    @classmethod
    def normalize_org_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        UUID(cleaned)
        return cleaned

    @model_validator(mode="after")
    def validate_task_credentials(self) -> "CreateTaskRequest":
        if self.org_id:
            self.access_token = None
            return self
        if not self.access_token:
            raise ValueError("请提供 access_token 或 Claude 用户 ID")
        return self


class BatchTasksRequest(BaseModel):
    task_ids: list[UUID] = Field(min_length=1, max_length=50)
