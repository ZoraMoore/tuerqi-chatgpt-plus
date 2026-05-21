import { toSubscriptionDisplay } from "../src/subscriptionDisplay.js";


function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}


const team = toSubscriptionDisplay({
  is_active: true,
  account_name: "Aixiaowu",
  subscription_plan: "Team",
  expires_at: "2026-05-23T00:00:00Z",
  platform: "browser"
});

assertEqual(team.statusText, "在有效期内", "active team status");
assertEqual(team.workspace, "Aixiaowu", "team workspace");
assertEqual(team.plan, "Team", "team plan");
assertEqual(team.expiresAt, "2026-05-23", "team expires date");
assertEqual(team.platform, "浏览器端", "team platform");

const teamEn = toSubscriptionDisplay({
  is_active: true,
  account_name: "Aixiaowu",
  subscription_plan: "Team",
  expires_at: "2026-05-23T00:00:00Z",
  platform: "browser"
}, "en");

assertEqual(teamEn.statusText, "Active", "english active team status");
assertEqual(teamEn.workspace, "Aixiaowu", "english team workspace");
assertEqual(teamEn.expiresAt, "2026-05-23", "english team expires date");
assertEqual(teamEn.platform, "Browser", "english team platform");

const plus = toSubscriptionDisplay({
  is_active: true,
  account_name: "",
  subscription_plan: "ChatGPT Plus",
  expires_at: "2026-06-05",
  platform: "web"
});

assertEqual(plus.workspace, "未知", "plus workspace fallback");
assertEqual(plus.plan, "Plus", "plus plan");
assertEqual(plus.expiresAt, "2026-06-05", "plus expires date");

const free = toSubscriptionDisplay({
  is_active: false,
  account_name: "",
  subscription_plan: "Free",
  expires_at: "",
  platform: "ios"
});

assertEqual(free.statusText, "已失效", "free status");
assertEqual(free.plan, "Free", "free plan");
assertEqual(free.expiresAt, "未知", "free expires fallback");
assertEqual(free.platform, "手机端", "free platform");

const freeEn = toSubscriptionDisplay({
  is_active: false,
  account_name: "",
  subscription_plan: "Free",
  expires_at: "",
  platform: "ios"
}, "en");

assertEqual(freeEn.statusText, "Expired", "english free status");
assertEqual(freeEn.expiresAt, "Unknown", "english free expires fallback");
assertEqual(freeEn.platform, "Mobile", "english free platform");
