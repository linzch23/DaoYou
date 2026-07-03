# 《导友》MVP API 接口文档
面向对象：前端负责人、后端负责人、Agent 负责人、数据库与测试负责人。

本文档是团队协作接口合同。前端 Mock、后端实现、Agent 输入输出、数据库测试数据和接口测试均应以本文档为准。

## 1. 基本约定
### 1.1 Base URL
本地开发默认：

```latex
http://localhost:8000
```

接口统一以 `/api` 为业务前缀，健康检查除外。

### 1.2 数据格式
+ 普通请求使用 `application/json`。
+ 图片上传使用 `multipart/form-data`。
+ 时间日期格式：
    - 日期：`YYYY-MM-DD`，例如 `2026-07-01`。
    - 时间：`HH:mm`，例如 `10:00`。
    - 日期时间：ISO 8601，例如 `2026-07-01T09:20:00+08:00`。

### 1.3 用户约定
MVP 暂不实现完整登录注册，默认使用：

```json
{
  "user_id": 1
}
```

所有需要用户上下文的接口仍保留 `user_id` 字段，便于后续接入认证系统。

### 1.4 统一响应格式
成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

失败响应：

```json
{
  "code": 4001,
  "message": "trip not found",
  "data": null
}
```

### 1.5 错误码
| code | 含义 | 常见场景 |
| --- | --- | --- |
| 0 | 成功 | 请求正常完成 |
| 4000 | 请求参数错误 | 缺少必填字段、字段类型错误、日期格式错误 |
| 4001 | 资源不存在 | user、trip、trip_day、trip_item、photo 或 push device 不存在 |
| 4002 | 文件上传失败 | 文件为空、类型不支持、大小超限、保存失败 |
| 4003 | 目的地无法解析 | 高德地理编码没有返回可用坐标，HTTP 状态为 422 |
| 5000 | 后端服务错误 | 未分类服务端异常 |
| 5001 | 大模型调用失败 | LLM API 超时、限流、鉴权失败 |
| 5002 | 地图 API 调用失败 | 地图路线、POI、距离估算失败 |
| 5003 | Agent 输出解析失败 | Agent 返回结构不符合约定 |


### 1.6 字段变更规则
+ 已进入前端 Mock 的字段不随意删除或改名。
+ 新增字段应保持向后兼容。
+ 删除字段、字段改名、字段类型变化必须同步前端、后端、Agent、测试负责人。
+ 涉及数据库字段的 API 变化必须同步数据库负责人。

### 1.7 外部能力与环境变量
根目录 `.env.example` 是模板，真实密钥写入根目录 `.env`。当前 Docker Compose 后端服务通过 `env_file: .env` 注入环境变量；修改 `.env` 后需要重新创建后端容器。

已验证的真实链路：

+ `LLM_PROVIDER=openai`、`LLM_BASE_URL=https://api.deepseek.com/v1`、`LLM_API_KEY`、`LLM_MODEL` 配置后，`POST /api/chat` 可返回非固定 LLM 回复。
+ `VISION_PROVIDER=qwen`、`QWEN_API_KEY` 配置后，`POST /api/photos/explain` 可识别测试图片主体；未配置时会回退到固定演示识别结果。
+ vivo AI/OCR 使用 `VIVO_APP_ID`、`VIVO_APP_KEY`；vivo Push 独立使用 `VIVO_PUSH_APP_ID`、`VIVO_PUSH_APP_KEY`、`VIVO_PUSH_APP_SECRET`，不能混用。

外部能力失败时，后端仍应返回结构稳定的业务响应或明确错误码，不能把原始异常透传给前端。

## 2. 接口总览
| 模块 | 方法 | 路径 | 说明 | 前端直接调用 | 调用 Agent |
| --- | --- | --- | --- | --- | --- |
| 健康检查 | GET | `/health` | 检查后端服务 | 是 | 否 |
| 首页 | GET | `/api/home/today` | 今日行程 | 是 | 否 |
| 用户位置 | PUT | `/api/location` | 上传用户最新位置 | 是 | 否 |
| 行程 | POST | `/api/trips` | 创建旅行 | 是 | 否 |
| 行程 | GET | `/api/trips` | 获取旅行列表 | 是 | 否 |
| 行程 | GET | `/api/trips/{trip_id}` | 获取旅行详情 | 是 | 否 |
| 行程 | PUT | `/api/trips/{trip_id}` | 更新旅行 | 是 | 否 |
| 行程 | DELETE | `/api/trips/{trip_id}` | 将旅行移入回收站 | 是 | 否 |
| 回收站 | GET | `/api/trash/trips` | 查询回收站旅行列表 | 是 | 否 |
| 回收站 | POST | `/api/trash/trips/{trip_id}/restore` | 恢复旅行 | 是 | 否 |
| 回收站 | DELETE | `/api/trash/trips/{trip_id}` | 永久删除旅行 | 是 | 否 |
| 回收站 | DELETE | `/api/trash/trips` | 清空旅行回收站 | 是 | 否 |
| 行程日 | POST | `/api/trips/{trip_id}/days` | 创建行程日 | 是 | 否 |
| 行程解析 | POST | `/api/trips/parse` | 从文字中提取明确的行程字段 | 是 | 否 |
| 行程创建 | POST | `/api/trips/from-draft` | 事务化创建完整行程 | 是 | 是 |
| 行程节点 | POST | `/api/trip-items` | 创建行程节点 | 是 | 否 |
| 行程节点 | PUT | `/api/trip-items/{item_id}` | 更新行程节点 | 是 | 否 |
| 行程节点 | DELETE | `/api/trip-items/{item_id}` | 删除行程节点 | 是 | 否 |
| 对话 | POST | `/api/chat` | 发送消息并获取回复 | 是 | 是 |
| 对话 | GET | `/api/chat/history` | 查询聊天历史 | 是 | 否 |
| Agent 操作 | POST | `/api/actions/{action_id}/confirm` | 确认并执行待处理操作 | 是 | 否 |
| Agent 操作 | POST | `/api/actions/{action_id}/reject` | 拒绝待处理操作 | 是 | 否 |
| 拍照讲解 | POST | `/api/photos/explain` | 上传图片并生成讲解 | 是 | 是 |
| 推送设备 | POST | `/api/push/devices` | 注册或刷新 vivo regId | 是 | 否 |
| 推送设备 | DELETE | `/api/push/devices/{reg_id}` | 禁用 vivo regId | 是 | 否 |
| 偏好 | GET | `/api/preferences` | 查询用户偏好 | 是 | 否 |
| 偏好 | PUT | `/api/preferences` | 更新用户偏好 | 是 | 否 |
| 偏好 | POST | `/api/preferences/parse` | 解析自由文本个性化偏好 | 是 | 是 |
| 记忆 | POST | `/api/memory/summary` | 总结用户记忆 | 可选 | 是 |
| 记忆 | GET | `/api/memory` | 查询高置信度用户记忆 | 是 | 否 |
| 记忆 | DELETE | `/api/memory/{memory_type}/{memory_key}` | 删除单条记忆 | 是 | 否 |
| 记忆 | DELETE | `/api/memory` | 清空用户记忆 | 是 | 否 |
| 记忆 | GET | `/api/memory/settings` | 查询自动画像开关 | 是 | 否 |
| 记忆 | PUT | `/api/memory/settings` | 开启或关闭自动画像 | 是 | 否 |


## 3. 通用数据结构
### 3.1 Trip
```json
{
  "id": 1,
  "user_id": 1,
  "title": "大连三日游",
  "start_date": "2026-07-01",
  "end_date": "2026-07-03",
  "status": "active",
  "deleted_at": null
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int | 旅行 ID |
| user_id | int | 用户 ID |
| title | string | 旅行标题 |
| start_date | string | 开始日期 |
| end_date | string | 结束日期 |
| status | string | `draft` / `active` / `finished` |
| deleted_at | string \| null | ISO 8601 删除时间；正常旅行为 `null`，回收站旅行非空 |


`status` 只表示旅行的业务生命周期，不使用 `deleted`。旅行是否位于回收站由后端 `deleted_at` 字段判断。`deleted_at` 是服务端只读字段，客户端不能通过创建或更新旅行接口直接设置，只能通过删除、恢复和永久删除接口改变回收站状态。

不同接口对 Trip 使用不同字段投影：

+ 普通列表返回 `id`、`title`、`start_date`、`end_date`、`status`、`deleted_at`，其中 `deleted_at` 固定为 `null`。
+ 旅行详情在列表字段基础上增加 `user_id` 和 `days`。
+ 回收站列表使用普通列表字段，但 `deleted_at` 必须非空。

### 3.2 TripDay
```json
{
  "id": 1,
  "trip_id": 1,
  "day_index": 1,
  "trip_date": "2026-07-01",
  "summary": "海边城市漫游",
  "items": []
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int | 行程日 ID |
| trip_id | int | 所属旅行 ID |
| day_index | int | 旅行中的第几天，从 1 开始 |
| trip_date | string | 日期，格式为 `YYYY-MM-DD` |
| summary | string \| null | 当日摘要 |
| items | TripItem[] | 旅行详情响应中包含的行程节点列表 |


### 3.3 TripItem
```json
{
  "id": 1,
  "trip_day_id": 1,
  "city": "大连",
  "title": "渔人码头",
  "item_type": "attraction",
  "start_time": "10:00",
  "end_time": "11:30",
  "address": "大连市中山区滨海路",
  "latitude": 38.9200000,
  "longitude": 121.6400000,
  "status": "planned",
  "notes": "适合拍照和慢走"
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int | 行程节点 ID |
| trip_day_id | int | 所属行程日 ID |
| city | string | 行程节点所在城市 |
| title | string | 景点或安排名称 |
| item_type | string | `attraction` / `food` / `rest` / `traffic` |
| start_time | string \| null | 开始时间，格式为 `HH:mm` |
| end_time | string \| null | 结束时间，格式为 `HH:mm` |
| address | string \| null | 地址 |
| latitude | number \| null | 纬度 |
| longitude | number \| null | 经度 |
| status | string | `planned` / `done` / `skipped` / `changed` |
| notes | string \| null | 备注 |


### 3.4 Location
```json
{
  "latitude": 38.92,
  "longitude": 121.64
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| latitude | number | 纬度，范围 `-90` 至 `90` |
| longitude | number | 经度，范围 `-180` 至 `180` |

### 3.5 UserLocation
表示后端保存的用户最新位置及其采集时间。

```json
{
  "latitude": 31.2304,
  "longitude": 121.4737,
  "location_updated_at": "2026-06-11T09:20:00+08:00"
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| latitude | number | 最新纬度 |
| longitude | number | 最新经度 |
| location_updated_at | string \| null | 设备采集位置的时间，ISO 8601；`null` 表示尚未收到真实定位 |

MVP 可在 `users` 中预置演示经纬度，但默认记录的 `location_updated_at` 必须为 `null`。提醒任务只有在该字段非空且位置未过期时，才将其视为用户真实位置。

### 3.6 Preferences
```json
{
  "explanation_style": "fun",
  "travel_pace": "slow",
  "interests": ["history", "photo"],
  "special_needs": ["less_walking"],
  "custom_instructions": "每天十点以后开始，不能吃辣，每日预算500元。",
  "custom_preferences": {
    "dietary": {"likes": [], "avoid": ["spicy"], "allergies": []},
    "budget": {"daily_amount": 500, "currency": "CNY"},
    "schedule": {"earliest_start_time": "10:00", "latest_end_time": null, "needs_nap": false}
  },
  "custom_preferences_confirmed_at": "2026-07-02T10:00:00+08:00"
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| explanation_style | string | `professional` / `fun` / `children` |
| travel_pace | string | `compact` / `normal` / `slow` |
| interests | string[] | `history` / `food` / `nature` / `photo` / `family` |
| special_needs | string[] | `less_walking` / `less_queue` / `accessible` |
| custom_instructions | string | 用户确认的自由文本旅行偏好，最多 500 字；只作为不可信数据使用 |
| custom_preferences | object | 从原文解析并经用户确认的受控结构化偏好 |
| custom_preferences_confirmed_at | string \| null | 最近一次确认时间，服务端只读 |


### 3.7 ChatMessage
```json
{
  "id": 1,
  "role": "user",
  "content": "这里怎么拍照好看？",
  "created_at": "2026-07-01T10:20:00+08:00"
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int | 消息 ID |
| role | string | `user` / `assistant` / `system` |
| content | string | 消息内容 |
| created_at | string | ISO 8601 创建时间 |


### 3.8 AgentActionOption
Agent 识别到行程编辑意图时，通过该结构返回可供用户选择的行程项新增或修改方案。

```json
{
  "option_id": "option_001",
  "label": "改为附近咖啡馆休息",
  "description": "减少步行，保留傍晚海边散步。",
  "operation": "update_trip_item",
  "trip_id": 1,
  "item_id": 3,
  "payload": {
    "city": "大连",
    "title": "附近咖啡馆休息",
    "item_type": "rest",
    "status": "changed"
  }
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| option_id | string | 本次 Chat 响应内的选项标识 |
| action_id | string | 服务端保存的待确认操作 ID；确认或拒绝时使用，客户端不得自行生成 |
| status | string | 初始为 `pending` |
| expires_at | string | 操作过期时间，ISO 8601 |
| label | string | 前端展示的选项标题 |
| description | string | 选项说明和推荐理由 |
| operation | string | `create_trip_item` / `update_trip_item` / `delete_trip_item` |
| trip_id | int | 当前聊天绑定的旅行 ID，前端执行前必须校验 |
| trip_day_id | int \| null | 目标 TripDay 已存在时返回 |
| target_date | string \| null | TripDay 不存在时返回，必须在旅行日期范围内 |
| target_day_index | int \| null | TripDay 不存在时返回，从 1 开始 |
| item_id | int \| null | 修改节点时必填，必须属于当前旅行 |
| payload | object | 创建或更新字段；删除操作固定为空对象，不包含 `user_id`、归属 ID |

当同一个方案包含多条累计操作时，服务端将它们保存为一个批量待确认动作：

```json
{
  "action_id": "uuid",
  "operation": "batch",
  "label": "写入第一天和第二天行程",
  "description": "共 4 项安排",
  "operation_count": 4,
  "operations": [
    {
      "operation": "create_trip_item",
      "target_day_index": 1,
      "target_date": "2026-07-01",
      "label": "新增俄罗斯风情街"
    }
  ],
  "status": "pending",
  "expires_at": "2026-07-03T12:15:00+00:00"
}
```

批量动作最多包含 20 项新增、修改或删除操作。确认时全部操作在同一事务执行；任一项失败则整体回滚。同一天缺少 TripDay 时只创建一次并供该批次内后续节点复用。


## 4. 健康检查
### 4.1 GET `/health`
检查后端服务是否启动。

请求参数：无。

请求示例：

```latex
GET /health
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "status": "ok"
  }
}
```

## 5. 首页接口
### 5.1 GET `/api/home/today`
获取当前旅行的今日行程，不返回站内提醒或未读数量。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | MVP 默认 1 |
| date | string | 否 | 指定查询日期，便于演示固定日期 |


请求示例：

```latex
GET /api/home/today?user_id=1&date=2026-07-01
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "trip_id": 1,
    "trip_title": "大连三日游",
    "date": "2026-07-01",
    "today_items": [
      {
        "id": 1,
        "city": "大连",
        "title": "渔人码头",
        "item_type": "attraction",
        "start_time": "10:00",
        "end_time": "11:30",
        "address": "大连市中山区滨海路",
        "status": "planned"
      }
    ]
  }
}
```

## 6. 用户位置接口
### 6.1 PUT `/api/location`
上传用户最新位置。Android 客户端在获得定位权限后建议每 15 分钟调用一次；位置变化明显时也可以提前上报。

请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID，MVP 默认 `1` |
| latitude | number | 是 | 纬度，范围 `-90` 至 `90` |
| longitude | number | 是 | 经度，范围 `-180` 至 `180` |
| timestamp | int | 是 | Android 实际采集位置的 Unix 秒时间戳，不是请求到达时间 |

请求体：

```json
{
  "user_id": 1,
  "latitude": 31.2304,
  "longitude": 121.4737,
  "timestamp": 1781140800
}
```

请求示例：

```latex
PUT /api/location
Content-Type: application/json

{"user_id":1,"latitude":31.2304,"longitude":121.4737,"timestamp":1781140800}
```

响应示例：位置已更新

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "updated": true,
    "location": {
      "latitude": 31.2304,
      "longitude": 121.4737,
      "location_updated_at": "2026-06-11T09:20:00+08:00"
    }
  }
}
```

响应示例：收到乱序旧位置

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "updated": false,
    "reason": "stale_timestamp",
    "location": {
      "latitude": 31.2305,
      "longitude": 121.4738,
      "location_updated_at": "2026-06-11T12:15:00+08:00"
    }
  }
}
```

处理约束：

+ 后端将 `timestamp` 转换为带时区时间并保存到 `users.location_updated_at`。
+ 只有请求时间戳晚于当前 `location_updated_at` 时才更新，防止离线重试或网络乱序覆盖新位置。
+ 相同时间戳和相同位置的重复 PUT 应保持幂等。
+ 客户端不得用请求发送时间代替设备定位采集时间。
+ 后端不保存位置历史轨迹，只保留用户最新位置。
+ 日志不得记录精确经纬度。
+ 用户不存在时返回 `4001`；经纬度越界、时间戳无效或超过服务器时间 5 分钟时返回 `4000`。

## 7. 行程接口
### 7.1 POST `/api/trips`
创建旅行。

请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |
| title | string | 是 | 旅行标题，建议不超过 200 个字符 |
| start_date | string | 是 | 开始日期，格式为 `YYYY-MM-DD` |
| end_date | string | 是 | 结束日期，不能早于 `start_date` |


请求体：

```json
{
  "user_id": 1,
  "title": "大连三日游",
  "start_date": "2026-07-01",
  "end_date": "2026-07-03"
}
```

请求示例：

```latex
POST /api/trips
Content-Type: application/json

{"user_id":1,"title":"大连三日游","start_date":"2026-07-01","end_date":"2026-07-03"}
```

创建成功后 `status` 默认为 `draft`，`deleted_at` 默认为 `null`。

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "trip_id": 1
  }
}
```

#### 7.1.1 POST `/api/trips/parse`

从用户的自然语言描述中提取明确出现的行程字段，不创建数据库记录。没有提到或无法确定的字段返回 `null`；“上午”等模糊时间写入 `time_period`，不会伪造精确时间。

```json
{
  "user_id": 1,
  "text": "8月12日上午去杭州西湖",
  "current_date": "2026-07-02",
  "timezone": "Asia/Shanghai"
}
```

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "title": null,
    "start_date": "2026-08-12",
    "end_date": null,
    "items": [{
      "title": "西湖",
      "city": "杭州",
      "trip_date": "2026-08-12",
      "time_period": "morning",
      "start_time": null,
      "end_time": null
    }],
    "warnings": [],
    "missing_required_fields": ["title", "end_date"]
  }
}
```

#### 7.1.2 POST `/api/trips/from-draft`

用户确认表单后，在单个数据库事务中创建旅行、行程日和行程节点。`idempotency_key` 用于防止网络重试造成重复创建；同一用户重复提交相同键时返回原 `trip_id`。

```json
{
  "user_id": 1,
  "title": "杭州旅行",
  "start_date": "2026-08-12",
  "end_date": "2026-08-13",
  "status": "active",
  "idempotency_key": "trip-1785680000000-abcd1234",
  "days": [{
    "day_index": 1,
    "trip_date": "2026-08-12",
    "summary": null,
    "items": [{"title": "西湖", "city": "杭州", "item_type": "attraction"}]
  }]
}
```

任一行程日或节点校验失败时整体回滚，不会留下半成品旅行。

### 7.2 GET `/api/trips`
获取旅行列表。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |
| status | string | 否 | `draft` / `active` / `finished` |


请求示例：

```latex
GET /api/trips?user_id=1
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "trips": [
      {
        "id": 1,
        "title": "大连三日游",
        "start_date": "2026-07-01",
        "end_date": "2026-07-03",
        "status": "active",
        "deleted_at": null
      }
    ]
  }
}
```

约束：

+ 此接口只返回 `deleted_at IS NULL` 的正常旅行。
+ `status` 参数只接受 `draft`、`active` 或 `finished`。

### 7.3 GET `/api/trips/{trip_id}`
获取旅行详情。

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| trip_id | int | 旅行 ID |


查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |


请求示例：

```latex
GET /api/trips/1?user_id=1
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "user_id": 1,
    "title": "大连三日游",
    "start_date": "2026-07-01",
    "end_date": "2026-07-03",
    "status": "active",
    "deleted_at": null,
    "days": [
      {
        "id": 1,
        "trip_id": 1,
        "day_index": 1,
        "trip_date": "2026-07-01",
        "summary": "海边城市漫游",
        "items": [
          {
            "id": 1,
            "trip_day_id": 1,
            "city": "大连",
            "title": "渔人码头",
            "item_type": "attraction",
            "start_time": "10:00",
            "end_time": "11:30",
            "address": "大连市中山区滨海路",
            "latitude": 38.92,
            "longitude": 121.64,
            "status": "planned",
            "notes": "适合拍照和慢走"
          }
        ]
      }
    ]
  }
}
```

已进入回收站的旅行通过此接口按资源不存在处理。

### 7.4 PUT `/api/trips/{trip_id}`
更新旅行基础信息。

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| trip_id | int | 旅行 ID |


请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |
| title | string | 否 | 新旅行标题 |
| status | string | 否 | `draft` / `active` / `finished` |


请求体：

```json
{
  "user_id": 1,
  "title": "大连轻松三日游",
  "status": "active"
}
```

请求示例：

```latex
PUT /api/trips/1
Content-Type: application/json

{"user_id":1,"title":"大连轻松三日游","status":"active"}
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "updated": true
  }
}
```

`deleted_at` 不允许出现在请求体中。已进入回收站的旅行不能通过此接口更新。

### 7.5 DELETE `/api/trips/{trip_id}`
将旅行移入回收站。

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| trip_id | int | 旅行 ID |


查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |


请求示例：

```latex
DELETE /api/trips/1?user_id=1
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "deleted": true,
    "deleted_at": "2026-06-04T10:00:00+08:00"
  }
}
```

此接口不修改旅行原有的 `status`，也不删除行程日、行程节点、聊天记录、照片讲解记录和提醒数据。已进入回收站的旅行不能继续用于普通行程、聊天、拍照讲解、提醒和改线接口。

### 7.6 POST `/api/trips/{trip_id}/days`
创建行程日。

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| trip_id | int | 所属旅行 ID |


请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |
| day_index | int | 是 | 旅行中的第几天，从 1 开始 |
| trip_date | string | 是 | 日期，格式为 `YYYY-MM-DD` |
| summary | string | 否 | 当日摘要 |

该接口支持精确幂等重试：同一旅行中已经存在完全相同的
`day_index + trip_date` 时，返回现有 `trip_day_id`，不新增记录，也不覆盖原
`summary`。如果只有序号相同或只有日期相同，仍返回 `4000`，避免隐藏行程日冲突。


请求体：

```json
{
  "user_id": 1,
  "day_index": 1,
  "trip_date": "2026-07-01",
  "summary": "海边城市漫游"
}
```

请求示例：

```latex
POST /api/trips/1/days
Content-Type: application/json

{"user_id":1,"day_index":1,"trip_date":"2026-07-01","summary":"海边城市漫游"}
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "trip_day_id": 1
  }
}
```

### 7.7 POST `/api/trip-items`
创建行程节点。

请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |
| trip_day_id | int | 是 | 所属行程日 ID |
| city | string | 是 | 行程节点所在城市 |
| title | string | 是 | 景点或安排名称 |
| item_type | string | 否 | 默认 `attraction` |
| start_time | string | 否 | 开始时间，格式为 `HH:mm` |
| end_time | string | 否 | 结束时间，格式为 `HH:mm` |
| address | string | 否 | 地址 |
| notes | string | 否 | 备注 |


创建成功后节点 `status` 默认为 `planned`。创建行程节点时要检查这个时间段是否已有行程，返回创建失败提示。

目的地坐标不接受客户端写入。后端使用 `city + address`（没有 `address` 时使用 `city + title`）调用高德 Web 服务地理编码，并将返回的“经度,纬度”保存到 `trip_items.longitude`、`trip_items.latitude`。无法解析地点时返回 HTTP 422，且不创建行程节点。

请求体：

```json
{
  "user_id": 1,
  "trip_day_id": 1,
  "city": "大连",
  "title": "渔人码头",
  "item_type": "attraction",
  "start_time": "10:00",
  "end_time": "11:30",
  "address": "大连市中山区滨海路",
  "notes": "适合拍照和慢走"
}
```

请求示例：

```latex
POST /api/trip-items
Content-Type: application/json

{"user_id":1,"trip_day_id":1,"city":"大连","title":"渔人码头","item_type":"attraction","start_time":"10:00","end_time":"11:30","address":"大连市中山区滨海路","notes":"适合拍照和慢走"}
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "item_id": 1
  }
}
```

### 7.8 PUT `/api/trip-items/{item_id}`
更新行程节点。

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| item_id | int | 行程节点 ID |


请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |
| city | string | 否 | 新的节点所在城市 |
| title | string | 否 | 新名称 |
| item_type | string | 否 | 节点类型 |
| start_time | string | 否 | 开始时间 |
| end_time | string | 否 | 结束时间 |
| address | string | 否 | 地址 |
| status | string | 否 | `planned` / `done` / `skipped` / `changed` |
| notes | string | 否 | 备注 |

修改 `city`、`title` 或 `address` 时，后端重新执行地理编码并清除该节点已有的到达状态；只修改时间、类型、状态或备注时不调用高德。客户端提交 `latitude` 或 `longitude` 会返回 HTTP 422。


请求体：

```json
{
  "user_id": 1,
  "start_time": "10:30",
  "end_time": "12:00",
  "status": "changed",
  "notes": "根据当天节奏顺延"
}
```

请求示例：

```latex
PUT /api/trip-items/1
Content-Type: application/json

{"user_id":1,"start_time":"10:30","end_time":"12:00","status":"changed","notes":"根据当天节奏顺延"}
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "updated": true
  }
}
```

### 7.9 DELETE `/api/trip-items/{item_id}`
删除行程节点。

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| item_id | int | 行程节点 ID |


查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |


请求示例：

```latex
DELETE /api/trip-items/1?user_id=1
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "deleted": true
  }
}
```

### 7.10 回收站接口（独立资源）
回收站使用 `/api/trash/trips` 作为独立资源路径，只处理已进入回收站的旅行。正常旅行不能通过回收站接口恢复或永久删除。

#### 7.10.1 GET `/api/trash/trips`
查询当前用户的回收站旅行列表。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |


请求示例：

```latex
GET /api/trash/trips?user_id=1
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "trips": [
      {
        "id": 1,
        "title": "大连三日游",
        "start_date": "2026-07-01",
        "end_date": "2026-07-03",
        "status": "active",
        "deleted_at": "2026-06-04T10:00:00+08:00"
      }
    ]
  }
}
```

#### 7.10.2 POST `/api/trash/trips/{trip_id}/restore`
恢复回收站中的旅行。

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| trip_id | int | 回收站旅行 ID |


请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |


请求体：

```json
{
  "user_id": 1
}
```

请求示例：

```latex
POST /api/trash/trips/1/restore
Content-Type: application/json

{"user_id":1}
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "restored": true
  }
}
```

#### 7.10.3 DELETE `/api/trash/trips/{trip_id}`
永久删除回收站中的单条旅行。此操作会删除旅行及其关联的行程日、行程节点、聊天记录、照片讲解记录和提醒数据库记录，且不可恢复。

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| trip_id | int | 回收站旅行 ID |


查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |


请求示例：

```latex
DELETE /api/trash/trips/1?user_id=1
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "permanently_deleted": true
  }
}
```

#### 7.10.4 DELETE `/api/trash/trips`
清空当前用户的旅行回收站。此操作只删除当前用户已进入回收站的旅行，不影响正常旅行和其他用户的数据。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |


请求示例：

```latex
DELETE /api/trash/trips?user_id=1
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "permanently_deleted_count": 3,
    "file_cleanup_failed_count": 0
  }
}
```

回收站为空时返回成功，`permanently_deleted_count` 为 `0`。前端必须在永久删除和清空回收站前展示不可恢复的二次确认提示。

本阶段不实现 30 天自动删除。回收站中的旅行只会在用户调用单条永久删除或清空回收站接口时消失。

## 8. AI 对话接口
### 8.1 POST `/api/chat`
向导友 Agent 发送消息。

后端处理流程：

```latex
保存用户消息
→ 读取用户偏好
→ 读取最近聊天历史
→ Agent 识别普通对话或改线意图
→ 改线意图生成可选的行程节点修改方案
→ 调用 LangGraph Agent
→ 保存 assistant 回复
→ 返回 reply、intent 和 action_options
```

请求体：

```json
{
  "user_id": 1,
  "trip_id": 1,
  "message": "下午我想轻松一点，怎么安排？",
  "current_location": {
    "latitude": 38.92,
    "longitude": 121.64
  }
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |
| trip_id | int | 是 | 当前旅行 ID；聊天和改线都基于该旅行上下文 |
| message | string | 是 | 用户输入 |
| current_location | object | 否 | 当前位置 |


请求示例：

```latex
POST /api/chat
Content-Type: application/json

{"user_id":1,"trip_id":1,"message":"下午我想轻松一点，怎么安排？","current_location":{"latitude":38.92,"longitude":121.64}}
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "reply": "你下午还有两个安排，建议适当预留交通和休息时间。",
    "intent": "chat",
    "action_options": [],
    "follow_up_questions": [
      "帮我把下午改轻松一点",
      "附近适合休息的地方有哪些？"
    ],
    "clarification_options": []
  }
}
```

`follow_up_questions` 只包含用户可以继续向 Agent 提出的问题，前端点击后可原样发送。
当 Agent 需要用户在有限选项中做选择时，问题写在 `reply`，并返回结构化的
`clarification_options`：

```json
{
  "reply": "第二天你想完全空着，还是安排一个轻松拍照的地点？",
  "intent": "chat",
  "action_options": [],
  "follow_up_questions": [],
  "clarification_options": [
    {
      "option_id": "clarify_001",
      "label": "完全空着",
      "message": "我想让第二天完全空着。"
    },
    {
      "option_id": "clarify_002",
      "label": "轻松拍照",
      "message": "我希望第二天安排一个轻松、适合拍照的地点。"
    }
  ]
}
```

前端展示 `label`，但用户选择后必须把完整的第一人称 `message` 发送给 Agent。
`follow_up_questions` 与 `clarification_options` 不能同时非空；同时出现时以前者为空、
优先使用 `clarification_options`。

响应示例：识别为改线意图

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "reply": "你可以把较远的贝壳博物馆改成附近咖啡馆休息，我整理了两个选项。",
    "intent": "replan",
    "action_options": [
      {
        "option_id": "option_001",
        "label": "改为附近咖啡馆休息",
        "description": "减少步行，保留傍晚海边散步。",
        "operation": "update_trip_item",
        "item_id": 3,
        "payload": {
          "city": "大连",
          "title": "附近咖啡馆休息",
          "item_type": "rest",
          "start_time": "14:30",
          "end_time": "15:30",
          "address": "渔人码头附近",
          "latitude": 38.92,
          "longitude": 121.64,
          "status": "changed",
          "notes": "减少步行，适合恢复体力"
        }
      },
      {
        "option_id": "option_002",
        "label": "跳过下一站",
        "description": "直接将下一站标记为跳过。",
        "operation": "update_trip_item",
        "item_id": 3,
        "payload": {
          "status": "skipped",
          "notes": "用户临时取消该安排"
        }
      }
    ],
    "follow_up_questions": [],
    "clarification_options": []
  }
}
```

改线处理约束：

+ `/api/chat` 只生成选项，不直接修改 `trip_items`。
+ 前端展示 `action_options`，并在执行前校验选项的 `trip_id` 与当前聊天一致。
+ 前端确认后只提交 `action_id` 到 `POST /api/actions/{action_id}/confirm`，不得把 Agent payload 作为可信写请求直接执行。
+ 用户放弃方案时调用 `POST /api/actions/{action_id}/reject`。
+ 服务端确认时重新校验用户/旅行归属、过期时间、旅行版本指纹、字段白名单和业务冲突，并在一个事务中执行。
+ 重复确认同一个已成功 action 返回原执行结果，不重复创建或修改数据。
+ 多条 `operations` 属于同一个累计方案，不是互斥选项；服务端返回单个 `operation=batch` 待确认动作。
+ batch 确认成功后，`result` 返回 `total`、`created`、`updated`、`deleted` 和逐项执行结果。
+ 未经确认时 Agent 必须明确说明“尚未写入”，不能声称已经新增、修改或删除成功。
+ 行程已变化、action 已过期、已拒绝或不属于当前用户时拒绝执行，前端应提示重新生成方案。
+ 修改和删除目标按 ID、完整标题、唯一包含匹配、日期时间线索和最近聊天提及逐级解析；候选不唯一时返回追问，不生成操作选项。
+ `create_trip_item`、`update_trip_item`、`delete_trip_item` 的原始 REST API 仍供手动编辑页面使用；Chat 确认流程必须走 Action API。
+ Agent 无法可靠确定旅行日或目标节点时，先返回自然语言追问，并将 `action_options` 置为空数组。

Agent 输出约定：

```json
{
  "intent": "chat",
  "reply": "给用户的自然语言回复",
  "action_options": [],
  "follow_up_questions": [],
  "clarification_options": []
}
```

### 8.2 GET `/api/chat/history`
查询聊天历史。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |
| trip_id | int | 是 | 当前旅行 ID；只返回该旅行的聊天历史 |
| limit | int | 否 | 默认 20 |


请求示例：

```latex
GET /api/chat/history?user_id=1&trip_id=1&limit=20
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "messages": [
      {
        "id": 1,
        "role": "user",
        "content": "这里怎么拍照好看？",
        "created_at": "2026-07-01T10:20:00+08:00"
      },
      {
        "id": 2,
        "role": "assistant",
        "content": "建议你站在码头入口偏右的位置，把海面和欧式建筑一起纳入画面。",
        "created_at": "2026-07-01T10:20:05+08:00"
      }
    ]
  }
}
```

### 8.3 POST `/api/actions/{action_id}/confirm`

确认并执行 `/api/chat` 返回的待处理操作。请求体：

```json
{"user_id": 1}
```

服务端使用创建 action 时保存的 payload，忽略客户端对展示数据的任何修改。成功响应包含 `status=confirmed`、操作类型、执行结果和 `idempotent`；重复确认返回相同结果且 `idempotent=true`。

### 8.4 POST `/api/actions/{action_id}/reject`

拒绝待处理操作，请求体同确认接口。拒绝操作幂等；已确认、已过期或已失效的操作不能再拒绝。

## 9. 拍照讲解接口
### 9.1 POST `/api/photos/explain`
上传图片并生成景点讲解。

请求类型：

```latex
multipart/form-data
```

表单字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | MVP 默认 1 |
| trip_id | int | 是 | 当前旅行 ID；拍照讲解基于该旅行上下文并保存到该旅行历史 |
| image | file | 是 | 用户上传图片 |
| current_location | object | 否 | 当前位置，结构与 Chat 接口一致，见 3.4 Location |

`current_location` 在业务模型中是对象。由于本接口使用 `multipart/form-data`，HTTP 传输时应作为 `application/json` 类型的表单 part 提交，后端解析后再按 Location 对象校验。

请求示例：

```bash
curl -X POST "http://localhost:8000/api/photos/explain" \
  -F "user_id=1" \
  -F "trip_id=1" \
  -F "image=@yurenmatou.jpg" \
  -F 'current_location={"latitude":38.92,"longitude":121.64};type=application/json'
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "photo_id": 1,
    "image_path": "uploads/images/yurenmatou.jpg",
    "recognition_result": "图片可能是大连渔人码头，包含港湾、欧式建筑和海边步道。",
    "explanation": "你现在看到的是大连渔人码头，它很适合慢节奏散步和拍照……",
    "follow_up_questions": [
      "这里怎么拍照好看？",
      "附近适合休息的地方有哪些？",
      "能讲一个儿童版介绍吗？"
    ]
  }
}
```

文件上传规则：

+ 推荐支持 `jpg`、`jpeg`、`png`、`webp`。
+ MVP 建议限制单文件大小不超过 10 MB。
+ 后端生成文件名，不直接使用用户原始文件名。
+ 数据库保存相对路径。
+ 文件保存失败时返回 `4002`。

## 10. 推送设备接口
### 10.1 POST `/api/push/devices`
注册或刷新 vivo 设备。相同 `provider + reg_id` 重复提交时更新归属、设备信息、
`last_seen_at` 并重新启用。

```json
{
  "user_id": 1,
  "reg_id": "vivo-reg-id",
  "device_name": "vivo device",
  "app_version": "0.1.0"
}
```

### 10.2 DELETE `/api/push/devices/{reg_id}`
通过查询参数 `user_id` 禁用当前用户的设备：

```http
DELETE /api/push/devices/{reg_id}?user_id=1
```

出发提醒没有前端查询接口。`reminder-worker` 每 15 分钟读取最新位置和下一目的地，
调用高德驾车 API 计算 ETA，并通过 vivo Direct Push 发送系统通知。

## 11. 用户偏好接口
### 11.1 GET `/api/preferences`
查询用户偏好。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |


请求示例：

```latex
GET /api/preferences?user_id=1
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "preferences": {
      "explanation_style": "fun",
      "travel_pace": "slow",
      "interests": ["history", "photo"],
      "special_needs": ["less_walking"]
    }
  }
}
```

### 11.2 PUT `/api/preferences`
更新用户偏好。

请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |
| preferences | object | 是 | 需要更新的偏好字段子集，字段结构见 3.6 |


请求体：

```json
{
  "user_id": 1,
  "preferences": {
    "explanation_style": "fun",
    "travel_pace": "slow",
    "interests": ["history", "photo"],
    "special_needs": ["less_walking"]
  }
}
```

更新采用浅层合并语义：未提交字段保持原值；首次更新时未提交字段使用系统默认偏好。
提交空数组或 `null` 属于显式更新，不会被当作“未提交”。

请求示例：

```latex
PUT /api/preferences
Content-Type: application/json

{"user_id":1,"preferences":{"explanation_style":"fun","travel_pace":"slow","interests":["history","photo"],"special_needs":["less_walking"]}}
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "updated": true
  }
}
```

### 11.3 POST `/api/preferences/parse`

将用户填写的自由文本整理为受控结构化偏好，供用户预览确认。此接口不写数据库。

```json
{
  "user_id": 1,
  "text": "我不能吃辣，每天预算500元，上午十点以后出发，优先坐地铁。",
  "current_preferences": {
    "travel_pace": "slow",
    "special_needs": ["less_walking"]
  }
}
```

响应包含 `parsed_preferences`、可展示的 `summary_items`、冲突或安全 `warnings`，以及信息不足时的 `clarification_questions`。存在澄清问题时，前端不得直接保存，应让用户修改原文后重新解析。

自由文本始终作为不可信偏好数据，不能改变系统规则、绕过 Action 确认或授权数据库操作。确认后由前端把原文和解析结果一起提交到 `PUT /api/preferences`。

## 12. 用户记忆接口
### 12.1 POST `/api/memory/summary`
根据聊天记录总结用户记忆。MVP 可由后端或 Agent 在合适时机触发，前端不一定直接调用。

请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |
| trip_id | int | 是 | 用于总结上下文的旅行 ID |


请求体：

```json
{
  "user_id": 1,
  "trip_id": 1
}
```

请求示例：

```latex
POST /api/memory/summary
Content-Type: application/json

{"user_id":1,"trip_id":1}
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "updated": true,
    "memories": [
      {
        "memory_type": "interest",
        "memory_key": "photo",
        "memory_value": {
          "description": "用户经常询问拍照角度和出片位置"
        },
        "confidence": 0.85
      }
    ]
  }
}
```

### 12.2 GET `/api/memory`

查询 Agent 当前可使用的高置信度长期记忆。每条记忆包含类型、键、结构化值、置信度和更新时间。推断结果必须能够追溯到消息证据，但接口不返回完整聊天原文。

```http
GET /api/memory?user_id=1
```

### 12.3 DELETE `/api/memory/{memory_type}/{memory_key}` 与 DELETE `/api/memory`

用户可以删除单条推断记忆，或清空自己的全部长期记忆：

```http
DELETE /api/memory/interest/photo?user_id=1
DELETE /api/memory?user_id=1
```

删除后，Agent 后续构建上下文时不得再读取相应记忆。若自动画像仍开启，用户以后再次明确表达相同偏好时可以重新形成记忆。

### 12.4 GET/PUT `/api/memory/settings`

查询或修改自动画像开关：

```json
{
  "user_id": 1,
  "enabled": false
}
```

关闭后：

- 聊天和图片讲解不再读取长期记忆。
- 新消息不再写入自动记忆。
- `/api/memory/summary` 不再生成新记忆。
- 已有记忆不会自动删除，用户可通过删除接口单独清理。

### 12.5 自动记忆规则

- “我喜欢拍照”“我希望少走路”等明确表达可以立即形成高置信度候选。
- 单次点击、单次地点选择或单次询问不能直接形成稳定画像。
- 重复行为信号至少需要两条独立证据。
- 每条记忆保存证据消息 ID、来源旅行、证据次数和置信度。
- 用户新的明确表达与旧记忆冲突时，以新表达为当前值并重新累计证据。
- Agent 节点只生成候选，数据库写入由 service 层完成。

## 13. Agent 对接约定
后端调用 Agent 时建议统一通过 `agent_service`，不要在 router 中直接调用 LangGraph。

### 13.1 通用 Agent 输入
`trip_id` 和 `current_trip` 在聊天、拍照讲解、提醒、行程工具和改线等需要行程上下文的场景中传入。`POST /api/chat`、`GET /api/chat/history` 和 `POST /api/photos/explain` 都要求前端提供当前旅行 ID。

```json
{
  "user_id": 1,
  "user_message": "下午我想轻松一点",
  "current_trip": {},
  "current_location": {
    "latitude": 38.92,
    "longitude": 121.64
  },
  "user_preferences": {},
  "chat_history": [],
  "image_info": {}
}
```

### 13.2 通用 Agent 输出
```json
{
  "intent": "chat",
  "reply": "给用户展示的自然语言回复",
  "action_options": [],
  "follow_up_questions": [],
  "clarification_options": []
}
```

`intent` 由 Agent 根据用户消息识别，当前支持普通对话 `chat` 和改线意图 `replan`。只有 `intent = "replan"` 时才应返回非空的 `action_options`。

### 13.3 后端兜底规则
+ Agent 缺少 `reply` 时，返回固定 fallback 文案。
+ Agent 将请求识别为改线意图但 `action_options` 结构错误时，返回 `5003` 或降级为不带操作选项的自然语言建议。
+ 大模型、Qwen 视觉、OCR 或地图调用失败时，优先保证演示链路不断；chat/photo 已验证在配置真实密钥后会返回非固定结果。
+ 后端日志可记录错误类型，但不能记录 API key、token、Cookie。

## 14. 前端 Mock 参考
前端 Mock 目录建议：

```latex
frontend/api/mock/
├── home.ts
├── trips.ts
├── trash.ts
├── chat.ts
├── photos.ts
└── preferences.ts
```

Mock 原则：

+ 字段名必须与本文档一致。
+ 响应必须包含 `code`、`message`、`data`。
+ 切换真实 API 前，前端负责人和后端负责人共同确认字段。

## 15. 测试建议
数据库与测试负责人可按以下顺序写接口测试：

1. `/health`。
2. 上传用户位置并验证旧时间戳不能覆盖新位置。
3. 创建旅行。
4. 创建行程日。
5. 创建行程节点。
6. 查询旅行详情。
7. 将旅行移入回收站。
8. 查询、恢复和永久删除回收站旅行。
9. 清空回收站并确认不影响正常旅行。
10. 查询首页今日行程。
11. 更新用户偏好。
12. 发送聊天消息。
13. 查询聊天历史。
14. 上传图片讲解。
15. 分别使用请求位置、用户最新位置和过期位置检查提醒。
16. 通过聊天识别改线意图并返回行程修改选项。
17. 选择改线选项后调用行程节点更新接口。
18. 配置真实 `LLM_API_KEY` 和 `QWEN_API_KEY` 后，分别用 curl 验证 chat 和 photo 返回非固定 fallback 内容。

每个核心接口至少覆盖：

+ 正常请求。
+ 缺少必填字段。
+ 资源不存在。
+ 外部 API 或 Agent 失败时的 fallback。
