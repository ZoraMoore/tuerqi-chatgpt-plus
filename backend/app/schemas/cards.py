from typing import Any

from urllib.parse import parse_qs, urlparse







from pydantic import BaseModel, Field, field_validator











PUBLIC_RECHARGE_BASE_URL = "http://chatgpt.scienceedu.me/recharge"



PUBLIC_RECHARGE_HOST = "chatgpt.scienceedu.me"



UPSTREAM_RECHARGE_HOST = "987ai.vip"











def normalize_card_query_item(value: str) -> str:



    cleaned = value.strip()



    parsed, hostname = parse_recharge_value(cleaned)







    if hostname == UPSTREAM_RECHARGE_HOST:



        raise ValueError(f"禁止使用上游充值链接，请使用 {PUBLIC_RECHARGE_BASE_URL}?code=xxxx")







    if hostname == PUBLIC_RECHARGE_HOST:



        return extract_recharge_code(parsed)







    return cleaned.upper()











def to_public_recharge_link(value: str) -> str:



    cleaned = value.strip()



    parsed, hostname = parse_recharge_value(cleaned)



    if hostname in {PUBLIC_RECHARGE_HOST, UPSTREAM_RECHARGE_HOST}:



        code = extract_recharge_code(parsed)



    else:



        code = cleaned.upper()



    return f"{PUBLIC_RECHARGE_BASE_URL}?code={code}"











def parse_recharge_value(value: str) -> tuple[Any, str]:



    parsed = urlparse(value)



    hostname = parsed.hostname.lower() if parsed.hostname else ""



    return parsed, hostname











def extract_recharge_code(parsed: Any) -> str:



    code = parse_qs(parsed.query).get("code", [""])[0].strip()



    if not code:



        raise ValueError("充值链接缺少 code 参数")



    return code.upper()











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



            normalized.append(normalize_card_query_item(cleaned))



        return normalized











class ReplaceCardRequest(BaseModel):



    old_card_key: str = Field(min_length=1, max_length=100)







    @field_validator("old_card_key")



    @classmethod



    def normalize_old_card_key(cls, value: str) -> str:



        return value.strip().upper()

