import type { SubscriptionItem } from "./types";
import { DEFAULT_LANGUAGE, translate, type Language } from "./i18n";

export interface SubscriptionDisplay {
  statusText: string;
  workspace: string;
  plan: string;
  expiresAt: string;
  platform: string;
  isActive: boolean;
}

export function toSubscriptionDisplay(item: SubscriptionItem, language: Language = DEFAULT_LANGUAGE): SubscriptionDisplay {
  const isActive = item.is_active === true;

  return {
    statusText: isActive ? translate(language, "activeSubscription") : translate(language, "inactiveSubscription"),
    workspace: normalizeText(item.account_name, translate(language, "unknown")),
    plan: normalizePlan(item.subscription_plan),
    expiresAt: formatDate(item.expires_at, language),
    platform: normalizePlatform(item.platform, language),
    isActive
  };
}

function normalizeText(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function normalizePlan(value: string | undefined): string {
  const normalized = value?.trim() ?? "";
  const lower = normalized.toLowerCase();

  if (lower.includes("team")) return "Team";
  if (lower.includes("plus")) return "Plus";
  if (lower.includes("free")) return "Free";
  return normalized || "Free";
}

function formatDate(value: string | undefined, language: Language): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) return translate(language, "unknown");

  const directDate = normalized.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (directDate) return directDate;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return translate(language, "unknown");
  return parsed.toISOString().slice(0, 10);
}

function normalizePlatform(value: string | undefined, language: Language): string {
  const normalized = value?.trim() ?? "";
  const lower = normalized.toLowerCase();

  if (["browser", "web", "openai"].includes(lower)) return translate(language, "browser");
  if (["ios", "android", "mobile", "phone"].includes(lower)) return translate(language, "mobile");
  return normalized || translate(language, "other");
}
