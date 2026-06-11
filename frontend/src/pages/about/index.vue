<!--
  pages/about/index.vue — 关于导友页(独立 route 化"项目元信息展示"子页,纯静态,uni.navigateBack 兜底)
  
  Spec contract: specs/AboutPage.md v0.1.0
  Route: /pages/about/index
  入口:MyPage 第 6 项菜单「关于」→ uni.navigateTo({url: AppRoutes.About})(per MyPage §3.4 + §4.4)
  出口:Header「←」/ 系统返回手势 → onBack 走 §5.4 4 路径 + 1 兜底(uni.navigateBack + reLaunch Home)
  
  2 视图态(spec §3 + §4.1 + §5):
    loaded — onLoad 立即(0 异步,纯静态;4 信息卡片 + ProjectLogo + Divider)
    error  — MVP 不自动触发,理论兜底(MVP 阶段 0 API 实际不可达)
  
  复用(spec §1 + §3.5 + §10 R-1~R-9):
    - AppColors(山水日志配色)/ AppRoutes.About(已预声明 constants/routes.js:20)/ AppRoutes.Home
    - AboutStrings(本任务新增 10 键)+ AboutInfoCards(本任务新增 4 键 Object.freeze)
    - OnboardingStrings.retry + NewTripStrings.errorFallback(错误兜底,per 13 页面惯例)
    - components/ErrorBanner.vue ⭐(整页 error 态)
    - utils/logger(5 关键事件,0 console.*)
  
  不复用(spec §7 + §8.2 + §10 C-5 + C-7 严禁):
    - 0 子组件新建(_InfoCard / _LoadedPanel / _ErrorPanel,沿 StyleSettingPage / MyPage 决策 inline 渲染)
    - 0 store 新建(aboutStore,per §7.1 严禁)
    - 0 service 新建(services/about.js,per §6 0 API 决策)
    - 0 storage 写入(纯展示,无草稿价值)
    - 0 URL params(纯展示,无 query)
  
  关键决策(per spec §1 + §1 MVP carve-out + §6.4.1 Resolved):
    - 0 API / 0 store / 0 service / 0 storage(纯静态展示,4 卡片字面硬编码)
    - 字面来源:package.json name/version + README.md 技术栈段 + 项目级占位版权
    - 4 信息卡片 inline 渲染(v-for AboutInfoCards,4 键 Object.freeze 集中登记)
    - 4 路径 onBack + 1 兜底(沿 GuideResultPage §5.4 模式)
-->
<template>
  <view
    class="about-page"
    :aria-label="strings.pageAria"
  >
    <!-- Header(44pt 顶栏,左「←」中 title,沿 PersonalProfilePage 形态) -->
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

    <!-- Body:可滚动,内容最大宽度 640rpx 居中(spec §3.7 H5 兼容性) -->
    <scroll-view
      class="body"
      scroll-y
      :enhanced="true"
      :show-scrollbar="false"
    >
      <view class="body-inner">
        <!-- ───────── loaded 态(主路径,onLoad 立即)───────── -->
        <view
          v-if="viewMode === 'loaded'"
          class="panel-loaded"
        >
          <!-- ProjectLogo(120rpx emoji ⛰️ 占位 + ProjectName + ProjectSubtitle) -->
          <view class="project-logo" aria-hidden="true">
            <text class="project-logo-emoji">⛰️</text>
          </view>
          <text class="project-name">{{ strings.projectName }}</text>
          <text class="project-subtitle">{{ strings.projectSubtitle }}</text>

          <!-- Divider(1rpx solid surfaceWarm,水平 32rpx margin) -->
          <view class="divider" aria-hidden="true" />

          <!-- InfoCards(4 张卡片 v-for 渲染,引用 AboutInfoCards 4 键 Object.freeze) -->
          <view class="info-cards">
            <view
              v-for="card in AboutInfoCards"
              :key="card.key"
              class="info-card"
            >
              <text class="info-card-icon" aria-hidden="true">{{ card.icon }}</text>
              <view class="info-card-text-wrap">
                <text class="info-card-label">{{ card.label }}</text>
                <text class="info-card-value">{{ card.value }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- ───────── error 态(理论不可达,防御性兜底)───────── -->
        <view
          v-else-if="viewMode === 'error'"
          class="panel-error"
        >
          <!-- 错误 icon(120rpx × 120rpx ⚠ 圆,background rgba(196,74,58,0.1),center) -->
          <view class="error-icon-circle" aria-hidden="true">
            <text class="error-icon-emoji">⚠</text>
          </view>
          <text class="error-text">{{ strings.errorTitle }}</text>
          <!-- _ErrorBanner ⭐ 复用(retryable=true,message=NewTripStrings.errorFallback) -->
          <ErrorBanner
            :message="errorMessage"
            :retryable="true"
            @retry="onRetryError"
          />
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { logger } from '../../utils/logger.js'
import { OnboardingStrings, NewTripStrings, AboutStrings, AboutInfoCards } from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import ErrorBanner from '../../components/ErrorBanner.vue'

const strings = AboutStrings
const infoCards = AboutInfoCards

// ───────── 类型定义(spec §4.1) ─────────
/**
 * @typedef {'loaded' | 'error'} AboutViewMode
 *   严格 2 枚举(spec §3 + §4.1,spec-auditor 严格核对 2 枚举,不许第 3 个)
 */

// ───────── Local State(spec §4.1) ─────────
/** @type {import('vue').Ref<AboutViewMode>} 严格 2 枚举 */
const viewMode = ref('loaded')
/** @type {import('vue').Ref<string>} error 态兜底文案(默认 NewTripStrings.errorFallback,per §1 复用决策) */
const errorMessage = ref(NewTripStrings.errorFallback)

// ───────── Handlers(spec §5) ─────────

/**
 * 入口:onMounted 触发 spec §5.1 页面进入(纯静态,onLoad 直接 setViewMode('loaded'))
 */
function onLoadPage() {
  viewMode.value = 'loaded'
  logger.info('[AboutPage] entered')
}

/**
 * Header「←」/ 系统返回手势 → onBack(spec §5.4 4 路径 + 1 兜底,沿 GuideResultPage §5.4 模式)
 * - stack 判定:getCurrentPages().length > 1 → uni.navigateBack({delta:1, fail: reLaunch Home})
 * - 无 stack(deep-link 直入)→ 兜底 uni.reLaunch Home
 */
function onBack() {
  logger.info('[AboutPage] onBack triggered')
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack({
      delta: 1,
      fail: () => {
        logger.error('[AboutPage] navigateBack failed, fallback reLaunch Home')
        uni.reLaunch({ url: AppRoutes.Home })
      },
    })
  } else {
    // 栈深度 == 1,深链冷启动罕见路径
    uni.reLaunch({ url: AppRoutes.Home })
  }
}

/**
 * error 态「重试」 → onRetryError(spec §5.3)
 * - MVP 简化:仅 logger + 切回 loaded 态,无实际重试动作(0 API)
 */
function onRetryError() {
  logger.info('[AboutPage] retry error clicked')
  viewMode.value = 'loaded'
}

// ───────── Lifecycle(spec §5.1 + §5.5) ─────────

onMounted(() => {
  onLoadPage()
})

onUnmounted(() => {
  // 释放引用 + 重置 viewMode(防复用 page instance 时态污染,per §5.5)
  viewMode.value = 'loaded'
  logger.debug('[AboutPage] unmounted, viewMode reset to loaded')
})
</script>

<style scoped>
.about-page {
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
  /* ≥ 44pt tap area(88rpx = 44pt,spec §3 + §10.2) */
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
}

/* ───────── Loaded Panel ───────── */
.panel-loaded {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
}

/* ProjectLogo(120rpx × 120rpx emoji ⛰️ 占位) */
.project-logo {
  width: 120rpx;
  height: 120rpx;
  background: #F2EBE0;
  /* surfaceWarm */
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  margin-top: 16rpx;
  /* space-md */
}

.project-logo-emoji {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 72rpx;
  /* 64px 主 emoji,见 spec §3.3 */
  line-height: 1;
}

/* ProjectName(Noto Serif SC 28px 600,AppColors.ink) */
.project-name {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 56rpx;
  /* 28px,见 spec §3.3 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  text-align: center;
  margin-top: 16rpx;
  /* space-md */
}

/* ProjectSubtitle(Noto Sans SC 13px 400,AppColors.inkMuted) */
.project-subtitle {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px,见 spec §3.3 */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.5;
  text-align: center;
  margin-top: 8rpx;
  /* space-sm */
}

/* Divider(1rpx solid surfaceWarm,水平 32rpx margin) */
.divider {
  height: 1rpx;
  background: #F2EBE0;
  /* surfaceWarm */
  margin: 32rpx 0;
  /* 上下各 32rpx 节奏 */
  width: 100%;
  box-sizing: border-box;
}

/* InfoCards(4 张 v-for,inline 渲染,4 卡片不抽 _InfoCard.vue 私有) */
.info-cards {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md,4 卡片间 16rpx(spec §3.1 节奏 8/16/24) */
  width: 100%;
  box-sizing: border-box;
}

.info-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  /* space-md */
  padding: 24rpx;
  /* space-lg */
  background: #FDFBF7;
  /* surfaceCard */
  border-radius: 16rpx;
  /* radius-lg,见 UI §四 */
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
  /* shadow-sm */
  /* 4 卡片**不**可点击(per AC-08),无 hover / tap 反馈 */
  box-sizing: border-box;
  pointer-events: none;
  /* 显式禁用 pointer,避免误触 */
}

.info-card-icon {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 64rpx;
  /* 64rpx emoji,见 spec §3.3 */
  line-height: 1;
  flex-shrink: 0;
  width: 64rpx;
  text-align: center;
}

.info-card-text-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.info-card-label {
  font-family: 'Noto Serif SC', serif;
  font-size: 32rpx;
  /* 16px,见 spec §3.3 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.info-card-value {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px,见 spec §3.3 */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
  word-break: break-all;
}

/* ───────── Error Panel ───────── */
.panel-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  /* space-lg */
  padding: 120rpx 40rpx;
  box-sizing: border-box;
  width: 100%;
}

.error-icon-circle {
  width: 120rpx;
  height: 120rpx;
  background: rgba(196, 74, 58, 0.1);
  /* dangerSoft,见 UI §二 */
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.error-icon-emoji {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 72rpx;
  /* 72rpx */
  color: #C44A3A;
  /* danger */
  line-height: 1;
}

.error-text {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 32rpx;
  /* 16px,见 spec §3.3 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  text-align: center;
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

/* ───────── H5 ≥1024px 大屏居中(spec §3.7 + §10 Compatibility) ───────── */
@media (min-width: 1024px) {
  .body-inner {
    max-width: 640rpx;
    margin: 0 auto;
    /* 仅作用于内容容器,Header 不受限 */
  }
}
</style>
