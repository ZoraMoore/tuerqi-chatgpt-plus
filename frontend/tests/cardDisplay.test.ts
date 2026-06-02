import { toCardStatusDisplay } from "../src/cardDisplay.js";
import { api } from "../src/lib/api.js";


function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}


const usedCard = toCardStatusDisplay({
  available: false,
  error: "卡密已被使用",
  product_api_type: "gpt",
  stock_level: "high",
  used_email: "alimoeini20001578@gmail.com"
});

assertEqual(usedCard.statusText, "卡密已使用", "used card status");
assertEqual(usedCard.accountText, "alimoeini20001578@gmail.com", "used card account");
assertEqual(usedCard.stockText, "库存：high", "used card stock");
assertEqual(usedCard.productText, "产品类型：ChatGPT", "used card product");
assertEqual(usedCard.tone, "blocked", "used card tone");

const usedCardEn = toCardStatusDisplay({
  available: false,
  error: "卡密已被使用",
  product_api_type: "gpt",
  stock_level: "high",
  used_email: "alimoeini20001578@gmail.com"
}, "en");

assertEqual(usedCardEn.statusText, "Card key used", "english used card status");
assertEqual(usedCardEn.accountText, "alimoeini20001578@gmail.com", "english used card account");
assertEqual(usedCardEn.stockText, "Stock: high", "english used card stock");
assertEqual(usedCardEn.productText, "Product: ChatGPT", "english used card product");

const availableCard = toCardStatusDisplay({
  available: true,
  stock_level: "low"
});

assertEqual(availableCard.statusText, "卡密可用", "available card status");
assertEqual(availableCard.accountText, "未返回", "available card account fallback");
assertEqual(availableCard.stockText, "库存：low", "available card stock");
assertEqual(availableCard.productText, "产品类型：未知", "available card product fallback");
assertEqual(availableCard.tone, "ok", "available card tone");

const availableCardEn = toCardStatusDisplay({
  available: true,
  stock_level: "low"
}, "en");

assertEqual(availableCardEn.statusText, "Card key available", "english available card status");
assertEqual(availableCardEn.accountText, "Not returned", "english available card account fallback");
assertEqual(availableCardEn.stockText, "Stock: low", "english available card stock");

const claudeCard = toCardStatusDisplay({
  available: true,
  product_api_type: "claude",
  stock_level: ""
});

assertEqual(claudeCard.productText, "产品类型：Claude", "claude product");
assertEqual(claudeCard.stockText, null, "claude empty stock is hidden");

const claudeCardEn = toCardStatusDisplay({
  available: true,
  product_api_type: "claude"
}, "en");

assertEqual(claudeCardEn.productText, "Product: Claude", "english claude product");
assertEqual(claudeCardEn.stockText, null, "english claude empty stock is hidden");

void api.createTask<{ success: boolean }>({
  card_key: "CLAUDE123",
  org_id: "a1b2c3d4-1234-1234-1234-123456789abc"
});
