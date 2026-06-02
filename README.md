# 自助服务系统

基于 `https://api.987ai.vip` 用户端接口封装的自助服务系统骨架，包含 FastAPI 后端代理、React/Vite 前端、PostgreSQL 与 Redis 本地编排。

## 功能范围

- 自助充值：按 GPT/Claude 卡密产品类型提交充值任务，支持 GPT Access Token/app_user_id 与 Claude 用户 ID。
- 卡密查询：批量提交卡密或链接并查询状态。
- 查询订阅：提交 Access Token 查询账号订阅信息。
- 自助换卡：提交旧卡密并请求生成新卡密。
- 批量充值：第一版保留页面骨架，后续接入队列和并发控制。

## 本地启动

1. 复制环境变量：

   ```bash
   cp .env.example .env
   ```

2. 启动全部服务：

   ```bash
   docker compose up --build
   ```

3. 访问服务：

   - 前端：http://localhost:5173
   - 后端健康检查：http://localhost:8000/health
   - 后端文档：http://localhost:8000/docs

## 本地开发

后端：

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

前端：

```bash
cd frontend
npm install
npm run dev
```

## 安全约束

- 浏览器只调用本地 FastAPI，不直连上游 API。
- Access Token、Claude 用户 ID、卡密等敏感输入默认不写入浏览器持久化存储。
- 后端日志包含基础脱敏过滤，后续接入业务日志时仍需避免记录原始 Token、Claude 用户 ID 和完整卡密。
- 所有公开请求都应保持 Pydantic 校验和限流策略，不能只依赖上游限流。

## 项目结构

```text
backend/
  app/
    api/routes/       # cards/accounts/tasks 路由
    core/             # 配置与日志
    db/               # SQLAlchemy 会话与模型占位
    middleware/       # 安全响应头
    schemas/          # Pydantic 入参模型
    services/         # 上游客户端与脱敏工具
frontend/
  src/
    lib/api.ts        # 前端 API 客户端
    App.tsx           # MVP 页面骨架
    styles.css        # 页面样式
```
