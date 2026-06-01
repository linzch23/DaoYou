// frontend/api/types.ts
// 共享类型与枚举 —— 与 docs/API接口文档.md 严格对齐。
// MVP 约定：所有需要鉴权的端点使用固定 user_id = 1。
//
// 时间格式约定（§1.2）：
//   日期：      'YYYY-MM-DD'，例如 '2026-07-01'
//   时间：      'HH:mm'，     例如 '10:00'         ← TripItem.start_time / end_time
//   日期时间：  ISO 8601，     例如 '2026-07-01T09:20:00+08:00'  ← ChatMessage/Reminder.created_at

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

export type ItemType = 'attraction' | 'food' | 'rest' | 'traffic'
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

// ───────────────── Trip / TripDay / TripSummary ─────────────────

// §3.1 —— 多了 'deleted'
export type TripStatus = 'draft' | 'active' | 'finished' | 'deleted'

export interface TripDay {
  id: number
  trip_id: number   // §3.2
  day_index: number
  trip_date: string // 'YYYY-MM-DD'
  summary: string
  // §6.3 详情响应里 days 数组中每项包含 items（草案项目用 ReplanNewItem）
  items: TripItem[]
}

// §3.1 + §6.3 详情响应 —— 全量 Trip
export interface Trip {
  id: number
  user_id: number
  title: string
  city: string
  start_date: string // 'YYYY-MM-DD'
  end_date: string
  status: TripStatus
  days: TripDay[]
}

// §6.2 列表响应 —— 轻量 Trip（无 user_id、无 days）
export interface TripSummary {
  id: number
  title: string
  city: string
  start_date: string
  end_date: string
  status: TripStatus
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

// §10.1 改线草案里的 new_items 元素（与 TripItem 不同：草案项没有 id/status/经纬度/trip_day_id）
export interface ReplanNewItem {
  title: string
  item_type: ItemType
  start_time: string // HH:mm
  end_time: string   // HH:mm
  address: string
  notes?: string
}

export interface ReplanDraft {
  draft_id: string // §10.1 样例为 'draft_001'，字符串
  summary: string
  reason: string
  new_items: ReplanNewItem[]
  removed_item_ids: number[]
}

// ───────────────── Request 类型（mock 不消费，但为后续 request 封装做准备） ─────────────────

export interface CreateTripRequest {
  user_id: number
  title: string
  city: string
  start_date: string
  end_date: string
}

export interface UpdateTripRequest {
  user_id: number
  title?: string
  status?: TripStatus
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
  title: string
  item_type: ItemType
  start_time: string // HH:mm
  end_time: string   // HH:mm
  address: string
  latitude: number
  longitude: number
  notes?: string
}

export interface UpdateTripItemRequest {
  user_id: number
  start_time?: string // HH:mm
  end_time?: string   // HH:mm
  status?: ItemStatus
  notes?: string
}

export interface ChatRequest {
  user_id: number
  trip_id: number
  message: string
}

export interface PhotoExplainForm {
  user_id: number
  trip_id: number
  image: File | Blob
  current_location?: string // JSON 字符串："{ latitude, longitude }"
  style: PhotoStyle
}

export interface ReminderCheckRequest {
  user_id: number
  trip_id: number
  current_time: string // ISO 8601
  current_location: Location
}

export interface ReplanRequest {
  user_id: number
  message: string
  current_location: Location
}

export interface ApplyPlanRequest {
  user_id: number
  draft_id: string // §10.2 样例为 'draft_001'
}

export interface UpdatePreferencesRequest {
  user_id: number
  preferences: Preferences
}

export interface MemorySummaryRequest {
  user_id: number
  trip_id: number
}
