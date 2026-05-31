# 导友项目 Coding Agent 指令

本文件适用于在本项目中协助开发的 Codex、opencode、Claude Code 或其他 coding agent。优先级低于用户当次明确要求，高于通用默认行为。

## 项目背景

《导友——你的个人旅游搭子》是面向 2026 中国高校计算机大赛 AIGC 创新赛的主动式旅游陪伴 Agent MVP。项目目标是在较短周期内完成可演示闭环：行程创建、首页今日行程、AI 对话、拍照讲解、智能提醒、动态改线和用户偏好个性化。

当前仓库主要包含项目策划、技术设计和团队协作文档，后续代码应按既定技术方案逐步落地：

- 前端：UniApp + Vue3。
- 后端：Python + FastAPI。
- Agent：LangGraph。
- 数据库：PostgreSQL。
- 文件存储：MVP 使用本地 `backend/uploads/`。
- 部署：Docker Compose。
- Python 依赖管理：优先使用 `uv`。

## 默认语言

- 文档、注释、计划和总结默认使用中文。
- 代码命名、API 路径、提交信息类型、配置键等遵循英文工程习惯。
- 对外接口字段使用英文 snake_case，避免中英混用。

## 项目边界

MVP 优先完成复赛演示闭环，不默认扩展商业化能力。除非用户明确要求，不引入以下内容：

- Redis、MinIO、消息队列、微服务拆分。
- 真实支付、订单、会员、OTA 交易接口。
- 完整登录注册和复杂权限体系。
- 原生推送、ASR、TTS、AR 等扩展能力。

如需引入上述能力，必须先说明原因、影响范围、替代方案和对演示计划的风险。

## 目录约定

建议代码落地后的仓库结构如下：

```text
duyou/
├── docs/
├── frontend/
├── backend/
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── agent/
│   └── uploads/
│       ├── images/
│       ├── docs/
│       └── audio/
└── docker-compose.yml
```

## 后端开发规则

- FastAPI 路由只做请求解析、依赖注入和响应封装，业务逻辑放入 `backend/app/services/`。
- 数据库模型放入 `backend/app/models/`，请求和响应模型放入 `backend/app/schemas/`。
- Agent 相关实现放入 `backend/app/agent/`，后端服务层只通过明确输入输出调用 Agent。
- 所有接口返回统一结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

- 已被前端使用的字段不得随意删除或改名；新增字段应保持向后兼容。
- 文件上传必须校验文件类型、大小和保存路径，禁止路径穿越。
- 外部大模型、地图、OCR、图片理解 API 必须封装在独立 adapter 或 service 中，不在路由层直接调用。
- MVP 可使用默认用户 `user_id=1`，但代码结构应预留后续接入认证的空间。

## 数据库规则

- MVP 表范围：`users`、`trips`、`trip_days`、`trip_items`、`chat_messages`、`user_preferences`、`user_memory`、`photo_records`、`notifications`。
- 表结构变更必须通过 Alembic 迁移，不手动修改数据库后遗漏迁移文件。
- 删除字段、修改字段类型属于高风险变更，必须先确认兼容方案。
- PostgreSQL 是权威数据源；LangGraph State 只保存单次请求内临时状态。

## Agent 协作规则

- LangGraph 负责状态流转、节点编排和工具调用。
- Agent 输入输出必须有 Pydantic schema 或等价结构约束。
- Prompt 修改会影响整体演示效果，非必要不做大范围重写。
- 大模型输出必须经过解析和校验；解析失败时返回可控 fallback，不能让前端收到原始异常。
- Agent 不直接操作数据库，涉及行程更新时通过后端 service 或明确的 tool contract 完成。

## 测试和验证

后端代码变更优先运行最小相关检查：

```bash
cd backend
uv run pytest
uv run ruff check .
```

如果项目尚未初始化测试工具，应至少手动验证：

- `GET /health`。
- 行程 CRUD。
- `/api/chat`。
- `/api/photos/explain`。
- `/api/reminders/check`。
- `/api/trips/{trip_id}/replan` 和 `/apply-plan`。

最终回复必须说明实际运行了哪些检查；未运行时说明原因。

## Git 与协作

- 除非用户明确要求，不 commit、不 push、不创建 PR。
- 不使用会丢失用户工作的命令，例如 `git reset --hard`、`git clean -fd`。
- 推荐分支：`main`、`develop`、`feature/frontend`、`feature/backend`、`feature/agent`、`feature/database`。
- Commit 格式建议：`type(scope): description`，例如 `feat(api): add trip endpoints`。

## 文档维护

影响以下内容时必须同步更新文档：

- API 路径、请求或响应字段。
- 数据库表结构和迁移。
- 启动命令、环境变量、部署流程。
- Agent 输入输出、Prompt 约束和 fallback 策略。
- 演示流程和固定演示数据。

