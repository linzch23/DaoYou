// frontend/api/mock/replan.ts
// 覆盖 docs/API接口文档.md §10.1–§10.2
//   POST /api/trips/{trip_id}/replan     → replanMock
//   POST /api/trips/{trip_id}/apply-plan → applyPlanMock

import type { ApiResponse, ReplanDraft, ReplanNewItem } from '../types'
import { seedAllItems } from './_seed'

// 演示改线：删除 item3（贝壳博物馆），追加一个休息类草案
const removedIds = [seedAllItems[2].id] // 103

// §10.1 new_items 元素是 ReplanNewItem（无 id / 经纬度 / status / trip_day_id）
const newItem: ReplanNewItem = {
  title: '附近咖啡馆休息',
  item_type: 'rest',
  start_time: '14:30',
  end_time: '15:30',
  address: '渔人码头附近',
  notes: '减少步行，适合恢复体力',
}

const draft: ReplanDraft = {
  draft_id: 'draft_001', // §10.1 字符串
  summary: '建议取消较远的户外景点，改为附近咖啡馆休息，再保留傍晚海边散步。',
  reason: '你当前偏好慢节奏和少步行，原计划下午路线距离较远。',
  new_items: [newItem],
  removed_item_ids: removedIds,
}

export const replanMock: ApiResponse<ReplanDraft> = {
  code: 0,
  message: 'success',
  data: draft,
}

// §10.2 created_item_ids 是数字数组（应用改线时为新生成的行程节点分配的 id）
export const applyPlanMock: ApiResponse<{
  applied: boolean
  updated_item_ids: number[]
  created_item_ids: number[]
}> = {
  code: 0,
  message: 'success',
  data: {
    applied: true,
    updated_item_ids: [],
    created_item_ids: [8], // 演示用：应用草案后新生成的行程节点 id
  },
}
