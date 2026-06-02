# 自助服务系统技术 PRD

版本：v0.1  
日期：2026-05-23  
状态：MVP 技术 PRD 草案  
适用范围：当前仓库前端、后端、Docker 编排与上游 API 对接

## 1. 文档概述

### 1.1 项目名称

自助服务系统 / Self-Service System

### 1.2 项目定位

本项目是一个面向 GPT 与 Claude 充值相关服务的自助服务系统。系统基于上游 `https://api.987ai.vip` 用户端 API 封装，提供 React/Vite 前端页面与 FastAPI 后端代理层，并通过 Docker Compose 编排 PostgreSQL 与 Redis 作为后续持久化、限流、队列能力的基础设施。

当前仓库定位更接近“可运行 MVP 骨架”：核心用户流程已经具备，生产级安全、限流、持久化、批量充值与完整测试仍需补齐。

### 1.3 文档目标

本文档用于沉淀当前项目的产品功能、技术架构、接口契约、数据设计、非功能要求、风险与后续里程碑，帮助后续研发、测试、部署和产品迭代对齐。

### 1.4 主要代码依据

- 项目说明：`README.md`
- 前端入口与页面：`frontend/src/App.tsx`、`frontend/src/main.tsx`
- 前端 API 客户端：`frontend/src/lib/api.ts`
- 前端类型与展示转换：`frontend/src/types.ts`、`frontend/src/cardDisplay.ts`、`frontend/src/subscriptionDisplay.ts`
- 后端入口与路由：`backend/app/main.py`、`backend/app/api/router.py`
- 后端业务路由：`backend/app/api/routes/cards.py`、`backend/app/api/routes/accounts.py`、`backend/app/api/routes/tasks.py`
- 后端请求模型：`backend/app/schemas/*.py`
- 上游请求客户端：`backend/app/services/upstream_client.py`
- 配置与编排：`.env.example`、`docker-compose.yml`
- 上游接口文档：`用户端API文档.txt`

## 2. 当前范围与版本状态

### 2.1 已实现范围

| 模块 | 当前状态 | 说明 |
|---|---|---|
| 首页导航 | 已实现 | 通过前端状态和 History API 实现轻量页面切换 |
| 自助充值 | 已实现 MVP | GPT/Claude 卡密验证、按产品类型提交任务、轮询状态、取消排队任务 |
| 卡密查询 | 已实现 MVP | 多行卡密或本站充值链接批量查询 |
| 查询订阅信息 | 已实现 MVP | 输入 Access Token 查询订阅状态 |
| 自助换卡 | 已实现 MVP | 输入旧卡密，请求上游生成新卡密 |
| 批量充值 | 页面占位 | 当前仅保留 BETA UI，未接入真实逻辑 |
| 中英文切换 | 已实现 | 支持 `zh/en`，偏好写入 localStorage |
| 后端代理 | 已实现 MVP | FastAPI 代理到上游 API |
| PostgreSQL | 占位 | 已有 SQLAlchemy engine 与 `RechargeTask` 模型，路由未使用 |
| Redis | 占位 | 已在配置和 Compose 中声明，业务未使用 |
| 自动化测试 | 部分覆盖 | 覆盖展示转换、Token 提取、上游请求构造、卡密链接转换等 |

### 2.2 暂不在当前已完成范围内

1. 生产级用户登录、权限控制、角色管理或后台管理。
2. 本地任务持久化、任务历史查询、审计日志。
3. Redis 限流、缓存、队列、分布式锁。
4. 批量充值的真实解析、并发提交、暂停/继续、结果导出。
5. 严格响应模型与统一错误响应契约。
6. 完整 E2E 测试、接口集成测试、可访问性测试。
7. 支付订单、财务对账、库存管理后台。

## 3. 目标用户与核心场景

### 3.1 目标用户

| 用户类型 | 核心诉求 |
|---|---|
| 普通充值用户 | 使用 GPT 卡密与 Access Token/app_user_id，或 Claude 卡密与 Claude 用户 ID 自助发起充值 |
| 卡密持有用户 | 查询卡密是否可用、是否已使用、是否停用 |
| 订阅查询用户 | 查询 ChatGPT 账号当前订阅状态 |
| 换卡用户 | 在符合条件时用旧卡密换取新卡密 |
| 运维/维护者 | 部署系统、代理上游 API、后续接入限流、日志和审计 |

### 3.2 核心用户旅程

#### A. 自助充值

1. 用户打开首页。
2. 点击“开始服务”进入账号充值页。
3. 输入卡密并点击“验证卡密”。
4. 前端调用本地后端 `GET /api/v1/cards/{card_code}`。
5. 后端规范化卡密并代理到上游 `GET /api/card-keys/:cardCode`。
6. 若卡密可用，前端根据 `product_api_type` 自动切换 GPT/Claude 表单，用户也可手动切换充值产品。
7. GPT 流程输入 Access Token 或 app_user_id，可选择是否启用 `force_recharge`。
8. Claude 流程输入从 `claude.ai/settings/account` 获取的标准 UUID 用户 ID。
9. 前端调用 `POST /api/v1/tasks` 创建充值任务：GPT 提交 `{ card_key, access_token, idp, force_recharge }`，Claude 提交 `{ card_key, org_id }`。
10. 成功后前端保存 `task_id`，每 3 秒轮询任务状态。
11. 当状态为 `completed`、`failed` 或 `unknown` 时停止轮询。
12. 当任务为 `pending` 时，用户可以取消排队。

#### B. 卡密批量查询

1. 用户进入“卡密查询”。
2. 在 textarea 中一行一条输入卡密或本站充值链接。
3. 前端按换行拆分、trim 并过滤空行。
4. 后端校验单次数量、单条长度和链接来源。
5. 后端调用上游 `POST /api/card-keys/batch-query`。
6. 后端将响应中的上游充值链接改写为本站 public link。
7. 前端展示查询成功提示和 JSON 结果。

#### C. 查询订阅信息

1. 用户进入“查询订阅信息”。
2. 输入 Access Token，可为纯 token、JSON 字符串或键值片段。
3. 后端提取 `accessToken` 或 `access_token`。
4. 后端调用上游 `POST /api/check-account`。
5. 前端展示工作区、订阅产品、到期日期、开通渠道和状态。

#### D. 自助换卡

1. 用户进入“自助换卡”。
2. 页面展示换卡不可撤销提示。
3. 用户输入旧卡密并提交。
4. 后端去除首尾空格并转大写。
5. 后端调用上游 `POST /api/card-keys/replace`。
6. 前端展示成功提示和上游返回结果。

## 4. 产品功能需求

### 4.1 首页与导航

#### 当前实现

前端通过 `PageKey`、`pageFromPath()`、`window.history.pushState()` 和 `popstate` 监听实现单页应用内导航，不依赖 React Router。

#### 功能需求

| 编号 | 功能 | 要求 |
|---|---|---|
| FR-H-001 | 首页展示 | 展示系统名称、购买入口、核心服务卡片 |
| FR-H-002 | 顶部导航 | 提供账号充值、卡密查询、批量充值、订阅查询、自助换卡入口 |
| FR-H-003 | URL 映射 | 支持 `/recharge`、`/query`、`/batch`、`/check-account`、`/replace-card` |
| FR-H-004 | 浏览器历史 | 支持前进/后退恢复页面 |
| FR-H-005 | 默认回退 | 未识别路径回退到首页 |

#### 验收标准

1. 访问 `/` 展示首页。
2. 点击顶部导航可进入对应页面。
3. 浏览器前进/后退可同步页面状态。
4. 刷新已知路径后能展示对应页面。
5. 未知路径不报错，回落到首页。

### 4.2 自助充值

#### 功能需求

| 编号 | 功能 | 要求 |
|---|---|---|
| FR-R-001 | 卡密输入 | 用户必须输入非空卡密 |
| FR-R-002 | 卡密验证 | 调用后端卡密状态接口，展示可用性、产品类型、库存、绑定账号信息 |
| FR-R-003 | GPT 输入 | GPT 流程支持 Access Token 或 UUID 格式 app_user_id |
| FR-R-004 | Claude 输入 | Claude 流程支持标准 UUID 格式 Claude 用户 ID |
| FR-R-005 | 产品切换 | 卡密验证后按 `product_api_type` 自动切换 GPT/Claude，且允许用户手动切换 |
| FR-R-006 | 强制充值 | GPT 流程支持 `force_recharge`，用于忽略账号类型校验；Claude 流程隐藏该选项 |
| FR-R-007 | 创建任务 | 调用后端创建充值任务接口，成功返回 `task_id` |
| FR-R-008 | 状态轮询 | 根据 `task_id` 每 3 秒查询一次任务状态 |
| FR-R-009 | 取消排队 | pending 状态下允许取消任务 |
| FR-R-010 | 状态展示 | 展示状态、队列位置、结果和错误信息 |
| FR-R-011 | 错误提示 | 网络错误、上游错误和校验错误应有用户可读提示 |

#### 任务状态

| 状态 | 含义 | 前端行为 |
|---|---|---|
| `pending` | 排队等待中 | 展示队列位置，可取消 |
| `processing` | 处理中 | 继续轮询 |
| `completed` | 已完成 | 停止轮询，展示结果 |
| `failed` | 失败 | 停止轮询，展示错误 |
| `unknown` | 任务不存在 | 停止轮询，展示未知状态 |

#### 验收标准

1. 卡密为空时“验证卡密”按钮不可提交或提交被拦截。
2. GPT 模式下 Access Token 为空时“确认充值”按钮不可提交。
3. Claude 模式下 Claude 用户 ID 为空时“确认充值”按钮不可提交，非 UUID 时展示明确错误。
4. 卡密验证成功后展示成功提示，并根据产品类型自动选中 GPT 或 Claude。
5. 用户可以通过页面切换按钮手动选择 GPT 或 Claude。
6. 卡密不可用时展示原因，例如已使用、不存在、已停用。
7. 创建任务成功后开始自动轮询。
8. pending 状态展示取消按钮。
9. completed/failed/unknown 状态停止轮询。
10. 取消排队成功后清空当前任务状态。

### 4.3 卡密查询

#### 功能需求

| 编号 | 功能 | 要求 |
|---|---|---|
| FR-C-001 | 多行输入 | 一行一条卡密或本站充值链接 |
| FR-C-002 | 空行过滤 | 前端过滤空行后提交 |
| FR-C-003 | 批量上限 | 后端单次最多 500 条 |
| FR-C-004 | 单条长度 | 后端限制每条不超过 500 字符 |
| FR-C-005 | 本站链接解析 | 支持 `http://chatgpt.scienceedu.me/recharge?code=...` |
| FR-C-006 | 上游链接拒绝 | 禁止直接提交 `https://987ai.vip/recharge?...` |
| FR-C-007 | 响应链接改写 | 将返回结果中的 link/card_key 改写为本站 public link |
| FR-C-008 | 结果展示 | 当前以 JSON 预览展示 |

#### 验收标准

1. 输入为空时查询按钮禁用。
2. 输入本站充值链接时能提取 `code` 并提交给上游。
3. 输入上游充值链接时后端拒绝并返回明确提示。
4. 查询成功后展示本次提交条数。
5. 返回结果中的 `link` 和 `card_key` 当前均为本站 public link。

### 4.4 查询订阅信息

#### 功能需求

| 编号 | 功能 | 要求 |
|---|---|---|
| FR-A-001 | Token 输入 | 支持纯 token、JSON、键值片段 |
| FR-A-002 | Token 提取 | 后端从 `accessToken` 或 `access_token` 提取实际 token |
| FR-A-003 | 长度限制 | token 最大 50000 字符 |
| FR-A-004 | 订阅查询 | 调用上游 `/api/check-account` |
| FR-A-005 | 结果摘要 | 展示查询成功和订阅数量 |
| FR-A-006 | 订阅卡片 | 展示工作区、产品、到期日期、开通渠道和状态 |
| FR-A-007 | 空结果提示 | success=true 但 subscriptions 为空时展示提示 |

#### 展示规则

| 字段 | 规则 |
|---|---|
| `subscription_plan` | 包含 team/plus/free 时归一化为 Team/Plus/Free |
| `expires_at` | 优先提取 `YYYY-MM-DD`，否则尝试 Date 解析 |
| `platform` | browser/web/openai 显示为浏览器端，ios/android/mobile/phone 显示为手机端 |
| `is_active` | true 显示有效，其他显示已失效 |

#### 验收标准

1. 输入为空时不可提交。
2. 查询过程中按钮显示“查询中”。
3. 查询失败时展示 warning 或 danger 提示。
4. 查询成功且存在订阅时展示卡片列表。
5. 查询成功但无订阅时展示“未返回订阅记录”。
6. 日期展示为 `YYYY-MM-DD` 或“未知”。

### 4.5 自助换卡

#### 功能需求

| 编号 | 功能 | 要求 |
|---|---|---|
| FR-X-001 | 旧卡密输入 | 必填 |
| FR-X-002 | 风险提示 | 页面提示换卡不可撤销 |
| FR-X-003 | 卡密规范化 | 后端去空格并转大写 |
| FR-X-004 | 换卡请求 | 调用上游 `/api/card-keys/replace` |
| FR-X-005 | 成功提示 | 提示用户妥善保存新卡密 |
| FR-X-006 | 结果展示 | 当前以 JSON 预览展示 |

#### 验收标准

1. 旧卡密为空时不可提交。
2. 页面明确展示换卡不可撤销。
3. 成功后提示保存新卡密。
4. 上游返回失败时展示错误信息。

### 4.6 批量充值

#### 当前状态

批量充值页面当前仅为 BETA 占位，仅包含输入格式说明、textarea 和“解析列表”按钮，未实现解析、任务提交、并发控制、轮询和结果管理。

#### 建议目标需求

| 编号 | 功能 | 要求 |
|---|---|---|
| FR-B-001 | 批量输入解析 | 支持 `卡密----Token`，一行一条 |
| FR-B-002 | 行级校验 | 卡密和 Token 均不能为空，错误显示行号 |
| FR-B-003 | 并发控制 | 默认并发 1，最大建议 3 |
| FR-B-004 | 逐条提交 | 每条调用创建任务接口 |
| FR-B-005 | 状态查询 | 支持批量查询任务状态或逐条轮询 |
| FR-B-006 | 暂停继续 | 支持批量提交过程暂停/继续 |
| FR-B-007 | 取消排队 | 对 pending 任务支持取消 |
| FR-B-008 | 失败重试 | 对网络错误或可重试失败支持手动重试 |
| FR-B-009 | 结果导出 | 支持复制或导出成功/失败明细 |
| FR-B-010 | 限流保护 | 前后端均限制提交速度，避免触发上游限流 |

#### 验收标准

1. 点击解析后展示总行数、有效行数、无效行数。
2. 无效行不提交，并展示行号和原因。
3. 并发数不能超过系统配置上限。
4. 每条任务展示卡密摘要、task_id、status、result/error。
5. 支持复制失败列表用于重试。
6. 页面刷新或关闭前对未完成任务给出提示。

### 4.7 国际化

#### 当前实现

前端内置 `zh/en` 字典，默认中文。语言偏好写入 `localStorage`，若 localStorage 不可用则仅影响持久化，不影响当前会话切换。

#### 功能需求

| 编号 | 功能 | 要求 |
|---|---|---|
| FR-I18N-001 | 默认中文 | 首次访问使用中文 |
| FR-I18N-002 | 语言切换 | 支持中文和英文切换 |
| FR-I18N-003 | 偏好持久化 | 使用 localStorage 记录语言 |
| FR-I18N-004 | 容错 | localStorage 不可用时不阻塞 UI |
| FR-I18N-005 | 可访问性 | 后续应同步更新 `document.documentElement.lang` |

## 5. 后端 API 需求

### 5.1 本地 API 与上游 API 映射

| 本地接口 | 上游接口 | 说明 |
|---|---|---|
| `GET /api/v1/cards/{card_code}` | `GET /api/card-keys/:cardCode` | 查询卡密状态 |
| `POST /api/v1/cards/batch-query` | `POST /api/card-keys/batch-query` | 批量查询卡密 |
| `POST /api/v1/cards/replace` | `POST /api/card-keys/replace` | 旧卡密换新卡密 |
| `POST /api/v1/accounts/parse-token` | `POST /api/parse-token` | 解析 token，当前前端未使用 |
| `POST /api/v1/accounts/check` | `POST /api/check-account` | 查询账号订阅 |
| `POST /api/v1/tasks` | `POST /api/tasks` | 创建充值任务 |
| `POST /api/v1/tasks/batch` | `POST /api/tasks/batch` | 批量查询任务状态，当前前端未使用 |
| `GET /api/v1/tasks/{task_id}` | `GET /api/tasks/:taskId` | 查询单个任务状态 |
| `DELETE /api/v1/tasks/{task_id}` | `DELETE /api/tasks/:taskId` | 取消排队任务 |

### 5.2 请求模型

| 模型 | 字段 | 校验/转换规则 |
|---|---|---|
| `AccessTokenRequest` | `access_token` | 必须为字符串，非空，最大 50000；支持 JSON/片段提取 |
| `BatchCardQueryRequest` | `card_keys` | 1-500 条；每条非空且不超过 500 字符；支持本站链接解析 |
| `ReplaceCardRequest` | `old_card_key` | 非空，最大 100；去空格并转大写 |
| `CreateTaskRequest` | `card_key` | 非空，最大 100；去空格并转大写 |
| `CreateTaskRequest` | `access_token` | GPT 流程必填，最大 50000；支持 JSON/片段提取 |
| `CreateTaskRequest` | `org_id` | Claude 流程必填，必须为标准 UUID；转发上游时只保留 `card_key` 与 `org_id` |
| `CreateTaskRequest` | `idp` | 可为空，最大 80 |
| `CreateTaskRequest` | `force_recharge` | 布尔值，默认 false；仅 GPT 流程转发 |
| `BatchTasksRequest` | `task_ids` | UUID 列表，1-50 条 |

### 5.3 响应模型要求

当前后端路由多以 `Any` 返回并透传上游响应。后续建议补充明确 response model：

1. `CardStatusResponse`
2. `TaskCreateResponse`
3. `TaskStatusResponse`
4. `BatchTaskStatusResponse`
5. `BatchCardQueryResponse`
6. `CheckAccountResponse`
7. `ReplaceCardResponse`
8. `ErrorResponse`

目标：

- 稳定前后端契约。
- 提升 OpenAPI 文档准确性。
- 避免上游字段变更直接破坏前端。
- 统一错误格式和敏感字段脱敏策略。

### 5.4 错误响应要求

建议统一为：

```json
{
  "success": false,
  "error": "USER_READABLE_CODE_OR_MESSAGE",
  "message": "用户可读提示",
  "request_id": "可选请求 ID"
}
```

后续不应直接把上游原始 HTML、Cloudflare 页面、stderr 或可能包含敏感信息的错误原文返回给浏览器。

## 6. 技术架构

### 6.1 总体架构

```text
用户浏览器
  |
  | React/Vite SPA
  | /api/v1/*
  v
FastAPI 后端代理
  |
  | curl 子进程模拟浏览器 JSON 请求
  v
上游 api.987ai.vip

旁路/预留：
PostgreSQL -> RechargeTask 模型占位
Redis      -> 限流/队列/缓存占位
```

### 6.2 前端架构

| 层级 | 当前实现 |
|---|---|
| UI 框架 | React |
| 语言 | TypeScript |
| 构建工具 | Vite |
| 样式 | 原生 CSS |
| 页面管理 | 单文件 App + PageKey 状态 |
| API 客户端 | `fetch` 封装，统一 `ApiError` |
| 国际化 | 本地字典 `i18n.ts` |
| 展示转换 | `cardDisplay.ts`、`subscriptionDisplay.ts` |

### 6.3 后端架构

| 层级 | 当前实现 |
|---|---|
| Web 框架 | FastAPI |
| ASGI 服务 | Uvicorn |
| 配置 | pydantic-settings，环境变量前缀 `SELF_SERVICE_` |
| 上游调用 | `curl` 子进程 + stdin body |
| 请求校验 | Pydantic v2 |
| 安全响应头 | 自定义 `SecurityHeadersMiddleware` |
| 日志 | `python-json-logger` + 敏感字段过滤 |
| 数据库预留 | SQLAlchemy async engine + PostgreSQL |
| Redis 预留 | Redis URL 配置，当前未使用 |

### 6.4 部署架构

本地 Docker Compose 包含：

| 服务 | 端口 | 说明 |
|---|---:|---|
| backend | 8000 | FastAPI，开发模式 reload |
| frontend | 5173 | Vite dev server |
| postgres | 5432 | PostgreSQL 16 Alpine |
| redis | 6379 | Redis 7 Alpine |

### 6.5 上游调用设计

后端当前使用 `curl` 调用上游 API，设计特征：

1. 构造浏览器风格请求头：`Origin`、`Referer`、`User-Agent`。
2. 使用参数列表而非 shell 字符串，降低命令注入风险。
3. JSON body 通过 stdin 传递，避免 Access Token 出现在进程命令行参数中。
4. 通过 `--write-out` 追加 HTTP 状态码 marker 并解析。
5. 非 JSON 响应会包装为 `{ "message": text }`。
6. Cloudflare 页面会转为用户可读提示。

## 7. 安全与合规需求

### 7.1 已有安全措施

| 安全项 | 当前实现 |
|---|---|
| 浏览器不直连上游 | 前端只请求本地 `/api/v1` |
| CORS | 默认允许 `http://localhost:5173` |
| 安全响应头 | `nosniff`、`DENY`、`no-referrer`、权限策略 |
| 日志脱敏 | 对 `access_token`、`token`、`card_key`、`old_card_key` 做部分正则脱敏 |
| 请求校验 | Pydantic 类型、长度、UUID 校验 |
| curl 调用安全 | 参数列表 + stdin body，不使用 shell 拼接 |

### 7.2 必须补齐的安全需求

| 编号 | 需求 | 优先级 | 说明 |
|---|---|---|---|
| SEC-001 | 后端限流 | P0 | 不能只依赖上游限流，避免代理被滥用 |
| SEC-002 | 敏感字段响应脱敏 | P0 | Access Token、卡密、邮箱、stderr 不应原样返回 |
| SEC-003 | 生产配置校验 | P0 | 禁止生产环境使用默认数据库密码和 debug 配置 |
| SEC-004 | CORS 白名单 | P0 | 生产环境必须配置明确域名 |
| SEC-005 | 文档访问控制 | P1 | debug=false 时关闭 docs；如需开放需鉴权 |
| SEC-006 | 上游错误包装 | P1 | 统一包装 4xx/5xx/非 JSON/Cloudflare 响应 |
| SEC-007 | 前端结果脱敏 | P1 | JSON 预览避免展示完整邮箱、token、卡密 |
| SEC-008 | 审计日志 | P2 | 记录请求摘要、状态、耗时，不记录原始敏感值 |

### 7.3 当前主要风险

1. 后端没有自己的鉴权、API Key 或限流。
2. 业务响应基本透传上游，存在契约不稳定与敏感字段泄漏风险。
3. 前端 `JsonPreview` 直接展示完整响应。
4. 日志脱敏只覆盖部分 JSON 字符串模式。
5. `.env.example` 的默认数据库账号密码仅适合本地开发。
6. `curl` stderr 可能包含未脱敏错误信息并返回客户端。

## 8. 数据与持久化需求

### 8.1 当前状态

当前已存在 SQLAlchemy async engine、PostgreSQL 连接配置和 `RechargeTask` 模型，但后端路由没有实际使用数据库。Redis 已在配置和 Docker Compose 中声明，但业务代码未使用。

### 8.2 当前 `RechargeTask` 模型字段

| 字段 | 含义 |
|---|---|
| `id` | 本地任务 UUID 主键 |
| `upstream_task_id` | 上游任务 ID，可空 |
| `card_key_masked` | 脱敏卡密 |
| `account_masked` | 脱敏账号 |
| `status` | 任务状态，默认 pending |
| `result` | 任务结果文本 |
| `error` | 错误文本 |
| `created_at` | 创建时间 |
| `updated_at` | 更新时间 |

### 8.3 后续数据需求

| 编号 | 需求 | 说明 |
|---|---|---|
| DATA-001 | 任务创建落库 | 创建任务时记录本地任务与上游任务映射 |
| DATA-002 | 状态同步 | 每次轮询或回调时更新本地状态 |
| DATA-003 | 历史查询 | 支持按时间、状态、卡密摘要查询 |
| DATA-004 | Redis 限流 | 按 IP + endpoint 做滑动窗口或令牌桶 |
| DATA-005 | Redis 队列 | 批量充值削峰，控制并发 |
| DATA-006 | 迁移体系 | 引入 Alembic 或等价工具管理 schema |
| DATA-007 | 数据保留策略 | 明确任务历史、审计日志保留周期 |

## 9. 非功能需求

### 9.1 性能

| 指标 | 目标 |
|---|---|
| 普通代理接口响应 | 受上游影响，目标 P95 < 3s |
| 创建任务超时 | 不超过 `SELF_SERVICE_REQUEST_TIMEOUT_SECONDS` |
| 任务轮询间隔 | 默认 3 秒 |
| 批量卡密查询 | 单次最多 500 条 |
| 批量任务查询 | 单次最多 50 个 UUID |
| 批量充值并发 | 建议默认 1，最大 3 |

### 9.2 可用性

1. 后端提供 `/health` 健康检查。
2. 上游异常时返回用户可读错误。
3. 上游触发 Cloudflare 验证时提示稍后重试。
4. 前端所有请求失败都应展示明确提示。
5. 后续生产环境应区分前端、后端、数据库、Redis 健康状态。

### 9.3 可维护性

1. 前端 API 调用集中在 `src/lib/api.ts`。
2. 前端展示转换逻辑独立在 `cardDisplay.ts` 与 `subscriptionDisplay.ts`。
3. 后端路由按 cards/accounts/tasks 拆分。
4. 后续应拆出 response model、service 层、repository 层、限流中间件。
5. 应清理或忽略构建产物，例如 `tsconfig.tsbuildinfo`、派生的 Vite 配置产物。

### 9.4 可观测性

后续应补充：

- request_id / trace_id。
- 上游请求耗时。
- 上游状态码。
- endpoint 级成功率、失败率、限流命中次数。
- 任务状态分布。
- Cloudflare/非 JSON 响应计数。
- 敏感字段脱敏测试与日志采样检查。

## 10. 测试需求

### 10.1 当前测试覆盖

| 端 | 测试文件 | 覆盖点 |
|---|---|---|
| 前端 | `frontend/tests/cardDisplay.test.ts` | 卡密状态展示归一化 |
| 前端 | `frontend/tests/subscriptionDisplay.test.ts` | 订阅展示归一化 |
| 前端 | `frontend/tests/i18n.test.ts` | 语言归一化与翻译 |
| 后端 | `backend/tests/test_upstream_client.py` | 上游请求头、curl 参数、stdin payload |
| 后端 | `backend/tests/test_account_schema.py` | Access Token 提取与长度校验 |
| 后端 | `backend/tests/test_card_query_links.py` | 充值链接解析与返回链接改写 |

### 10.2 测试缺口

| 优先级 | 缺口 |
|---|---|
| P0 | 前端 `test:display` 当前主要做 TypeScript 类型检查，手写断言未真正执行 |
| P0 | 后端缺少 FastAPI 路由级测试 |
| P0 | 缺少上游 4xx/5xx/非 JSON/超时/curl 不存在测试 |
| P1 | 缺少安全响应头、CORS、日志脱敏测试 |
| P1 | 缺少任务创建-轮询-取消集成测试 |
| P1 | 缺少批量输入边界测试 |
| P2 | 缺少 E2E、可访问性、浏览器兼容性测试 |

### 10.3 建议测试验收

1. 前端引入 Vitest 或等价 runner，真正执行断言。
2. 后端增加 `TestClient` 或 `httpx.AsyncClient` 路由测试。
3. 使用 fake upstream 覆盖所有接口成功/失败路径。
4. 对敏感字段脱敏做回归测试。
5. 对批量充值解析器先做单元测试，再实现提交逻辑。

## 11. 里程碑规划

### M0：MVP 稳定化

目标：让现有单用户自助流程稳定可用。

- 修正前端测试脚本，使断言真正执行。
- 增加后端路由级测试。
- 统一错误响应结构。
- 前端隐藏或脱敏 JSON 预览中的敏感字段。
- 补充 README 中生产部署注意事项。

### M1：生产安全底座

目标：避免代理层被滥用。

- Redis 限流。
- request_id 日志链路。
- 统一敏感字段脱敏。
- 生产 CORS 配置校验。
- 默认密码与 debug 配置安全检查。
- 上游错误统一包装。

### M2：任务持久化

目标：支持任务历史与更稳定的任务状态管理。

- 引入 Alembic 或等价迁移体系。
- 创建和更新 `RechargeTask`。
- 同步上游状态到本地。
- 提供任务历史查询接口。
- 支持后台补偿轮询或定时同步。

### M3：批量充值正式版

目标：实现批量提交、并发控制和结果管理。

- 前端解析 `卡密----Token`。
- 后端批量任务创建 API。
- Redis 队列或并发控制。
- 结果导出。
- 失败重试与暂停/继续。
- 防重复提交。

## 12. 风险清单

| 风险 | 等级 | 说明 | 建议 |
|---|---|---|---|
| 无本地限流 | 高 | 被刷接口会把压力转发给上游 | 优先接 Redis 限流 |
| 上游响应透传 | 高 | 字段变化或敏感字段泄漏会影响前端 | 增加 response model 和脱敏 |
| 批量充值未实现 | 中 | 页面存在但功能不可用 | 标注 BETA 或尽快补齐 |
| curl 子进程依赖 | 中 | 性能、环境、可观测性弱 | 短期保留，长期评估 httpx |
| DB/Redis 未使用 | 中 | 编排复杂但价值未体现 | 明确路线或暂时弱化 |
| 前端测试不执行断言 | 中 | 容易误以为已有测试保障 | 改用 Vitest 或实际 runner |
| 默认数据库密码 | 中 | 生产误用风险 | 文档提示并增加启动校验 |
| HTML lang 不随语言切换 | 低 | 影响可访问性 | 切换语言时同步 documentElement.lang |

## 13. 开放问题

1. 系统是否计划公网部署？如果是，是否需要登录、API Key 或后台管理？
2. 是否允许匿名用户调用充值、查询和换卡接口？
3. 批量充值是面向普通用户还是内部运营？
4. 上游 API 是否能承诺稳定响应模型？
5. 是否需要保存任务历史？保存多久？
6. 卡密查询返回的 `user_id` 邮箱是否需要脱敏？
7. 是否需要对 Access Token 做更严格格式校验，还是继续兼容 app_user_id？
8. 生产部署时前后端是否同域？如果不同域，需要配置 API base URL。
9. 是否要把 `parse-token` 接入充值流程，用于“确认账号”步骤？
10. 是否继续保留 `curl` 模拟浏览器请求，还是迁移到 `httpx`？

## 14. 总结

当前项目已经具备清晰的 MVP 骨架：前端是 React/Vite SPA，后端是 FastAPI 上游代理层，核心功能覆盖自助充值、卡密查询、订阅查询和自助换卡。项目最大的工程价值是把浏览器与上游 API 隔离，为安全、限流、日志和后续队列化处理提供了承载点。

从生产级技术 PRD 角度看，下一阶段应优先补齐：

1. 后端限流与安全脱敏。
2. 响应模型和错误结构标准化。
3. 前端测试真实执行。
4. 批量充值正式实现。
5. 数据库迁移与任务持久化。
6. Redis 在限流/队列中的实际落地。
