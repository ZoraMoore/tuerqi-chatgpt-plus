import logging
import re
import sys

from pythonjsonlogger import jsonlogger

from app.core.config import settings


SENSITIVE_PATTERNS = [
    re.compile(r'("access_token"\s*:\s*")([^"]+)(")', re.IGNORECASE),
    re.compile(r'("token"\s*:\s*")([^"]+)(")', re.IGNORECASE),
    re.compile(r'("card_key"\s*:\s*")([^"]+)(")', re.IGNORECASE),
    re.compile(r'("old_card_key"\s*:\s*")([^"]+)(")', re.IGNORECASE),
]


def mask_sensitive_text(text: str) -> str:
    masked = text
    for pattern in SENSITIVE_PATTERNS:
        masked = pattern.sub(r"\1***\3", masked)
    return masked


class SensitiveDataFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = mask_sensitive_text(record.msg)
        if record.args:
            record.args = tuple(
                mask_sensitive_text(arg) if isinstance(arg, str) else arg
                for arg in record.args
            )
        return True


def configure_logging() -> None:
    root_logger = logging.getLogger()
    if getattr(configure_logging, "_configured", False):
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(SensitiveDataFilter())
    handler.setFormatter(
        jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    )

    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(settings.log_level.upper())
    setattr(configure_logging, "_configured", True)
