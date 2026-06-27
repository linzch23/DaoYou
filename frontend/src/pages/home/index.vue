<!--
  pages/home/index.vue — 首页 / 探险日记(底部 Tab「首页」,tabBar page)
   
  Spec contract: specs/HomePage.md v0.2.0
  Route: /pages/home/index
  TabBar page —— 常驻挂载(uni.switchTab 不会销毁)
   
  v0.2.0 重构:从 5 视图态互斥 v-if 链改为 diary + trips section 并存结构
    - viewMode 5 枚举保留为底层语义标记(日志/埋点用,**不**直接驱动 v-if)
    - sectionVisibility 4 字段(实际 v-if 决定源)替代 v0.1.0 viewMode 互斥
    - error 态整页替换;loading 态全空白;两段 + empty 兜底(sectionVisibility)
    - 移除 Header「←」返回按钮(uni-app tabBar page 默认无 navigationBar)
    - 移除 onBack 4 路径逻辑(切 tab 走 BottomTabBar,沿 BottomTabBar.md)
   
  视图决策(spec §3.7.3 决策表):
    error     → HomeErrorOverlay(error 优先,Section 1/2/Empty 全部不渲染)
    loading   → 居中转圈(未首次拉完)
    diary     → Section 1 渲染(today 不为空)
    trips     → Section 2 渲染(trips 非空)
    empty     → EmptyState(today=null && trips.length===0 双空兜底)
   
  浮层:SpotDetailSheet(本地 selectedSpot 控制)
  收藏:favoriteIds(page-level ref,持久化到 uni.storage 'favorites')
  浮动按钮:FabAddTrip(Section 1/2/Empty 显示,error/loading 不显示)
   
  Refresh:
    onShow → homeStore.refreshAll() 强制重拉(spec §5.1)
    hasFetchedOnce 控制 viewMode 不会在第一次完成前跳到 error 之外

  v0.3.0 修订(per user-round5-2026-06-27):
    - SpotDetailSheet 浮层 4 按钮 → 1 按钮(仅保留「导航去这里」),拍照讲解 / 收藏 2 按钮删除
    - 本页面同步删除 onGuide / onToggleFavorite handler + @guide / @toggle-favorite emit binding
    - isCurrentSpotFavorited computed 整段删除(浮层不再消费此 computed)
    - favoriteIds ref + loadFavorites / saveFavorites storage 逻辑暂保留
      (本 task 不删,user 后续 task 决定是否清 storage + 是否升级为 homeStore 跨页共享)
    - 选点 / 导航升级 / 收藏跨页共享 推迟到后续 task
-->
<template>
  <view class="home-page">
    <!-- Header(顶栏 44pt,无 ← 按钮,tabBar page 默认无 navigationBar 隐式语义) -->
    <view
      v-if="!sectionVisibility.showError"
      class="header"
    >
      <text class="header-title">{{ headerTitle }}</text>
      <UnreadBadge
        v-if="showBadge"
        :count="unreadCount"
      />
    </view>

    <!-- Body(滚动区) -->
    <scroll-view
      class="body"
      scroll-y
      :enhanced="true"
      :show-scrollbar="false"
    >
      <view class="body-inner">
        <!-- 顶层 loading 态:未首次拉完,转圈 + 提示语 -->
        <view
          v-if="isInitialLoading"
          class="state-loading"
        >
          <view
            class="loading-spinner"
            aria-hidden="true"
          />
          <text class="state-loading-text">{{ strings.loadingText }}</text>
        </view>

        <!-- error 态:整页错误占位(per spec §3.7.3 + AC-08) -->
        <view
          v-else-if="sectionVisibility.showError"
          class="state-error"
        >
          <ErrorBanner
            :message="errorMessage"
            :retryable="true"
            @retry="onRetry"
          />
        </view>

        <!-- 正常态:Section 1 + Section 2 并存 + Empty 兜底(per spec §3.7.2) -->
        <template v-else>
          <!-- Section 1:今日行程(per spec §3.7 + §1 + AC-02/AC-03 + 2026-06-24 Fix A) -->
          <!-- v0.2.1 修订:Section 1 永远保留,有 active trip 即渲染;内部按 hasTodayItems 派生:
               - 有 today_items → 渲染 <HomeDiary>
               - 无 today_items → 渲染 <EmptyTodayState> 占位
               (per user 报「Section 1 为假」+「再次进入时消失」) -->
          <view
            v-if="sectionVisibility.showDiary"
            class="section section-diary"
          >
            <HomeDiary
              v-if="hasTodayItems"
              :today="store.today"
              :favorites="favoriteIds"
              @select-spot="onSelectSpot"
              @view-full-trip="onViewFullTrip"
              @reminder-tap="onReminderTap"
            />
            <EmptyTodayState
              v-else
              :title="strings.emptyTodayTitle"
              :subtitle="strings.emptyTodaySubtitle"
              :emoji="strings.emptyTodayEmoji"
            />
          </view>

          <!-- Section 2:行程列表(per spec §3.7 + §1 + AC-06) -->
          <view
            v-if="sectionVisibility.showTrips"
            class="section section-trips"
          >
            <view class="section-trips-title-wrap">
              <text class="section-trips-title">{{ strings.sectionTripsTitle }}</text>
            </view>
            <TripList
              :trips="sortedTrips"
              @select-trip="onSelectTrip"
              @chat="onChatTrip"
              @delete="onDeleteTrip"
            />
          </view>

          <!-- Empty 兜底:双空才渲染(per spec §3.7 + AC-07) -->
          <view
            v-if="sectionVisibility.showEmpty"
            class="section section-empty"
          >
            <EmptyState
              :title="strings.emptyTitle"
              :subtitle="strings.emptySubtitle"
              :cta-label="strings.emptyCta"
              :illustration="strings.emptyIllustration"
              @cta="onAddTrip"
            />
          </view>
        </template>
      </view>
    </scroll-view>

    <!-- 浮动新建按钮:非 error + 非 loading 时显示(per spec §3.4 v0.2.0 修订) -->
    <view
      v-if="!sectionVisibility.showError && !isInitialLoading"
      class="btn-add-trip"
      :aria-label="addTripAria"
      role="button"
      hover-class="btn-add-trip-hover"
      :hover-stay-time="50"
      @click="onAddTrip"
    >
      <text
        class="btn-add-trip-text"
        aria-hidden="true"
      >+</text>
    </view>

    <!-- 景点详情浮层 -->
    <!-- v0.3.0(per user-round5-2026-06-27):删 :is-favorite + @guide + @toggle-favorite
         SpotDetailSheet 浮层 v0.3.0 起不显示收藏按钮 / 拍照讲解按钮(只剩 1 按钮「导航」) -->
    <SpotDetailSheet
      :spot="selectedSpot"
      @close="onCloseSheet"
      @navigate="onNavigate"
    />

    <!-- 删除确认弹窗(2026-06-24 UserRound2-001 §3 Bug C 新增) -->
    <DeleteConfirmDialog
      :visible="deleteConfirmVisible"
      :title="deleteConfirmTitle"
      :message="deleteConfirmMessage"
      :btn-confirm-label="deleteConfirmConfirm"
      :btn-cancel-label="deleteConfirmCancel"
      @confirm="onDeleteConfirm"
      @cancel="onDeleteCancel"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useHomeStore } from '../../stores/homeStore.js'
import { HomeStrings } from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import { logger } from '../../utils/logger.js'
import { loadFavorites, saveFavorites } from '../../services/home.js'

import HomeDiary from '../../components/HomeDiary.vue'
import TripList from '../../components/TripList.vue'
import EmptyState from '../../components/EmptyState.vue'
import SpotDetailSheet from '../../components/SpotDetailSheet.vue'
import ErrorBanner from '../../components/ErrorBanner.vue'
import UnreadBadge from '../../components/UnreadBadge.vue'
import EmptyTodayState from './components/EmptyTodayState.vue'
// 2026-06-24 UserRound2-001 §3 Bug C 新增:删除确认弹窗(私有子组件,沿 TrashPage PermanentDeleteConfirmDialog 同形态)
import DeleteConfirmDialog from './components/DeleteConfirmDialog.vue'

const strings = HomeStrings

// ──────────── Store ────────────
const store = useHomeStore()

// ──────────── Local State(spec §4.1)────────────
/** @type {import('vue').Ref<import('../../api/types').TripItem | null>} */
const selectedSpot = ref(null)
/** @type {import('vue').Ref<boolean>} */
const sheetVisible = ref(false)
/** @type {import('vue').Ref<number[]>} 本地收藏 ids,持久化到 uni.storage */
const favoriteIds = ref([])
/** @type {import('vue').Ref<'loading' | 'diary' | 'trips' | 'empty' | 'error'>} v0.2.0 修订:仅作语义标记,不直接驱动 v-if */
const viewMode = ref('loading')
/** @type {import('vue').Ref<boolean>} */
const hasFetchedOnce = ref(false)
/**
 * 2026-06-24 UserRound2-001 §3 Bug C 新增:删除确认弹窗可见性
 * (per AGENTS.md §0 modal 用 v-if 不 v-show,避免占位节点)
 * @type {import('vue').Ref<boolean>}
 */
const deleteConfirmVisible = ref(false)
/**
 * 2026-06-24 UserRound2-001 §3 Bug C 新增:待删除 trip 引用
 * (modal 显示期间持有 trip 引用,confirm 时直接用)
 * @type {import('vue').Ref<import('../../api/types').TripSummary | null>}
 */
const pendingDeleteTrip = ref(null)

// 2026-06-24 UserRound2-001 §3 Bug C 新增:删除弹窗文案(走 HomeStrings 集中管理)
const deleteConfirmTitle = computed(() => strings.deleteConfirmTitle)
const deleteConfirmMessage = computed(() => strings.deleteConfirmMessage)
const deleteConfirmConfirm = computed(() => strings.deleteConfirmConfirm)
const deleteConfirmCancel = computed(() => strings.deleteConfirmCancel)

// ──────────── Computed ────────────

/**
 * 是否有 diary 内容(派生自 store.today,与 viewMode 局部状态解耦)
 * 用于稳定 Header 标题 + 角标显示,避免 onShow 时 viewMode 重置为 'loading' 引起的
 * 「我的行程」→「探险日记」闪动(per UI-019 fix)。
 *
 * spec §3.7.1 v0.2.0:viewMode 5 枚举保留为底层语义标记(日志/埋点用),**不**直接驱动 Header。
 * Header 应反映**数据状态**(store.today 缓存)而非**视图状态**(viewMode 局部),
 * 这样从其他 page 返回 HomePage 时,store.today 仍然保留,第一帧就显示正确的标题。
 */
const hasDiaryContent = computed(() =>
  !!store.today
  && Array.isArray(store.today.today_items)
  && store.today.today_items.length > 0
)

const headerTitle = computed(() =>
  hasDiaryContent.value ? strings.pageTitleDiary : strings.pageTitleTrips
)

const unreadCount = computed(() => store.unreadCount)
const showBadge = computed(
  () => hasDiaryContent.value && store.unreadCount > 0
)

const errorMessage = computed(
  () => store.error?.message || strings.errorTitle
)

// v0.3.0(per user-round5-2026-06-27):isCurrentSpotFavorited 删
//   收藏按钮已删,favoriteIds 暂保留 ref(本 task 不删,user 后续 task 决定是否清 storage)

/**
 * 行程列表按 start_date 升序(spec §5.2 + §9 AC-05:进行中置顶)
 * MVP 简化:active 优先,其余按 start_date 升序;finished 排在最后
 */
const sortedTrips = computed(() => {
  const list = [...store.trips]
  list.sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1
    if (a.status !== 'active' && b.status === 'active') return 1
    if (a.status === 'finished' && b.status !== 'finished') return 1
    if (a.status !== 'finished' && b.status === 'finished') return -1
    return (a.start_date || '').localeCompare(b.start_date || '')
  })
  return list
})

const addTripAria = computed(() => strings.addTripAria)

/**
 * 2026-06-24 Fix A 新增:Section 1 永远保留判定
 * 派生:`store.today !== null`(即有 active trip),Section 1 永远渲染
 * 内部:`hasTodayItems` 决定渲染 <HomeDiary> vs <EmptyTodayState>
 * @returns {boolean}
 */
const hasTodayItems = computed(() =>
  !!store.today
  && Array.isArray(store.today.today_items)
  && store.today.today_items.length > 0
)

/**
 * v0.2.0 新增:sectionVisibility 计算属性(spec §3.7.2)
 * 实际 v-if 渲染的决定源,取代 v0.1.0 viewMode 互斥链
 * 4 字段(showError/showDiary/showTrips/showEmpty)互斥决策:
 *   - error 优先:任一 fetch 失败 → 整页 error
 *   - loading 全空白:未首次拉完 + isFetching
 *   - 双空 → empty 兜底
 *   - 任一非空 → 对应 section 渲染(可同时)
 *
 * v0.2.1(2026-06-24)修订:showDiary 改用 hasActiveOrUpcomingTrip(有 active trip 即显示),
 * 内部 hasTodayItems 决定 HomeDiary vs EmptyTodayState,避免「今日无行程时整段消失」。
 */
const sectionVisibility = computed(() => {
  const today = store.today
  const trips = store.trips
  const error = store.error
  const isFetching = store.isFetchingToday || store.isFetchingTrips
  const hasFetchedOnceLocal = hasFetchedOnce.value

  // error 优先:任一 fetch 失败 → 整页错误占位
  if (error !== null) {
    return { showError: true, showDiary: false, showTrips: false, showEmpty: false }
  }

  // 加载中且未首次拉完:全空白(等 fetch 完成)
  if (isFetching && !hasFetchedOnceLocal) {
    return { showError: false, showDiary: false, showTrips: false, showEmpty: false }
  }

  // 正常态:v0.2.1 修订 — showDiary = today !== null(有 active trip 即显示),
  // 内部 hasTodayItems 决定 <HomeDiary> vs <EmptyTodayState> 占位
  const showDiary = today !== null
  const showTrips = trips.length > 0
  const showEmpty = !showDiary && !showTrips

  return { showError: false, showDiary, showTrips, showEmpty }
})

/**
 * 是否处于初始 loading 态(用于转圈 + 提示语渲染 + FAB 隐藏)
 * 派生:sectionVisibility 全 false 但 hasFetchedOnce=false 即初始 loading
 */
const isInitialLoading = computed(
  () => !hasFetchedOnce.value && !sectionVisibility.value.showError
)

// ──────────── View Mode Decision(spec §3.7 + §5.5)────────────

/**
 * 决定 viewMode 5 枚举(底层语义标记,供日志/埋点用)
 * 不直接驱动 v-if,仅由 sectionVisibility 决定渲染(spec §3.7.1 v0.2.0 修订)
 */
function decideViewMode() {
  if (!hasFetchedOnce.value) {
    viewMode.value = 'loading'
    return
  }
  if (store.error) {
    viewMode.value = 'error'
    return
  }
  if (
    store.today
    && store.today.today_items
    && store.today.today_items.length > 0
  ) {
    viewMode.value = 'diary'
    return
  }
  if (store.trips.length > 0) {
    viewMode.value = 'trips'
    return
  }
  viewMode.value = 'empty'
}

// ──────────── Lifecycle ────────────

/**
 * 拉取并刷新视图决策
 * spec §5.1:onShow 强制重拉(无缓存命中)
 */
async function fetchAndDecide() {
  viewMode.value = 'loading'
  try {
    await store.refreshAll()
  } catch (err) {
    logger.error('[HomePage] refreshAll error', err)
    // refreshAll 内部已消化为 store.error
  } finally {
    hasFetchedOnce.value = true
    decideViewMode()
  }
}

onMounted(() => {
  // 启动时加载本地收藏
  favoriteIds.value = loadFavorites()
  logger.info('[HomePage] mounted, favoriteIds loaded', {
    count: favoriteIds.value.length,
  })
  fetchAndDecide()
})

onShow(() => {
  // tabBar 切回时强制重拉(spec §5.1 + §9 AC-11)
  logger.debug('[HomePage] onShow, refetch')
  fetchAndDecide()
})

onUnmounted(() => {
  // 重置 local state,避免下次进入遗留
  selectedSpot.value = null
  sheetVisible.value = false
  logger.debug('[HomePage] unmounted, reset local state')
})

// ──────────── Handlers ────────────

/**
 * 错误重试(spec §9 AC-07 + §3.7)
 */
function onRetry() {
  logger.info('[HomePage] retry')
  fetchAndDecide()
}

/**
 * 新建行程(右下浮动按钮 + empty CTA)
 */
function onAddTrip() {
  logger.info('[HomePage] add trip')
  uni.navigateTo({ url: AppRoutes.NewTrip })
    .catch((err) => {
      logger.warn('[HomePage] navigateTo(NewTrip) fail', err)
      uni.showToast({ title: strings.toastPageJumpFail, icon: 'none', duration: 1500 })
    })
}

/**
 * 查看完整行程(Diary 底部按钮)
 * spec §8.1:uni.navigateTo({ url: AppRoutes.TripDetail + '?tripId=' + today.trip_id })
 */
function onViewFullTrip() {
  if (!store.today) return
  const tripId = store.today.trip_id
  logger.info('[HomePage] view full trip', { tripId })
  uni.navigateTo({ url: `${AppRoutes.TripDetail}?tripId=${tripId}` })
    .catch((err) => {
      logger.warn('[HomePage] navigateTo(TripDetail) fail', err)
      uni.showToast({ title: strings.toastPageJumpFail, icon: 'none', duration: 1500 })
    })
}

/**
 * TripList → TripDetailPage / EditTripPage(草稿)
 *
 * 草稿状态(per issues/UI/UI-023-draft-page-prefill.md §步骤 1):
 *   - status='draft' → 跳 EditTripPage?tripId=X&mode=draft
 *     草稿页字段预填(db_trips 读,沿 Plan 1 placeholder 扩展)
 *   - 其他状态 → 跳 TripDetailPage(原流程)
 */
function onSelectTrip(trip) {
  if (!trip) return
  logger.info('[HomePage] select trip', { tripId: trip.id, status: trip.status })
  if (trip.status === 'draft') {
    // 草稿 → EditTripPage 接管(per UI-023 §步骤 1)
    uni.navigateTo({ url: `${AppRoutes.EditTrip}?tripId=${trip.id}&mode=draft` })
      .catch((err) => {
        logger.warn('[HomePage] navigateTo(EditTrip draft) fail', err)
        uni.showToast({ title: strings.toastPageJumpFail, icon: 'none', duration: 1500 })
      })
    return
  }
  // 其他状态(active/finished/deleted) → TripDetailPage
  uni.navigateTo({ url: `${AppRoutes.TripDetail}?tripId=${trip.id}` })
    .catch((err) => {
      logger.warn('[HomePage] navigateTo(TripDetail) fail', err)
      uni.showToast({ title: strings.toastPageJumpFail, icon: 'none', duration: 1500 })
    })
}

/**
 * TripCard.chat emit → ChatPage(2026-06-24 Fix B)
 * 跳 AppRoutes.Chat 携带 tripId query(每行程独立 chat session,per task「每行程有独立 chatSession」)
 * chat page 内部从 homeStore.currentTripId 派生(沿 Q1 决策,chatStore 自动从 homeStore 拿)
 */
function onChatTrip(trip) {
  if (!trip) return
  logger.info('[HomePage] chat tap', { tripId: trip.id })
  uni.navigateTo({ url: `${AppRoutes.Chat}?tripId=${trip.id}` })
    .catch((err) => {
      logger.warn('[HomePage] navigateTo(Chat) fail', err)
      uni.showToast({ title: strings.toastPageJumpFail, icon: 'none', duration: 1500 })
    })
}

/**
 * TripCard.delete emit → DeleteConfirmDialog(2026-06-24 UserRound2-001 §3 Bug C)
 * 门控:active trip 不允许在首页直接删,引导走回收站(per HomeStrings.deleteActiveTripToast);
 * 其他状态(draft / finished)→ 弹 DeleteConfirmDialog 二次确认。
 */
function onDeleteTrip(trip) {
  if (!trip) return
  if (trip.status === 'active') {
    logger.info('[HomePage] delete trip blocked (active)', { tripId: trip.id })
    uni.showToast({ title: strings.deleteActiveTripToast, icon: 'none', duration: 1500 })
    return
  }
  logger.info('[HomePage] delete trip tap', { tripId: trip.id, status: trip.status })
  pendingDeleteTrip.value = trip
  deleteConfirmVisible.value = true
}

/**
 * DeleteConfirmDialog:确认删除 → 调 homeStore.deleteTrip + refreshAll
 * store action 只做"删"一件事,page 层显式调 refreshAll 重拉(per AGENTS.md §5 store 纪律)
 */
async function onDeleteConfirm() {
  const trip = pendingDeleteTrip.value
  if (!trip) return
  deleteConfirmVisible.value = false
  pendingDeleteTrip.value = null
  logger.info('[HomePage] delete trip start', { tripId: trip.id })
  try {
    await store.deleteTrip(trip.id)
    await store.refreshAll()
    uni.showToast({ title: strings.deleteSuccessToast, icon: 'success', duration: 1500 })
    logger.info('[HomePage] delete trip ok', { tripId: trip.id })
  } catch (err) {
    logger.error('[HomePage] delete trip failed', err)
    uni.showToast({ title: strings.deleteFailToast, icon: 'none', duration: 1500 })
  }
}

/**
 * DeleteConfirmDialog:取消/蒙层点击
 */
function onDeleteCancel() {
  deleteConfirmVisible.value = false
  pendingDeleteTrip.value = null
  logger.debug('[HomePage] delete trip cancel')
}

/**
 * ReminderChip 点击(spec §3.2:跳 TripDetailPage)
 * 本页面 MVP 不挂载实际 chip 数据,仅 handler 留作后续
 */
function onReminderTap(tripId) {
  logger.info('[HomePage] reminder tap', { tripId })
  uni.navigateTo({ url: `${AppRoutes.TripDetail}?tripId=${tripId}` })
    .catch((err) => {
      logger.warn('[HomePage] navigateTo(TripDetail) fail', err)
    })
}

/**
 * 选中某 SpotCard → 打开浮层
 * spec §3.5 §9 AC-03
 */
function onSelectSpot(spot) {
  if (!spot) return
  selectedSpot.value = spot
  sheetVisible.value = true
  logger.info('[HomePage] select spot', { itemId: spot.id })
}

/**
 * 关闭浮层
 */
function onCloseSheet() {
  selectedSpot.value = null
  sheetVisible.value = false
}

/**
 * 导航去这里 — 唤起系统地图
 * spec §9 AC-04:uni.openLocation({ latitude, longitude, name, address })
 * 导航升级(4 端条件编译 + lat/lng 缺失 Toast + H5 端高德网页兜底)推迟到后续 task
 */
function onNavigate(spot) {
  if (!spot) return
  logger.info('[HomePage] navigate', { itemId: spot.id })
  uni.openLocation({
    latitude: Number(spot.latitude) || 0,
    longitude: Number(spot.longitude) || 0,
    name: spot.title || '',
    address: spot.address || '',
    scale: 16,
  }).catch((err) => {
    logger.warn('[HomePage] openLocation fail', err)
    uni.showToast({ title: strings.toastMapFail, icon: 'none', duration: 1500 })
  })
}

// v0.3.0(per user-round5-2026-06-27):删 onGuide / onToggleFavorite 2 函数
//   拍照讲解 / 收藏 2 按钮在 SpotDetailSheet 浮层中已删除,对应 handler 同步收敛
//   favoriteIds ref + loadFavorites / saveFavorites storage 逻辑暂保留
//   (本 task 不删,user 后续 task 决定是否清 storage + 是否升级为 homeStore 跨页共享)
//   选点 / 导航升级 / 收藏跨页共享 推迟到后续 task(per issues/Cross-Page/user-round5-...)

/**
 * 标记 spot 已到达(乐观更新,本页面 MVP 不挂载 UI 入口,仅导出 hook)
 * spec §7.5 / §9 AC-08
 */
function onMarkSpotVisited(itemId) {
  store.markSpotVisited(itemId)
}
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #F7F3EC;
  /* Surface,见 UI §二 */
  position: relative;
  box-sizing: border-box;
}

/* ───────── Header(顶栏,无 ← 按钮,tabBar page) ───────── */
.header {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12rpx;
  padding: 0 40rpx;
  /* 水平边距 40rpx(等价 20px) */
  flex-shrink: 0;
  background: transparent;
  box-sizing: border-box;
}

.header-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 44rpx;
  /* 22px,UI §三 页面标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.2;
  flex: 1;
}

/* ───────── Body ───────── */
.body {
  flex: 1;
  min-height: 0;
}

.body-inner {
  padding: 16rpx 0 120rpx;
  /* 底部预留空间给浮动按钮,避免遮挡 */
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
  animation: spin 0.8s linear infinite;
}

.state-loading-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ───────── 视图态容器(v0.2.0 section 容器,非互斥) ───────── */
.section {
  width: 100%;
  box-sizing: border-box;
}

.section-trips {
  padding: 24rpx 0 0;
  /* 上下间距(与 Section 1 之间) */
}

.section-empty {
  padding: 0 40rpx;
  /* Empty 容器有水平边距 */
}

.state-error {
  padding: 24rpx 40rpx;
}

/* ───────── Section 2 标题(per spec §3 UI Structure) ───────── */
.section-trips-title-wrap {
  padding: 0 40rpx 16rpx;
  box-sizing: border-box;
}

.section-trips-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px,UI §三 段标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

/* ───────── 浮动按钮(BtnAddTrip)───────── */
.btn-add-trip {
  position: fixed;
  right: 32rpx;
  bottom: 120rpx;
  /* 距底部 Tab 栏 ~24rpx */
  width: 96rpx;
  height: 96rpx;
  border-radius: 9999px;
  /* radius-full */
  background: linear-gradient(135deg, #D4613A 0%, #E87D5A 100%);
  /* 丹霞渐变,见 UI §八 浮动操作按钮 */
  box-shadow: 0 4rpx 20rpx rgba(212, 97, 58, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  box-sizing: border-box;
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
}

.btn-add-trip-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 12rpx rgba(212, 97, 58, 0.4);
}

.btn-add-trip-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 48rpx;
  /* 24px */
  font-weight: 300;
  color: #FFFFFF;
  line-height: 1;
  margin-top: -4rpx;
  /* 视觉居中补偿 */
}

/* ───────── H5 ≥1024px 大屏居中(spec §10 NFR 兼容性)───────── */
@media (min-width: 1024px) {
  .section-diary,
  .section-trips,
  .section-empty,
  .state-error {
    max-width: 640rpx;
    margin: 0 auto;
  }
}
</style>
