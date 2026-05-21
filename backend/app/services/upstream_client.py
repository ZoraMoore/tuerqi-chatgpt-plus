import asyncio
import json
import shutil
import subprocess
from collections.abc import AsyncIterator
from typing import Any
from urllib.parse import urljoin

from fastapi import HTTPException

from app.core.config import settings


HTTP_STATUS_MARKER = "__HTTP_STATUS__:"


def build_upstream_headers() -> dict[str, str]:
    # 上游 API 对脚本型请求较敏感，需保持与原站前端一致的 JSON 浏览器请求特征。
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Origin": "https://987ai.vip",
        "Referer": "https://987ai.vip/",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
    }


def build_curl_args(
    curl_binary: str,
    method: str,
    url: str,
    json_body: dict[str, Any] | None = None,
) -> list[str]:
    args = [
        curl_binary,
        "--silent",
        "--show-error",
        "--location",
        "--max-time",
        str(settings.request_timeout_seconds),
        "--request",
        method.upper(),
        "--write-out",
        f"\n{HTTP_STATUS_MARKER}%{{http_code}}",
    ]

    for key, value in build_upstream_headers().items():
        args.extend(["-H", f"{key}: {value}"])

    if json_body is not None:
        args.extend(["--data-binary", "@-"])

    args.append(url)
    return args


def find_curl_binary() -> str:
    curl_binary = shutil.which("curl.exe") or shutil.which("curl")
    if not curl_binary:
        raise HTTPException(status_code=500, detail={"message": "服务器缺少 curl 运行环境"})
    return curl_binary


def build_stdin_payload(json_body: dict[str, Any]) -> str:
    return json.dumps(json_body, ensure_ascii=False)


def run_curl(args: list[str], stdin_payload: str | None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        input=stdin_payload,
        capture_output=True,
        check=False,
        encoding="utf-8",
        errors="ignore",
    )


class UpstreamClient:
    def __init__(self) -> None:
        self._base_url = settings.upstream_base_url.rstrip("/") + "/"
        self._curl_binary = find_curl_binary()

    async def close(self) -> None:
        return None

    async def request(
        self,
        method: str,
        path: str,
        json_body: dict[str, Any] | None = None,
    ) -> Any:
        url = urljoin(self._base_url, path.lstrip("/"))
        args = build_curl_args(self._curl_binary, method, url, json_body)
        stdin_payload = None
        if json_body is not None:
            stdin_payload = build_stdin_payload(json_body)
        try:
            process = await asyncio.to_thread(run_curl, args, stdin_payload)
        except OSError as exc:
            raise HTTPException(status_code=502, detail={"message": "上游请求执行失败"}) from exc

        if process.returncode != 0:
            message = process.stderr or "上游服务暂不可用"
            raise HTTPException(status_code=502, detail={"message": message.strip()})

        body, status_code = self._split_curl_output(process.stdout)
        data = self._parse_response_text(body)
        if status_code >= 400:
            raise HTTPException(status_code=status_code, detail=data)
        return data

    @staticmethod
    def _split_curl_output(output: str) -> tuple[str, int]:
        body, marker, status_text = output.rpartition(HTTP_STATUS_MARKER)
        if not marker:
            raise HTTPException(status_code=502, detail={"message": "上游响应格式异常"})
        try:
            status_code = int(status_text.strip())
        except ValueError as exc:
            raise HTTPException(status_code=502, detail={"message": "上游状态码异常"}) from exc
        return body.rstrip("\r\n"), status_code

    @staticmethod
    def _parse_response_text(text: str) -> Any:
        if not text:
            return {}
        try:
            return json.loads(text)
        except ValueError:
            if "cloudflare" in text.lower() or "just a moment" in text.lower():
                return {"message": "上游 API 触发 Cloudflare 验证，请稍后重试"}
            return {"message": text}


async def get_upstream_client() -> AsyncIterator[UpstreamClient]:
    client = UpstreamClient()
    try:
        yield client
    finally:
        await client.close()
