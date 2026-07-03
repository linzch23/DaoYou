# 导友——你的个人旅游搭子

《导友》是面向 AIGC 创新赛的主动式旅游陪伴 Agent MVP，包含 UniApp 前端、
FastAPI/LangGraph 后端、PostgreSQL，以及独立的下一目的地提醒 Worker。

## 项目结构

```text
frontend/   UniApp + Vue3 前端
backend/    FastAPI、LangGraph、SQLAlchemy 和 Alembic
docs/       API、技术设计和 vivo 推送文档
```

## Docker 快速启动（推荐）

要求：Docker Desktop，或 Docker Engine + Docker Compose。

所有命令均在仓库根目录执行。

### 1. 准备环境变量

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

Linux/macOS：

```bash
cp .env.example .env
```

按需填写 `.env`。完整变量及默认值以 [.env.example](.env.example) 为准，真实密钥不得提交。

### 2. 启动服务

```bash
docker compose up -d --build
docker compose ps
```

Compose 会启动：

- `postgres`：PostgreSQL。
- `backend`：执行数据库迁移和演示数据初始化后启动 FastAPI。
- `reminder-worker`：每 15 分钟检查下一目的地并发送 vivo 出发提醒。

### 3. 验证

```bash
curl http://localhost:8000/health
```

接口文档：

- Swagger：[http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc：[http://localhost:8000/redoc](http://localhost:8000/redoc)

查看日志：

```bash
docker compose logs -f backend reminder-worker
```

停止服务：

```bash
docker compose down
```

## 本地开发

### 后端

PostgreSQL 使用 Docker，本地运行 FastAPI：

```bash
docker compose up -d postgres
cd backend
uv sync
uv run alembic upgrade head
uv run python -m app.db.seed
uv run uvicorn app.main:app --reload
```

需要同时调试提醒 Worker 时，在另一个 `backend/` 终端运行：

```bash
uv run python -m app.jobs.departure_alerts_worker
```

数据库维护和后端检查见 [backend/README.md](backend/README.md)。

### 前端 H5

```bash
cd frontend
npm install
npm run dev:h5
```

前端后端地址配置在 `frontend/src/services/config.js`。真机部署不能使用
`localhost`，生产环境应使用可访问的 HTTPS 地址。

其他构建命令：

```bash
npm test
npm run build:h5
npm run build:app
```

## Android 原生插件

正式打包前，在根目录 `.env` 填写 `VIVO_PUSH_APP_ID` 和
`VIVO_PUSH_APP_KEY`，并填写绑定 `com.daoyou.app` 和正式签名 SHA1 的
`AMAP_ANDROID_APP_KEY`。先从仓库根目录生成本地 AAR：

```powershell
& frontend\nativeplugins\VivoPushPlugin\android\build-plugin.ps1
```

生成的 `VivoPushPlugin-release.aar` 供 HBuilderX 打包使用，但不提交 Git。
源码 Manifest 只保留占位符；AppSecret 始终只保存在后端。然后生成供 HBuilderX
导入/云打包的目录：

```powershell
cd frontend
npm run build:app:package
```

该命令只在构建期间注入高德 Android Key，完成后恢复源码 Manifest，并把原生插件
复制到 `frontend/dist/build/app/nativeplugins/`。不要直接用带占位符的
`npm run build:app` 产物制作正式 APK。

## 常用检查

后端：

```bash
cd backend
uv run pytest
uv run ruff check .
uv run alembic check
```

前端：

```bash
cd frontend
npm test
npm run build:h5
npm run build:app:package
```

## 文档

- [API 接口文档](docs/API接口文档.md)
- [技术设计文档](docs/技术设计文档.md)
- [团队协作与项目管理](docs/团队开发协作与项目管理文档.md)
- [vivo 消息推送实施与分工](docs/vivo消息推送实施与分工.md)

