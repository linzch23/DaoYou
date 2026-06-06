// frontend/api/mock/_seed.ts
// 共享 demo 数据 —— 围绕 trip_id=1 的「大连三日游」组织，
// 让 home / trips / trip-detail / chat 之间的数据可串联。
// 坐标使用真实大连地标经纬度（避免 0,0）。

import type {
  Trip,
  TripSummary,
  TripItem,
  TripDay,
  Reminder,
  ChatMessage,
  Preferences,
  MemoryRecord,
} from '../types'

// 固定用户（MVP 单用户）
export const SEED_USER_ID = 1

// 主行程：trip_id = 1
const TRIP_ID = 1
const CITY = '大连'
const START = '2026-07-01'
const END = '2026-07-03'

// 各 day 的 trip_day_id
const DAY1_ID = 11
const DAY2_ID = 12
const DAY3_ID = 13

// ──────────── TripItem 集合（跨 3 天复用） ────────────

const item1: TripItem = {
  id: 101,
  trip_day_id: DAY1_ID,
  title: '星海广场',
  item_type: 'attraction',
  start_time: '09:00',
  end_time: '11:30',
  address: '大连市沙河口区星海广场',
  latitude: 38.8867,
  longitude: 121.5833,
  status: 'done',
  notes: '亚洲最大城市广场，海景开阔。',
}

const item2: TripItem = {
  id: 102,
  trip_day_id: DAY1_ID,
  title: '午餐：日式拉面',
  item_type: 'food',
  start_time: '12:00',
  end_time: '13:00',
  address: '大连市沙河口区黑石礁街',
  latitude: 38.8801,
  longitude: 121.5612,
  status: 'planned',
}

const item3: TripItem = {
  id: 103,
  trip_day_id: DAY1_ID,
  title: '大连贝壳博物馆',
  item_type: 'attraction',
  start_time: '14:00',
  end_time: '16:30',
  address: '大连市沙河口区星海广场西侧',
  latitude: 38.8855,
  longitude: 121.5791,
  status: 'planned',
}

const item4: TripItem = {
  id: 104,
  trip_day_id: DAY2_ID,
  title: '棒棰岛景区',
  item_type: 'attraction',
  start_time: '09:30',
  end_time: '12:00',
  address: '大连市中山区棒棰岛',
  latitude: 38.9031,
  longitude: 121.6601,
  status: 'planned',
}

const item5: TripItem = {
  id: 105,
  trip_day_id: DAY2_ID,
  title: '海鲜午餐',
  item_type: 'food',
  start_time: '12:30',
  end_time: '13:30',
  address: '大连市中山区港湾广场',
  latitude: 38.9188,
  longitude: 121.6311,
  status: 'planned',
}

const item6: TripItem = {
  id: 106,
  trip_day_id: DAY2_ID,
  title: '俄罗斯风情街',
  item_type: 'attraction',
  start_time: '15:00',
  end_time: '17:30',
  address: '大连市西岗区团结街',
  latitude: 38.9142,
  longitude: 121.6203,
  status: 'planned',
}

const item7: TripItem = {
  id: 107,
  trip_day_id: DAY3_ID,
  title: '滨海路骑行',
  item_type: 'traffic',
  start_time: '08:30',
  end_time: '11:00',
  address: '大连市滨海路',
  latitude: 38.8920,
  longitude: 121.6055,
  status: 'planned',
  notes: '建议租车，提前查看天气。',
}

const item8: TripItem = {
  id: 108,
  trip_day_id: DAY3_ID,
  title: '返程休整',
  item_type: 'rest',
  start_time: '15:00',
  end_time: '17:00',
  address: '酒店休息',
  latitude: 38.9188,
  longitude: 121.6311,
  status: 'planned',
}

const allItems: TripItem[] = [item1, item2, item3, item4, item5, item6, item7, item8]

// ──────────── TripDay 集合 ────────────

const day1: TripDay = {
  id: DAY1_ID,
  trip_id: TRIP_ID,
  day_index: 1,
  trip_date: '2026-07-01',
  summary: '星海广场 + 贝壳博物馆，看海听风。',
  items: [item1, item2, item3],
}

const day2: TripDay = {
  id: DAY2_ID,
  trip_id: TRIP_ID,
  day_index: 2,
  trip_date: '2026-07-02',
  summary: '棒棰岛 + 风情街，海鲜正餐。',
  items: [item4, item5, item6],
}

const day3: TripDay = {
  id: DAY3_ID,
  trip_id: TRIP_ID,
  day_index: 3,
  trip_date: '2026-07-03',
  summary: '滨海路骑行 + 休整返程。',
  items: [item7, item8],
}

// ──────────── Trip ────────────

export const seedTrip: Trip = {
  id: TRIP_ID,
  user_id: SEED_USER_ID,
  title: '大连三日游',
  city: CITY,
  start_date: START,
  end_date: END,
  status: 'active',
  days: [day1, day2, day3],
}

// 另一条「草稿」trip，用于列表展示
const seedTrip2: Trip = {
  id: 2,
  user_id: SEED_USER_ID,
  title: '青岛两日周末',
  city: '青岛',
  start_date: '2026-08-15',
  end_date: '2026-08-16',
  status: 'draft',
  days: [
    {
      id: 21,
      trip_id: 2,
      day_index: 1,
      trip_date: '2026-08-15',
      summary: '栈桥 + 八大关',
      items: [],
    },
  ],
}

// 一条已结束的 trip
const seedTrip3: Trip = {
  id: 3,
  user_id: SEED_USER_ID,
  title: '西安四日文化行',
  city: '西安',
  start_date: '2026-05-01',
  end_date: '2026-05-04',
  status: 'finished',
  days: [],
}

// 两条「已删除」trip(specs/TrashPage.md §6.4.4 触发新增,演示 TrashPage 4 视图态中的 `loaded`)
// 后端无 deleted_at 字段,按 id 降序近似 deleted_at 降序(per spec §6.4.3)
const seedTrip4: Trip = {
  id: 4,
  user_id: SEED_USER_ID,
  title: '西藏自驾游',
  city: '拉萨',
  start_date: '2026-06-01',
  end_date: '2026-06-03',
  status: 'deleted',
  days: [],
}
const seedTrip5: Trip = {
  id: 5,
  user_id: SEED_USER_ID,
  title: '上海周末',
  city: '上海',
  start_date: '2026-04-15',
  end_date: '2026-04-16',
  status: 'deleted',
  days: [],
}

export const seedTrips: Trip[] = [seedTrip, seedTrip2, seedTrip3, seedTrip4, seedTrip5]

// §6.2 列表响应用 —— 投影掉 user_id 与 days
export const seedTripSummaries: TripSummary[] = seedTrips.map((t) => ({
  id: t.id,
  title: t.title,
  city: t.city,
  start_date: t.start_date,
  end_date: t.end_date,
  status: t.status,
}))

// ──────────── 今日行程（day 1 of trip 1） ────────────

export const seedTodayItems: TripItem[] = [item1, item2, item3]

// ──────────── Reminders ────────────

export const seedReminders: Reminder[] = [
  {
    id: 501,
    type: 'departure',
    content: '下一项「大连贝壳博物馆」将于 14:00 出发，建议提前 30 分钟出门。',
    status: 'unread',
    created_at: '2026-07-01T13:25:00+08:00',
  },
  {
    id: 502,
    type: 'weather',
    content: '明日棒棰岛有阵雨，建议携带雨具并调整户外停留时间。',
    status: 'read',
    created_at: '2026-07-01T18:00:00+08:00',
  },
]

// ──────────── Chat 历史 ────────────

export const seedChatHistory: ChatMessage[] = [
  {
    id: 1,
    role: 'user',
    content: '今天下午想去贝壳博物馆，怎么走？',
    created_at: '2026-07-01T11:42:00+08:00',
  },
  {
    id: 2,
    role: 'assistant',
    content: '从星海广场步行约 15 分钟，路线已为您规划。',
    created_at: '2026-07-01T11:42:18+08:00',
  },
  {
    id: 3,
    role: 'user',
    content: '明天的棒棰岛需要提前预约吗？',
    created_at: '2026-07-01T13:10:00+08:00',
  },
  {
    id: 4,
    role: 'assistant',
    content: '棒棰岛景区无需预约，门票可现场或线上购买。',
    created_at: '2026-07-01T13:10:25+08:00',
  },
  {
    id: 5,
    role: 'user',
    content: '今天下午想去贝壳博物馆，怎么走？',
    created_at: '2026-07-01T15:02:00+08:00',
  },
  {
    id: 6,
    role: 'assistant',
    content: '这里是导友的演示回复。',
    created_at: '2026-07-01T15:02:20+08:00',
  },
]

// ──────────── Preferences ────────────

export const seedPreferences: Preferences = {
  explanation_style: 'fun',
  travel_pace: 'slow',
  interests: ['history', 'photo'],
  special_needs: ['less_walking'],
}

// ──────────── Memory（行程结束后的总结） ────────────

// §12.1 memory_value 是对象
export const seedMemories: MemoryRecord[] = [
  {
    memory_type: 'preference',
    memory_key: 'travel_pace',
    memory_value: { description: '用户偏好慢节奏，3 天行程密度适宜。' },
    confidence: 0.92,
  },
  {
    memory_type: 'behavior',
    memory_key: 'photo_habit',
    memory_value: { description: '用户在景点类 item 处停留时间较长，喜欢拍照。' },
    confidence: 0.78,
  },
]

// 暴露所有 items 供其他 mock 复用
export const seedAllItems: TripItem[] = allItems
