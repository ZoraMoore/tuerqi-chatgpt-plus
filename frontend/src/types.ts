export type TaskStatus = "pending" | "processing" | "completed" | "failed" | "unknown";
export type ProductApiType = "gpt" | "claude" | string;

export interface CardStatusResponse {
  available: boolean;
  error?: string;
  stock_level?: string;
  product_api_type?: ProductApiType;
  used_email?: string;
}

export type CreateTaskPayload =
  | {
      card_key: string;
      access_token: string;
      idp?: string;
      force_recharge?: boolean;
    }
  | {
      card_key: string;
      org_id: string;
    };

export interface TaskCreateResponse {
  success: boolean;
  task_id?: string;
  error?: string;
}

export interface TaskStatusResponse {
  status: TaskStatus;
  result: string;
  error: string;
  queue_position?: number;
}

export interface SubscriptionItem {
  is_active?: boolean;
  account_name?: string;
  subscription_plan?: string;
  expires_at?: string;
  platform?: string;
}

export interface CheckAccountResponse {
  success: boolean;
  message?: string;
  subscriptions?: SubscriptionItem[];
}
