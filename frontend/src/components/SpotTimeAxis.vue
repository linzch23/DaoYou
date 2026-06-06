<!--
  SpotTimeAxis.vue — 横向 scroll-view 卡片列表(见 spec §3.1 / §8.2)
  
  Spec contract: specs/HomePage.md §8.2
  
  Props
    items      : TripItem[]   来自 today.today_items(已按 start_time 升序)
    favorites  : number[]     已收藏 id 列表
    activeId   : number|null  当前进行中 item id;null = 无"现在"节点
  
  Emits
    select        : TripItem     用户点某张卡片
    activeChange  : { id: number }   滚动后当前活动卡片变化(预留埋点)
-->
<template>
  <scroll-view
    class="spot-time-axis"
    :class="`spot-time-axis-${items.length > 0 ? 'has-items' : 'empty'}`"
    scroll-x
    :scroll-with-animation="true"
    :enhanced="true"
    :show-scrollbar="false"
    :scroll-into-view="scrollIntoId"
    @scroll="onScroll"
  >
    <view class="spot-time-axis-track">
      <view
        v-for="(item, idx) in items"
        :key="item.id"
        :id="`spot-${item.id}`"
        class="spot-time-axis-cell"
      >
        <SpotCard
          :spot="item"
          :state="computeState(item)"
          :is-favorite="favorites.includes(item.id)"
          @tap="onCardTap(item)"
        />
        <!-- 分隔提示(最后一个不画) -->
        <view
          v-if="idx < items.length - 1"
          class="spot-time-axis-divider"
          aria-hidden="true"
        />
      </view>
    </view>
  </scroll-view>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import SpotCard from './SpotCard.vue'
import { HomeStrings } from '../constants/strings.js'

const props = defineProps({
  /** @type {import('vue').PropType<Array<import('../api/types').TripItem>>} */
  items: {
    type: Array,
    required: true,
  },
  /** @type {import('vue').PropType<number[]>} */
  favorites: {
    type: Array,
    required: true,
  },
  /** @type {import('vue').PropType<number | null>} */
  activeId: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits(['select', 'activeChange'])

/**
 * 将 HH:mm 转换为今日分钟数
 * @param {string} hhmm
 * @returns {number}
 */
function hhmmToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return -1
  const [h, m] = hhmm.split(':').map((v) => Number.parseInt(v, 10))
  if (Number.isNaN(h) || Number.isNaN(m)) return -1
  return h * 60 + m
}

/**
 * 取当前时间对应的今日分钟数
 * @returns {number}
 */
function nowMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * 计算某 item 的 3 态(只按时间,与后端 status 字段**完全无关**)。
 *
 * UI-021 修订(2026-06-06):用户期望统一为"end_time 已过 → 透明度 0.5",不再用
 * 后端 status 区分视觉态。后端 status(done / changed / skipped)在此处被刻意
 * 忽略;'done' 也不再映射为独立态(沿用 done 绿底删除同步收敛)。
 *
 * 规则:
 *   1. 时间解析失败(start 或 end 无效)→ 'upcoming'(兜底,不渲染过期灰)
 *   2. now ∈ [start, end]                → 'active'  (进行中,primarySoft 边框)
 *   3. now < start                        → 'upcoming'(未开始,默认白底)
 *   4. now > end                          → 'expired' (已过 end_time,opacity 0.5)
 *
 * 注:SpotCard 的 prop 仍允许 'done' / 'changed' 入参(其他 page 仍可能传),
 * 本组件(home tab 唯一调用方)只产 3 态。'done' 入参时 CSS 已收敛为 upcoming
 * 视觉,✅ 印章仍由 SpotCard 模板 v-if 渲染(打卡反馈信息,per UI-021 §1 备注)。
 *
 * @param {import('../api/types').TripItem} item
 * @returns {'active' | 'upcoming' | 'expired'}
 */
function computeState(item) {
  const start = hhmmToMinutes(item.start_time)
  const end = hhmmToMinutes(item.end_time)
  const now = nowMinutes()
  if (start < 0 || end < 0) return 'upcoming'
  if (now >= start && now <= end) return 'active'
  if (now < start) return 'upcoming'
  return 'expired'
}

/**
 * 滚动定位:取 active 卡片;若 activeId 存在则用它
 * 初始化时 scroll-into-view 到 active / 第一个 upcoming
 */
const scrollIntoId = ref('')

watch(
  () => [props.items, props.activeId],
  async () => {
    await nextTick()
    // 优先 activeId;无则用内部 active 计算的第一个
    let target = props.activeId
    if (target == null) {
      const found = props.items.find((i) => computeState(i) === 'active')
      if (found) target = found.id
    }
    if (target != null) {
      scrollIntoId.value = `spot-${target}`
    } else {
      // 否则定位到第一个 upcoming
      const upcoming = props.items.find((i) => computeState(i) === 'upcoming')
      if (upcoming) scrollIntoId.value = `spot-${upcoming.id}`
    }
  },
  { immediate: true, deep: true }
)

/**
 * @param {import('../api/types').TripItem} item
 */
function onCardTap(item) {
  emit('select', item)
}

function onScroll() {
  // 滚动后活动卡片变化(预留埋点;MVP 阶段不发)
  // 这里如果需要可视区判定,可结合 IntersectionObserver;为简单起见只在每次 emit 'select' 时记录
}

onMounted(() => {
  // 首次定位:scroll-into-view 需 scroll-view 已挂载
  nextTick(() => {
    let target = props.activeId
    if (target == null) {
      const found = props.items.find((i) => computeState(i) === 'active')
      if (found) target = found.id
    }
    if (target != null) {
      scrollIntoId.value = `spot-${target}`
    }
  })
})
</script>

<style scoped>
.spot-time-axis {
  width: 100%;
  white-space: nowrap;
  box-sizing: border-box;
  /* 留出左侧/右侧 40rpx 内边距(与 Body 水平边距对齐) */
  padding: 0 40rpx;
}

.spot-time-axis-track {
  display: inline-flex;
  align-items: stretch;
  gap: 16rpx;
  /* space-md */
  padding: 8rpx 0;
  box-sizing: border-box;
}

.spot-time-axis-cell {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.spot-time-axis-divider {
  width: 4rpx;
  /* UI-026 (2026-06-06):从 1rpx 提升到 4rpx,提升横向滚动卡片间分隔可识别度 */
  height: 64rpx;
  background: rgba(45, 106, 94, 0.15);
  /* UI-026:从 0.10 提升到 0.15,主色阴影更明显但不刺眼 */
  flex-shrink: 0;
}
</style>
