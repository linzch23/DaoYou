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
| 4001 | 资源不存在 | trip、trip_day、trip_item、photo、notification 不存在 |
| 4002 | 文件上传失败 | 文件为空、类型不支持、大小超限、保存失败 |
| 5000 | 后端服务错误 | 未分类服务端异常 |
| 5001 | 大模型调用失败 | LLM API 超时、限流、鉴权失败 |
| 5002 | 地图 API 调用失败 | 地图路线、POI、距离估算失败 |
| 5003 | Agent 输出解析失败 | Agent 返回结构不符合约定 |


### 1.6 字段变更规则
+ 已进入前端 Mock 的字段不随意删除或改名。
+ 新增字段应保持向后兼容。
+ 删除字段、字段改名、字段类型变化必须同步前端、后端、Agent、测试负责人。
+ 涉及数据库字段的 API 变化必须同步数据库负责人。

## 2. 接口总览
| 模块 | 方法 | 路径 | 说明 | 前端直接调用 | 调用 Agent |
| --- | --- | --- | --- | --- | --- |
| 健康检查 | GET | `/health` | 检查后端服务 | 是 | 否 |
| 首页 | GET | `/api/home/today` | 今日行程和未读提醒 | 是 | 否 |
| 行程 | POST | `/api/trips` | 创建旅行 | 是 | 否 |
| 行程 | GET | `/api/trips` | 获取旅行列表 | 是 | 否 |
| 行程 | GET | `/api/trips/{trip_id}` | 获取旅行详情 | 是 | 否 |
| 行程 | PUT | `/api/trips/{trip_id}` | 更新旅行 | 是 | 否 |
| 行程 | DELETE | `/api/trips/{trip_id}` | 删除旅行 | 是 | 否 |
| 行程日 | POST | `/api/trips/{trip_id}/days` | 创建行程日 | 是 | 否 |
| 行程节点 | POST | `/api/trip-items` | 创建行程节点 | 是 | 否 |
| 行程节点 | PUT | `/api/trip-items/{item_id}` | 更新行程节点 | 是 | 否 |
| 行程节点 | DELETE | `/api/trip-items/{item_id}` | 删除行程节点 | 是 | 否 |
| 对话 | POST | `/api/chat` | 发送消息并获取回复 | 是 | 是 |
| 对话 | GET | `/api/chat/history` | 查询聊天历史 | 是 | 否 |
| 拍照讲解 | POST | `/api/photos/explain` | 上传图片并生成讲解 | 是 | 是 |
| 提醒 | POST | `/api/reminders/check` | 检查行程风险 | 是 | 是 |
| 提醒 | GET | `/api/reminders` | 查询提醒列表 | 是 | 否 |
| 改线 | POST | `/api/trips/{trip_id}/replan` | 生成改线草案 | 是 | 是 |
| 改线 | POST | `/api/trips/{trip_id}/apply-plan` | 应用改线方案 | 是 | 否 |
| 偏好 | GET | `/api/preferences` | 查询用户偏好 | 是 | 否 |
| 偏好 | PUT | `/api/preferences` | 更新用户偏好 | 是 | 否 |
| 记忆 | POST | `/api/memory/summary` | 总结用户记忆 | 可选 | 是 |


## 3. 通用数据结构
### 3.1 Trip
```json
{
  "id": 1,
  "user_id": 1,
  "title": "大连三日游",
  "city": "大连",
  "start_date": "2026-07-01",
  "end_date": "2026-07-03",
  "status": "active"
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | int | 旅行 ID |
| user_id | int | 用户 ID |
| title | string | 旅行标题 |
| city | string | 城市 |
| start_date | string | 开始日期 |
| end_date | string | 结束日期 |
| status | string | `draft` / `active` / `finished`/ `deleted` |


### 3.2 TripDay
```json
{
  "id": 1,
  "trip_id": 1,
  "day_index": 1,
  "trip_date": "2026-07-01",
  "summary": "海边城市漫游"
}
```

### 3.3 TripItem
```json
{
  "id": 1,
  "trip_day_id": 1,
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
| item_type | string | `attraction` / `food` / `rest` / `traffic` |
| status | string | `planned` / `done` / `skipped` / `changed` |


### 3.4 Location
```json
{
  "latitude": 38.92,
  "longitude": 121.64
}
```

### 3.5 Preferences
```json
{
  "explanation_style": "kid",
  "travel_pace": "slow",
  "interests": ["history", "photo"],
  "special_needs": ["less_walking"]
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| explanation_style | string | `professional` / `fun` / `children` |
| travel_pace | string | `compact` / `normal` / `slow` |
| interests | string[] | `history` / `food` / `nature` / `photo` / `family` |
| special_needs | string[] | `less_walking` / `less_queue` / `accessible` |


## 4. 健康检查
### 4.1 GET `/health`
检查后端服务是否启动。

请求参数：无。

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
获取当前旅行的今日行程和未读提醒数量。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | MVP 默认 1 |
| trip_id | int | 是 | 当前旅行 ID |
| date | string | 否 | 指定查询日期，便于演示固定日期 |


请求示例：

```latex
GET /api/home/today?user_id=1&trip_id=1&date=2026-07-01
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "trip_id": 1,
    "trip_title": "大连三日游",
    "city": "大连",
    "date": "2026-07-01",
    "today_items": [
      {
        "id": 1,
        "title": "渔人码头",
        "item_type": "attraction",
        "start_time": "10:00",
        "end_time": "11:30",
        "address": "大连市中山区滨海路",
        "status": "planned"
      }
    ],
    "unread_reminders": 1
  }
}
```

## 6. 行程接口
### 6.1 POST `/api/trips`
创建旅行。

请求体：

```json
{
  "user_id": 1,
  "title": "大连三日游",
  "city": "大连",
  "start_date": "2026-07-01",
  "end_date": "2026-07-03"
}
```

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

### 6.2 GET `/api/trips`
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
        "city": "大连",
        "start_date": "2026-07-01",
        "end_date": "2026-07-03",
        "status": "active"
      }
    ]
  }
}
```

### 6.3 GET `/api/trips/{trip_id}`
获取旅行详情。

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| trip_id | int | 旅行 ID |


查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |


响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "title": "大连三日游",
    "city": "大连",
    "start_date": "2026-07-01",
    "end_date": "2026-07-03",
    "status": "active",
    "days": [
      {
        "id": 1,
        "day_index": 1,
        "trip_date": "2026-07-01",
        "summary": "海边城市漫游",
        "items": [
          {
            "id": 1,
            "title": "渔人码头",
            "item_type": "attraction",
            "start_time": "10:00",
            "end_time": "11:30",
            "address": "大连市中山区滨海路",
            "status": "planned"
          }
        ]
      }
    ]
  }
}
```

### 6.4 PUT `/api/trips/{trip_id}`
更新旅行基础信息。

请求体：

```json
{
  "user_id": 1,
  "title": "大连轻松三日游",
  "status": "active"
}
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

### 6.5 DELETE `/api/trips/{trip_id}`
删除旅行。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |


请求体：

```json
{
  "user_id": 1,
  "trip_id": 1,
  
}
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

### 6.6 POST `/api/trips/{trip_id}/days`
创建行程日。

请求体：

```json
{
  "user_id": 1,
  "day_index": 1,
  "trip_date": "2026-07-01",
  "summary": "海边城市漫游"
}
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

### 6.7 POST `/api/trip-items`
创建行程节点。

请求体：

```json
{
  "user_id": 1,
  "trip_day_id": 1,
  "title": "渔人码头",
  "item_type": "attraction",
  "start_time": "10:00",
  "end_time": "11:30",
  "address": "大连市中山区滨海路",
  "latitude": 38.92,
  "longitude": 121.64,
  "notes": "适合拍照和慢走"
}
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

### 6.8 PUT `/api/trip-items/{item_id}`
更新行程节点。

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

### 6.9 DELETE `/api/trip-items/{item_id}`
删除行程节点。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |
| trip_id | int  | 是 | 旅行 ID |
| trip_day_id | int | 是 | 旅行日 ID |
| trip_item_id | int | 是 | 行程 ID |


```json
{
  "user_id": 1,
  "trip_id": 1,
  "trip_day_id": 1,
  "trip_item_id": 1
}
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

## 7. AI 对话接口
### 7.1 POST `/api/chat`
向导友 Agent 发送消息。

后端处理流程：

```latex
保存用户消息
→ 读取行程上下文
→ 读取用户偏好
→ 读取最近聊天历史
→ 调用 LangGraph Agent
→ 保存 assistant 回复
→ 返回 reply
```

请求体：

```json
{
  "user_id": 1,
  "trip_id": 1,
  "message": "下午我想轻松一点，怎么安排？"
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |
| trip_id | int | 是 | 当前旅行 ID |
| message | string | 是 | 用户输入 |


响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "reply": "你下午原本有两个景点，节奏略紧。我建议保留距离近的海边点位，把另一个换成咖啡馆休息，这样更符合你的慢节奏偏好。",
    "intent": "chat",
    "follow_up_questions": [
      "修改行程到咖啡馆休息",
      "附近适合休息的地方还有哪些？"
    ]
  }
}
```

Agent 输出约定：

```json
{
  "intent": "chat",
  "reply": "给用户的自然语言回复",
  "structured_data": {},
  "follow_up_questions": []
}
```

### 7.2 GET `/api/chat/history`
查询聊天历史。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |
| trip_id | int | 是 | 当前旅行 ID |
| limit | int | 否 | 默认 20 |


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

## 8. 拍照讲解接口
### 8.1 POST `/api/photos/explain`
上传图片并生成景点讲解。

请求类型：

```latex
multipart/form-data
```

表单字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | MVP 默认 1 |
| trip_id | int | 是 | 当前旅行 ID |
| image | file | 是 | 用户上传图片 |
| current_location | string | 否 | JSON 字符串，包含 latitude 和 longitude |
| style | string | 是 | json字符串，包括professional、casual、kid |


请求示例：

```latex
POST /api/photos/explain
Content-Type: multipart/form-data

user_id=1
trip_id=1
image=<file>
current_location={"latitude":38.92,"longitude":121.64}
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "photo_id": 1,
    "image_path": "uploads/images/yurenmatou.jpg",
    "recognition_result": "图片可能是大连渔人码头，包含港湾、欧式建筑和海边步道。",（可能没用）
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

## 9. 智能提醒接口
### 9.1 POST `/api/reminders/check`
检查当前行程风险。MVP 使用半主动提醒，由用户点击触发。

请求体：

```json
{
  "user_id": 1,
  "trip_id": 1,
  "current_time": "2026-07-01T09:20:00+08:00",
  "current_location": {
    "latitude": 38.92,
    "longitude": 121.64
  }
}
```

响应示例：存在风险

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "has_risk": true,
    "reminder": {
      "id": 1,
      "type": "departure",
      "content": "距离下一个景点还有约 40 分钟路程，建议现在出发，这样能比较从容地赶上 10:00 的安排。",
      "status": "unread"
    }
  }
}
```

响应示例：暂无风险

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "has_risk": false,
    "reminder": null
  }
}
```

提醒类型：

| type | 说明 | MVP 优先级 |
| --- | --- | --- |
| departure | 出发提醒 | P0 |
| conflict | 时间冲突提醒 | P0 |
| weather | 天气提醒 | P1 |
| rest | 休息提醒 | P1 |


### 9.2 GET `/api/reminders`
查询提醒列表。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |
| trip_id | int | 是 | 当前旅行 ID |
| status | string | 否 | `unread` / `read` |


响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "reminders": [
      {
        "id": 1,
        "type": "departure",
        "content": "距离下一个景点还有约 40 分钟路程，建议现在出发。",
        "status": "unread",
        "created_at": "2026-07-01T09:20:00+08:00"
      }
    ]
  }
}
```

## 10. 动态改线接口
### 10.1 POST `/api/trips/{trip_id}/replan`
生成新的行程草案，不直接覆盖原行程。

请求体：

```json
{
  "user_id": 1,
  "message": "我有点累，不想去下一个景点了，帮我换一个轻松点的安排。",
  "current_location": {
    "latitude": 38.92,
    "longitude": 121.64
  }
}
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "draft_id": "draft_001",
    "summary": "建议取消较远的户外景点，改为附近咖啡馆休息，再保留傍晚海边散步。",
    "reason": "你当前偏好慢节奏和少步行，原计划下午路线距离较远。",
    "new_items": [
      {
        "title": "附近咖啡馆休息",
        "item_type": "rest",
        "start_time": "14:30",
        "end_time": "15:30",
        "address": "渔人码头附近",
        "notes": "减少步行，适合恢复体力"
      }
    ],
    "removed_item_ids": [3]
  }
}
```

约束：

+ 此接口只生成草案，不修改 `trip_items`。
+ `draft_id` 用于后续确认应用。
+ Agent 或地图 API 失败时可返回固定演示草案。

Agent 输出约定：

```json
{
  "intent": "replan",
  "reply": "自然语言说明",
  "structured_data": {
    "summary": "草案摘要",
    "reason": "推荐理由",
    "new_items": [],
    "removed_item_ids": []
  },
  "follow_up_questions": []
}
```

### 10.2 POST `/api/trips/{trip_id}/apply-plan`
用户确认后应用改线方案。

请求体：

```json
{
  "user_id": 1,
  "draft_id": "draft_001"
}
```

响应示例：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "applied": true,
    "updated_item_ids": [3],
    "created_item_ids": [8]
  }
}
```

约束：

+ 需要事务处理，避免只更新一半。
+ 应用后首页应重新请求 `/api/home/today`。

## 11. 用户偏好接口
### 11.1 GET `/api/preferences`
查询用户偏好。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | int | 是 | 用户 ID |


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

## 12. 用户记忆接口
### 12.1 POST `/api/memory/summary`
根据聊天记录总结用户记忆。MVP 可由后端或 Agent 在合适时机触发，前端不一定直接调用。

请求体：

```json
{
  "user_id": 1,
  "trip_id": 1
}
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

## 13. Agent 对接约定
后端调用 Agent 时建议统一通过 `agent_service`，不要在 router 中直接调用 LangGraph。

### 13.1 通用 Agent 输入
```json
{
  "user_id": 1,
  "trip_id": 1,
  "user_message": "下午我想轻松一点",
  "intent_hint": "chat",
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
  "structured_data": {},
  "follow_up_questions": []
}
```

### 13.3 后端兜底规则
+ Agent 缺少 `reply` 时，返回固定 fallback 文案。
+ Agent `structured_data` 结构错误时，返回 `5003` 或降级草案。
+ 大模型超时时，优先保证演示链路不断。
+ 后端日志可记录错误类型，但不能记录 API key、token、Cookie。

## 14. 前端 Mock 参考
前端 Mock 目录建议：

```latex
frontend/api/mock/
├── home.ts
├── trips.ts
├── chat.ts
├── photos.ts
├── reminders.ts
└── preferences.ts
```

Mock 原则：

+ 字段名必须与本文档一致。
+ 响应必须包含 `code`、`message`、`data`。
+ 切换真实 API 前，前端负责人和后端负责人共同确认字段。

## 15. 测试建议
数据库与测试负责人可按以下顺序写接口测试：

1. `/health`。
2. 创建旅行。
3. 创建行程日。
4. 创建行程节点。
5. 查询旅行详情。
6. 查询首页今日行程。
7. 更新用户偏好。
8. 发送聊天消息。
9. 查询聊天历史。
10. 上传图片讲解。
11. 检查提醒。
12. 生成改线草案。
13. 应用改线方案。

每个核心接口至少覆盖：

+ 正常请求。
+ 缺少必填字段。
+ 资源不存在。
+ 外部 API 或 Agent 失败时的 fallback。

