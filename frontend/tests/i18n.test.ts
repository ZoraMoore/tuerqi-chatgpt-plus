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
