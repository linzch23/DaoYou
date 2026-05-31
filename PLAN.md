# 《导友》MVP 开发计划

## 1. 总目标

在 5 周内完成可演示的主动式旅游陪伴 Agent MVP。开发顺序遵循“先合同、再骨架、再业务、再 AI、最后联调”的原则，避免前端、后端、Agent 和数据库在最后阶段集中冲突。

## 2. 角色分工

| 成员 | 职责 |
| --- | --- |
| 成员 A | 前端负责人，负责 UniApp 页面、交互、图片上传和录屏操作 |
| 成员 B | 后端负责人，负责 FastAPI、API 设计、行程模块、用户模块、PostgreSQL 连接 |
| 成员 C | Agent 负责人，负责 LangGraph、Prompt、AI 对话、拍照讲解、提醒、改线 |
| 成员 D | 数据库与测试负责人，负责模型、迁移、Docker Compose、uploads、测试数据和联调 |

本文档中“我”默认指成员 B，即后端负责人。

## 3. 阶段计划

### 第 1 周：项目骨架

目标：项目可以启动，后端 API 基础可访问。

后端任务：

- 初始化 `backend/`。
- 配置 `pyproject.toml`、`uv.lock`。
- 创建 FastAPI 应用入口 `backend/app/main.py`。
- 建立 `api/`、`core/`、`db/`、`models/`、`schemas/`、`services/`、`agent/` 目录。
- 实现 `GET /health`。
- 配置统一响应结构。
- 与成员 D 确认 PostgreSQL 连接方式和 `.env.example`。

验收：

- 后端可本地启动。
- `/health` 返回 `{"code":0,"message":"success","data":{"status":"ok"}}`。
- Swagger 页面可访问。

### 第 2 周：行程管理

目标：首页能展示今日行程，前端能基于真实 API 替换 Mock。

后端任务：

- 实现旅行 CRUD。
- 实现行程日创建。
- 实现行程节点创建、更新、删除。
- 实现 `GET /api/home/today`。
- 与成员 A 对齐首页和行程页字段。
- 与成员 D 联调“大连三日游”种子数据。

验收：

- 可创建旅行和行程节点。
- 可查询旅行详情。
- 首页可读取今日时间轴。
- API 字段与前端 Mock 保持一致。

### 第 3 周：AI 对话与拍照讲解

目标：完成对话和图片讲解基本闭环。

后端任务：

- 实现 `/api/chat`。
- 实现 `/api/chat/history`。
- 实现 `/api/photos/explain`。
- 编写图片上传校验和本地保存逻辑。
- 与成员 C 确认 Agent 输入输出 schema。
- 保存聊天记录和照片记录。
- 增加大模型失败或 Agent 失败 fallback。

验收：

- 用户发送消息后能收到回复。
- 聊天记录可查询。
- 图片能保存到 `uploads/images/`。
- 图片讲解接口返回 `recognition_result`、`explanation`、`follow_up_questions`。

### 第 4 周：智能提醒与动态改线

目标：完成主动能力演示。

后端任务：

- 实现 `/api/reminders/check`。
- 实现 `/api/reminders`。
- 实现 `/api/trips/{trip_id}/replan`。
- 实现 `/api/trips/{trip_id}/apply-plan`。
- 确保改线草案生成阶段不修改原行程。
- 确认用户点击确认后再更新 `trip_items`。
- 与成员 C 联调地图工具和 replan node。

验收：

- 点击检查风险后可生成提醒。
- 用户提出改线后返回草案。
- 应用草案后首页行程更新。
- 大模型或地图 API 失败时仍可用固定演示数据兜底。

### 第 5 周：联调、冻结与演示

目标：冻结复赛演示版本，完成录制和答辩准备。

后端任务：

- 修复 API Bug。
- 检查接口响应时间和错误响应。
- 固定演示数据和 fallback。
- 配合成员 A 完整录制演示路径。
- 准备答辩中关于后端架构、API 稳定性和降级策略的话术。

验收：

- 核心演示路径完整跑通。
- 后端日志可用于排查问题。
- 演示环境可重复启动。
- 演示前冻结 API 字段和数据库结构。

## 4. 后端任务拆解

| 优先级 | 任务 | 产物 |
| --- | --- | --- |
| P0 | FastAPI 骨架 | `backend/app/main.py`、`/health` |
| P0 | 统一响应和错误码 | `core/response.py`、`core/errors.py` |
| P0 | 数据库连接 | `db/session.py`、配置读取 |
| P0 | 行程 API | `api/trips.py`、`services/trip_service.py` |
| P0 | 首页 API | `api/home.py`、`services/home_service.py` |
| P0 | 对话 API | `api/chat.py`、`services/chat_service.py` |
| P0 | 图片讲解 API | `api/photos.py`、`services/photo_service.py`、`file_service.py` |
| P0 | 提醒 API | `api/reminders.py`、`services/reminder_service.py` |
| P0 | 改线 API | `services/replan_service.py` |
| P1 | 用户偏好 API | `api/preferences.py`、`services/preference_service.py` |
| P1 | Agent adapter | `services/agent_service.py` |
| P1 | fallback 数据 | `core/fallbacks.py` 或 `services/fallback_service.py` |
| P2 | 完整测试覆盖 | `tests/` |

## 5. 联调节点

| 时间 | 联调对象 | 检查内容 |
| --- | --- | --- |
| 第 2 周末 | 前端 + 后端 + 数据库 | `/health`、行程列表、行程详情、首页今日行程 |
| 第 4 周中 | 后端 + Agent + 数据库 | `/api/chat`、`/api/photos/explain`、Agent schema、fallback |
| 第 5 周 | 全员 | 创建旅行到动态改线完整演示路径 |

## 6. 风险和应对

| 风险 | 影响 | 后端应对 |
| --- | --- | --- |
| API 字段频繁变化 | 前端返工 | 先写 API 文档，字段变更需同步 |
| 数据库迁移不稳定 | 启动失败 | 与成员 D 固定 Alembic 流程 |
| Agent 输出不稳定 | 前端解析失败 | 使用 schema 校验和 fallback |
| 图片上传失败 | 拍照讲解中断 | 校验类型、大小、路径，保留测试图片 |
| 大模型限流 | 演示不可控 | 准备固定回复和本地演示数据 |
| 地图 API 异常 | 改线失败 | 准备模拟 POI 和路线耗时 |
| 联调过晚 | 问题集中爆发 | 第 2 周末必须完成第一次联调 |

## 7. 每日后端工作节奏

1. 拉取最新分支，确认是否有 API 或数据库变更。
2. 查看当天要实现的接口合同。
3. 先写 schema，再写 service，最后接 router。
4. 本地运行最小验证。
5. 在团队群同步接口路径、字段变化和待联调事项。
6. 提交 PR 前补充请求和响应示例。

## 8. 冻结规则

演示前 3 天冻结：

- 数据库表结构。
- API 路径和字段名。
- Agent 输入输出 schema。
- 演示数据。
- 大模型 fallback 内容。

演示前一天只修复 P0/P1 Bug，不再合并大功能。

