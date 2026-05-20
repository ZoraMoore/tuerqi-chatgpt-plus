import { FormEvent, useEffect, useMemo, useState } from "react";

import { api, ApiError } from "./lib/api";
import type {
  CardStatusResponse,
  CheckAccountResponse,
  TaskCreateResponse,
  TaskStatusResponse
} from "./types";

type PageKey = "home" | "recharge" | "query" | "batch" | "check-account" | "replace-card";
type NoticeTone = "info" | "success" | "warning" | "danger";

const pages: Array<{ key: PageKey; label: string; description: string }> = [
  { key: "recharge", label: "开始服务", description: "验证卡密并提交充值任务" },
  { key: "query", label: "卡密查询", description: "批量查询卡密状态和使用信息" },
  { key: "batch", label: "批量充值", description: "按行提交卡密与充值密钥" },
  { key: "check-account", label: "查询订阅信息", description: "查询 ChatGPT 账号订阅状态" },
  { key: "replace-card", label: "自助换卡", description: "旧卡密自动替换为新卡密" }
];

function pageFromPath(pathname: string): PageKey {
  const key = pathname.replace(/^\//, "") as PageKey;
  return pages.some((page) => page.key === key) ? key : "home";
}

export function App() {
  const [page, setPage] = useState<PageKey>(() => pageFromPath(window.location.pathname));

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

  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("home")} type="button">
          <span className="brand-mark">S</span>
          <span>自助服务系统</span>
        </button>
        <nav className="nav" aria-label="主导航">
          {pages.map((item) => (
            <button
              className={page === item.key ? "nav-link active" : "nav-link"}
              key={item.key}
              onClick={() => navigate(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {page === "home" && <HomePage onNavigate={navigate} />}
        {page === "recharge" && <RechargePage />}
        {page === "query" && <CardQueryPage />}
        {page === "batch" && <BatchRechargePage />}
        {page === "check-account" && <CheckAccountPage />}
        {page === "replace-card" && <ReplaceCardPage />}
      </main>

      <footer className="footer">提交敏感信息前请确认域名无误。Token 与卡密默认不在浏览器持久化保存。</footer>
    </div>
  );
}

function HomePage({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  return (
    <section className="hero-grid">
      <div className="hero-card">
        <p className="eyebrow">PRIVATE SELF-SERVICE</p>
        <h1>构建你自己的自助充值入口</h1>
        <p className="hero-copy">
          前端只负责清晰引导，所有上游接口由 FastAPI 代理处理，便于统一校验、限流、脱敏和记录任务状态。
        </p>
        <div className="hero-actions">
          <button className="primary-button" onClick={() => onNavigate("recharge")} type="button">
            开始服务
          </button>
          <button className="ghost-button" onClick={() => onNavigate("query")} type="button">
            查询卡密
          </button>
        </div>
      </div>
      <div className="service-grid">
        {pages.map((item) => (
          <button className="service-card" key={item.key} onClick={() => onNavigate(item.key)} type="button">
            <span>{item.label}</span>
            <small>{item.description}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function RechargePage() {
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
        if (active) setNotice({ tone: "danger", text: getErrorText(error) });
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
      setCardStatus(result);
      setNotice({
        tone: result.available ? "success" : "warning",
        text: result.available ? "卡密验证成功，请继续输入充值密钥。" : result.error ?? "卡密不可用"
      });
    } catch (error) {
      setNotice({ tone: "danger", text: getErrorText(error) });
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
        setNotice({ tone: "danger", text: result.error ?? "创建任务失败" });
        return;
      }
      setTaskId(result.task_id);
      setNotice({ tone: "success", text: "任务已创建，系统将自动轮询状态。" });
    } catch (error) {
      setNotice({ tone: "danger", text: getErrorText(error) });
    } finally {
      setBusy(false);
    }
  }

  async function cancelTask() {
    if (!taskId) return;
    setBusy(true);
    try {
      await api.cancelTask(taskId);
      setNotice({ tone: "success", text: "已取消排队任务，可重新提交。" });
      setTaskStatus(null);
      setTaskId("");
    } catch (error) {
      setNotice({ tone: "danger", text: getErrorText(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageFrame title="账号充值" subtitle="验证卡密、确认账号、提交任务并自动轮询状态。">
      <form className="panel" onSubmit={verifyCard}>
        <StepLabel index="01" title="验证卡密" />
        <label className="field-label" htmlFor="card-key">卡密</label>
        <input id="card-key" required value={cardKey} onChange={(event) => setCardKey(event.target.value)} placeholder="请输入卡密" />
        <button className="primary-button" disabled={busy || !cardKey.trim()} type="submit">验证卡密</button>
        {cardStatus && <StockBadge stockLevel={cardStatus.stock_level} available={cardStatus.available} />}
      </form>

      <form className="panel" onSubmit={createTask}>
        <StepLabel index="02" title="提交充值密钥" />
        <label className="field-label" htmlFor="access-token">Access Token 或 app_user_id</label>
        <textarea
          id="access-token"
          required
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
          placeholder="请粘贴完整充值密钥"
        />
        <label className="checkbox-row">
          <input checked={forceRecharge} onChange={(event) => setForceRecharge(event.target.checked)} type="checkbox" />
          覆盖充值，忽略账号类型校验
        </label>
        <button className="primary-button" disabled={busy || !cardKey.trim() || !accessToken.trim()} type="submit">确认充值</button>
      </form>

      {taskStatus && (
        <div className="panel status-panel">
          <StepLabel index="03" title="任务状态" />
          <StatusRows taskStatus={taskStatus} />
          {taskStatus.status === "pending" && (
            <button className="ghost-button" disabled={busy} onClick={cancelTask} type="button">取消排队</button>
          )}
        </div>
      )}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    </PageFrame>
  );
}

function CardQueryPage() {
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
      setNotice({ tone: "success", text: `查询完成，共提交 ${cardKeys.length} 条。` });
    } catch (error) {
      setNotice({ tone: "danger", text: getErrorText(error) });
    }
  }

  return (
    <PageFrame title="卡密查询" subtitle="支持原始卡密、充值链接、混合文本，一行一条。">
      <form className="panel" onSubmit={queryCards}>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="ABCD1234\nhttps://example.com/recharge?code=EFGH5678" />
        <div className="button-row">
          <button className="primary-button" disabled={cardKeys.length === 0} type="submit">开始查询</button>
          <button className="ghost-button" onClick={() => setInput("")} type="button">清空</button>
        </div>
      </form>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {result !== null && <JsonPreview value={result} />}
    </PageFrame>
  );
}

function BatchRechargePage() {
  return (
    <PageFrame title="批量充值" subtitle="第一版提供受控骨架，后续接入队列和并发控制。">
      <div className="panel">
        <StepLabel index="BETA" title="输入格式" />
        <p className="muted">每行一条：卡密----Token。建议并发保持 1-3，避免触发上游限流。</p>
        <textarea placeholder="ABCD1234----eyJhbGciOi..." />
        <button className="primary-button" type="button">解析列表</button>
      </div>
      <Notice tone="info">批量队列、去重检测和结果表格将在后续任务中完善。</Notice>
    </PageFrame>
  );
}

function CheckAccountPage() {
  const [accessToken, setAccessToken] = useState("");
  const [result, setResult] = useState<CheckAccountResponse | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    try {
      const data = await api.checkAccount<CheckAccountResponse>(accessToken);
      setResult(data);
      setNotice({ tone: data.success ? "success" : "warning", text: data.message ?? "查询完成" });
    } catch (error) {
      setNotice({ tone: "danger", text: getErrorText(error) });
    }
  }

  return (
    <PageFrame title="查询订阅信息" subtitle="输入 Access Token 查询账号订阅状态。">
      <form className="panel" onSubmit={submit}>
        <textarea required value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder='支持完整 JSON、键值对或纯 Token' />
        <button className="primary-button" disabled={!accessToken.trim()} type="submit">提交查询</button>
      </form>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {result?.subscriptions?.map((item) => (
        <div className="panel status-panel" key={`${item.account_name}-${item.expires_at}`}>
          <strong>{item.account_name}</strong>
          <span>{item.subscription_plan}</span>
          <span>{item.is_active ? "有效" : "无效"}</span>
          <span>{item.expires_at}</span>
        </div>
      ))}
    </PageFrame>
  );
}

function ReplaceCardPage() {
  const [oldCardKey, setOldCardKey] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    try {
      const data = await api.replaceCard(oldCardKey);
      setResult(data);
      setNotice({ tone: "success", text: "换卡请求已提交，请妥善保存新卡密。" });
    } catch (error) {
      setNotice({ tone: "danger", text: getErrorText(error) });
    }
  }

  return (
    <PageFrame title="自助换卡" subtitle="提交旧卡密，系统自动请求上游生成新卡密。">
      <Notice tone="warning">换卡不可撤销，旧卡密会立即停用，且旧卡密不能存在进行中的充值任务。</Notice>
      <form className="panel" onSubmit={submit}>
        <label className="field-label" htmlFor="old-card-key">旧卡密</label>
        <input id="old-card-key" required value={oldCardKey} onChange={(event) => setOldCardKey(event.target.value)} placeholder="请输入需要替换的旧卡密" />
        <button className="primary-button" disabled={!oldCardKey.trim()} type="submit">确认换卡</button>
      </form>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {result !== null && <JsonPreview value={result} />}
    </PageFrame>
  );
}

function PageFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="page-frame">
      <div className="page-heading">
        <p className="eyebrow">WORKFLOW</p>
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

function StockBadge({ stockLevel, available }: { stockLevel?: string; available: boolean }) {
  const text = stockLevel ? `库存：${stockLevel}` : "库存未公开";
  return <div className={available ? "stock-badge ok" : "stock-badge blocked"}>{text}</div>;
}

function StatusRows({ taskStatus }: { taskStatus: TaskStatusResponse }) {
  return (
    <div className="status-rows">
      <span>状态：{taskStatus.status}</span>
      <span>排队位置：{taskStatus.queue_position ?? 0}</span>
      {taskStatus.result && <span>结果：{taskStatus.result}</span>}
      {taskStatus.error && <span>错误：{taskStatus.error}</span>}
    </div>
  );
}

function getErrorText(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return "请求失败，请稍后重试";
}
