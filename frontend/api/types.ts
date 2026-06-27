// frontend/api/types.ts
// 共享类型与枚举 —— 与 docs/API接口文档.md 严格对齐。
// MVP 约定：所有需要鉴权的端点使用固定 user_id = 1。
//
// 时间格式约定（§1.2）：
//   日期：      'YYYY-MM-DD'，例如 '2026-07-01'
//   时间：      'HH:mm'，     例如 '10:00'         ← TripItem.start_time / end_time
//   日期时间：  ISO 8601，     例如 '2026-07-01T09:20:00+08:00'  ← ChatMessage/Reminder.created_at
//
// v0.3.0(2026-06-11):ChatRequest 补 trip_id + current_location 字段,与后端 ChatRequest 对齐
// v0.3.1(2026-06-11):新增 LocationUpdate types,与后端 locations.py:UpdateLocationRequest 对齐
// 2026-06-23:chat/photo 恢复 trip_id 必填,与每个旅程一个对话页面的前端逻辑对齐。
// 2026-06-24(trip_id 一致性审计触发):Trip / TripSummary / HomeTodayData 移除 `city` 字段,
//   对齐 docs/API接口文档.md §3.1(L116-128 Trip 字段表无 city)+ §5.1(L383-405 /home/today
//   响应 data 无 city)。原 types 字面写 `city: string` 但后端 Pydantic CreateTripRequest
//   (backend/app/schemas/trips.py:7-17) 不接 / Trip schema 也不存 — 前端持有不存在的字段
//   等同埋雷,本轮统一清理;mock/_seed.ts / mock/home.ts / TripCard.vue / HomeDiary.vue
//   联动同步(per issues/Cross-Page/trip-id-audit-fix-2026-06-24)
// 2026-06-24(同审计触发):PhotoExplainForm.image 类型 `File | Blob` → `string`,uni-app
//   实际传本地临时路径(uni.chooseImage 返回值),原类型是浏览器/Node 占位
// 这些改动由 orchestrator 在 data/contract 层直接做(per AGENTS.md §0 api/ 是 code-writer READ-ONLY 范围,不在 worker 派单里)

// ───────────────── 响应信封 / 错误码 ─────────────────

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export type ErrorCode =
  | 0    // success
  | 4000 // bad request
  | 4001 // not found
  | 4002 // upload fail
  | 5000 // server error
  | 5001 // LLM error
  | 5002 // map error
  | 5003 // agent output parse error

// ───────────────── 共享值对象 ─────────────────

export interface Location {
  latitude: number
  longitude: number
}

// ───────────────── TripItem ─────────────────

// §3.3 + UI-025 扩展:'other' 用于行程安排(横向拖动)兜底类型,
//     实际 TripItem 后端字段未含,纯前端 client-only 类型(POST /api/trips
//     body 用 ItineraryItem,内部包 item_type 字段;TripItem 接受 'other' 是
//     防御性扩展,后端若返回 'other' 也照常展示,ItemTypeEmoji.default 兜底)
export type ItemType = 'attraction' | 'food' | 'rest' | 'traffic' | 'other'
export type ItemStatus = 'planned' | 'done' | 'skipped' | 'changed'

export interface TripItem {
  id: number
  trip_day_id: number // §3.3
  title: string
  item_type: ItemType
  start_time: string // §3.3  HH:mm，例 '10:00'
  end_time: string   // §3.3  HH:mm，例 '11:30'
  address: string
  latitude: number
  longitude: number
  status: ItemStatus
  notes?: string
}

// ───────────────── ItineraryItem(UI-025 行程安排字段)─────────────────
//
// 用于 NewTripPage / EditTripPage form 视图的「行程安排」字段
// (横向 scroll-view + 拖动排序)。
//
// 与 TripItem 的区别(per spec UI-025 §2 / issues/UI/UI-025):
//   - 无 trip_day_id / address / lat-lng / status / notes(纯文本 + 时间段 + 类型)
//   - id 是**客户端生成**稳定 key(Date.now() + 随机后缀),用于 v-for 拖动
//   - item_type 用 'other' 兜底(新加,ItemType 5 枚举)
//   - 服务端若需要回显,POST /api/trips body 携带 itineraryArrange: ItineraryItem[]
//
// 时间格式与 TripItem 一致(沿 §3.3 'HH:mm')
export interface ItineraryItem {
  id: number                // 客户端生成稳定 key(拖动排序需要)
  title: string             // 地点名称
  start_time: string        // 'HH:mm'
  end_time: string          // 'HH:mm'
  item_type: ItemType       // 'attraction' | 'food' | 'traffic' | 'rest' | 'other'
  // 2026-06-23(TripCreateEditFix-001 触发新增):date 是**前端派生**字段,标识该 item 属于哪一天
  //   - 后端 TripItem **无** date 列(关联的是 trip_day_id,date 由 trip_day.trip_date 承担)
  //   - 新建行程时由 NewTripPage 收集(user 选 YYYY-MM-DD + 串行分组到 trip_day)
  //   - 编辑行程时由 EditTripPage 从 trip.days[].items[] 反向派生(date 从 day.trip_date 拿)
  //   - '?' 可选因为后端 GET /api/trip-items 不返回 date;前端用 day.trip_date 补
  //   - api/ 是 READ-ONLY(code-writer 自主决策,deliverable §3 透明登记)
  date?: string             // 'YYYY-MM-DD',前端派生 + user 选填
}

// ───────────────── Trip / TripDay / TripSummary ─────────────────

// §3.1 —— TripStatus 3 枚举(draft / active / finished);'deleted' 语义由 deleted_at 字段承担(specs/TrashPage.md v0.2.0)
export type TripStatus = 'draft' | 'active' | 'finished'

export interface TripDay {
  id: number
  trip_id: number   // §3.2
  day_index: number
  trip_date: string // 'YYYY-MM-DD'
  summary: string
  items: TripItem[]
}

// §3.1 + §6.3 详情响应 —— 全量 Trip
//   注:无 city 字段(per 2026-06-24 审计清理)
export interface Trip {
  id: number
  user_id: number
  title: string
  start_date: string // 'YYYY-MM-DD'
  end_date: string
  status: TripStatus
  days: TripDay[]
  deleted_at: string | null // ISO 8601;null = 活跃;非 null = 已删(per docs/API接口文档.md §3.1,TrashPage v0.2.0)
}

// §6.2 列表响应 —— 轻量 Trip（无 user_id、无 days、无 city）
//   v0.6.0(per user-round4-2026-06-26 19:46 bug 修复):新增 `itinerary_count` 字段,
//     前端 `src/utils/tripStatus.js:computeEffectiveStatus` 派生「完整行程」用
//     (title && start_date && itinerary_count >= 1 → inProgress / finished;
//     缺任一字段 → draft)。
//   - 后端 `backend/app/services/serializers.py:serialize_trip_summary(trip, db)` v0.6.0 起
//     传 db 时走 subquery 一次查清,避免 N+1。
//   - api/ 是 READ-ONLY(code-writer 自主决策,deliverable §3 透明登记)。
export interface TripSummary {
  id: number
  title: string
  start_date: string
  end_date: string
  status: TripStatus
  deleted_at: string | null // ISO 8601;null = 活跃;非 null = 已删(TrashPage 用,per docs/API接口文档.md §3.1)
  // v0.6.0 新增 — 行程项总数(经 TripDay → TripItem join count)
  // MVP 简化:前端仅用 ≥1 / ==0 判定,实际值不展示
  itinerary_count: number
}

// ───────────────── Preferences ─────────────────

// §3.5 偏好模块的讲解风格
export type ExplanationStyle = 'professional' | 'fun' | 'children'
export type TravelPace = 'compact' | 'normal' | 'slow'
export type Interest = 'history' | 'food' | 'nature' | 'photo' | 'family'
export type SpecialNeed = 'less_walking' | 'less_queue' | 'accessible'

export interface Preferences {
  explanation_style: ExplanationStyle
  travel_pace: TravelPace
  interests: Interest[]
  special_needs: SpecialNeed[]
}

// ───────────────── Reminder ─────────────────

export type ReminderType = 'departure' | 'conflict' | 'weather' | 'rest'
export type ReminderStatus = 'unread' | 'read'

// §9.1 /check 响应的 reminder 缺 created_at；§9.2 /reminders 列表里有 —— 故 optional
export interface Reminder {
  id: number
  type: ReminderType
  content: string
  status: ReminderStatus
  created_at?: string // ISO 8601
}

// ───────────────── Chat ─────────────────

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: number
  role: ChatRole
  content: string
  created_at: string // ISO 8601
}

// ───────────────── Memory ─────────────────

// §12.1 memory_value 是对象（如 { description: '...' }）
export interface MemoryRecord {
  memory_type: string
  memory_key: string
  memory_value: Record<string, unknown>
  confidence: number
}

// ───────────────── Replan（动态改线） ─────────────────

// §8.1 拍照讲解表单的 style —— 与 Preferences.explanation_style 是不同字段，使用不同枚举
export type PhotoStyle = 'professional' | 'casual' | 'kid'

// ───────────────── Request 类型（mock 不消费，但为后续 request 封装做准备） ─────────────────

// CreateTripRequest 扩展 itineraryArrange 字段(per UI-025):
//   - 后端是否存 itineraryArrange 暂未确定(per spec §6.4.x PD-001 触发现状),
//     但**前端 POST 携带**便于后续后端补字段时无侵入升级
//   - 沿用既有 4 字段 + user_id(由 service 内部注入) + itineraryArrange 数组
//   - 4 选填字段(companions / budget_range / transport_preference / special_needs)
//     仍**不**入参,client-only(per spec §6.4.2)
//   - 2026-06-23(TripCreateEditFix-001 触发删除):移除 `city` 字段
//     原 type 字面写 `city: string` 但后端 CreateTripRequest (backend/app/schemas/trips.py:7-17) 不接
//     Pydantic extra=ignore 静默丢,前端 types 字面偏差,**应**清理;api/ 是 READ-ONLY,
//     code-writer 自主决策 + deliverable §3 透明登记(spec-writer 后续决策是否同步修订)
export interface CreateTripRequest {
  user_id: number
  title: string
  start_date: string
  end_date: string
  itineraryArrange?: ItineraryItem[] // UI-025 新增(可选,空数组也合法)
}

export interface UpdateTripRequest {
  user_id: number
  title?: string
  status?: TripStatus
  // UI-025 itineraryArrange 是**可选**字段(per v0.3.0 integrate-r1 实证):
  //   - 后端 Pydantic 默认 extra=ignore,前端 POST/PUT 携带此字段会被静默忽略
  //   - 携带无害,前端**默认发送**便于后端补字段时无侵入升级
  //   - 严格来说 `itineraryArrange` 是 `ItineraryItem[]`(UI-025 客户端类型)
  itineraryArrange?: ItineraryItem[] // UI-025 新增(可选,EditTripPage PUT partial-update)
}

export interface CreateTripDayRequest {
  user_id: number
  day_index: number
  trip_date: string
  summary: string
}

export interface CreateTripItemRequest {
  user_id: number
  trip_day_id: number
  // 2026-06-25(per Cross-Page issue location-real-fix-v2-2026-06-25 §2.4):补回 city 必填
  //   - 后端 Pydantic `backend/app/schemas/trips.py:33-44 CreateTripItemRequest` city: str 必填
  //   - 前端 NewTripPage / EditTripPage 调 createTripItem 时**必须**传 city
  //     (page 层从 trip.title 派生,默认 trip.title 字面值)
  //   - 此前 audit (trip-id-audit-fix-2026-06-24) 仅清掉 Trip 表的 city,误连带删除 TripItem 的 city
  city: string
  title: string
  // 以下 6 字段对齐后端 Pydantic 全 optional,前端 MVP 不强求
  item_type?: ItemType
  start_time?: string // HH:mm
  end_time?: string   // HH:mm
  address?: string
  latitude?: number
  longitude?: number
  notes?: string
}

export interface UpdateTripItemRequest {
  user_id: number
  // 2026-06-25(UserRound2-001 Bug A 触发新增,additive only):补 title + item_type 字段
  //   - 后端 UpdateTripItemRequest Pydantic 模型实际接受 title / item_type 可改字段
  //     (per backend/app/schemas/trips.py + user 实测 PUT 200 OK)
  //   - 原 type 字面只列 4 字段(start_time / end_time / status / notes),前端 EditTripPage
  //     onUpdateItem 调用时 title / item_type 实际发向后端但类型无声明,api/ 是 READ-ONLY,
  //     code-writer 自主决策 + deliverable §3 透明登记(spec-writer 后续决策是否同步修订)
  title?: string
  item_type?: ItemType
  start_time?: string // HH:mm
  end_time?: string   // HH:mm
  status?: ItemStatus
  notes?: string
}

export interface ChatRequest {
  user_id: number
  trip_id: number
  message: string
  current_location?: Location // Optional:对齐后端 ChatRequest(per docs/API接口文档.md §8.1)
}

// ───────────────── LocationUpdate(per v0.3.1 integrate-r2)─────────────────
//
// 与后端 `backend/api/locations.py:UpdateLocationRequest` 1:1 对齐。
//
// 用途:MVP 阶段由 page 层调 `uni.getLocation` 获取经纬度,经本 service 上报后端,
// 后端用于行程内推荐 / 安全提醒 / 距离计算等。
//
// v0.3.1(2026-06-11,per integrate-r2 task):
//   - MVP 不接高德 SDK,经纬度精度依赖 `uni.getLocation`(微信小程序 / H5 浏览器 API)
//   - timestamp 秒级(非毫秒)对齐后端契约
//   - 后续如需更高精度,IssueManager 提议在 manifest.json 配高德 key + 引入 @dcloudio/uni-amap
export interface LocationUpdate {
  user_id: number
  latitude: number
  longitude: number
  timestamp: number
}

// LocationUpdateResponse —— `ApiResponse<{ success: boolean }>` 形态别名
//
// 与后端契约 1:1 对齐:`PUT /api/locations` 成功响应
//   { code: 0, message: 'success', data: { success: true } }
//
// 公开 type 而非 interface,便于调用方直接 import 用作 `Promise<LocationUpdateResponse>`
export type LocationUpdateResponse = ApiResponse<{ success: boolean }>

export interface PhotoExplainForm {
  user_id: number
  trip_id: number
  // uni-app 本地临时路径(uni.chooseImage 返回的 tempFilePaths[0]),
  // 不是浏览器/Node 的 File | Blob。原 2026-06-24 审计触发的类型修正。
  image: string
  current_location?: string // JSON 字符串:"{ latitude, longitude }"
}

export interface ReminderCheckRequest {
  user_id: number
  current_time: string // ISO 8601
  current_location?: Location // Optional:未传时由后端读取用户最新位置(per spec §10.1 字段表「否」+ docs/API-前端一致性审计-v2.md §4.4 Resolved 决策 A)
  // 2026-06-19: 删除 trip_id 字段(per b60dc3c 文档修订 + docs/API接口文档.md §10.1 L1320-1327 不再要求 trip_id)
  // 2026-06-22: current_location 改可选(per docs/API-前端一致性审计-v2.md §7.3.1 orchestrator 1-line fix)
}

export interface UpdatePreferencesRequest {
  user_id: number
  preferences: Preferences
}

export interface MemorySummaryRequest {
  user_id: number
  trip_id: number
}
