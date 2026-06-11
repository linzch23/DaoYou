<!--
  pages/trip-prepare/index.vue — 行程准备中占位页(独立 route,MVP 不展开"行程准备"实质业务,uni.navigateBack 兜底)
  
  Spec contract: specs/TripPreparePage.md v0.1.0
  Route: /pages/trip-prepare/index
  入口:未来 deep-link / 内部扩展入口(per §1 MVP carve-out 决策;MVP 阶段无上游调用)
  出口:Header「←」/ 系统返回手势 / 「返回上一页」按钮 → onBack 走 §5.4 4 路径 + 1 兜底(uni.navigateBack + reLaunch Home)
  
  3 视图态(spec §3 / §4.1 / §5):
    loading — onLoad 初始 + 500ms 模拟(纯 UI 切换,无 API)
    loaded  — 500ms 后切到(插画 🧳 + 主副消息 + 返回上一页按钮)
    error   — MVP 不自动触发,防御性兜底(复用 _ErrorBanner 整页)
  
  复用(spec §3.6 + §10 R-1~R-9):
    - AppColors(山水日志配色)/ AppRoutes.TripPrepare(已预声明 constants/routes.js:26)/ AppRoutes.Home
    - TripPrepareStrings(本任务新增 8 键)
    - OnboardingStrings.errorFallback + retry(错误兜底,per 13 页面惯例)
    - components/ErrorBanner.vue ⭐(整页 error 态)
    - utils/logger(7 关键事件,0 console.*)
  
  不复用(spec §7 + §8.2 + §10 C-6 + C-10 严禁):
    - 0 子组件新建(_LoadingPanel / _LoadedPanel / _ErrorPanel / _BackButton / _Illustration / _ActionBar)
    - 0 store 新建(tripPrepareStore / prepareStore / placeholderStore,per §7.2 严禁)
    - 0 service 新建(services/trips.js:prepareTrip,per §7.3 严禁)
    - 0 草稿 / 0 modal(per §4.5 MVP 简化)
  
  关键决策(per spec §1 + §6.2.1 + §6.2.2 PD-001 Resolved):
    - 0 API / 0 store / 0 service(占位 page,500ms 模拟"准备中"动效,无任何端点)
    - 0 子组件(沿 NewTripPage / TripDetailPage / EditTripPage 同形态 inline 渲染惯例)
    - 4 路径 onBack + 1 兜底(Header「←」/ 系统返回手势 / 「返回上一页」按钮 + stack 判定 + reLaunch Home)
    - 2 层 stale setTimeout guard(沿 NewTripPage §5.6 + PhotoGuidePage §5.6 模式)
-->
<template>
  <view
    class="tpp-page"
    :aria-label="strings.pageAria"
  >
    <!-- Header(44pt 顶栏,左「←」中 title,沿 PersonalProfilePage / LoginPage 形态) -->
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
      <text class="header-title">{{ strings.title }}</text>
      <view class="header-spacer" />
    </view>

    <!-- Body:可滚动,内容最大宽度 640rpx 居中(spec §3.5 H5 兼容性) -->
    <scroll-view
      class="body"
      scroll-y
      :enhanced="true"
      :show-scrollbar="false"
    >
      <view class="body-inner">
        <!-- ───────── loading 态(0~500ms) ───────── -->
        <view
          v-if="viewMode === 'loading'"
          class="panel-center"
        >
          <view class="loading-spinner" aria-hidden="true" />
          <text class="loading-text">{{ strings.loadingText }}</text>
        </view>

        <!-- ───────── loaded 态(主路径,500ms 后到达)───────── -->
        <view
          v-else-if="viewMode === 'loaded'"
          class="panel-loaded"
        >
          <!-- _Illustration(120rpx 圆形 + 🧳 emoji,AppColors.primarySoft 软背景圆) -->
          <view class="illustration" aria-hidden="true">
            <text class="illustration-emoji">{{ strings.illustrationEmoji }}</text>
          </view>

          <!-- _Title(Noto Serif SC 36px 600,AppColors.ink,center) -->
          <text class="main-title">{{ strings.mainTitle }}</text>

          <!-- _Subtitle(Noto Sans SC 14px,AppColors.inkLight,center) -->
          <text class="subtitle">{{ strings.subtitle }}</text>

          <!-- (sticky bottom) _ActionBar 单按钮(per §3.4) -->
          <view class="action-bar">
            <view
              class="btn-back"
              role="button"
              :aria-label="strings.backLabel"
              hover-class="btn-back-hover"
              :hover-stay-time="50"
              @click="onBack"
            >
              <text class="btn-back-text">{{ strings.backLabel }}</text>
            </view>
          </view>
        </view>

        <!-- ───────── error 态(防御性兜底,MVP 实际不可达)───────── -->
        <view
          v-else-if="viewMode === 'error'"
          class="panel-error"
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
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { logger } from '../../utils/logger.js'
import { OnboardingStrings, TripPrepareStrings } from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import ErrorBanner from '../../components/ErrorBanner.vue'

const strings = TripPrepareStrings

// ───────── 类型定义(spec §4.1) ─────────
/**
 * @typedef {'loading' | 'loaded' | 'error'} TripPrepareViewMode
 *   严格 3 枚举(spec §3 + §4.1,spec-auditor 严格核对 3 枚举,不许第 4 个)
 */

// ───────── Local State(spec §4.1) ─────────
/** @type {import('vue').Ref<TripPrepareViewMode>} 严格 3 枚举 */
const viewMode = ref('loading')
/** @type {import('vue').Ref<string>} error 态兜底文案(默认 OnboardingStrings.errorFallback,per §3.5 复用决策) */
const errorMessage = ref(OnboardingStrings.errorFallback)
/** @type {import('vue').Ref<ReturnType<typeof setTimeout> | null>} 500ms setTimeout 句柄,onUnmounted 兜底 clearTimeout(沿 NewTripPage §5.6 模式) */
const prepareTimerId = ref(/** @type {ReturnType<typeof setTimeout> | null} */ (null))

/**
 * @type {import('vue').Ref<boolean>}
 * error 态重试节流锁(per issues/Cross-Page/Throttle-001 §4.2)
 * 0~10ms brief 窗口 + 500ms setTimeout 段防双击堆叠(防止 startLoading 重复触发 timer 覆盖)
 */
const isRetrying = ref(false)

// ───────── Handlers(spec §5) ─────────

/**
 * 取消模拟定时器(沿 NewTripPage §5.6 + PhotoGuidePage §5.6 模式)
 */
function clearPrepareTimer() {
  if (prepareTimerId.value !== null) {
    clearTimeout(prepareTimerId.value)
    prepareTimerId.value = null
  }
}

/**
 * 启动 loading → loaded 流程(spec §5.5 startLoading 算法)
 * - viewMode='loading' + errorMessage=null
 * - clearPrepareTimer 防堆叠
 * - setTimeout(500ms) → viewMode='loaded'(stale guard)
 */
function startLoading() {
  viewMode.value = 'loading'
  errorMessage.value = OnboardingStrings.errorFallback
  clearPrepareTimer()
  prepareTimerId.value = setTimeout(() => {
    // 回调内 guard 防 stale(避免外部切 viewMode 后回调仍触发)
    if (viewMode.value !== 'loading') {
      logger.warn('[TripPreparePage] stale setTimeout guard, viewMode changed to', {
        viewMode: viewMode.value,
      })
      return
    }
    viewMode.value = 'loaded'
    prepareTimerId.value = null
    logger.info('[TripPreparePage] switched to loaded')
  }, 500)
}

/**
 * 入口:onMounted 触发 spec §5.1 页面进入流程
 */
function onLoadPage() {
  logger.info('[TripPreparePage] onLoad')
  startLoading()
}

/**
 * Header「←」/ 系统返回手势 / 「返回上一页」按钮 → onBack(spec §5.4 4 路径 + 1 兜底)
 * - clearPrepareTimer(若仍在)
 * - stack 判定:getCurrentPages().length > 1 → uni.navigateBack({delta:1, fail: reLaunch Home})
 * - 无 stack(deep-link 直入)→ 兜底 uni.reLaunch Home
 */
function onBack() {
  clearPrepareTimer()
  const pages = getCurrentPages()
  if (pages.length > 1) {
    logger.info('[TripPreparePage] back btn tapped, viewMode=' + viewMode.value)
    uni.navigateBack({
      delta: 1,
      fail: () => {
        logger.error('[TripPreparePage] navigateBack failed, fallback to reLaunch Home')
        uni.reLaunch({ url: AppRoutes.Home })
      },
    })
  } else {
    logger.info('[TripPreparePage] no previous page, reLaunch Home')
    uni.reLaunch({ url: AppRoutes.Home })
  }
}

/**
 * error 态「重试」 → onRetry(spec §5.3 E)
 * - 重新进入 loading 流程(clearPrepareTimer + 启动 setTimeout(500ms))
 * - viewMode='loading' + errorMessage=fresh + 启动新 setTimeout
 * Throttle-001 §4.2:加 isRetrying 互斥锁,try/finally 兜底 reset
 */
async function onRetry() {
  if (isRetrying.value) return
  isRetrying.value = true
  logger.info('[TripPreparePage] retry')
  try {
    startLoading()
    // 等待 viewMode flip 到非 error 视为 retry 完成(startLoading 同步 flip 到 loading)
    // 不必 await setTimeout,startLoading 自身切 loading 后 error banner v-if 消失
  } finally {
    isRetrying.value = false
  }
}

// ───────── Lifecycle(spec §5.1 + §5.6) ─────────

onMounted(() => {
  onLoadPage()
})

onUnmounted(() => {
  clearPrepareTimer()
  isRetrying.value = false
  logger.debug('[TripPreparePage] onUnmounted, viewMode=' + viewMode.value)
})
</script>

<style scoped>
.tpp-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #F7F3EC;
  /* surface,见 UI §二 */
  box-sizing: border-box;
  animation: pageEnter 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
  /* fadeSlideUp 0.45s ease-out,见 UI §七 */
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  min-width: 88rpx;
  min-height: 88rpx;
  /* ≥ 44pt tap area(88rpx = 44pt,spec §3.2 + §10.2) */
  border-radius: 9999px;
  /* radius-full */
  box-sizing: border-box;
  transition: background 0.15s ease-out, transform 0.15s ease-out;
}

.header-back-hover {
  background: rgba(45, 106, 94, 0.06);
  /* primarySoft */
  transform: scale(0.96);
}

.header-back-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 48rpx;
  /* 24px */
  color: #2C2C2C;
  /* ink */
  line-height: 1;
  margin-top: -4rpx;
  /* 视觉居中补偿 */
}

.header-title {
  flex: 1;
  text-align: center;
  font-family: 'Noto Serif SC', serif;
  font-size: 44rpx;
  /* 22px,UI §三 page title */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.2;
}

.header-spacer {
  width: 88rpx;
  /* 与 header-back 同宽,保证标题居中 */
  flex-shrink: 0;
}

/* ───────── Body ───────── */
.body {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
}

.body-inner {
  padding: 48rpx 40rpx;
  /* space-2xl / 20px → 40rpx 水平边距 */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 60vh;
}

/* ───────── Loading Panel ───────── */
.panel-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
  gap: 24rpx;
  /* space-lg */
  min-height: 60vh;
  box-sizing: border-box;
}

.loading-spinner {
  width: 64rpx;
  height: 64rpx;
  border: 6rpx solid rgba(45, 106, 94, 0.12);
  /* primaryBorder */
  border-top-color: #2D6A5E;
  /* primary */
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  box-sizing: border-box;
}

.loading-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
  text-align: center;
}

/* ───────── Loaded Panel ───────── */
.panel-loaded {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  /* space-lg 8/16/24 节奏 */
  padding: 80rpx 0 48rpx;
  /* 顶部留白 80rpx,底部留给 action-bar */
  box-sizing: border-box;
  width: 100%;
}

/* _Illustration(120rpx × 120rpx 圆形 + AppColors.primarySoft 软背景) */
.illustration {
  width: 120rpx;
  height: 120rpx;
  background: rgba(45, 106, 94, 0.12);
  /* primarySoft */
  border-radius: 12rpx;
  /* radius-md */
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.illustration-emoji {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 80rpx;
  /* 80rpx emoji */
  line-height: 1;
}

/* _Title(Noto Serif SC 36px 600,AppColors.ink,center) */
.main-title {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 72rpx;
  /* 36px,见 spec §3.3 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  text-align: center;
  margin-top: 16rpx;
  /* space-md */
}

/* _Subtitle(Noto Sans SC 14px,AppColors.inkLight,center) */
.subtitle {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.6;
  text-align: center;
  max-width: 480rpx;
  margin-top: 8rpx;
  /* space-sm */
}

/* _ActionBar(sticky bottom 视觉,主按钮 88rpx 触达) */
.action-bar {
  margin-top: 64rpx;
  /* 与末段 64rpx 间距(spec §3.4 节奏 32/64) */
  width: 100%;
  max-width: 600rpx;
  box-sizing: border-box;
}

.btn-back {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area(88rpx = 44pt,spec §3.4 + §10.2) */
  border-radius: 9999px;
  /* radius-full */
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
  /* Primary 渐变,见 UI §八 */
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
  /* primaryShadow */
  box-sizing: border-box;
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
}

.btn-back-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.btn-back-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* ───────── Error Panel ───────── */
.panel-error {
  padding: 24rpx 0;
  box-sizing: border-box;
  width: 100%;
}

/* ───────── Animations ───────── */
@keyframes pageEnter {
  from {
    opacity: 0;
    transform: translateY(20rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ───────── H5 ≥1024px 大屏居中(spec §3.5 + §10.3 Compatibility) ───────── */
@media (min-width: 1024px) {
  .body-inner {
    max-width: 640rpx;
    margin: 0 auto;
    /* 仅作用于内容容器,Header / 浮动按钮不受限 */
  }
}
</style>
