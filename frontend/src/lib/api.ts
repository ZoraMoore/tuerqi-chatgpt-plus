import type { CreateTaskPayload } from "../types";

const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new ApiError(extractErrorMessage(data), response.status, data);
  }
  return data as T;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function extractErrorMessage(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const detail = record.detail;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
    if (detail && typeof detail === "object") {
      const detailRecord = detail as Record<string, unknown>;
      if (typeof detailRecord.message === "string") return detailRecord.message;
      if (typeof detailRecord.error === "string") return detailRecord.error;
    }
  }
  return "请求失败，请稍后重试";
}

export const api = {
  getCardStatus: <T>(cardCode: string) => request<T>(`/cards/${encodeURIComponent(cardCode)}`),
  batchQueryCards: <T>(cardKeys: string[]) =>
    request<T>("/cards/batch-query", {
      method: "POST",
      body: JSON.stringify({ card_keys: cardKeys })
    }),
  replaceCard: <T>(oldCardKey: string) =>
    request<T>("/cards/replace", {
      method: "POST",
      body: JSON.stringify({ old_card_key: oldCardKey })
    }),
  parseToken: <T>(accessToken: string) =>
    request<T>("/accounts/parse-token", {
      method: "POST",
      body: JSON.stringify({ access_token: accessToken })
    }),
  checkAccount: <T>(accessToken: string) =>
    request<T>("/accounts/check", {
      method: "POST",
      body: JSON.stringify({ access_token: accessToken })
    }),
  createTask: <T>(payload: CreateTaskPayload) =>
    request<T>("/tasks", { method: "POST", body: JSON.stringify(payload) }),
  getTaskStatus: <T>(taskId: string) => request<T>(`/tasks/${taskId}`),
  cancelTask: <T>(taskId: string) => request<T>(`/tasks/${taskId}`, { method: "DELETE" })
};
