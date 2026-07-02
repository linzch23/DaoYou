# 导友后端

FastAPI 后端，负责业务 API、PostgreSQL、文件上传、LangGraph Agent 和
下一目的地提醒 Worker。

## 环境要求

- Python 3.10+
- [uv](https://docs.astral.sh/uv/)
- Docker Desktop，或 Docker Engine + Docker Compose

除明确标注“仓库根目录”的命令外，本文件中的命令均在 `backend/` 执行。

## 本地开发启动

### 1. 准备根目录环境变量

在仓库根目录复制 `.env.example` 为 `.env` 并填写所需配置。后端本地运行时会读取
根目录 `.env`。

### 2. 启动 PostgreSQL

在仓库根目录执行：

```bash
docker compose up -d postgres
docker compose ps
```

等待 `daoyou-postgres` 状态变为 `healthy`。

### 3. 安装依赖并初始化数据库

进入 `backend/`：

```bash
uv sync
uv run alembic upgrade head
uv run python -m app.db.seed
```

种子脚本可重复执行，不会重复插入已有的默认用户和演示旅行。

### 4. 启动 FastAPI

```bash
uv run uvicorn app.main:app --reload
```

访问：

- 健康检查：[http://localhost:8000/health](http://localhost:8000/health)
- Swagger：[http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc：[http://localhost:8000/redoc](http://localhost:8000/redoc)

### 5. 可选：启动提醒 Worker

在另一个 `backend/` 终端执行：

```bash
uv run python -m app.jobs.departure_alerts_worker
```

Worker 常驻运行，每 15 分钟检查用户最新位置和下一目的地。

## 完整 Docker 启动

如果希望 PostgreSQL、FastAPI 和 Worker 全部由 Compose 管理，请直接使用根目录
[README](../README.md) 的“Docker 快速启动”流程，不需要再次手动执行迁移或种子脚本。

修改 `.env` 后重新创建服务：

```bash
# 仓库根目录
docker compose up -d --force-recreate backend reminder-worker
```

修改后端代码、依赖、迁移或 Dockerfile 后重新构建：

```bash
# 仓库根目录
docker compose up -d --build backend reminder-worker
```

## 检查

```bash
uv run pytest
uv run ruff check .
uv run alembic check
```

`alembic check` 需要可访问的 PostgreSQL，并使用当前 `DATABASE_URL`。

## 数据库命令

```bash
# 应用全部迁移
uv run alembic upgrade head

# 查看当前迁移版本
uv run alembic current

# 检查模型与迁移是否一致
uv run alembic check

# 回退一个版本；执行前确认迁移的数据影响
uv run alembic downgrade -1
```

查看演示数据，在仓库根目录执行：

```bash
docker compose exec postgres psql -U daoyou -d daoyou \
  -c "SELECT id, nickname FROM users;" \
  -c "SELECT id, title, start_date, end_date, status FROM trips;" \
  -c "SELECT COUNT(*) AS trip_items FROM trip_items;"
```

只停止 PostgreSQL：

```bash
# 仓库根目录
docker compose stop postgres
```
