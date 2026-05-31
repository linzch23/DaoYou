# 项目进度记录

## 2026-05-31：初始化项目骨架

### 遇到的问题

- 项目目录中已有 `.git` 空目录，但不是有效 Git 仓库，`git status --short` 无法运行。
- 现有内容以策划和设计文档为主，缺少可运行后端、前端骨架、Docker 配置和测试。
- `fastapi.testclient.TestClient` 在当前依赖组合下请求阶段卡住，无法作为稳定的最小验证方式。

### 解决方式

- 使用 `uv` 初始化后端 Python 环境，并生成 `backend/uv.lock`。
- 创建 FastAPI 后端分层骨架：`api`、`core`、`db`、`models`、`schemas`、`services`、`agent`。
- 创建 `/health` 健康检查和统一响应结构。
- 创建 SQLAlchemy 模型初稿，覆盖用户、行程、聊天、偏好、记忆、照片和提醒。
- 创建 LangGraph Agent 占位文件，固定后端与 Agent 的后续接入边界。
- 创建前端协作骨架和 `frontend/api/mock/` 示例数据。
- 创建 `docker-compose.yml` 和 `backend/Dockerfile`。
- 将健康检查测试调整为直接验证已注册 endpoint 输出，避免测试客户端兼容问题阻塞骨架验证。

### 后续如何避免

- 后端接口测试客户端需要在后续统一选型并固定版本，避免 FastAPI、Starlette、httpx 版本组合不兼容。
- 每个接口先落 Pydantic schema 和测试，再接真实数据库逻辑。
- 数据库变更由成员 D 通过 Alembic 迁移管理，成员 B 只确认 API 查询需求。
- 前端 Mock 字段必须以 `docs/API.md` 为准。

### 验证记录

- `cd backend && UV_CACHE_DIR=/tmp/uv-cache uv sync`：成功安装并锁定依赖。
- `cd backend && UV_CACHE_DIR=/tmp/uv-cache uv run pytest`：1 个测试通过。
- `cd backend && UV_CACHE_DIR=/tmp/uv-cache uv run ruff check .`：通过。

### git commit ID

8354c87
