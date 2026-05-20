from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class CreateTaskRequest(BaseModel):
    card_key: str = Field(min_length=1, max_length=100)
    access_token: str = Field(min_length=1, max_length=50000)
    idp: str = Field(default="", max_length=80)
    force_recharge: bool = False

    @field_validator("card_key")
    @classmethod
    def normalize_card_key(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("access_token")
    @classmethod
    def normalize_access_token(cls, value: str) -> str:
        return value.strip()


class BatchTasksRequest(BaseModel):
    task_ids: list[UUID] = Field(min_length=1, max_length=50)
