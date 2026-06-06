<!--
  pages/trash/index.vue — 回收站页(独立 route,uni.navigateTo from MyPage 菜单项 2 拉起,无 URL params)

  Spec contract: specs/TrashPage.md v0.1.0
  Route: /pages/trash/index
  入口:MyPage 菜单项 2「回收站」→ uni.navigateTo({url: AppRoutes.Trash}) 拉起
  出口:Header「←」/ 系统返回手势 → uni.navigateBack({delta:1, fail: reLaunch Home})
        _PermanentDeleteConfirmDialog 2 按钮(取消 / 永久删除→ Toast「30 天后自动清理」+ 0 API)

  4 视图态(spec §3.4 / §4.1 / §5):
    loading — 初始 / onLoad / onShow 重新拉取(_LoadingBlock 居中转圈 + loadingText)
    loaded  — trashedTrips 拉取成功且非空(_Hint + _TrashList 多条 _TrashItemRow)
    empty   — trashedTrips 拉取成功且为空(EmptyState 整页 + 📦 + 「回收站空空如也」)
    error   — fetchTrash 失败(_ErrorBlock _ErrorBanner + 重试按钮)

  复用(spec §3.5 + §10 R-1~R-3):
    - AppColors(山水日志配色) / AppRoutes.Trash(已预声明) / AppRoutes.Home
    - TrashPageStrings(本任务新增) + HomeTripStatusLabel.deleted(状态徽章复用)
    - OnboardingStrings.retry(_ErrorBanner 内部用)
    - useTrashStore.fetchTrash() / restoreTrashById() / clearTrash()
    - services/trips.listDeletedTrips()(GET 全量 + JS filter,per §6.4.1 PD-001)
    - services/trips.updateTrip()(恢复操作复用)
    - services/preferences.ApiError(错误类跨 service 复用)
    - components/EmptyState.vue(整页 empty 态,per R-1)
    - components/ErrorBanner.vue(整页 error 态,per R-2)
    - utils/logger

  不复用(per spec §3.5 + §10 C-5):
    - 不抽 _TrashItemRow 公共(MVP YAGNI,N 行复用但只本页面用,沿用 _ 前缀私有)
    - 不复用 components/TripCard.vue(本页面是已删 trip,无 tap 跳详情,语义不匹配)
    - 不跨目录 import MyPage _LogoutConfirmDialog(沿用 _ 前缀私有惯例)
    - 不调 homeStore.fetchTrips()(恢复后由 HomePage onShow 自动重拉,避免本页面主动触发)

  关键决策(per spec §6.4.1 + §6.4.2 + orchestrator 2026-06-04 09:15 steer 确认):
    - listDeletedTrips 走前端 GET 全量 + JS filter `status==='deleted'` + sort by id desc(后端不支持 ?status=deleted)
    - 永久删除 2 次确认 + Toast「30 天后自动清理」+ 0 API(等后端定时任务 30 天自动清理)
-->
<template>
  <view
    class="trash-page"
    :aria-label="strings.pageAria"
  >
    <!-- Header:44pt 顶栏,左侧「←」返回 + 标题居中(独立 route 非 tabBar 形态) -->
    <view class="header">
      <view
        class="header-back"
        role="button"
        :aria-label="strings.backAria"
        hover-class="header-back-hover"
        :hover-stay-time="50"
        @click="onBack"
      >
        <text class="header-back-icon" aria-hidden="true">←</text>
      </view>
      <view class="header-title-wrap">
        <text class="header-title">{{ strings.title }}</text>
      </view>
      <view class="header-spacer" />
    </view>

    <!-- Body:可滚动,内容最大宽度 640rpx 居中(spec §3.7 H5 兼容性) -->
    <scroll-view
      class="body"
      scroll-y
      :enhanced="true"
      :show-scrollbar="false"
    >
      <view class="body-inner">
        <!-- ───────── loading 态 ───────── -->
        <view
          v-if="viewMode === 'loading'"
          class="panel-loading"
        >
          <view class="spinner" aria-hidden="true" />
          <text class="loading-text">{{ strings.loadingText }}</text>
        </view>

        <!-- ───────── loaded 态(主路径)───────── -->
        <view
          v-else-if="viewMode === 'loaded'"
          class="panel-loaded"
        >
          <!-- _Hint:顶部小提示条(per spec §3 备注 6) -->
          <view class="hint" role="status">
            <text class="hint-text">{{ strings.hintText }}</text>
          </view>

          <!-- _TrashList:多条 _TrashItemRow -->
          <view class="trash-list">
            <TrashItemRow
              v-for="trip in trashStore.trashedTrips"
              :key="trip.id"
              :trip="trip"
              :is-restoring="trashStore.restoringId === trip.id"
              :status-label="statusLabel"
              @restore="onRestoreTap"
              @permanent-delete="onPermanentDeleteTap"
            />
          </view>
        </view>

        <!-- ───────── empty 态(整页 EmptyState)───────── -->
        <view
          v-else-if="viewMode === 'empty'"
          class="panel-empty"
        >
          <EmptyState
            :title="strings.emptyTitle"
            :subtitle="strings.emptySubtitle"
            :illustration="'📦'"
          />
        </view>

        <!-- ───────── error 态 ───────── -->
        <view
          v-else-if="viewMode === 'error'"
          class="panel-error"
        >
          <ErrorBanner
            :message="errorMessage"
            :retryable="true"
            @retry="onRetry"
          />
        </view>
      </view>
    </scroll-view>

    <!-- _PermanentDeleteConfirmDialog(modal,fadeIn 0.2s + slideUp 0.3s ease-spring) -->
    <PermanentDeleteConfirmDialog
      :visible="permanentDeleteDialogVisible"
      :title="strings.permanentDeleteDialogTitle"
      :message="strings.permanentDeleteDialogMessage"
      :btn-confirm-label="strings.permanentDeleteDialogConfirm"
      :btn-cancel-label="strings.permanentDeleteDialogCancel"
      @confirm="onPermanentDeleteConfirm"
      @cancel="onPermanentDeleteCancel"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { logger } from '../../utils/logger.js'
import { useTrashStore } from '../../stores/trashStore.js'
import {
  TrashPageStrings,
  HomeTripStatusLabel,
} from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import EmptyState from '../../components/EmptyState.vue'
import ErrorBanner from '../../components/ErrorBanner.vue'
import TrashItemRow from './components/TrashItemRow.vue'
import PermanentDeleteConfirmDialog from './components/PermanentDeleteConfirmDialog.vue'

const strings = TrashPageStrings
const statusLabel = HomeTripStatusLabel.deleted  // '已结束'(per spec §3.2 状态徽章)
const trashStore = useTrashStore()

// ───────── Local State(spec §4.1) ─────────
/** @type {import('vue').Ref<'loading' | 'loaded' | 'empty' | 'error'>} */
const viewMode = ref('loading')
/** @type {import('vue').Ref<number | null>} */
const permanentDeleteDialogTripId = ref(null)
/** @type {import('vue').Ref<boolean>} */
const permanentDeleteDialogVisible = ref(false)

/**
 * 错误码 → 友好提示映射(spec §5.3 A/B/C + §5.4 伪代码)
 * - isNetworkError=true → errorNetwork
 * - code=5000 / 5xx → errorServer
 * - 其他 / 4xx → errorFallback
 * @returns {string}
 */
function mapErrorToMessage() {
  const err = trashStore.error
  if (!err) return strings.errorNetwork
  if (err.isNetworkError) return strings.errorNetwork
  if (err.code === 5000 || (err.statusCode >= 500 && err.statusCode < 600)) {
    return strings.errorServer
  }
  return strings.errorFallback
}

/** error 态显示文案(spec §9 AC-11) */
const errorMessage = computed(() => mapErrorToMessage())

/** 已删行程数(用于 logger) */
const trashedCount = computed(() => trashStore.trashedTrips.length)

// ───────── View Mode Decision(spec §3.6 + §5.1) ─────────

/**
 * 根据 fetch 结果切 viewMode(spec §5.1 + HomePage §4.1 hasFetchedOnce 模式)
 * - isFetching=true → 'loading'(避免 fetch 完成前跳到 error 之外的态)
 * - error != null → 'error'
 * - trashedTrips.length > 0 → 'loaded'
 * - trashedTrips.length === 0 → 'empty'
 */
function decideViewMode() {
  if (trashStore.isFetching) {
    viewMode.value = 'loading'
    return
  }
  if (trashStore.error) {
    viewMode.value = 'error'
    return
  }
  if (trashedCount.value > 0) {
    viewMode.value = 'loaded'
  } else {
    viewMode.value = 'empty'
  }
}

// ───────── Fetch(spec §5.1) ─────────

/**
 * 拉取并刷新视图决策
 * - onLoad / onShow 入口均走此函数(强制重拉,per spec §4.3 决策:trashedTrips 是删除行,数据变化频繁)
 * - 失败 → error 态,viewMode 切 'error'
 * - 成功 → loaded / empty 二选一
 */
async function fetchAndDecide() {
  viewMode.value = 'loading'
  trashStore.clearLoadError()
  try {
    await trashStore.fetchTrash()
    decideViewMode()
    logger.info('[TrashPage] onLoad ok', { count: trashedCount.value })
  } catch (err) {
    decideViewMode()
    logger.error('[TrashPage] onLoad failed', err)
  }
}

// ───────── Lifecycle(spec §5.1) ─────────

onMounted(() => {
  // 初始进入:拉取(独立 route,非 tabBar,但仍强制重拉避免残留)
  fetchAndDecide()
  logger.info('[TrashPage] mounted')
})

onShow(() => {
  // onShow 强制重拉(per spec §4.3 + §5.1)
  // trashedTrips 是删除行,数据可能频繁变化(用户从其他页 soft-delete trip 后返回)
  if (viewMode.value === 'loading' && trashStore.isFetching) {
    // 已经在 onMounted 飞行中,跳过避免并发
    return
  }
  fetchAndDecide()
  logger.info('[TrashPage] onShow loaded', { count: trashedCount.value })
})

onUnmounted(() => {
  // 清空 trashStore 状态(per spec §3 备注 7 + §5.1)
  // 避免下次进入页面看到上次残留(trashedTrips / restoringId)
  trashStore.clearTrash()
  logger.debug('[TrashPage] onUnmounted, viewMode=' + viewMode.value)
})

// ───────── Handlers(spec §5.2) ─────────

/**
 * 恢复某条 trip(per AC-03 / AC-04 / AC-05 / AC-06)
 * - trashStore.restoreTrashById 内部已做乐观更新 + 失败回滚
 * - 成功 → Toast「已恢复」+ row 已从列表移除(乐观更新生效)
 * - 失败 → 回滚 + viewMode='error' + _ErrorBanner 重试
 * - 404/4001 静默:store 内部处理,row 不回滚,viewMode 不切 error
 * - viewMode 衍生:乐观更新后 trashedTrips.length === 0 → 'empty'
 */
async function onRestoreTap(tripId) {
  if (trashStore.restoringId !== null) return
  logger.info('[TrashPage] restore start', { tripId })
  try {
    await trashStore.restoreTrashById(tripId)
    // 成功:Toast + 重新决策 viewMode(乐观更新可能让 trashedTrips 变空)
    uni.showToast({
      title: strings.restoreSuccessToast,
      icon: 'success',
      duration: 1500,
    })
    decideViewMode()
    logger.info('[TrashPage] restore ok', { tripId })
  } catch (err) {
    // 失败(非 404):store 已回滚 + 写 error,page 端切 viewMode='error'
    decideViewMode()
    logger.error('[TrashPage] restore failed', err)
  }
}

/**
 * 永久删除按钮 → 弹 _PermanentDeleteConfirmDialog(per AC-07)
 * - permanentDeleteDialogTripId = tripId
 * - permanentDeleteDialogVisible = true
 */
function onPermanentDeleteTap(tripId) {
  if (trashStore.restoringId !== null) return
  permanentDeleteDialogTripId.value = tripId
  permanentDeleteDialogVisible.value = true
  logger.info('[TrashPage] permanent delete dialog shown', { tripId })
}

/**
 * _PermanentDeleteConfirmDialog 取消 / 蒙层点击(per AC-08)
 * - dialogTripId=null + dialogVisible=false
 * - 不调任何 API
 */
function onPermanentDeleteCancel() {
  const tripId = permanentDeleteDialogTripId.value
  permanentDeleteDialogTripId.value = null
  permanentDeleteDialogVisible.value = false
  logger.info('[TrashPage] permanent delete cancelled', { tripId })
}

/**
 * _PermanentDeleteConfirmDialog 确认 → Toast「30 天后自动清理」+ 0 API(per AC-09 + §6.4.2 PD-001)
 * MVP 阶段不真删,等后端定时任务 30 天自动清理
 * - 不修改 trashedTrips(row 仍在列表中)
 * - 不写 storage
 * - 不调任何 API / store / service
 */
function onPermanentDeleteConfirm() {
  const tripId = permanentDeleteDialogTripId.value
  permanentDeleteDialogTripId.value = null
  permanentDeleteDialogVisible.value = false
  uni.showToast({
    title: strings.permanentDeleteToast,
    icon: 'none',
    duration: 2500,
  })
  logger.info('[TrashPage] permanent delete confirmed, MVP no-op, will auto-clean in 30 days', { tripId })
}

/**
 * 重试按钮 → 重新拉全量(per AC-11)
 * - viewMode='loading' 但不重置 hasFetchedOnce(无此 gate,本页面每次 onShow 都重拉)
 * - 重新调 trashStore.fetchTrash()
 */
async function onRetry() {
  logger.info('[TrashPage] retry fetch')
  await fetchAndDecide()
}

/**
 * Header「←」返回(per spec §5.5 + AC-15)
 * - 优先 uni.navigateBack({delta:1, fail: reLaunch My})
 * - 兜底 reLaunch(My) 清空 stack(MyPage 是 tabBar)
 */
function onBack() {
  uni.navigateBack({
    delta: 1,
    fail: () => {
      logger.warn('[TrashPage] navigateBack failed, reLaunch My')
      uni.reLaunch({ url: AppRoutes.My })
    },
  })
  logger.info('[TrashPage] back, navigateBack + fallback reLaunch My')
}
</script>

<style scoped>
.trash-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #F7F3EC;
  /* surface,见 UI §二 */
  box-sizing: border-box;
}

/* ───────── Header ───────── */
.header {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #FDFBF7;
  /* surfaceCard */
  border-bottom: 1px solid rgba(45, 106, 94, 0.1);
  /* borderStrong */
  box-sizing: border-box;
  flex-shrink: 0;
}

.header-back {
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  /* radius-full,确保圆形触达 ≥ 44pt(per spec §10 NFR) */
  flex-shrink: 0;
  box-sizing: border-box;
  transition: opacity 0.15s ease-out;
}

.header-back-hover {
  opacity: 0.6;
}

.header-back-icon {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 40rpx;
  /* 20px */
  color: #2C2C2C;
  /* ink */
  line-height: 1;
}

.header-title-wrap {
  flex: 1;
  text-align: center;
  min-width: 0;
}

.header-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 22px;
  /* 22px,UI §三 主标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.2;
}

.header-spacer {
  width: 88rpx;
  /* 与 header-back 等宽,确保标题居中 */
  flex-shrink: 0;
}

/* ───────── Body ───────── */
.body {
  flex: 1;
  box-sizing: border-box;
}

.body-inner {
  padding: 24rpx 40rpx 80rpx;
  /* space-lg / 20px → 40rpx 水平边距(mobile,per spec §3.7) */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  /* space-lg */
}

/* ───────── loading 态 ───────── */
.panel-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
  gap: 24rpx;
}

.spinner {
  width: 64rpx;
  height: 64rpx;
  border: 4rpx solid rgba(45, 106, 94, 0.15);
  /* primaryBorder */
  border-top-color: #2D6A5E;
  /* primary */
  border-radius: 50%;
  animation: trashSpin 0.8s linear infinite;
  box-sizing: border-box;
}

.loading-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
}

@keyframes trashSpin {
  to { transform: rotate(360deg); }
}

/* ───────── loaded 态 ───────── */
.panel-loaded {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md,列表项间间距(per spec §3.1 16/24 节奏) */
}

/* _Hint:顶部小提示条(per spec §3 备注 6) */
.hint {
  background: #F2EBE0;
  /* surfaceWarm,见 UI §二 */
  border-radius: 8px;
  /* radius-sm */
  padding: 12rpx 16rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
}

.hint-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
}

/* _TrashList:多条 _TrashItemRow 列表 */
.trash-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md,列表项间 16rpx(per spec §3.1) */
}

/* ───────── empty 态 ───────── */
.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  /* 垂直居中,占 Body 高度 ≥ 60%(沿用 EmptyState 既有契约) */
  box-sizing: border-box;
}

/* ───────── error 态 ───────── */
.panel-error {
  padding: 24rpx 0;
}

/* ───────── H5 ≥1024px 响应式(spec §3.7 + AC-12) ───────── */
@media (min-width: 1024px) {
  .body-inner {
    max-width: 640rpx;
    margin: 0 auto;
    /* 仅作用于内容容器,Header 不受限 */
  }
}
</style>
