# 导友——你的个人旅游搭子

《导友》是面向 AIGC 创新赛的主动式旅游陪伴 Agent MVP。系统目标是跑通行程创建、首页今日行程、AI 对话、拍照讲解、智能提醒、动态改线和用户偏好个性化闭环。

## 技术栈

- 前端：UniApp + Vue3。
- 后端：Python + FastAPI。
- Agent：LangGraph 预留目录与调用边界。
- 数据库：PostgreSQL。
- 文件存储：MVP 使用本地 `backend/uploads/`。
- 依赖管理：`uv`。

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
- `docs/API.md`：团队 API 合同。
- `BACKEND_DEVELOPMENT_FLOW.md`：后端负责人开发流程。

