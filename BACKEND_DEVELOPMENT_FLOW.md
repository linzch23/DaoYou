# 后端负责人开发流程参考

本文档面向《导友》项目后端负责人。你的核心职责是把产品和 Agent 能力稳定地包装成前端可调用、数据库可追溯、演示可控的 FastAPI 服务。

## 1. 你的职责边界

你负责：

- FastAPI 后端工程初始化。
- REST API 设计与实现。
- 统一响应格式和错误处理。
- 行程、首页、用户偏好等后端业务模块。
- PostgreSQL 连接和业务查询。
- 与 Agent 负责人约定输入输出，并在 service 层调用 Agent。
- 与前端负责人保持 API 字段兼容。
- 与数据库负责人确认模型是否满足 API。
- 演示前保证后端稳定和可降级。

你不直接负责：

- 前端页面样式和交互细节。
- LangGraph 内部节点、Prompt 的主要设计。
- 数据库迁移的最终主导权。
- Docker Compose 和演示数据的最终主导权。

但这些工作都会影响后端，因此你需要参与评审和联调。

## 2. 推荐开发顺序

后端每个功能按以下顺序开发：

```text
确认接口合同
→ 定义 Pydantic schema
→ 编写 service 业务逻辑
→ 接入 router
→ 补充错误处理
→ 本地验证
→ 与前端或 Agent 联调
→ 更新文档
```

不要先在路由里堆业务逻辑。路由层越薄，后续联调和排错越容易。

## 3. 后端工程初始化流程

建议目录：

```text
backend/
├── pyproject.toml
├── uv.lock
├── app/
│   ├── main.py
│   ├── api/
│   ├── core/
│   ├── db/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   └── agent/
└── tests/
```

初始化步骤：

1. 创建 `backend/pyproject.toml`，依赖至少包含 FastAPI、Uvicorn、SQLAlchemy、Pydantic、psycopg、python-multipart。
2. 创建 `app/main.py`，注册 FastAPI 实例。
3. 创建 `app/api/health.py`，实现 `/health`。
4. 创建 `app/core/config.py`，统一读取环境变量。
5. 创建 `app/core/response.py`，封装统一响应。
6. 创建 `app/core/errors.py`，定义业务异常和错误码。
7. 创建 `app/db/session.py`，配置数据库连接。
8. 启动后访问 Swagger，确认接口可见。

## 4. 统一响应和错误处理

所有接口返回：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

建议封装：

```python
def success(data: object = None, message: str = "success") -> dict[str, object]:
    return {"code": 0, "message": message, "data": data or {}}
```

错误码：

| code | 使用场景 |
| --- | --- |
| 4000 | 请求参数错误 |
| 4001 | 查询的资源不存在 |
| 4002 | 文件上传失败 |
| 5000 | 未分类后端错误 |
| 5001 | 大模型调用失败 |
| 5002 | 地图 API 调用失败 |
| 5003 | Agent 输出解析失败 |

路由层不应直接暴露 Python traceback、数据库异常或外部 API 原始错误。

## 5. API 开发流程

### 5.1 行程模块

优先实现：

- `POST /api/trips`
- `GET /api/trips`
- `GET /api/trips/{trip_id}`
- `PUT /api/trips/{trip_id}`
- `DELETE /api/trips/{trip_id}`
- `POST /api/trips/{trip_id}/days`
- `POST /api/trip-items`
- `PUT /api/trip-items/{item_id}`
- `DELETE /api/trip-items/{item_id}`

关键点：

- `trip_id`、`trip_day_id`、`item_id` 都必须校验存在。
- MVP 可默认 `user_id=1`，但请求和查询仍保留 `user_id` 字段。
- 删除可以先做物理删除；如果担心演示数据误删，可改成状态字段。
- 查询旅行详情时返回 days 和 items，方便前端一次渲染。

### 5.2 首页模块

接口：`GET /api/home/today`

关键点：

- 根据 `trip_id` 和当前日期匹配 `trip_days.trip_date`。
- 如果演示日期与真实日期不一致，可允许传入 `date` 参数或使用当前 active trip 的第一天作为 fallback。
- 返回今日行程和未读提醒数量。

### 5.3 AI 对话模块

接口：

- `POST /api/chat`
- `GET /api/chat/history`

关键点：

- service 层先保存用户消息，再调用 Agent。
- 调用 Agent 时传入 `user_id`、`trip_id`、`message`、当前行程、偏好和最近聊天历史。
- Agent 成功后保存 assistant 回复。
- Agent 失败时返回 fallback，并记录错误日志。

### 5.4 拍照讲解模块

接口：`POST /api/photos/explain`

关键点：

- 使用 `multipart/form-data`。
- 校验扩展名和 MIME 类型。
- 限制文件大小，避免演示时误传大文件。
- 服务端生成文件名，例如 `{uuid}.jpg`。
- 数据库保存相对路径。
- 调用 Agent 或 photo service 获取讲解。
- 返回 `photo_id`、`image_path`、`recognition_result`、`explanation`、`follow_up_questions`。

### 5.5 智能提醒模块

接口：

- `POST /api/reminders/check`
- `GET /api/reminders`

关键点：

- MVP 优先支持出发提醒和时间冲突提醒。
- 当前时间使用前端传入值，便于演示固定场景。
- 地图 API 失败时使用模拟耗时。
- 有风险时写入 `notifications`。
- 无风险时返回 `has_risk=false`。

### 5.6 动态改线模块

接口：

- `POST /api/trips/{trip_id}/replan`
- `POST /api/trips/{trip_id}/apply-plan`

关键点：

- `replan` 只生成草案，不直接改数据库。
- 草案可以先保存在内存或数据库中；为了演示可追溯，推荐后续增加 draft 表。MVP 若无 draft 表，可用可解析的 `draft_id` 与短期缓存或固定 payload。
- `apply-plan` 才更新 `trip_items`。
- 应用方案时使用事务，避免只改了一半。

## 6. 与数据库负责人的协作

你需要确认：

- 表字段是否满足 API 响应。
- 是否需要索引，例如 `trip_id`、`user_id`、`trip_date`。
- Alembic migration 是否能在本地成功升级。
- 种子数据是否覆盖演示路径。

数据库变更流程：

```text
提出字段需求
→ 成员 D 更新模型和 migration
→ 你确认 API 查询是否满足
→ 本地 upgrade
→ 跑最小接口验证
```

不要在业务代码里临时依赖不存在的字段。

## 7. 与 Agent 负责人的协作

你需要和成员 C 固定 Agent 调用协议。

建议输入：

```json
{
  "user_id": 1,
  "trip_id": 1,
  "message": "我有点累，不想去下一个景点了",
  "intent_hint": "replan",
  "current_trip": {},
  "current_location": {},
  "user_preferences": {},
  "chat_history": []
}
```

建议输出：

```json
{
  "intent": "replan",
  "reply": "建议换成附近咖啡馆休息，再保留傍晚海边散步。",
  "structured_data": {},
  "follow_up_questions": []
}
```

后端必须做：

- 校验 Agent 输出字段。
- 对缺失字段设置默认值。
- 对解析失败返回 fallback。
- 不把 Agent 原始异常直接返回给前端。

## 8. 与前端负责人的协作

你需要保证：

- 字段名和前端 Mock 一致。
- 删除或改名字段前提前同步。
- 每个接口给出请求示例和响应示例。
- Swagger 可访问。
- 图片上传字段名固定为 `image`。

联调时优先定位：

1. 请求有没有发到后端。
2. 请求参数是否符合 schema。
3. 后端 service 是否查到数据。
4. Agent 或外部 API 是否失败。
5. 返回字段是否和前端渲染字段一致。

## 9. 本地验证清单

每次完成一个接口，至少检查：

- [ ] 正常请求返回 `code=0`。
- [ ] 缺少必填字段时返回参数错误。
- [ ] 查询不存在资源时返回资源不存在。
- [ ] 数据库写入符合预期。
- [ ] Swagger 示例可读。
- [ ] 日志不泄露 token、Cookie、API key。

核心演示前检查：

- [ ] `/health` 正常。
- [ ] 可创建“大连三日游”。
- [ ] 首页今日行程正常。
- [ ] `/api/chat` 有回复。
- [ ] `/api/photos/explain` 能保存图片并返回讲解。
- [ ] `/api/reminders/check` 能生成提醒。
- [ ] `/api/trips/{trip_id}/replan` 能生成草案。
- [ ] `/api/trips/{trip_id}/apply-plan` 能更新行程。

## 10. 演示前后端自查

演示前 1 天：

- 固定 `.env` 和 API key 配置。
- 固定演示用户、旅行、图片和路线数据。
- 确认 fallback 可用。
- 清理无关测试数据。
- 记录一份可复现启动命令。
- 不再合并大范围改动。

答辩中你可以重点说明：

- 后端采用 FastAPI 分层设计，路由、服务、模型和 Agent 调用解耦。
- PostgreSQL 保存权威业务数据，LangGraph State 只保存单次请求状态。
- Agent 能读取行程、偏好和历史消息，不是单纯问答。
- 外部 API 不稳定时有 fallback，保证演示稳定。
- API 合同固定，前端可基于 Mock 与后端并行开发。

