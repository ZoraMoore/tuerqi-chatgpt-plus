import re
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends

from app.schemas.tasks import BatchTasksRequest, CreateTaskRequest
from app.services.upstream_client import UpstreamClient, get_upstream_client


router = APIRouter()
TASK_ID_PATTERN = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)


@router.post("")
async def create_task(
    payload: CreateTaskRequest,
    upstream: UpstreamClient = Depends(get_upstream_client),
) -> Any:
    request_body = payload.model_dump(exclude_none=True)
    if request_body.get("org_id"):
        request_body = {
            "card_key": request_body["card_key"],
            "org_id": request_body["org_id"],
        }
    return await upstream.request(
        "POST",
        "/api/tasks",
        request_body,
    )


@router.post("/batch")
async def batch_query_tasks(
    payload: BatchTasksRequest,
    upstream: UpstreamClient = Depends(get_upstream_client),
) -> Any:
    task_ids = [str(task_id) for task_id in payload.task_ids]
    return await upstream.request("POST", "/api/tasks/batch", {"task_ids": task_ids})


@router.get("/{task_id}")
async def get_task_status(
    task_id: UUID,
    upstream: UpstreamClient = Depends(get_upstream_client),
) -> Any:
    return await upstream.request("GET", f"/api/tasks/{task_id}")


@router.delete("/{task_id}")
async def cancel_task(
    task_id: UUID,
    upstream: UpstreamClient = Depends(get_upstream_client),
) -> Any:
    return await upstream.request("DELETE", f"/api/tasks/{task_id}")


def extract_task_id(message: str) -> str | None:
    match = TASK_ID_PATTERN.search(message)
    return match.group(0) if match else None
