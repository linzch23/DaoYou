<!--
  pages/login/index.vue — 登录占位页(独立 route,MVP 暂未开放登录,uni.reLaunch Home 兜底)
  
  Spec contract: specs/LoginPage.md v0.1.0
  Route: /pages/login/index
  入口:未来 deep-link / 误路径触发(per §1 MVP carve-out 决策)
  出口:Header「←」/ 系统返回手势 → uni.navigateBack({delta:1, fail: reLaunch Home});「返回首页」按钮 → uni.reLaunch Home
  
  3 视图态(spec §3.4 / §4.1 / §5):
    loading — onLoad 初始 + 200ms 模拟(纯 UI 切换,无 API)
    loaded  — 200ms 后切到(占位 icon + 主副消息 + 返回首页按钮)
    error   — MVP 不自动触发,仅 spec 兜底(复用 _ErrorBanner 整页)
  
  复用(spec §3.5 + §10 R-1~R-9):
    - AppColors(山水日志配色)/ AppRoutes.Home(已预声明 constants/routes.js:12)
    - LoginPageStrings(本任务新增 7 键)
    - OnboardingStrings.errorNetwork(错误态兜底,per 13 页面惯例)
    - OnboardingStrings.retry(_ErrorBanner 内部固定)
    - components/ErrorBanner.vue ⭐(整页 error 态)
    - utils/logger(10 关键事件,0 console.*)
  
  不复用(spec §8.2 + §10 C-9 严禁):
    - 0 子组件新建(_LoginForm / _LoginButton / _OAuthButton / _PhoneInput / _CodeInput / _LoginConfirmDialog)
    - 0 store 新建(useAuthStore / useLoginStore / useSessionStore,per §7.2 严禁)
    - 0 service 新建(services/auth.js / services/login.js,per §1 0 API 决策)
    - 0 路由预声明新增(AppRoutes.Login 已在 constants/routes.js:34 预声明)
  
  关键决策(per spec §1 + §6.4.1 PD-001 Resolved):
    - MVP 不接登录流(api/types.ts 全文 248 行 0 命中 User/Session/LoginRequest)
    - 0 API 调用(grep uni.request / uni.uploadFile 0 命中)
    - 0 真实登录表单(占位页 = 明确"未开放" + 返回首页逃生口)
    - 200ms setTimeout 模拟 + 2 层 stale guard(沿 NewTripPage §5.6 模式)
-->
<template>
  <view
    class="login-page"
    :aria-label="strings.pageAria"
  >
    <!-- Header(44pt 顶栏,左「←」中 title,沿 PersonalProfilePage 形态) -->
    <view class="header">
      <view
        class="header-back"
        role="button"
        :aria-label="'返回'"
        hover-class="header-back-hover"
        :hover-stay-time="50"
        @click="onBack"
      >
        <text class="header-back-text" aria-hidden="true">←</text>
      </view>
      <text class="header-title">{{ strings.title }}</text>
      <view class="header-spacer" />
    </view>

    <!-- Body:可滚动,内容最大宽度 640rpx 居中(spec §3.6 H5 兼容性) -->
    <scroll-view
      class="body"
      scroll-y
      :enhanced="true"
      :show-scrollbar="false"
    >
      <view class="body-inner">
        <!-- ───────── loading 态(0~200ms) ───────── -->
        <view
          v-if="viewMode === 'loading'"
          class="panel-center"
        >
          <view class="loading-spinner" aria-hidden="true" />
          <text class="panel-center-title">{{ strings.loadingText }}</text>
        </view>

        <!-- ───────── loaded 态(主路径,200ms 后到达)───────── -->
        <view
          v-else-if="viewMode === 'loaded'"
          class="panel-loaded"
        >
          <!-- _Icon(120rpx × 120rpx 圆形占位,AppColors.surfaceWarm 背景) -->
          <view class="icon-circle" aria-hidden="true">
            <text class="icon-emoji">{{ strings.iconEmoji }}</text>
          </view>

          <!-- _MainMessage(Noto Serif SC 20px 600) -->
          <text class="main-message">{{ strings.mainMessage }}</text>

          <!-- _SubMessage(Noto Sans SC 14px,AppColors.inkLight,max-width 480rpx 居中) -->
          <text class="sub-message">{{ strings.subMessage }}</text>

          <!-- _VerticalSpacer(24rpx 节奏) -->
          <view class="spacer" aria-hidden="true" />

          <!-- _ActionButton(主 CTA「返回首页」,Primary 渐变 + 88rpx 触达) -->
          <view
            class="btn-back-home"
            role="button"
            :aria-label="strings.btnBackHome"
            hover-class="btn-back-home-hover"
            :hover-stay-time="50"
            @click="onBackHome"
          >
            <text class="btn-back-home-text">{{ strings.btnBackHome }}</text>
          </view>
        </view>

        <!-- ───────── error 态(MVP 不自动触发,spec 兜底)───────── -->
        <view
          v-else-if="viewMode === 'error'"
          class="panel-error"
        >
          <ErrorBanner
            :message="errorMessage"
            :retryable="true"
            @retry="onRetry"
          />
          <!-- error 态保留「返回首页」逃生口(per §3.4 备注) -->
          <view
            class="btn-back-home btn-back-home-error"
            role="button"
            :aria-label="strings.btnBackHome"
            hover-class="btn-back-home-hover"
            :hover-stay-time="50"
            @click="onBackHome"
          >
            <text class="btn-back-home-text">{{ strings.btnBackHome }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { logger } from '../../utils/logger.js'
import { OnboardingStrings, LoginPageStrings } from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import ErrorBanner from '../../components/ErrorBanner.vue'

const strings = LoginPageStrings

// ───────── 类型定义(spec §4.1) ─────────
/**
 * @typedef {'loading' | 'loaded' | 'error'} LoginViewMode
 *   严格 3 枚举(spec §3.4 + §4.1,spec-auditor 严格核对 3 枚举,不许第 4 个)
 */

// ───────── Local State(spec §4.1) ─────────
/** @type {import('vue').Ref<LoginViewMode>} 严格 3 枚举 */
const viewMode = ref('loading')
/** @type {import('vue').Ref<boolean>} 首次模拟初始化完成标记,防 setTimeout stale guard */
const hasInitialized = ref(false)
/** @type {import('vue').Ref<ReturnType<typeof setTimeout> | null>} 200ms setTimeout 句柄,onUnmounted 兜底 clearTimeout */
const simulateTimerId = ref(/** @type {ReturnType<typeof setTimeout> | null} */ (null))
/** @type {import('vue').Ref<string>} error 态兜底文案(默认 OnboardingStrings.errorNetwork,per §3.4 + §3.5 R-1) */
const errorMessage = ref(OnboardingStrings.errorNetwork)

// ───────── Handlers(spec §5) ─────────

/**
 * 入口:onMounted 模拟初始化(per §5.1 200ms setTimeout,无 API 调用)
 * - viewMode='loading'
 * - setTimeout(200ms) → viewMode='loaded'(stale guard 2 层防护)
 * - onUnmounted 兜底 clearTimeout(沿 NewTripPage §5.6 + PhotoGuidePage §5.6 模式)
 */
function onLoadPage() {
  // 初始化 local state
  viewMode.value = 'loading'
  hasInitialized.value = false
  simulateTimerId.value = null
  errorMessage.value = null

  // 防 onLoad 二次进入时 setTimeout 堆叠(沿 NewTripPage §5.6 stale guard 模式)
  clearSimulateTimer()

  logger.info('[LoginPage] onLoad enter')

  simulateTimerId.value = setTimeout(() => {
    // 回调内 guard 防 stale(避免外部切 viewMode 后回调仍触发)
    if (viewMode.value !== 'loading' || hasInitialized.value) {
      logger.warn('[LoginPage] stale setTimeout guard, skip loaded transition', {
        viewMode: viewMode.value,
        hasInitialized: hasInitialized.value,
      })
      return
    }
    viewMode.value = 'loaded'
    hasInitialized.value = true
    simulateTimerId.value = null
    logger.info('[LoginPage] initialized (placeholder, no API)')
  }, 200)
}

/**
 * 取消模拟定时器(沿 NewTripPage §5.6 + PhotoGuidePage §5.6 模式)
 */
function clearSimulateTimer() {
  if (simulateTimerId.value !== null) {
    clearTimeout(simulateTimerId.value)
    simulateTimerId.value = null
  }
}

/**
 * Header「←」/ 系统返回手势 → onBack(spec §5.2 Step 2 + §5.3 A)
 * - 取消 setTimeout(若仍在)
 * - stack 判定:getCurrentPages().length > 1 → uni.navigateBack
 * - 无 stack(deep-link 直入)→ 兜底 uni.reLaunch Home
 */
function onBack() {
  clearSimulateTimer()
  const pages = getCurrentPages()
  if (pages.length > 1) {
    logger.info('[LoginPage] navigateBack')
    uni.navigateBack({
      delta: 1,
      fail: () => {
        logger.error('[LoginPage] navigateBack failed')
        uni.showToast({
          title: '返回失败,请稍后重试',
          icon: 'none',
        })
      },
    })
  } else {
    logger.info('[LoginPage] back, no stack, reLaunch Home')
    uni.reLaunch({ url: AppRoutes.Home })
  }
}

/**
 * 「返回首页」主按钮 → onBackHome(spec §5.2 Step 3 + §5.3 C)
 * - uni.reLaunch Home 清空 stack
 * - 失败兜底 Toast
 */
function onBackHome() {
  logger.info('[LoginPage] back to home, reLaunch')
  uni.reLaunch({
    url: AppRoutes.Home,
    fail: () => {
      logger.error('[LoginPage] reLaunch Home failed')
      uni.showToast({
        title: '返回失败,请稍后重试',
        icon: 'none',
      })
    },
  })
}

/**
 * error 态「重试」 → onRetry(spec §5.3 B)
 * - 重新触发 onLoad 流程(模拟"重新初始化")
 * - viewMode='loading' + hasInitialized=false + 启动新 setTimeout
 */
function onRetry() {
  logger.info('[LoginPage] retry from error, re-init')
  onLoadPage()
}

// ───────── Lifecycle ─────────

onMounted(() => {
  onLoadPage()
})

onUnmounted(() => {
  clearSimulateTimer()
  logger.debug('[LoginPage] unmounted, cleaned up timer')
})
</script>

<style scoped>
.login-page {
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
  /* ≥ 44pt tap area(88rpx = 44pt,spec §3.2 + AC-08) */
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

/* ───────── Center Panel(loading 态)───────── */
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

.panel-center-title {
  display: block;
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
  padding: 80rpx 0;
  box-sizing: border-box;
  width: 100%;
}

/* _Icon(120rpx × 120rpx 圆形占位) */
.icon-circle {
  width: 120rpx;
  height: 120rpx;
  background: #F2EBE0;
  /* surfaceWarm */
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.icon-emoji {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 80rpx;
  /* 80rpx emoji */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1;
}

/* _MainMessage(Noto Serif SC 20px 600,AppColors.ink,center) */
.main-message {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 40rpx;
  /* 20px,UI §三 中标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  text-align: center;
  margin-top: 16rpx;
  /* space-md */
}

/* _SubMessage(Noto Sans SC 14px,AppColors.inkLight,max-width 480rpx 居中) */
.sub-message {
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

/* _VerticalSpacer(24rpx 节奏) */
.spacer {
  height: 24rpx;
  /* space-lg */
  width: 100%;
}

/* _ActionButton(主 CTA「返回首页」,Primary 渐变,88rpx 触达) */
.btn-back-home {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area(88rpx = 44pt,spec §3.3 + AC-08) */
  width: 100%;
  max-width: 600rpx;
  border-radius: 9999px;
  /* radius-full */
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
  /* Primary 渐变,见 UI §八 */
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
  /* primaryShadow */
  box-sizing: border-box;
  margin-top: 24rpx;
  /* space-lg */
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
}

.btn-back-home-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.btn-back-home-error {
  margin-top: 32rpx;
  /* 与 _ErrorBanner 之间略大间距,避免视觉粘连 */
}

.btn-back-home-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* ───────── Error Panel ───────── */
.panel-error {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 16rpx;
  /* space-md */
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

/* ───────── H5 ≥1024px 大屏居中(spec §3.6 + §10 NFR Compatibility) ───────── */
@media (min-width: 1024px) {
  .body-inner {
    max-width: 640rpx;
    margin: 0 auto;
    /* 仅作用于内容容器,Header / 浮动按钮不受限 */
  }
}
</style>
