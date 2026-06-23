# 导友后端

《导友》MVP 的 FastAPI 后端服务，负责业务 API、PostgreSQL 数据访问、文件上传以及 Agent 调用。

## 环境要求

- Python 3.10+
- uv
- Docker Desktop 或 Docker Engine
- Docker Compose

## 安装依赖

```bash
uv sync
```

## 本地启动后端

```bash
uv run uvicorn app.main:app --reload
```

服务默认运行在 `http://localhost:8000`，可通过以下地址访问：

- 健康检查：`http://localhost:8000/health`
- Swagger：`http://localhost:8000/docs`
- ReDoc：`http://localhost:8000/redoc`

## Docker 启动后端和数据库

在仓库根目录执行：

```bash
docker compose up -d --build
```

当前 `docker-compose.yml` 会先启动 `postgres`，等待数据库健康检查通过后启动 `backend`。`backend` 容器启动时会自动执行：

```bash
uv run --no-sync alembic upgrade head
```

迁移成功后才会启动 FastAPI 服务。因此协作者拉取最新代码后，用 Docker 启动后端时通常不需要再手动执行 `alembic upgrade head`。

后端容器通过仓库根目录 `.env` 读取外部能力配置；`.env.example` 仅作为模板。修改 `.env` 后需要重新创建后端容器：

```bash
docker compose up -d --force-recreate backend
```

如果修改了依赖、Dockerfile 或镜像内代码，再使用 `--build`。

如果只需要启动数据库，可以执行：

```bash
docker compose up -d postgres
```

如果修改了后端代码、迁移文件、依赖或 Dockerfile，建议使用 `--build` 重新构建镜像，避免容器继续使用旧代码。

## 运行检查

```bash
uv run pytest
uv run ruff check .
```

## 初始化数据库

PostgreSQL 通过 Docker Compose 运行，不需要在本机单独安装 PostgreSQL。

如果使用上面的 `docker compose up -d --build` 启动完整服务，数据库迁移会由 `backend` 容器自动执行。

如果你只启动数据库并在本机运行后端，则先在仓库根目录启动数据库：

```bash
docker compose up -d postgres
docker compose ps
```

当 `daoyou-postgres` 状态显示为 `healthy` 后，进入 `backend/` 执行数据库迁移：

```bash
uv run alembic upgrade head
uv run alembic current
```

然后写入默认用户和“大连三日游”演示数据：

```bash
uv run python -m app.db.seed
```

种子脚本可以重复执行；如果演示数据已经存在，不会重复插入。

## 验证数据库

在仓库根目录执行：

```bash
docker compose exec postgres psql -U daoyou -d daoyou \
  -c "SELECT id, nickname FROM users;" \
  -c "SELECT id, title, start_date, end_date, status FROM trips;" \
  -c "SELECT COUNT(*) AS trip_days FROM trip_days;" \
  -c "SELECT COUNT(*) AS trip_items FROM trip_items;"
```

预期结果：

- 默认用户：`id=1`，昵称为“导友演示用户”。
- 默认旅行：`大连三日游`。
- 行程日：3 条。
- 行程节点：5 条。

## 常用数据库命令

```bash
# 查看当前迁移版本
uv run alembic current

# 检查 SQLAlchemy 模型和迁移是否一致
uv run alembic check

# 回退一个迁移版本
uv run alembic downgrade -1

# 停止数据库容器
docker compose stop postgres
```
