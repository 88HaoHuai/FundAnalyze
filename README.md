# FundAnalyze

一个覆盖 **Web + iOS + FastAPI** 的基金分析项目，支持基金分组、实时估值、市场风向、资讯聚合和单基金 AI 分析。

## 项目结构

```text
fundProject/
├─ src/                         # Web 前端（React + Vite）
├─ api/                         # Vercel Serverless 代理与定时任务入口
├─ server/                      # FastAPI 后端（鉴权、分组、资讯、AI、调度）
├─ ios/FundAnalyze/FundAnalyze/ # iOS 客户端（SwiftUI）
├─ vercel.json                  # Vercel rewrites + cron
└─ README.md
```

## 当前核心能力

- 基金分组与持仓管理（普通分组 + 市场分组）
- 基金实时估值与历史趋势
- 资讯页四分区（市场摘要 / 重点资讯 / 相关资讯 / AI 解读）
- 单基金分析页（关键词、相关资讯、政策观察、AI 综合分析）
- 趋势图多周期切换：`近7天 / 近1月 / 近3月 / 近6月 / 近1年 / 近3年`
- 趋势图回撤标注：最大回撤与修复时间
- Vercel 代理接口（`/api/fund`、`/api/pingzhong`、`/api/f10`、`/api/stock`）
- 自动定投调度任务（FastAPI APScheduler + Vercel Cron）

## 技术栈

- Web：React 19 + Vite 7 + Recharts
- iOS：SwiftUI
- 后端：FastAPI + SQLAlchemy Async + asyncpg + APScheduler
- 数据库：PostgreSQL（`DATABASE_URL`）
- 部署：Vercel（前端与代理）+ 自托管 FastAPI（或云主机）

## 本地开发

### 1. 启动后端（FastAPI）

在 `server` 目录准备环境：

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

创建 `.env`（示例）：

```env
DATABASE_URL=postgresql+asyncpg://user:password@127.0.0.1:5432/fundanalyze
JWT_SECRET=replace_me
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=720

SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

AI_API_KEY=
AI_MODEL=deepseek-ai/DeepSeek-V3
CRON_SECRET=
```

启动：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. 启动 Web 前端（React）

在仓库根目录：

```bash
npm install
npm run dev
```

Vite 已配置代理：`/api -> http://127.0.0.1:8000`。

### 3. 启动 iOS 客户端

```bash
open ios/FundAnalyze/FundAnalyze/FundAnalyze.xcodeproj
```

在 Xcode 里选择 `FundAnalyze` Scheme 后运行模拟器即可。

## 数据与接口说明

### FastAPI 业务接口（`server/routers`）

- `auth.py`：登录、鉴权
- `groups.py`：分组与持仓管理
- `funds.py`：基金元数据、基金相关能力
- `news.py`：资讯聚合（东方财富 / 财联社）
- `ai.py`：AI 分析能力

### Vercel 代理接口（`api/` + `vercel.json`）

- `/api/fund/*` -> 天天基金估值 JS
- `/api/pingzhong/*` -> `pingzhong` 代理
- `/api/f10/*` -> 东方财富 F10 代理
- `/api/stock` -> 股票行情代理

## 数据库变更

近期新增基金关键词相关字段：

- `group_funds.fund_type`
- `group_funds.fund_keywords`

如果线上库缺字段，可执行：

```sql
ALTER TABLE group_funds ADD COLUMN fund_type VARCHAR(50);
ALTER TABLE group_funds ADD COLUMN fund_keywords VARCHAR(500);
```

## 部署要点

### Web + 代理（Vercel）

- `vercel.json` 已配置 rewrites 与 cron
- `api/auto_invest` 受 `CRON_SECRET` 保护
- 部署后需在 Vercel 项目配置环境变量

### FastAPI

- 需要独立部署并保证 `DATABASE_URL` 可连接
- 建议通过 `systemd` / `supervisor` / Docker 方式守护
- 生产环境请限制 CORS，不要使用 `allow_origins=["*"]`

## 安全注意事项

- 当前代码里包含默认管理员初始化逻辑（`server/main.py`），上线前请改为你自己的安全账号与强密码，并尽快迁移到环境变量方案
- `.env` 不要提交到仓库
- JWT Secret、SMTP 密码、AI Key 必须使用线上密钥管理

## 常见问题

- Web 报 `Unexpected token 'T'`：通常是上游返回了 HTML，当前已在代理和前端做降级解析，优先检查上游接口可用性
- 趋势图长周期无数据：优先检查 `pingzhong` 与 `f10` 代理是否可访问
- 资讯为空：先确认后端 `/api/news` 与 `/api/news_cls` 在当前网络可返回数据

## 许可证

当前仓库未声明开源许可证。如需开源，请补充 `LICENSE` 文件。
