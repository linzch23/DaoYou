# 《导友》项目状态

更新时间：2026-05-31

## 1. 当前状态

当前目录已从纯文档阶段推进到项目骨架阶段。已有材料包括：

- `导友-技术设计文档.md`：包含产品定位、系统架构、目录设计、Agent 架构、数据库设计、API 设计、Prompt 和开发计划。
- `导友-团队开发协作与项目管理文档.md`：包含团队分工、GitHub 协作、API 协作、数据库协作、并行开发、时间线、联调流程和风险管理。
- `应用赛道初赛作品策划——沉默是金晚的康桥.pdf`：包含作品背景、团队成员、产品理念、交互设计、创新点、用户需求和市场前景。
- `backend/`：已初始化 FastAPI + uv 后端骨架，包含 API、schema、service、model、Agent 占位和健康检查测试。
- `frontend/`：已创建前端协作骨架和 Mock 数据目录，后续由前端负责人接入 UniApp + Vue3。
- `docker-compose.yml`：已提供 PostgreSQL 和后端服务的 Compose 骨架。
- `docs/API.md`：已固化协作者 API 合同。

## 2. 项目阶段判断

| 项目部分 | 状态 | 说明 |
| --- | --- | --- |
| 产品定位 | 已明确 | 主动式旅游陪伴 Agent |
| MVP 闭环 | 已明确 | 行程、对话、拍照讲解、提醒、改线、偏好 |
| 技术选型 | 已明确 | UniApp + FastAPI + LangGraph + PostgreSQL |
| 后端架构 | 骨架已落地 | 已建立 FastAPI 分层目录和占位 service |
| API 合同 | 已固化 | `docs/API.md` 可供前端 Mock、后端实现和测试参考 |
| 数据库模型 | 初版已落地 | 已创建 SQLAlchemy 模型；Alembic 迁移仍待补齐 |
| Agent 流程 | 骨架已落地 | 已创建 `graph.py`、`state.py`、`nodes.py`、`tools.py`、`prompts.py` |
| 前端工程 | 协作骨架已创建 | UniApp 真实工程仍待前端负责人初始化 |
| 后端工程 | 已初始化 | uv 环境、FastAPI 应用和 `/health` 已可验证 |
| Docker Compose | 骨架已创建 | PostgreSQL 与 backend 服务配置已存在，尚未实测容器启动 |
| 测试 | 最小测试已创建 | `/health` 测试通过，后续需补接口测试 |

## 3. 后端负责人当前重点

你作为后端负责人，当前最重要的工作不是马上写复杂 AI 逻辑，而是先把后端工程骨架和 API 合同稳定下来。

优先级：

1. 把占位 service 替换为真实数据库读写。
2. 与成员 D 补齐 Alembic 迁移和种子数据。
3. 与成员 A 基于 `docs/API.md` 校验 Mock 字段。
4. 与成员 C 将 `agent_service` 和 LangGraph 实现接入现有 API。
5. 为行程、首页、对话、图片、提醒、改线接口补充测试。

## 4. 已明确的后端接口

| 模块 | 接口 |
| --- | --- |
| 健康检查 | `GET /health` |
| 首页 | `GET /api/home/today` |
| 行程 | `POST /api/trips`、`GET /api/trips`、`GET /api/trips/{trip_id}`、`PUT /api/trips/{trip_id}`、`DELETE /api/trips/{trip_id}` |
| 行程日 | `POST /api/trips/{trip_id}/days` |
| 行程节点 | `POST /api/trip-items`、`PUT /api/trip-items/{item_id}`、`DELETE /api/trip-items/{item_id}` |
| 对话 | `POST /api/chat`、`GET /api/chat/history` |
| 拍照讲解 | `POST /api/photos/explain` |
| 提醒 | `POST /api/reminders/check`、`GET /api/reminders` |
| 改线 | `POST /api/trips/{trip_id}/replan`、`POST /api/trips/{trip_id}/apply-plan` |
| 偏好 | `GET /api/preferences`、`PUT /api/preferences` |
| 记忆 | `POST /api/memory/summary` |

## 5. 已明确的数据表

- `users`
- `trips`
- `trip_days`
- `trip_items`
- `chat_messages`
- `user_preferences`
- `user_memory`
- `photo_records`
- `notifications`

## 6. 待办清单

### P0

- [x] 创建 `backend/` 工程。
- [x] 配置 `uv` 和 FastAPI。
- [x] 实现 `/health`。
- [x] 建立统一响应结构。
- [x] 建立错误码和异常处理。
- [x] 建立数据库连接配置。
- [ ] 与成员 D 完成数据库模型和 Alembic 迁移。
- [ ] 实现行程管理 API 的真实数据库逻辑。
- [ ] 实现首页今日行程 API 的真实数据库逻辑。

### P1

- [ ] 实现聊天 API 和聊天记录保存。
- [ ] 实现图片上传保存和拍照讲解 API。
- [ ] 实现提醒检查和提醒列表 API。
- [ ] 实现动态改线草案和应用 API。
- [ ] 实现偏好读写 API。
- [ ] 与成员 C 完成 Agent adapter。

### P2

- [x] 增加最小健康检查测试。
- [ ] 增加接口测试。
- [ ] 增加固定演示数据。
- [ ] 增加 fallback 策略。
- [x] 完成 README 启动说明。
- [ ] 准备答辩技术说明。

## 7. 当前风险

| 风险 | 等级 | 当前判断 | 应对 |
| --- | --- | --- | --- |
| 业务逻辑仍是占位实现 | 高 | 当前 API 多数返回固定骨架数据 | 下一步接入 PostgreSQL 和真实 service |
| Alembic 迁移未完成 | 高 | SQLAlchemy 模型已有，迁移缺失 | 成员 D 主导生成迁移，成员 B 确认字段满足 API |
| 数据库和后端职责交叉 | 中 | 成员 B 与 D 需同步 | 数据库变更由 D 主导，B 确认 API 需求 |
| Agent 输出不稳定 | 高 | MVP 必然存在 | 后端做 schema 校验和 fallback |
| 演示依赖外部 API | 中 | 网络和额度不稳定 | 准备本地固定演示数据 |
| 容器启动未验证 | 中 | Compose 已创建但尚未实测 | 后续本地运行 Docker Compose 验证 |

## 8. 下一步建议

1. 与成员 D 生成 Alembic 迁移并准备“大连三日游”种子数据。
2. 将 `trip_service`、`home_service` 从固定响应替换为数据库读写。
3. 与成员 A 对齐 `frontend/api/mock/` 和 `docs/API.md`。
4. 与成员 C 接入真实 LangGraph Agent。
5. 为 P0 接口补充 pytest 测试。
