def mask_value(value: str, visible_start: int = 4, visible_end: int = 4) -> str:
    if not value:
        return ""
    if len(value) <= visible_start + visible_end:
        return "***"
    return f"{value[:visible_start]}***{value[-visible_end:]}"


def mask_email(value: str) -> str:
    if "@" not in value:
        return mask_value(value)
    name, domain = value.split("@", 1)
    return f"{mask_value(name, 2, 1)}@{domain}"
