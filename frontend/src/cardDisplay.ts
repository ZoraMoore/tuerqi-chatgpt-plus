import type { CardStatusResponse, ProductApiType } from "./types";
import { DEFAULT_LANGUAGE, translate, type Language } from "./i18n";

export interface CardStatusDisplay {
  statusText: string;
  accountText: string;
  productName: string;
  productText: string;
  stockText: string | null;
  tone: "ok" | "blocked";
}

export function toCardStatusDisplay(status: CardStatusResponse, language: Language = DEFAULT_LANGUAGE): CardStatusDisplay {
  const productName = normalizeProductType(status.product_api_type, language);
  return {
    statusText: normalizeCardStatus(status, language),
    accountText: normalizeText(status.used_email, translate(language, "notReturned")),
    productName,
    productText: translate(language, "productType", { product: productName }),
    stockText: normalizeStockText(status, language),
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

function normalizeProductType(value: ProductApiType | undefined, language: Language): string {
  const productType = value?.trim().toLowerCase();
  if (productType === "gpt") return translate(language, "productGpt");
  if (productType === "claude") return translate(language, "productClaude");
  return productType || translate(language, "unknown");
}

function normalizeStockText(status: CardStatusResponse, language: Language): string | null {
  if (status.stock_level) {
    return translate(language, "stockPrefix", { stock: status.stock_level });
  }
  if (status.product_api_type?.trim().toLowerCase() === "claude") {
    return null;
  }
  return translate(language, "stockUnknown");
}
