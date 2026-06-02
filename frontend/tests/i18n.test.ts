import { normalizeLanguage, translate } from "../src/i18n.js";


function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}


assertEqual(normalizeLanguage("zh"), "zh", "zh language is accepted");
assertEqual(normalizeLanguage("en"), "en", "en language is accepted");
assertEqual(normalizeLanguage("fr"), "zh", "unsupported language falls back to zh");
assertEqual(translate("zh", "navRecharge"), "开始服务", "zh nav recharge");
assertEqual(translate("en", "navRecharge"), "Start Service", "en nav recharge");
assertEqual(translate("en", "submitQuery"), "Submit Query", "en submit query");
assertEqual(translate("zh", "rechargeModeGpt"), "GPT", "zh gpt recharge mode");
assertEqual(translate("zh", "rechargeModeClaude"), "Claude", "zh claude recharge mode");
assertEqual(translate("zh", "claudeUserIdLabel"), "Claude 用户 ID", "zh claude user id label");
assertEqual(translate("en", "claudeUserIdLabel"), "Claude User ID", "en claude user id label");
assertEqual(
  translate("zh", "claudeUuidError"),
  "Claude 用户 ID 必须是标准 UUID 格式",
  "zh claude uuid error"
);
assertEqual(translate("en", "productClaude"), "Claude", "en claude product");
