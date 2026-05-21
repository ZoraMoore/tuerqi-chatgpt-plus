import type { CardStatusResponse } from "./types";
import { DEFAULT_LANGUAGE, translate, type Language } from "./i18n";

export interface CardStatusDisplay {
  statusText: string;
  accountText: string;
  stockText: string;
  tone: "ok" | "blocked";
}

export function toCardStatusDisplay(status: CardStatusResponse, language: Language = DEFAULT_LANGUAGE): CardStatusDisplay {
  return {
    statusText: normalizeCardStatus(status, language),
    accountText: normalizeText(status.used_email, translate(language, "notReturned")),
    stockText: status.stock_level ? translate(language, "stockPrefix", { stock: status.stock_level }) : translate(language, "stockUnknown"),
    tone: status.available ? "ok" : "blocked"
  };
}

function normalizeCardStatus(status: CardStatusResponse, language: Language): string {
  if (status.available) return translate(language, "cardAvailable");

  const error = status.error?.trim();
  if (!error) return translate(language, "cardUnavailable");
  if (error.includes("已被使用") || error.includes("已使用")) return translate(language, "cardUsed");
  if (error.includes("不存在")) return translate(language, "cardNotFound");
  if (error.includes("停用")) return translate(language, "cardDisabled");
  return error;
}

function normalizeText(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}
