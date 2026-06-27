<!--
  pages/trip-detail/index.vue — 行程详情页(独立 route,深链 ?tripId=xxx)
  
  Spec contract: specs/TripDetailPage.md v0.1.0
  Route: /pages/trip-detail/index(uni.navigateTo 拉起,支持深链 ?tripId=xxx)
  
  4 视图态(spec §3.9 / §5):
    loading   → 初始 / GET 飞行中
    detail    → 拉取成功 + trip.status !== 'deleted'(嵌套 5 子态: inProgress/upcoming/expired/finished/draft)
    notfound  → URL 缺参/非数字/<=0/资源不存在/已被软删
    error     → 网络断开/5xx/4000/其他 code!==0
  
  5 视图态 = 4 主态 × 3 子态(detail 拆 inProgress/upcoming/expired + finished + draft 共 5 枚举):
    inProgress → AppColors.active 徽章 + 进度条 1-99% + 倒计时
    upcoming   → AppColors.upcoming 徽章 + 进度条 0% + 倒计时
    expired    → AppColors.inkMuted 徽章 + 整页灰色遮罩 + 按钮可点
    finished   → AppColors.inkMuted 徽章 + 整页灰色遮罩 + 按钮置灰 50% 不可点
    draft      → AppColors.warning 徽章 + 无遮罩 + 按钮可点
  
  复用(零修改,spec §3.6 + §10 R-1~R-3):
    - components/SpotCard.vue(单 item 卡片,4 态视觉,emit tap)
    - components/SpotDetailSheet.vue(景点详情浮层,4 emit)
    - components/ErrorBanner.vue(viewMode='error' 兜底)
    - services/trips.getTripDetail / deleteTrip(本次落地)
    - stores/homeStore.fetchTrips(deleteTrip 成功后刷新)
    - constants/strings.js 增量 TripDetailStrings + TripDetailWeekdays + TripDetailStatusLabel
    - AppColors / AppRoutes / logger
  
  私有(本次新建):
    - pages/trip-detail/components/DeleteConfirmDialog.vue(2 按钮 modal)
  
  入口:
    - HomePage TripCard / Diary「查看完整行程」/ NewTripPage POST 成功 / push 通知
    - 注:HomePage 当前用 `?id=xxx`,本页面按 spec §4.3 + §5.1 解析 `?tripId=xxx`;
         此为下游 / 跨页对齐项,见 deliverable §3

  v0.3.0 修订(per user-round5-2026-06-27):
    - SpotDetailSheet 浮层 4 按钮 → 1 按钮(仅保留「导航去这里」),拍照讲解 / 收藏 2 按钮删除
    - 本页面同步删除 onGuide / onToggleFavorite handler + @guide / @toggle-favorite emit binding
    - 选点 / 导航升级 / 收藏跨页共享 推迟到后续 task
-->
<template>
  <view
    class="trip-detail-page"
    :aria-label="strings.pageAria"
  >
    <!-- Header(顶栏 44pt 触达) -->
    <view class="header">
      <view
        class="header-back"
        role="button"
        :aria-label="strings.backAria"
        hover-class="header-back-hover"
        :hover-stay-time="50"
        @click="onBack"
      >
        <text class="header-back-text" aria-hidden="true">←</text>
      </view>
      <text class="header-title">{{ headerTitle }}</text>
    </view>

    <!-- Body(滚动区) -->
    <scroll-view
      class="body"
      scroll-y
      :enhanced="true"
      :show-scrollbar="false"
    >
      <view class="body-inner">
        <!-- loading 态(spec §3.9) -->
        <view
          v-if="viewMode === 'loading'"
          class="state-loading"
        >
          <view class="loading-spinner" aria-hidden="true" />
          <text class="state-loading-text">{{ strings.loadingText }}</text>
        </view>

        <!-- detail 态(spec §3.9 + §3.4 5 子态) -->
        <template v-else-if="viewMode === 'detail' && trip">
          <!-- _TripHeader 信息卡块(spec §3.2) -->
          <view class="trip-header">
            <text class="trip-header-title">{{ trip.title }}</text>
            <view class="trip-header-meta">
              <text class="trip-header-meta-item">📍 {{ trip.city }}</text>
              <text class="trip-header-meta-item">📅 {{ dateRangeText }}</text>
            </view>

            <!-- 状态徽章 + 进度条 + 倒计时(spec §3.4) -->
            <view class="trip-header-status">
              <view
                class="status-badge"
                :class="`status-badge-${currentSubStatus}`"
              >
                <text class="status-badge-text">{{ subStatusLabel }}</text>
              </view>
              <text
                v-if="countdownText"
                class="trip-header-countdown"
              >{{ countdownText }}</text>
            </view>

            <!-- 进度条(仅 inProgress 显百分比) -->
            <view
              v-if="currentSubStatus === 'inProgress'"
              class="trip-header-progress"
              role="progressbar"
              :aria-valuenow="progressPercent"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <view
                class="trip-header-progress-fill"
                :style="{ width: progressPercent + '%' }"
              />
            </view>

            <!-- 灰色遮罩(仅 finished 启用,expired 不遮 — spec §3.4 备注) -->
            <view
              v-if="currentSubStatus === 'finished'"
              class="trip-header-overlay"
              aria-hidden="true"
            />
          </view>

          <!-- _DayList 行程日块列表(spec §3.5) -->
          <view
            v-if="sortedDays.length > 0"
            class="day-list"
          >
            <view
              v-for="(day, dayIdx) in sortedDays"
              :key="day.id || dayIdx"
              class="day-block"
            >
              <view class="day-header">
                <view class="day-index-badge">
                  <text class="day-index-emoji" aria-hidden="true">🗓️</text>
                  <text class="day-index-text">Day {{ day.day_index }}</text>
                </view>
                <text class="day-date">{{ formatDayDate(day.trip_date) }}</text>
              </view>
              <text
                v-if="day.summary"
                class="day-summary"
              >{{ day.summary }}</text>

              <!-- _DayItemList(items 按 start_time 升序) -->
              <view
                v-if="day.items && day.items.length > 0"
                class="day-item-list"
              >
                <SpotCard
                  v-for="item in sortedItems(day.items)"
                  :key="item.id"
                  :spot="item"
                  :state="mapItemState(item, currentSubStatus, today, day.trip_date)"
                  :is-favorite="false"
                  @tap="onSpotTap(item)"
                />
              </view>
              <!-- 空 day 兜底(spec §3 + §5.3.E) -->
              <view
                v-else
                class="day-empty"
              >
                <text class="day-empty-emoji" aria-hidden="true">{{ strings.emptyDayEmoji }}</text>
                <text class="day-empty-text">{{ strings.emptyDayText }}</text>
              </view>
            </view>
          </view>
        </template>

        <!-- notfound 态(spec §3.8 + §3.9) -->
        <view
          v-else-if="viewMode === 'notfound'"
          class="state-notfound"
          role="alert"
        >
          <text class="notfound-emoji" aria-hidden="true">{{ strings.errorNotFoundEmoji }}</text>
          <text class="notfound-message">{{ strings.errorNotFoundMessage }}</text>
          <view
            class="notfound-button"
            role="button"
            :aria-label="strings.errorNotFoundButton"
            hover-class="notfound-button-hover"
            :hover-stay-time="50"
            @click="onNotFoundAction"
          >
            <text class="notfound-button-text">{{ strings.errorNotFoundButton }}</text>
          </view>
        </view>

        <!-- error 态(spec §3.9) -->
        <view
          v-else-if="viewMode === 'error'"
          class="state-error"
        >
          <ErrorBanner
            :message="errorMessage"
            :retryable="true"
            :loading="isRetrying"
            @retry="onRetry"
          />
        </view>
      </view>
    </scroll-view>

    <!-- Sticky _ActionBar(底部 1-2 按钮,viewMode='detail' 时显示;UI-024:finished 时只显示「复制行程」) -->
    <view
      v-if="viewMode === 'detail' && trip"
      class="action-bar"
    >
      <view
        class="action-bar-btn action-bar-btn-delete"
        role="button"
        :aria-label="strings.btnDelete"
        hover-class="action-bar-btn-delete-hover"
        :hover-stay-time="50"
        @click="onDeleteClick"
      >
        <text class="action-bar-btn-delete-text">{{ strings.btnDelete }}</text>
      </view>
      <view
        class="action-bar-btn action-bar-btn-modify"
        role="button"
        :aria-label="isCopyMode ? strings.btnCopy : strings.btnModify"
        hover-class="action-bar-btn-modify-hover"
        :hover-stay-time="50"
        @click="onActionClick"
      >
        <text class="action-bar-btn-modify-text">{{ isCopyMode ? strings.btnCopy : strings.btnModify }}</text>
      </view>
    </view>

    <!-- 景点详情浮层(spec §8.3 复用) -->
    <!-- v0.3.0(per user-round5-2026-06-27):删 :is-favorite + @guide + @toggle-favorite
         SpotDetailSheet 浮层 v0.3.0 起不显示收藏按钮 / 拍照讲解按钮(只剩 1 按钮「导航」) -->
    <SpotDetailSheet
      :spot="selectedSpot"
      @close="onSheetClose"
      @navigate="onNavigate"
    />

    <!-- 删除确认弹窗(私有组件) -->
    <DeleteConfirmDialog
      :visible="dialogVisible"
      :title="strings.deleteDialogTitle"
      :message="strings.deleteDialogMessage"
      :btn-cancel-label="strings.deleteDialogCancel"
      :btn-confirm-label="strings.deleteDialogConfirm"
      :confirming="isDeleting"
      @cancel="onDialogCancel"
      @confirm="onDialogConfirm"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useHomeStore } from '../../stores/homeStore.js'
import {
  TripDetailStrings,
  TripDetailWeekdays,
  TripDetailStatusLabel,
} from '../../constants/strings.js'
import { AppColors } from '../../constants/colors.js'
import { AppRoutes } from '../../constants/routes.js'
import { logger } from '../../utils/logger.js'
import { getTripDetail, deleteTrip } from '../../services/trips.js'
import { ApiError } from '../../services/preferences.js'

import SpotCard from '../../components/SpotCard.vue'
import SpotDetailSheet from '../../components/SpotDetailSheet.vue'
import ErrorBanner from '../../components/ErrorBanner.vue'
import DeleteConfirmDialog from './components/DeleteConfirmDialog.vue'

// TripDetailStrings 引用(避免后续改动时全局替换)
const strings = TripDetailStrings

// ─────────────── Store ───────────────
const store = useHomeStore()

// ─────────────── Local State(spec §4.1) ───────────────

/** @type {import('vue').Ref<number | null>} 解析自 URL ?tripId=xxx,无效 → null(驱动 notfound) */
const tripId = ref(null)

/** @type {import('vue').Ref<'loading' | 'detail' | 'notfound' | 'error'>} */
const viewMode = ref('loading')

/** @type {import('vue').Ref<import('../../api/types').Trip | null>} */
const trip = ref(null)

/**
 * 5 子态(基于 trip.status + 当前日期 × start_date/end_date 派生)
 * @type {import('vue').Ref<'inProgress' | 'upcoming' | 'expired' | 'finished' | 'draft'>}
 */
const currentSubStatus = ref('upcoming')

/** @type {import('vue').Ref<import('../../api/types').TripDay[]>} 冗余于 trip.days,方便 v-for */
const days = ref([])

/** @type {import('vue').Ref<import('../../api/types').TripItem | null>} 浮层选中项 */
const selectedSpot = ref(null)

/** @type {import('vue').Ref<boolean>} deleteTrip 飞行中标记(给 uni.showLoading + 按钮置灰用) */
const isDeleting = ref(false)

/**
 * @type {import('vue').Ref<boolean>}
 * error 态重试节流锁(per issues/Cross-Page/Throttle-001 §4.2)
 * error → loading flip 0~10ms brief 窗口 + 1~3s async 段防双击堆叠
 */
const isRetrying = ref(false)

/** @type {import('vue').Ref<boolean>} 删除确认弹窗显隐 */
const dialogVisible = ref(false)

/**
 * @typedef {'network' | 'server' | 'badrequest' | 'notfound'} ErrorType
 * @typedef {Object} ErrorInfo
 * @property {ErrorType} type
 * @property {string} message
 * @property {unknown} [cause]
 * @property {string} occurredAt
 */
/** @type {import('vue').Ref<ErrorInfo | null>} */
const error = ref(null)

/** @type {Date} 当前时间锚点(子态判定 + 倒计时计算) */
const today = new Date()

// ─────────────── Computed ───────────────

/** 顶栏标题:detail 态用 trip.title(短),其他态用 strings.title 兜底(spec §3.2) */
const headerTitle = computed(() => {
  if (viewMode.value === 'detail' && trip.value) {
    return trip.value.title || strings.title
  }
  return strings.title
})

/** 子态徽章文案(5 枚举 → 字符串) */
const subStatusLabel = computed(() => TripDetailStatusLabel[currentSubStatus.value])

/** 日期范围文本:`07月01日 ~ 07月03日` 格式(spec §3.2 表格) */
const dateRangeText = computed(() => {
  if (!trip.value) return ''
  return `${formatMonthDay(trip.value.start_date)} ~ ${formatMonthDay(trip.value.end_date)}`
})

/** 倒计时文本(仅 inProgress / upcoming 显示) */
const countdownText = computed(() => {
  if (!trip.value) return ''
  if (currentSubStatus.value === 'inProgress') {
    const days = Math.ceil((parseDate(trip.value.end_date) - today.getTime()) / 86400000)
    return `${strings.countdownInProgressPrefix}${Math.max(days, 0)}${strings.countdownInProgressSuffix}`
  }
  if (currentSubStatus.value === 'upcoming') {
    const days = Math.ceil((parseDate(trip.value.start_date) - today.getTime()) / 86400000)
    return `${strings.countdownUpcomingPrefix}${Math.max(days, 0)}${strings.countdownUpcomingSuffix}`
  }
  return ''
})

/** 进度条百分比(仅 inProgress,1-99%) */
const progressPercent = computed(() => {
  if (!trip.value || currentSubStatus.value !== 'inProgress') return 0
  const start = parseDate(trip.value.start_date)
  const end = parseDate(trip.value.end_date)
  const total = end - start
  if (total <= 0) return 0
  const elapsed = today.getTime() - start
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)))
})

/** 已结束(finished)→ 仅「修改行程」置灰走 copy,「删除 / 复制」**可点**(per fix-trip-bugs-v1 user 2026-06-18) */
const isModifyDisabled = computed(() => currentSubStatus.value === 'finished')

/** 兼容老 isActionsDisabled 引用 — 等价 isModifyDisabled(per fix-trip-bugs-v1 决定:finished 整组隐藏 → 现改单 modify 隐藏) */
const isActionsDisabled = isModifyDisabled

/** UI-024:finished 行程 → 复制模式,modify 按钮文案 + 行为切换 */
const isCopyMode = computed(() => currentSubStatus.value === 'finished')

/** days 排序后(按 day_index 升序) */
const sortedDays = computed(() => {
  const list = [...days.value]
  list.sort((a, b) => (a.day_index || 0) - (b.day_index || 0))
  return list
})

/** 错误兜底文案(给 _ErrorBanner message prop) */
const errorMessage = computed(
  () => error.value?.message || strings.errorServer
)

// ─────────────── 视图决策算法(spec §5.4) ───────────────

/**
 * 将 ApiError 归一为 ErrorInfo(沿用 homeStore.buildErrorInfo 模式,本地实现)
 * @param {ApiError | Error | unknown} err
 * @returns {ErrorInfo}
 */
function buildErrorInfo(err) {
  /** @type {ErrorType} */
  let type = 'server'
  let message = strings.errorServer
  if (err instanceof ApiError) {
    if (err.isNetworkError) {
      type = 'network'
      message = strings.errorNetwork
    } else if (err.code === 4000 || err.statusCode === 400) {
      type = 'badrequest'
      message = strings.errorBadRequest
    } else if (err.code === 4001 || err.statusCode === 404) {
      type = 'notfound'
      message = strings.errorNotFound
    } else if (err.code === 5000 || (err.statusCode >= 500 && err.statusCode < 600)) {
      type = 'server'
      message = strings.errorServer
    }
  } else if (err && typeof err === 'object' && 'message' in err) {
    message = String((/** @type {{ message: unknown }} */ (err)).message)
  }
  return {
    type,
    message,
    cause: err,
    occurredAt: new Date().toISOString(),
  }
}

/**
 * 视图决策(spec §5.4 decideViewMode)
 * 步骤:URL 校验 → fetchResult 派生 viewMode
 */
function decideViewMode() {
  // URL 校验放第一步(避免无效 fetch,见 spec §5.4 伪代码)
  if (!Number.isFinite(tripId.value) || (tripId.value ?? 0) <= 0) {
    viewMode.value = 'notfound'
    return
  }
  // trip 拉取成功 + deleted_at == null → detail
  // v0.2.0 修订(per spec §3.3 + §3.4):TripStatus 3 枚举,deleted 语义由 deleted_at 字段承担
  // (用 != 兜底 null / undefined)
  if (trip.value) {
    if (trip.value.deleted_at != null) {
      viewMode.value = 'notfound'
      return
    }
    viewMode.value = 'detail'
    return
  }
  // error 字段非空 → error
  if (error.value) {
    // error.type === 'notfound' 视作资源不存在,切 notfound
    if (error.value.type === 'notfound') {
      viewMode.value = 'notfound'
      return
    }
    viewMode.value = 'error'
    return
  }
  // 飞行中 / 初始 → loading
  viewMode.value = 'loading'
}

/**
 * 子态判定(spec §5.4 decideSubStatus)
 * 优先级:finished(后端 status) > draft > active × 日期交叉
 * @param {import('../../api/types').Trip} t
 * @param {Date} ref
 * @returns {'inProgress' | 'upcoming' | 'expired' | 'finished' | 'draft'}
 */
function decideSubStatus(t, ref) {
  if (t.status === 'finished') return 'finished'
  if (t.status === 'draft') return 'draft'
  // status === 'active' 时按日期交叉判定
  const start = parseDate(t.start_date)
  const end = parseDate(t.end_date)
  const now = ref.getTime()
  if (now < start) return 'upcoming'
  if (now > end) return 'expired'
  return 'inProgress'
}

/**
 * 单 item 5 态映射(spec §5.4 mapItemState,沿用 HomePage 判定 + 适配 5 子态)
 * finished trip 强制覆盖为 expired(灰显,见 §5.3.L)
 *
 * 2026-06-24 Fix C 修订:新增 dayDate 参数,先按 dayDate vs today 距离粗判,
 * 避免 trip_date=未来日期 的 item 被错判为 expired(原逻辑把 start_time 解释为
 * 「今天 HH:mm」,与实际 dayDate 无关,导致未来日期 item 误判)。
 *
 * @param {import('../../api/types').TripItem} item
 * @param {'inProgress' | 'upcoming' | 'expired' | 'finished' | 'draft'} sub
 * @param {Date} ref
 * @param {string} [dayDate] item 所属 day 的 trip_date(YYYY-MM-DD),可选
 * @returns {'done' | 'active' | 'upcoming' | 'expired' | 'changed'}
 */
function mapItemState(item, sub, ref, dayDate) {
  if (sub === 'finished') return 'expired'
  if (item.status === 'done') return 'done'
  if (item.status === 'changed') return 'changed'
  if (item.status === 'skipped') return 'expired'

  // 2026-06-24 Fix C 新增:先按 dayDate vs today 距离粗判
  if (typeof dayDate === 'string' && dayDate) {
    const dayStart = parseDate(dayDate)
    const dayEnd = dayStart + 86399999 // 当日 23:59:59.999
    const now = ref.getTime()
    if (now < dayStart) return 'upcoming' // 整日都未来
    if (now > dayEnd) return 'expired' // 整日都过去
    // 当天 → 进入时分判定
  }

  // planned + 当天 → 按时分判定(原逻辑保留)
  const start = parseTimeOfDay(item.start_time, ref)
  const end = parseTimeOfDay(item.end_time, ref)
  const now = ref.getTime()
  if (now < start) return 'upcoming'
  if (now > end) return 'expired'
  return 'active'
}

// ─────────────── 工具函数(spec §3.5 + §3.2) ───────────────

/**
 * 解析 'YYYY-MM-DD' → 当日 00:00 本地时间戳
 * @param {string} ymd
 * @returns {number}
 */
function parseDate(ymd) {
  if (!ymd || typeof ymd !== 'string') return 0
  const t = new Date(ymd).getTime()
  return Number.isFinite(t) ? t : 0
}

/**
 * 解析 'HH:mm' → 今日对应时间戳
 * @param {string} hhmm
 * @param {Date} ref
 * @returns {number}
 */
function parseTimeOfDay(hhmm, ref) {
  if (!hhmm || typeof hhmm !== 'string') return 0
  const parts = hhmm.split(':')
  const h = Number.parseInt(parts[0], 10)
  const m = Number.parseInt(parts[1], 10)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  const d = new Date(ref)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

/**
 * 格式化 `YYYY-MM-DD` → `07月01日` 格式(spec §3.2 _TripHeader)
 * @param {string} ymd
 * @returns {string}
 */
function formatMonthDay(ymd) {
  const t = parseDate(ymd)
  if (!t) return ''
  const d = new Date(t)
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${m}${strings.monthDay}${day}${strings.dayUnit}`
}

/**
 * 格式化 `YYYY-MM-DD` → `07-01 周三` 格式(spec §3.5 _DayBlock)
 * @param {string} ymd
 * @returns {string}
 */
function formatDayDate(ymd) {
  const t = parseDate(ymd)
  if (!t) return ''
  const d = new Date(t)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const weekday = TripDetailWeekdays[d.getDay()] || ''
  return `${m}-${day} ${weekday}`
}

/**
 * items 按 start_time 升序(spec §3.9)
 * @param {import('../../api/types').TripItem[]} items
 * @returns {import('../../api/types').TripItem[]}
 */
function sortedItems(items) {
  const list = [...(items || [])]
  list.sort((a, b) => {
    const ta = parseTimeOfDay(a.start_time, today)
    const tb = parseTimeOfDay(b.start_time, today)
    return ta - tb
  })
  return list
}

// ─────────────── 拉取详情(spec §5.1) ───────────────

/**
 * 拉取单条 trip 详情 — GET /api/trips/{trip_id}?user_id=1
 * 错误归一到 ErrorInfo(由 decideViewMode 决策 viewMode)
 */
async function fetchTripDetail() {
  if (!Number.isFinite(tripId.value) || (tripId.value ?? 0) <= 0) return
  viewMode.value = 'loading'
  error.value = null
  try {
    const res = await getTripDetail(/** @type {number} */ (tripId.value))
    const data = res.data
    if (!data || data.deleted_at != null) {
      // 后端返回 deleted_at 非 null 视为 notfound(per spec §3.3 v0.2.0)
      trip.value = null
      error.value = {
        type: 'notfound',
        message: strings.errorNotFound,
        occurredAt: new Date().toISOString(),
      }
      logger.info('[TripDetailPage] notfound, trip 404', { tripId: tripId.value })
    } else {
      trip.value = data
      days.value = data.days || []
      currentSubStatus.value = decideSubStatus(data, today)
      logger.info('[TripDetailPage] fetch ok', {
        tripId: tripId.value,
        subStatus: currentSubStatus.value,
        daysCount: days.value.length,
      })
    }
  } catch (err) {
    logger.error('[TripDetailPage] fetch failed', err)
    error.value = buildErrorInfo(err)
  } finally {
    decideViewMode()
  }
}

// ─────────────── 路由参数解析(spec §4.3 + §5.1) ───────────────

/**
 * 解析 URL ?tripId=xxx
 * 缺省 / 空 / 非数字 / <= 0 → tripId=null(驱动 viewMode='notfound')
 * @param {Record<string, string | undefined> | undefined} options
 */
function parseQuery(options) {
  const raw = options?.tripId
  if (raw === undefined || raw === null || raw === '') {
    tripId.value = null
    // spec §9 AC-07 + §10 NFR 可观测性:onLoad 时立即打点(不等用户点按钮)
    logger.info('[TripDetailPage] notfound, bad tripId', { rawTripId: raw })
    return
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) {
    tripId.value = null
    logger.info('[TripDetailPage] notfound, bad tripId', { rawTripId: raw })
    return
  }
  tripId.value = n
}

/**
 * 从 uni-app 运行时拿当前页的 options(query 参数)
 * 优先用 onLoad(options) 钩子入参,fallback 用 getCurrentPages() 末项 options
 * (本工程未在 package.json 显式列 @dcloudio/uni-app,故 fallback 走 getCurrentPages)
 * @returns {Record<string, string | undefined> | undefined}
 */
function getCurrentPageOptions() {
  try {
    const pages = /** @type {any[]} */ (typeof getCurrentPages === 'function' ? getCurrentPages() : [])
    if (Array.isArray(pages) && pages.length > 0) {
      const last = pages[pages.length - 1]
      return last?.options
    }
  } catch (err) {
    logger.warn('[TripDetailPage] getCurrentPages fail', err)
  }
  return undefined
}

// ─────────────── Lifecycle ───────────────

/**
 * 初始化入口(spec §5.1)
 * 1) 解析 query
 * 2) 决策(初始 loading)
 * 3) tripId 有效 → 主动 fetch
 */
function initialize(options) {
  logger.info('[TripDetailPage] initialize', { options })

  // 1) 解析 query
  parseQuery(options)

  // 2) 初始决策(无效 tripId → notfound;否则 loading)
  decideViewMode()

  // 3) tripId 有效 → 拉取详情
  if (tripId.value !== null) {
    fetchTripDetail()
  }
}

onMounted(() => {
  // uni-app Vue 3 模式下,onLoad(options) 是页面级钩子(@dcloudio/uni-app)
  // 本工程未显式列该依赖,fallback 到 onMounted + getCurrentPages() 读 options
  const options = getCurrentPageOptions()
  initialize(options)
})

/**
 * onShow 重新拉取(spec §5.3.C)
 * 用途:从 EditTripPage 返回时数据可能已变,需刷新最新
 */
onShow(() => {
  // 仅在已有 tripId 时触发(避免初次挂载竞争)
  if (tripId.value === null) return
  logger.info('[TripDetailPage] onShow re-fetch', { tripId: tripId.value })
  fetchTripDetail()
})

/**
 * onUnmounted 兜底(spec §5.5)
 * 释放 local ref;不重置 trip(由 Vue 自动 GC)
 */
onUnmounted(() => {
  selectedSpot.value = null
  dialogVisible.value = false
  isDeleting.value = false
  isRetrying.value = false
  logger.debug('[TripDetailPage] unmounted, viewMode=' + viewMode.value)
})

// ─────────────── Handlers ───────────────

/**
 * Header ← 按钮:返回上游(uni.navigateBack,栈顶则 reLaunch Home)
 */
function onBack() {
  logger.info('[TripDetailPage] back')
  uni.navigateBack({
    delta: 1,
    fail: () => uni.reLaunch({ url: AppRoutes.Home }),
  })
}

/**
 * notfound 按钮 → 返回首页(spec §3.8 + §5.3.A)
 */
function onNotFoundAction() {
  logger.info('[TripDetailPage] notfound, back to home', { tripId: tripId.value })
  uni.reLaunch({ url: AppRoutes.Home })
}

/**
 * error 态重试 → 重新拉取(spec §9 AC-09)
 * Throttle-001 §4.2:加 isRetrying 互斥锁,try/finally 兜底 reset(防网络异常永远卡 loading)
 */
async function onRetry() {
  if (isRetrying.value) return
  logger.info('[TripDetailPage] error, retry', { tripId: tripId.value })
  if (tripId.value === null) return
  isRetrying.value = true
  try {
    await fetchTripDetail()
  } finally {
    isRetrying.value = false
  }
}

/**
 * 「修改行程」点击 → 跳 EditTripPage(spec §5.2 Step C + §9 AC-04)
 * finished 子态 → 置灰不可点(本路径不可达,但保留 isActionsDisabled 防御)
 */
function onModifyClick() {
  if (isModifyDisabled.value) {
    logger.info('[TripDetailPage] modify disabled (finished)')
    return
  }
  if (tripId.value === null) return
  logger.info('[TripDetailPage] modify', { tripId: tripId.value })
  uni.navigateTo({ url: `${AppRoutes.EditTrip}?tripId=${tripId.value}` })
    .catch((err) => {
      logger.warn('[TripDetailPage] navigateTo(EditTrip) fail', err)
    })
}

/**
 * 「复制行程」点击 → 跳 NewTripPage 带 `?copyFrom={tripId}`(UI-024)
 * NewTripPage 接 query 后直接进 form 态并预填字段
 */
function onCopyClick() {
  if (tripId.value === null) return
  logger.info('[TripDetailPage] copy', { tripId: tripId.value })
  uni.navigateTo({
    url: `${AppRoutes.NewTrip}?copyFrom=${tripId.value}`,
  }).catch((err) => {
    logger.warn('[TripDetailPage] navigateTo(NewTrip copy) fail', err)
  })
}

/**
 * action-bar 主 CTA 统一入口:finished → 复制,其他 → 修改(UI-024)
 */
function onActionClick() {
  if (isCopyMode.value) {
    onCopyClick()
  } else {
    onModifyClick()
  }
}

/**
 * 「删除行程」点击 → 弹 _DeleteConfirmDialog(spec §5.2 Step D + §9 AC-05)
 */
function onDeleteClick() {
  // fix-trip-bugs-v1:finished 行程允许删除(per user 2026-06-18)。原防御拦截已移除
  if (tripId.value === null) return
  dialogVisible.value = true
  logger.info('[TripDetailPage] delete dialog open', { tripId: tripId.value })
}

/**
 * 弹窗「取消」/ 蒙层点击(spec §5.3.J)
 */
function onDialogCancel() {
  dialogVisible.value = false
  logger.info('[TripDetailPage] delete dialog cancel', { tripId: tripId.value })
}

/**
 * 弹窗「确定删除」→ 调 deleteTrip(spec §5.2 Step E + §9 AC-06)
 */
async function onDialogConfirm() {
  if (tripId.value === null) return
  isDeleting.value = true
  dialogVisible.value = false
  uni.showLoading({ title: strings.deleteDialogConfirming, mask: true })
  try {
    await deleteTrip(/** @type {number} */ (tripId.value))
    uni.hideLoading()
    uni.showToast({
      title: strings.deleteSuccessToast,
      icon: 'success',
      duration: 1500,
    })
    logger.info('[TripDetailPage] delete ok', { tripId: tripId.value })
    // 刷新 HomePage 列表(失败仅 warn,不阻塞 reLaunch,见 §5.3.I)
    try {
      await store.fetchTrips()
    } catch (err) {
      logger.warn('[TripDetailPage] fetchTrips after delete failed', err)
    }
    // 跳首页(MVP 简化:不强制引导用户进回收站,沿 specs/TripDetailPage.md §1.4 + §9 AC-06)
    uni.reLaunch({ url: AppRoutes.Home })
  } catch (err) {
    uni.hideLoading()
    logger.error('[TripDetailPage] delete failed', err)
    uni.showToast({
      title: strings.deleteFailToast,
      icon: 'none',
      duration: 1500,
    })
    isDeleting.value = false
    // viewMode 保持 'detail'(不切 error,详情仍可看,见 §5.3.H)
  }
}

/**
 * SpotCard tap → 打开 SpotDetailSheet 浮层(spec §5.2 Step B)
 * 注:已过期 / 已结束 trip 的 item 状态为 expired,SpotCard 内部 @click 拦截不触发
 */
function onSpotTap(item) {
  if (!item) return
  selectedSpot.value = item
  logger.info('[TripDetailPage] spot tap', { itemId: item.id })
}

/**
 * SpotDetailSheet 关闭 → 清空 selectedSpot(spec §5.3.K)
 */
function onSheetClose() {
  logger.info('[TripDetailPage] spot sheet close')
  selectedSpot.value = null
}

/**
 * SpotDetailSheet「导航去这里」→ 唤起系统地图(spec §5.3.D + §9 AC-04 类似)
 * 导航升级(4 端条件编译 + lat/lng 缺失 Toast + H5 端高德网页兜底)推迟到后续 task
 */
function onNavigate(item) {
  if (!item) return
  logger.info('[TripDetailPage] navigate', { itemId: item.id })
  uni.openLocation({
    latitude: Number(item.latitude) || 0,
    longitude: Number(item.longitude) || 0,
    name: item.title || '',
    address: item.address || '',
    scale: 16,
  }).catch((err) => {
    logger.warn('[TripDetailPage] openLocation fail', err)
  })
}

// v0.3.0(per user-round5-2026-06-27):删 onGuide / onToggleFavorite 2 函数
//   拍照讲解 / 收藏 2 按钮在 SpotDetailSheet 浮层中已删除,对应 handler 同步收敛
//   选点 + 导航升级 + 收藏跨页共享 推迟到后续 task(per issues/Cross-Page/user-round5-...)
</script>

<style scoped>
.trip-detail-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #F7F3EC;
  /* Surface,见 UI §二 */
  position: relative;
  box-sizing: border-box;
}

/* ───────── Header ───────── */
.header {
  height: 88rpx;
  /* 44pt 触达(88rpx = 44pt,见 OnboardingPage 2026-06-02 ui-reviewer 速算经验) */
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12rpx;
  padding: 0 40rpx;
  flex-shrink: 0;
  background: transparent;
  box-sizing: border-box;
}

.header-back {
  width: 88rpx;
  height: 88rpx;
  /* 44pt 触达 */
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
  box-sizing: border-box;
  transition: background 0.15s ease-out, transform 0.15s ease-out;
}

.header-back-hover {
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft */
  transform: scale(0.96);
}

.header-back-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 40rpx;
  /* 20px,back arrow */
  color: #2C2C2C;
  /* ink */
  line-height: 1;
}

.header-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px,UI §三 页面标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.2;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ───────── Body ───────── */
.body {
  flex: 1;
  min-height: 0;
}

.body-inner {
  padding: 16rpx 0 160rpx;
  /* 底部预留 160rpx 给 sticky _ActionBar + 上下间距 */
  box-sizing: border-box;
}

/* ───────── Loading 态 ───────── */
.state-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
  gap: 24rpx;
  min-height: 60vh;
  box-sizing: border-box;
}

.loading-spinner {
  width: 64rpx;
  height: 64rpx;
  border: 6rpx solid rgba(45, 106, 94, 0.12);
  border-top-color: #2D6A5E;
  border-radius: 50%;
  animation: tdp-spin 0.8s linear infinite;
}

.state-loading-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

@keyframes tdp-spin {
  to { transform: rotate(360deg); }
}

/* ───────── _TripHeader 信息卡块(spec §3.2)───────── */
.trip-header {
  position: relative;
  margin: 0 40rpx 24rpx;
  padding: 24rpx;
  background: #FDFBF7;
  /* surfaceCard */
  border-radius: 16px;
  /* radius-lg */
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  /* shadow-sm */
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.trip-header-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 44rpx;
  /* 22px,UI §三 页面标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.trip-header-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16rpx;
}

.trip-header-meta-item {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

.trip-header-status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 4rpx;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 16rpx;
  border-radius: 9999px;
  /* radius-full */
  background: rgba(45, 106, 94, 0.08);
  /* default primarySoft(spec §3.1 5 子态色) */
  box-sizing: border-box;
}

.status-badge-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px,小标签 */
  font-weight: 600;
  line-height: 1.4;
}

/* 5 子态配色(spec §3.4 矩阵) */
.status-badge-inProgress {
  background: #2D6A5E;
  /* active */
}
.status-badge-inProgress .status-badge-text {
  color: #FFFFFF;
}

.status-badge-upcoming {
  background: #D8D0C4;
  /* upcoming(本项目未在 AppColors 集中,沿用 spec §3.1 直接色值) */
}
.status-badge-upcoming .status-badge-text {
  color: #2C2C2C;
  /* ink */
}

.status-badge-expired {
  background: #9A9A9A;
  /* inkMuted */
}
.status-badge-expired .status-badge-text {
  color: #FFFFFF;
}

.status-badge-finished {
  background: #9A9A9A;
  /* inkMuted,与 expired 同色 */
}
.status-badge-finished .status-badge-text {
  color: #FFFFFF;
}

.status-badge-draft {
  background: #D4A03A;
  /* warning */
}
.status-badge-draft .status-badge-text {
  color: #FFFFFF;
}

.trip-header-countdown {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

.trip-header-progress {
  height: 8rpx;
  border-radius: 4rpx;
  background: #E8E0D4;
  /* divider */
  overflow: hidden;
  margin-top: 4rpx;
  box-sizing: border-box;
}

.trip-header-progress-fill {
  height: 100%;
  background: #2D6A5E;
  /* primary */
  border-radius: 4rpx;
  transition: width 0.3s ease-out;
}

.trip-header-overlay {
  position: absolute;
  inset: 0;
  background: rgba(247, 243, 236, 0.5);
  /* surface 0.5 alpha(spec §3.4 已结束灰遮罩) */
  pointer-events: none;
  border-radius: 16px;
  /* 跟随卡片圆角 */
}

/* ───────── _DayList ───────── */
.day-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  /* space-lg */
  padding: 0 40rpx;
  box-sizing: border-box;
}

.day-block {
  background: #FFFFFF;
  /* UI-026 (2026-06-06):从 surfaceCard (#FDFBF7) 改为纯白,跟 page 背景 #F7F3EC 形成可识别边界 */
  border: 1.5rpx solid rgba(45, 106, 94, 0.12);
  /* UI-026:提升 borderSubtle 透明度,与 SpotCard 形成 0.12 / 0.10 层次 */
  border-radius: 12px;
  /* radius-md */
  padding: 24rpx;
  /* space-lg */
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  box-sizing: border-box;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
  /* shadow-sm,UI-026:从 0.04 微提升到 0.06 */
}

.day-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-wrap: wrap;
}

.day-index-badge {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
  padding: 4rpx 16rpx;
  border-radius: 9999px;
  /* radius-full */
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft */
  box-sizing: border-box;
}

.day-index-emoji {
  font-size: 20rpx;
  line-height: 1;
}

.day-index-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  font-weight: 600;
  color: #2D6A5E;
  /* primary */
  line-height: 1.4;
}

.day-date {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

.day-summary {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.day-item-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md */
  margin-top: 8rpx;
}

/* _EmptyDaysPlaceholder(spec §3) */
.day-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 24rpx 0;
  box-sizing: border-box;
}

.day-empty-emoji {
  font-size: 40rpx;
  line-height: 1;
}

.day-empty-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.4;
  text-align: center;
}

/* ───────── notfound 态(spec §3.8)───────── */
.state-notfound {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  padding: 120rpx 40rpx;
  min-height: 60vh;
  box-sizing: border-box;
}

.notfound-emoji {
  font-size: 96rpx;
  /* 48px,大图标 */
  line-height: 1;
}

.notfound-message {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
  text-align: center;
}

.notfound-button {
  margin-top: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 240rpx;
  min-height: 88rpx;
  /* ≥ 44pt tap area */
  padding: 0 32rpx;
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
  /* Primary 渐变 */
  border-radius: 9999px;
  /* radius-full */
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
  /* shadow-md */
  box-sizing: border-box;
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
}

.notfound-button-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.notfound-button-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* ───────── error 态 ───────── */
.state-error {
  padding: 24rpx 40rpx;
  box-sizing: border-box;
}

/* ───────── Sticky _ActionBar(spec §3 + §3.4)───────── */
.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 40rpx calc(16rpx + env(safe-area-inset-bottom, 0rpx));
  /* 16rpx 上 + 16rpx 下 + iOS safe-area 适配 */
  background: #FDFBF7;
  /* surfaceCard */
  border-top: 1.5rpx solid rgba(45, 106, 94, 0.06);
  /* borderSubtle */
  z-index: 100;
  box-sizing: border-box;
}

.action-bar-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area */
  border-radius: 9999px;
  /* radius-full */
  box-sizing: border-box;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out, background 0.15s ease-out;
}

/* 主按钮:修改行程(Primary 渐变) */
.action-bar-btn-modify {
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
  /* Primary 渐变,见 UI §八 主按钮 */
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
  /* primaryShadow */
}

.action-bar-btn-modify-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.action-bar-btn-modify-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px,UI §三 重要正文 */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* 次按钮:删除行程(描边) */
.action-bar-btn-delete {
  background: transparent;
  border: 1.5rpx solid #C44A3A;
  /* danger 描边 */
  flex: 0.6;
}

.action-bar-btn-delete-hover {
  background: rgba(196, 74, 58, 0.08);
  /* dangerSoft */
}

.action-bar-btn-delete-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 500;
  color: #C44A3A;
  /* danger */
  line-height: 1.4;
}

/* 置灰:仅 finished(spec §3.4 + §5.3.L + §9 AC-10) */
.action-bar-btn-disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* ───────── H5 ≥1024px 大屏居中(spec §10 NFR 兼容性)───────── */
@media (min-width: 1024px) {
  .trip-header,
  .day-list,
  .state-error {
    max-width: 640rpx;
    margin-left: auto;
    margin-right: auto;
  }
  .state-error {
    /* override .day-list margin */
  }
  .state-notfound {
    max-width: 640rpx;
    margin: 0 auto;
  }
}
</style>
