from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.accounts import MAX_ACCESS_TOKEN_LENGTH, extract_access_token


class CreateTaskRequest(BaseModel):
    card_key: str = Field(min_length=1, max_length=100)
    access_token: str = Field(min_length=1, max_length=MAX_ACCESS_TOKEN_LENGTH)
    idp: str = Field(default="", max_length=80)
    force_recharge: bool = False

    @field_validator("card_key")
    @classmethod
    def normalize_card_key(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("access_token", mode="before")
    @classmethod
    def normalize_access_token(cls, value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("Access Token 必须是字符串")
        return extract_access_token(value)


class BatchTasksRequest(BaseModel):
    task_ids: list[UUID] = Field(min_length=1, max_length=50)
