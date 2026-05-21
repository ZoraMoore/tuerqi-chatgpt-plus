import { FormEvent, useEffect, useMemo, useState } from "react";

import { api, ApiError } from "./lib/api";
import { toCardStatusDisplay } from "./cardDisplay";
import { DEFAULT_LANGUAGE, normalizeLanguage, translate, type Language, type TranslationKey } from "./i18n";
import { toSubscriptionDisplay } from "./subscriptionDisplay";
import type {
  CardStatusResponse,
  CheckAccountResponse,
  SubscriptionItem,
  TaskCreateResponse,
  TaskStatusResponse
} from "./types";

type PageKey = "home" | "recharge" | "query" | "batch" | "check-account" | "replace-card";
type NoticeTone = "info" | "success" | "warning" | "danger";
type TranslationValues = Record<string, string | number>;
type Translator = (key: TranslationKey, values?: TranslationValues) => string;

const LANGUAGE_STORAGE_KEY = "self-service-language";

const pages: Array<{ key: PageKey; labelKey: TranslationKey; descriptionKey: TranslationKey }> = [
  { key: "recharge", labelKey: "navRecharge", descriptionKey: "descRecharge" },
  { key: "query", labelKey: "navQuery", descriptionKey: "descQuery" },
  { key: "batch", labelKey: "navBatch", descriptionKey: "descBatch" },
  { key: "check-account", labelKey: "navCheckAccount", descriptionKey: "descCheckAccount" },
  { key: "replace-card", labelKey: "navReplaceCard", descriptionKey: "descReplaceCard" }
];

function readInitialLanguage(): Language {
  try {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function pageFromPath(pathname: string): PageKey {
  const key = pathname.replace(/^\//, "") as PageKey;
  return pages.some((page) => page.key === key) ? key : "home";
}

export function App() {
  const [page, setPage] = useState<PageKey>(() => pageFromPath(window.location.pathname));
  const [language, setLanguage] = useState<Language>(readInitialLanguage);
  const t: Translator = (key, values) => translate(language, key, values);

  useEffect(() => {
    const onPopState = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(nextPage: PageKey) {
    const path = nextPage === "home" ? "/" : `/${nextPage}`;
    window.history.pushState({}, "", path);
    setPage(nextPage);
  }

  function toggleLanguage() {
    setLanguage((current) => {
      const next = current === "zh" ? "en" : "zh";
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      } catch {
        // localStorage 可能被隐私模式禁用，界面仍可在当前会话切换语言。
      }
      return next;
    });
  }

  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("home")} type="button">
          <span className="brand-mark">{t("brandMark")}</span>
          <span>{t("appName")}</span>
        </button>
        <div className="topbar-actions">
          <nav className="nav" aria-label={t("mainNavigation")}>
            {pages.map((item) => (
              <button
                className={page === item.key ? "nav-link active" : "nav-link"}
                key={item.key}
                onClick={() => navigate(item.key)}
                type="button"
              >
                {t(item.labelKey)}
              </button>
            ))}
          </nav>
          <button className="language-toggle" onClick={toggleLanguage} type="button">
            {t("languageToggle")}
          </button>
        </div>
      </header>

      <main className="main">
        {page === "home" && <HomePage onNavigate={navigate} t={t} />}
        {page === "recharge" && <RechargePage language={language} t={t} />}
        {page === "query" && <CardQueryPage t={t} />}
        {page === "batch" && <BatchRechargePage t={t} />}
        {page === "check-account" && <CheckAccountPage language={language} t={t} />}
        {page === "replace-card" && <ReplaceCardPage t={t} />}
      </main>

      <footer className="footer">{t("footer")}</footer>
    </div>
  );
}

function HomePage({ onNavigate, t }: { onNavigate: (page: PageKey) => void; t: Translator }) {
  return (
    <section className="hero-grid">
      <div className="hero-card">
        <p className="eyebrow">{t("privateSelfService")}</p>
        <h1>{t("heroTitleTop")}
          <br />
          {t("heroTitleBottom")}</h1>
        <p className="hero-copy">
          {t("heroCopyPrefix")}<a href="https://api.scienceedu.me/" target="_blank" rel="noopener noreferrer">https://api.scienceedu.me/</a>
        </p>
        <div className="hero-actions">
          <button className="primary-button" onClick={() => onNavigate("recharge")} type="button">
            {t("startService")}
          </button>
          <button className="ghost-button" onClick={() => onNavigate("query")} type="button">
            {t("queryCards")}
          </button>
        </div>
      </div>
      <div className="service-grid">
        {pages.map((item) => (
          <button className="service-card" key={item.key} onClick={() => onNavigate(item.key)} type="button">
            <span>{t(item.labelKey)}</span>
            <small>{t(item.descriptionKey)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function RechargePage({ language, t }: { language: Language; t: Translator }) {
  const [cardKey, setCardKey] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [forceRecharge, setForceRecharge] = useState(false);
  const [cardStatus, setCardStatus] = useState<CardStatusResponse | null>(null);
  const [taskId, setTaskId] = useState("");
  const [taskStatus, setTaskStatus] = useState<TaskStatusResponse | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    let active = true;
    const poll = async () => {
      try {
        const result = await api.getTaskStatus<TaskStatusResponse>(taskId);
        if (!active) return;
        setTaskStatus(result);
        if (["completed", "failed", "unknown"].includes(result.status)) {
          return;
        }
        window.setTimeout(poll, 3000);
      } catch (error) {
        if (active) setNotice({ tone: "danger", text: getErrorText(error, t) });
      }
    };
    poll();
    return () => {
      active = false;
    };
  }, [taskId]);

  async function verifyCard(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    setCardStatus(null);
    try {
      const result = await api.getCardStatus<CardStatusResponse>(cardKey);
      const display = toCardStatusDisplay(result, language);
      setCardStatus(result);
      setNotice({
        tone: result.available ? "success" : "warning",
        text: result.available ? t("cardVerifySuccess") : display.statusText
      });
    } catch (error) {
      setNotice({ tone: "danger", text: getErrorText(error, t) });
    } finally {
      setBusy(false);
    }
  }

  async function createTask(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const result = await api.createTask<TaskCreateResponse>({
        card_key: cardKey,
        access_token: accessToken,
        idp: "",
        force_recharge: forceRecharge
      });
      if (!result.success || !result.task_id) {
        setNotice({ tone: "danger", text: result.error ?? t("createTaskFailed") });
        return;
      }
      setTaskId(result.task_id);
      setNotice({ tone: "success", text: t("taskCreated") });
    } catch (error) {
      setNotice({ tone: "danger", text: getErrorText(error, t) });
    } finally {
      setBusy(false);
    }
  }

  async function cancelTask() {
    if (!taskId) return;
    setBusy(true);
    try {
      await api.cancelTask(taskId);
      setNotice({ tone: "success", text: t("cancelQueueSuccess") });
      setTaskStatus(null);
      setTaskId("");
    } catch (error) {
      setNotice({ tone: "danger", text: getErrorText(error, t) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageFrame title={t("rechargeTitle")} subtitle={t("rechargeSubtitle")} t={t}>
      <form className="panel" onSubmit={verifyCard}>
        <StepLabel index="01" title={t("verifyCardStep")} />
        <label className="field-label" htmlFor="card-key">{t("cardKey")}</label>
        <input id="card-key" required value={cardKey} onChange={(event) => setCardKey(event.target.value)} placeholder={t("cardKeyPlaceholder")} />
        <button className="primary-button" disabled={busy || !cardKey.trim()} type="submit">{t("verifyCard")}</button>
        {cardStatus && <CardStatusPanel language={language} status={cardStatus} t={t} />}
      </form>

      <form className="panel" onSubmit={createTask}>
        <StepLabel index="02" title={t("submitTokenStep")} />
        <label className="field-label" htmlFor="access-token">{t("accessTokenLabel")}</label>
        <textarea
          id="access-token"
          required
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
          placeholder={t("accessTokenPlaceholder")}
        />
        <label className="checkbox-row">
          <input checked={forceRecharge} onChange={(event) => setForceRecharge(event.target.checked)} type="checkbox" />
          {t("forceRecharge")}
        </label>
        <button className="primary-button" disabled={busy || !cardKey.trim() || !accessToken.trim()} type="submit">{t("confirmRecharge")}</button>
      </form>

      {taskStatus && (
        <div className="panel status-panel">
          <StepLabel index="03" title={t("taskStatus")} />
          <StatusRows taskStatus={taskStatus} t={t} />
          {taskStatus.status === "pending" && (
            <button className="ghost-button" disabled={busy} onClick={cancelTask} type="button">{t("cancelQueue")}</button>
          )}
        </div>
      )}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    </PageFrame>
  );
}

function CardQueryPage({ t }: { t: Translator }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const cardKeys = useMemo(() => input.split(/\r?\n/).map((item) => item.trim()).filter(Boolean), [input]);

  async function queryCards(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    try {
      const data = await api.batchQueryCards(cardKeys);
      setResult(data);
      setNotice({ tone: "success", text: t("queryCompleteCount", { count: cardKeys.length }) });
    } catch (error) {
      setNotice({ tone: "danger", text: getErrorText(error, t) });
    }
  }

  return (
    <PageFrame title={t("cardQueryTitle")} subtitle={t("cardQuerySubtitle")} t={t}>
      <form className="panel" onSubmit={queryCards}>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={t("cardQueryPlaceholder")} />
        <div className="button-row">
          <button className="primary-button" disabled={cardKeys.length === 0} type="submit">{t("startQuery")}</button>
          <button className="ghost-button" onClick={() => setInput("")} type="button">{t("clear")}</button>
        </div>
      </form>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {result !== null && <JsonPreview value={result} />}
    </PageFrame>
  );
}

function BatchRechargePage({ t }: { t: Translator }) {
  return (
    <PageFrame title={t("batchTitle")} subtitle={t("batchSubtitle")} t={t}>
      <div className="panel">
        <StepLabel index="BETA" title={t("inputFormat")} />
        <p className="muted">{t("batchHint")}</p>
        <textarea placeholder="ABCD1234----eyJhbGciOi..." />
        <button className="primary-button" type="button">{t("parseList")}</button>
      </div>
      <Notice tone="info">{t("batchFormatNotice")}</Notice>
    </PageFrame>
  );
}

function CheckAccountPage({ language, t }: { language: Language; t: Translator }) {
  const [accessToken, setAccessToken] = useState("");
  const [result, setResult] = useState<CheckAccountResponse | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const subscriptions = result?.subscriptions ?? [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice(null);
    setResult(null);
    try {
      const data = await api.checkAccount<CheckAccountResponse>(accessToken);
      setResult(data);
      if (!data.success) {
        setNotice({ tone: "warning", text: data.message ?? t("noSubscriptionInfo") });
      }
    } catch (error) {
      setNotice({ tone: "danger", text: getErrorText(error, t) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageFrame title={t("checkAccountTitle")} subtitle={t("checkAccountSubtitle")} t={t}>
      <form className="panel" onSubmit={submit}>
        <textarea required value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder={t("checkAccountPlaceholder")} />
        <button className="primary-button" disabled={busy || !accessToken.trim()} type="submit">
          {busy ? t("querying") : t("submitQuery")}
        </button>
      </form>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {result?.success && <SubscriptionSummary count={subscriptions.length} t={t} />}
      {result?.success && subscriptions.length === 0 && <Notice tone="warning">{t("queryNoSubscriptions")}</Notice>}
      {subscriptions.length > 0 && (
        <div className="subscription-list">
          {subscriptions.map((item, index) => (
            <SubscriptionCard item={item} index={index} key={`${item.account_name}-${item.subscription_plan}-${item.expires_at}-${index}`} language={language} t={t} />
          ))}
        </div>
      )}
    </PageFrame>
  );
}

function SubscriptionSummary({ count, t }: { count: number; t: Translator }) {
  return (
    <div className="subscription-summary" aria-live="polite">
      <span className="summary-mark">OK</span>
      <div>
        <strong>{t("querySuccess")}</strong>
        <small>{t("subscriptionsFound", { count })}</small>
      </div>
    </div>
  );
}

function SubscriptionCard({ item, index, language, t }: { item: SubscriptionItem; index: number; language: Language; t: Translator }) {
  const display = toSubscriptionDisplay(item, language);

  return (
    <article className={display.isActive ? "subscription-card active" : "subscription-card inactive"}>
      <div className="subscription-card-head">
        <div>
          <span className="subscription-status">{display.statusText}</span>
          <strong>{display.workspace}</strong>
        </div>
        <span className="subscription-index">{t("subscriptionIndex", { index: index + 1 })}</span>
      </div>
      <div className="subscription-fields">
        <SubscriptionField label={t("workspace")} value={display.workspace} />
        <SubscriptionField label={t("subscriptionProduct")} value={display.plan} highlight />
        <SubscriptionField label={t("expiresAt")} value={display.expiresAt} />
        <SubscriptionField label={t("platform")} value={display.platform} />
      </div>
    </article>
  );
}

function SubscriptionField({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="subscription-field">
      <span>{label}</span>
      <strong className={highlight ? "field-pill" : undefined}>{value}</strong>
    </div>
  );
}

function ReplaceCardPage({ t }: { t: Translator }) {
  const [oldCardKey, setOldCardKey] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    try {
      const data = await api.replaceCard(oldCardKey);
      setResult(data);
      setNotice({ tone: "success", text: t("replaceSuccess") });
    } catch (error) {
      setNotice({ tone: "danger", text: getErrorText(error, t) });
    }
  }

  return (
    <PageFrame title={t("replaceTitle")} subtitle={t("replaceSubtitle")} t={t}>
      <Notice tone="warning">{t("replaceWarning")}</Notice>
      <form className="panel" onSubmit={submit}>
        <label className="field-label" htmlFor="old-card-key">{t("oldCardKey")}</label>
        <input id="old-card-key" required value={oldCardKey} onChange={(event) => setOldCardKey(event.target.value)} placeholder={t("oldCardKeyPlaceholder")} />
        <button className="primary-button" disabled={!oldCardKey.trim()} type="submit">{t("confirmReplace")}</button>
      </form>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {result !== null && <JsonPreview value={result} />}
    </PageFrame>
  );
}

function PageFrame({ title, subtitle, t, children }: { title: string; subtitle: string; t: Translator; children: React.ReactNode }) {
  return (
    <section className="page-frame">
      <div className="page-heading">
        <p className="eyebrow">{t("workflow")}</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="stack">{children}</div>
    </section>
  );
}

function StepLabel({ index, title }: { index: string; title: string }) {
  return (
    <div className="step-label">
      <span>{index}</span>
      <strong>{title}</strong>
    </div>
  );
}

function Notice({ tone, children }: { tone: NoticeTone; children: React.ReactNode }) {
  return <div className={`notice ${tone}`}>{children}</div>;
}

function JsonPreview({ value }: { value: unknown }) {
  return <pre className="json-preview">{JSON.stringify(value, null, 2)}</pre>;
}

function CardStatusPanel({ status, language, t }: { status: CardStatusResponse; language: Language; t: Translator }) {
  const display = toCardStatusDisplay(status, language);

  return (
    <div className={`card-status-panel ${display.tone}`}>
      <div className="card-status-head">
        <span>{t("cardStatus")}</span>
        <strong>{display.statusText}</strong>
      </div>
      <div className="card-status-rows">
        <CardStatusField highlight={Boolean(status.used_email?.trim())} label={t("rechargeAccount")} value={display.accountText} />
        <CardStatusField label={t("stockStatus")} value={display.stockText} />
      </div>
    </div>
  );
}

function CardStatusField({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="card-status-field">
      <span>{label}</span>
      <strong className={highlight ? "account-highlight" : undefined}>{value}</strong>
    </div>
  );
}

function StatusRows({ taskStatus, t }: { taskStatus: TaskStatusResponse; t: Translator }) {
  return (
    <div className="status-rows">
      <span>{t("statusLabel", { status: taskStatus.status })}</span>
      <span>{t("queuePosition", { position: taskStatus.queue_position ?? 0 })}</span>
      {taskStatus.result && <span>{t("resultLabel", { result: taskStatus.result })}</span>}
      {taskStatus.error && <span>{t("errorLabel", { error: taskStatus.error })}</span>}
    </div>
  );
}

function getErrorText(error: unknown, t: Translator): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return t("requestFailed");
}
