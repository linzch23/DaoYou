<!--
  pages/spot-detail-sheet/index.vue — 景点详情浮层(独立 route,深链 ?spotId=xxx)
  
  Spec contract: specs/SpotDetailSheet.md v0.1.0
  Route: /pages/spot-detail-sheet/index(uni.navigateTo 拉起,支持深链 ?spotId=xxx)
  
  4 视图态(spec §3.4 / §5):
    loading   → 初始 / homeStore.isFetchingToday=true
    sheet     → URL 解析成功 + homeStore.today 非空 + today_items 找到对应 id
    notfound  → URL 缺参 / 解析失败 / 找不到对应 id
    error     → homeStore.error != null 且重试后仍失败
  
  复用:components/SpotDetailSheet.vue(spec §3.3 + §10 R-1~R-9 已 refactor)
  私有:pages/spot-detail-sheet/components/_ErrorOverlay.vue(spec §3.3 / §8.2)
  
  关闭路径(spec §3.1):
    1) _Backdrop click → onClose
    2) _DragHandle click → onClose(组件内部)
    3) _CloseButton click → onClose(组件内部)
    4) 系统返回 / uni.navigateBack → onUnmounted 兜底重置
-->
<template>
  <view class="sds-page">
    <!-- loading 态(spec §3.4) -->
    <view
      v-if="viewMode === 'loading'"
      class="state-loading"
    >
      <view class="loading-spinner" aria-hidden="true" />
      <text class="state-loading-text">{{ strings.loadingText }}</text>
    </view>

    <!-- notfound / error 态:统一 _ErrorOverlay(spec §3.2) -->
    <_ErrorOverlay
      v-else-if="viewMode === 'notfound'"
      type="notfound"
      :message="strings.errorNotFoundMessage"
      :button-label="strings.errorNotFoundButton"
      @action="onErrorAction"
    />

    <_ErrorOverlay
      v-else-if="viewMode === 'error'"
      type="error"
      :message="strings.errorLoadMessage"
      :button-label="strings.errorLoadButton"
      @action="onErrorAction"
    />

    <!-- sheet 态(spec §3.4):复用 ⭐ components/SpotDetailSheet.vue -->
    <SpotDetailSheet
      v-else-if="viewMode === 'sheet'"
      :spot="selectedSpot"
      :is-favorite="isCurrentSpotFavorited"
      @close="onSheetClose"
      @navigate="onNavigate"
      @guide="onGuide"
      @toggle-favorite="onToggleFavorite"
    />
  </view>
</template>

<script setup>
import { ref, computed, onUnmounted, onMounted, watch } from 'vue'
import { useHomeStore } from '../../stores/homeStore.js'
import { SpotDetailSheetStrings } from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import { logger } from '../../utils/logger.js'
import { loadFavorites, saveFavorites } from '../../services/home.js'

import SpotDetailSheet from '../../components/SpotDetailSheet.vue'
import _ErrorOverlay from './components/_ErrorOverlay.vue'

const strings = SpotDetailSheetStrings

// ─────────────── Store ───────────────
const store = useHomeStore()

// ─────────────── Local State(spec §4.1) ───────────────

/** @type {import('vue').Ref<number | null>} */
const spotId = ref(null)

/** @type {import('vue').Ref<'loading' | 'sheet' | 'notfound' | 'error'>} */
const viewMode = ref('loading')

/** @type {import('vue').Ref<import('../../api/types').TripItem | null>} */
const selectedSpot = ref(null)

/** @type {import('vue').Ref<number[]>} 本地收藏 ids,持久化到 uni.storage 'favorites' */
const favoriteIds = ref([])

// ─────────────── Computed ───────────────

const isCurrentSpotFavorited = computed(() => {
  if (!selectedSpot.value) return false
  return favoriteIds.value.includes(selectedSpot.value.id)
})

// ─────────────── 视图决策(spec §5.1 / §5.4) ───────────────

/**
 * 视图决策伪代码(spec §5.4):
 *   if (!Number.isFinite(spotId) || spotId <= 0) → 'notfound'
 *   if (store.today) {
 *     target = today_items.find(i => i.id === spotId)
 *     if (target) → 'sheet'(调用方负责把 selectedSpot 置为 target)
 *     else → 'notfound'
 *   }
 *   if (store.isFetchingToday) → 'loading'
 *   if (store.error) → 'error'
 *   else → 'loading'  (冷启动深链,需 refreshAll)
 */
function decideViewMode() {
  if (!Number.isFinite(spotId.value) || (spotId.value ?? 0) <= 0) {
    viewMode.value = 'notfound'
    return
  }

  if (store.today) {
    const target = store.today.today_items.find((i) => i.id === spotId.value)
    if (target) {
      selectedSpot.value = target
      viewMode.value = 'sheet'
      return
    }
    // 缓存命中但找不到 → 视为 notfound(数据可能已过期)
    viewMode.value = 'notfound'
    return
  }

  if (store.isFetchingToday) {
    viewMode.value = 'loading'
    return
  }

  if (store.error) {
    viewMode.value = 'error'
    return
  }

  // 冷启动深链:homeStore.today 仍为 null,需主动 fetch
  viewMode.value = 'loading'
}

/**
 * 拉取今日数据(冷启动深链入口)
 * refreshAll 内部已用 Promise.allSettled 包装,失败被消化到 store.error
 */
async function fetchAndDecide() {
  try {
    await store.refreshAll()
  } catch (err) {
    logger.error('[SpotDetailSheetPage] refreshAll error', err)
  } finally {
    // 不论成功失败,都重新决策(失败时 store.error 非空 → viewMode='error')
    decideViewMode()
  }
}

// ─────────────── 路由参数解析(spec §4.3) ───────────────

/**
 * 解析 URL ?spotId=xxx
 * 缺省 / 空 / 非数字 / <= 0 → spotId=null(驱动 viewMode='notfound')
 *
 * @param {Record<string, string | undefined> | undefined} options
 */
function parseQuery(options) {
  const raw = options?.spotId
  if (raw === undefined || raw === null || raw === '') {
    spotId.value = null
    // spec §9 AC-04 + §10 NFR 可观测性:onLoad 时立即打点(不等用户点按钮)
    logger.info('[SpotDetailSheetPage] notfound, bad spotId', { rawSpotId: raw })
    return
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) {
    spotId.value = null
    // spec §9 AC-04:Number 解析失败 / n <= 0 也算"bad spotId"
    logger.info('[SpotDetailSheetPage] notfound, bad spotId', { rawSpotId: raw })
    return
  }
  spotId.value = n
}

/**
 * 从 uni-app 运行时拿当前页的 options(query 参数)
 * 优先用 onLoad(options) 钩子入参,fallback 用 getCurrentPages() 末项 options
 * (本工程未在 package.json 显式列 @dcloudio/uni-app,故 fallback 走 getCurrentPages)
 *
 * @returns {Record<string, string | undefined> | undefined}
 */
function getCurrentPageOptions() {
  try {
    // uni-app 运行时全局函数,无需 import
    const pages = /** @type {any[]} */ (typeof getCurrentPages === 'function' ? getCurrentPages() : [])
    if (Array.isArray(pages) && pages.length > 0) {
      const last = pages[pages.length - 1]
      return last?.options
    }
  } catch (err) {
    logger.warn('[SpotDetailSheetPage] getCurrentPages fail', err)
  }
  return undefined
}

// ─────────────── Lifecycle ───────────────

/**
 * 初始化入口(spec §5.1)
 * 1) 同步本地收藏
 * 2) 解析 query
 * 3) 决策
 * 4) 冷启动深链 → 主动 fetch
 */
function initialize(options) {
  logger.info('[SpotDetailSheetPage] initialize', { options })

  // 1) 同步本地收藏(spec §4.1 备注)
  favoriteIds.value = loadFavorites()

  // 2) 解析 query
  parseQuery(options)

  // 3) 决策
  decideViewMode()

  // 4) 缓存未就绪且 spotId 有效 → 冷启动深链入口
  if (
    spotId.value !== null &&
    !store.today &&
    !store.isFetchingToday
  ) {
    fetchAndDecide()
  }
}

onMounted(() => {
  // uni-app Vue 3 模式下,onLoad(options) 是页面级钩子(@dcloudio/uni-app)
  // 本工程未显式列该依赖,fallback 到 onMounted + getCurrentPages() 读 options
  const options = getCurrentPageOptions()
  initialize(options)
})

// ─────────────── 兜底:onUnmounted 重置 spec §5.2 Step F + AC-11 ───────────────
onUnmounted(() => {
  selectedSpot.value = null
  viewMode.value = 'loading'
  // 释放 ref;storage 持久化由 saveFavorites 保护
  favoriteIds.value = []
  logger.debug('[SpotDetailSheetPage] unmounted, reset local state')
})

// ─────────────── Watchers ───────────────

// 监控 store.today 变化:fetchAndDecide 完成后 store.today 更新,触发重新决策
watch(
  () => store.today,
  (next, prev) => {
    // spec §9 AC-08:sheet 态下 today 被外部清空(从非 null 变 null,如登出 clearHome)
    // → 仅 warn 记录,不切换 viewMode(浮层保持显示,selectedSpot 已固定)
    if (
      viewMode.value === 'sheet' &&
      next === null &&
      prev !== null
    ) {
      logger.warn(
        '[SpotDetailSheetPage] today cleared mid-flight, keep sheet'
      )
    }
    if (viewMode.value === 'loading' && spotId.value !== null) {
      decideViewMode()
    }
  }
)

// 监控 store.error 变化(从 loading → error)
watch(
  () => store.error,
  (next) => {
    if (next && viewMode.value === 'loading') {
      viewMode.value = 'error'
    }
  }
)

// ─────────────── Handlers ───────────────

/**
 * 错误兜底按钮:返回首页(notfound) / 重试(error)
 * spec §5.3.A / §5.3.C
 */
function onErrorAction() {
  if (viewMode.value === 'notfound') {
    logger.info('[SpotDetailSheetPage] notfound, back to home', {
      spotId: spotId.value,
    })
    uni.reLaunch({ url: AppRoutes.Home })
  } else if (viewMode.value === 'error') {
    logger.info('[SpotDetailSheetPage] error, retry')
    viewMode.value = 'loading'
    fetchAndDecide()
  }
}

/**
 * 浮层关闭(spec §5.2 Step E + §9 AC-03)
 * 组件内部已 slideDown 0.3s + 280ms 后 emit('close'),本 handler 收尾
 */
function onSheetClose() {
  logger.info('[SpotDetailSheetPage] close', { spotId: spotId.value })
  selectedSpot.value = null
  // 优先 uni.navigateBack 回到上游;若栈顶(本页是首页栈,理论上不会),回退 reLaunch Home
  uni.navigateBack({
    delta: 1,
    fail: () => uni.reLaunch({ url: AppRoutes.Home }),
  })
}

/**
 * 导航去这里 —— 唤起系统地图(spec §5.2 Step B + §9 AC-02)
 * 复用 pages/home/index.vue:353-366 同款逻辑(同服务,字段一致)
 */
function onNavigate(spot) {
  if (!spot) return
  logger.info('[SpotDetailSheetPage] navigate', { spotId: spot.id })
  uni.openLocation({
    latitude: Number(spot.latitude) || 0,
    longitude: Number(spot.longitude) || 0,
    name: spot.title || '',
    address: spot.address || '',
    scale: 16,
  }).catch((err) => {
    logger.warn('[SpotDetailSheetPage] openLocation fail', err)
    uni.showToast({
      title: strings.toastMapFail || '地图唤起失败,请稍后重试',
      icon: 'none',
      duration: 1500,
    })
  })
}

/**
 * 拍照讲解 —— 跳 PhotoGuide Tab,带 ?fromSpot=spotId(spec §5.2 Step C)
 * 复用 pages/home/index.vue:371-381 同款逻辑
 */
function onGuide(spot) {
  if (!spot) return
  logger.info('[SpotDetailSheetPage] guide', { spotId: spot.id })
  uni.switchTab({
    url: `${AppRoutes.PhotoGuide}?fromSpot=${spot.id}`,
  }).catch((err) => {
    logger.warn('[SpotDetailSheetPage] switchTab(PhotoGuide) fail', err)
    uni.showToast({
      title: '页面跳转失败,请稍后重试',
      icon: 'none',
      duration: 1500,
    })
  })
}

/**
 * 收藏 / 取消收藏(本地,无后端;spec §6.4.1 + §6.2 客户端 local 状态)
 * 复用 pages/home/index.vue:387-404 同款逻辑
 */
function onToggleFavorite(spot) {
  if (!spot) return
  const id = spot.id
  const has = favoriteIds.value.includes(id)
  let next
  let toastText
  if (has) {
    next = favoriteIds.value.filter((v) => v !== id)
    toastText = '已取消收藏'
  } else {
    next = [...favoriteIds.value, id]
    toastText = '已收藏'
  }
  favoriteIds.value = next
  saveFavorites(next)
  uni.showToast({ title: toastText, icon: 'success', duration: 1500 })
  // spec §5.2 Step D L319:事件名 toggleFavorite(camelCase) + 字段 isFavorite
  logger.info('[SpotDetailSheetPage] toggleFavorite', {
    spotId: id,
    isFavorite: !has,
    total: next.length,
  })
}
</script>

<style scoped>
.sds-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #F7F3EC;
  /* Surface,见 UI §二 */
  position: relative;
  box-sizing: border-box;
}

/* ───────── Loading 态 ───────── */
.state-loading {
  position: fixed;
  inset: 0;
  z-index: 800;
  /* 浮层 z-index 999,loading 800 避免遮挡 */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  padding: 40rpx;
  box-sizing: border-box;
  background: #F7F3EC;
  /* Surface */
}

.loading-spinner {
  width: 64rpx;
  height: 64rpx;
  border: 6rpx solid rgba(45, 106, 94, 0.12);
  border-top-color: #2D6A5E;
  border-radius: 50%;
  animation: sds-spin 0.8s linear infinite;
}

.state-loading-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

@keyframes sds-spin {
  to { transform: rotate(360deg); }
}

/* spec §3.5 / §9 AC-09 / §10 NFR Compatibility:大屏(H5 ≥ 1024px)内容最大宽度 640rpx 居中
   沿用 HomePage v0.1.0 §10 NFR;移动端(< 1024px)零变化 */
@media (min-width: 1024px) {
  .sds-page {
    max-width: 640rpx;
    margin: 0 auto;
  }
}
</style>
