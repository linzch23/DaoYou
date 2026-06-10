# 导友——你的个人旅游搭子

《导友》是面向 AIGC 创新赛的主动式旅游陪伴 Agent MVP。系统目标是跑通行程创建、首页今日行程、AI 对话、拍照讲解、智能提醒、动态改线和用户偏好个性化闭环。

## 技术栈

- 前端：UniApp + Vue3。
- 后端：Python + FastAPI。
- Agent：LangGraph，已实现意图分流、对话、拍照讲解、提醒和改线建议主流程。
- 数据库：PostgreSQL。
- 文件存储：MVP 使用本地 `backend/uploads/`。
- 依赖管理：`uv`。
- 部署与本地联调：Docker Compose。

## 当前进展

- 前端已形成 UniApp + Vue3 v1，包含首页、新建/编辑行程、拍照讲解、个人中心、回收站等页面，并保留本地 Mock 和草稿存储能力。
- 后端已完成 FastAPI 分层骨架、SQLAlchemy 模型、Alembic 初始迁移、演示种子数据和统一响应合同。
- Agent 已完成 LangGraph 第一阶段工作流；地图、天气、视觉、OCR 和记忆更新目前仍以 Mock 或 fallback 为主。
- 动态改线统一通过 `POST /api/chat` 返回受控 `action_options`，用户确认后调用 `PUT /api/trip-items/{item_id}`。
- 前端分支仍需按最新 API 合同清理 `Trip.city`、`status=deleted` 和旧改线 Mock 等兼容差异。

## 后端本地启动

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

健康检查：

```bash
curl http://localhost:8000/health
```

预期响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "status": "ok"
  }
}
```

## 常用检查

```bash
cd backend
uv run pytest
uv run ruff check .
```

## 文档入口

- `SPEC.md`：MVP 规格说明。
- `ARCHITECTURE.md`：系统架构说明。
- `PLAN.md`：开发计划。
- `STATUS.md`：项目状态。
- `docs/API接口文档.md`：团队 API 合同。
- `docs/技术设计文档.md`：详细技术设计。
- `docs/团队开发协作与项目管理文档.md`：团队协作规范。
- `docs/vivo消息推送实施与分工.md`：vivo 消息推送方案、职责和验收流程。
