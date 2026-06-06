<!--
  pages/style-setting/index.vue — 讲解风格设置页(独立 route,从 MyPage「讲解风格」菜单入口)
  
  Spec contract: specs/StyleSettingPage.md v0.1.0
  Route: /pages/style-setting/index
  入口:MyPage 第 3 项菜单「讲解风格」 → uni.navigateTo({url: AppRoutes.StyleSetting})
  出口:PUT 成功后 → uni.navigateBack()(保留 stack)→ MyPage.onShow 自动 re-fetch
  
  5 视图态(spec §3.7 / §4.1 / §5):
    loading — 初始 / GET 飞行中(转圈 + 提示)
    loaded  — GET 拉取成功 + 3 选项展示 + 当前高亮 + 「保存」按钮
    saving  — 用户点「保存」且 isDirty + viewMode≠saving(PUT 飞行中,转圈 + 提示)
    saved   — PUT 成功 ✓ 大对勾(瞬时 ≤ 200ms 后 navigateBack)
    error   — GET / PUT 失败(error panel + 重试)
  
  复用(spec §3.6 + §10 R-1~R-9):
    - AppColors(山水日志配色)
    - AppRoutes(已预声明 constants/routes.js:17)
    - StyleSettingStrings / StyleSettingOptions(本规格新增)
    - OnboardingStrings.retry / errorXxx(跨页复用,避免重复定义)
    - useUserStore.fetchPreferences() + updateProfile()(onLoad 拉 + saving 存)
    - services/preferences.ApiError(import 自 services/preferences.js)
    - pages/style-setting/components/StyleOptionCard.vue(页面私有 3 选项卡)
  
  不复用(spec §3.6 + §10 C-8/C-9):
    - _ErrorBanner 横向 banner(本页面 error 态走全屏 _ErrorPanel,形态独立)
    - _StyleOptionCard **不**抽到 components/(MVP YAGNI,本页面私有)
    - styleSettingStore / styleStore / preferencesStore(**不**新建,沿用 userStore 0 增量)
    - services/style.js(不存在该服务端点,所有调用走 services/preferences.js 既有 updatePreferences)
  
  关键决策(per spec §6.4.1/§6.4.2):
    - 3 选项 1:1 对齐 ExplanationStyle 3 枚举(无 PD-001 触发)
    - PUT partial-update 1 字段:只发 explanation_style,不碰 travel_pace / interests / special_needs
    - 走 userStore.updateProfile({ explanation_style }) → services/preferences.updatePreferences
    - **不**调用 services/preferences.updateUserInfo(语义混淆,见 §10.8 C-6)
    - **不**弹 _DraftConfirmDialog(per §4.6 + §5.4 MVP 简化决策,单选 + 1 字段无草稿价值)
    - **不**存草稿(per §4.6)
    - onLoad 兼容层:onMounted + getCurrentPages() 末项 options 兜底(本工程未显式列 @dcloudio/uni-app)
-->
<template>
  <view
    class="ssp-page"
    :aria-label="strings.pageAria"
  >
    <!-- Header(顶栏 44pt,左「←」中 title,沿用 PersonalProfilePage 形态) -->
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
        <!-- ───────── loading 态 ───────── -->
        <view
          v-if="viewMode === 'loading'"
          class="panel-center"
        >
          <view class="loading-spinner" aria-hidden="true" />
          <text class="panel-center-title">{{ strings.loadingText }}</text>
        </view>

        <!-- ───────── loaded 态(3 选项 + 保存) ───────── -->
        <view
          v-else-if="viewMode === 'loaded'"
          class="panel-form"
        >
          <!-- _FormHeader(标题 + 提示,spec §3.5)— UI-016 移除冗余 userId + currentStyle 展示 -->
          <view class="form-header">
            <text class="form-title">{{ strings.formTitle }}</text>
            <text class="form-hint">{{ strings.formHint }}</text>
          </view>

          <!-- _OptionList(3 选项 v-for,inline 渲染 + _StyleOptionCard 私有卡) -->
          <view class="option-list">
            <StyleOptionCard
              v-for="opt in StyleSettingOptions"
              :key="opt.value"
              :explanation-style="opt.value"
              :title="opt.title"
              :desc="opt.desc"
              :icon="opt.icon"
              :is-selected="selectedStyle === opt.value"
              :on-tap="onSelectOption"
            />
          </view>

          <!-- _ActionBar 单按钮(spec §3.6) -->
          <view class="action-bar">
            <view
              class="btn-save"
              :class="{ 'btn-save-disabled': !canSave }"
              role="button"
              :aria-label="strings.btnSave"
              :aria-disabled="!canSave || undefined"
              hover-class="btn-save-hover"
              :hover-stay-time="50"
              @click="onSave"
            >
              <text class="btn-save-text">{{ strings.btnSave }}</text>
            </view>
          </view>
        </view>

        <!-- ───────── saving 态(PUT 飞行中) ───────── -->
        <view
          v-else-if="viewMode === 'saving'"
          class="panel-center"
        >
          <view class="loading-spinner" aria-hidden="true" />
          <text class="panel-center-title">{{ strings.savingText }}</text>
        </view>

        <!-- ───────── saved 态(瞬时 ≤ 200ms) ───────── -->
        <view
          v-else-if="viewMode === 'saved'"
          class="panel-center"
        >
          <view class="completed-check" aria-hidden="true">✓</view>
          <text class="panel-center-title">{{ strings.savedText }}</text>
        </view>

        <!-- ───────── error 态(GET / PUT 失败) ───────── -->
        <view
          v-else-if="viewMode === 'error'"
          class="panel-center"
        >
          <view class="error-icon" aria-hidden="true">⚠</view>
          <text class="panel-center-title error-message">{{ saveError }}</text>
          <view
            class="btn-retry"
            role="button"
            :aria-label="OnboardingStrings.retry"
            hover-class="btn-retry-hover"
            :hover-stay-time="50"
            @click="onRetry"
          >
            <text class="btn-retry-text">{{ OnboardingStrings.retry }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  StyleSettingStrings,
  StyleSettingOptions,
  OnboardingStrings,
  MyPageExplanationLabel,
} from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import { useUserStore } from '../../stores/userStore.js'
import { logger } from '../../utils/logger.js'
import StyleOptionCard from './components/StyleOptionCard.vue'

const strings = StyleSettingStrings

// ─────────────── 类型定义(spec §4.1) ───────────────
/**
 * @typedef {import('../../api/types').ExplanationStyle} ExplanationStyle
 *
 * @typedef {'loading' | 'loaded' | 'saving' | 'saved' | 'error'} StyleSettingViewMode
 *   严格 5 枚举(spec §3.7 + §4.1)
 */

// ─────────────── 常量 ───────────────
const MVP_USER_ID = '1'                                  // MVP 单用户(per docs/API接口文档.md §1.3)
const FALLBACK_STYLE = /** @type {ExplanationStyle} */ ('professional')  // MVP fallback,per §5.1

// ─────────────── 静态辅助函数 ───────────────

/**
 * 从 userStore.preferences 派生 currentStyle(可能为 null,新用户首登,per §5.1)
 * @param {import('../../api/types').Preferences | null | undefined} prefs
 * @returns {ExplanationStyle | null}
 */
function pickCurrentStyle(prefs) {
  if (!prefs) return null
  return /** @type {ExplanationStyle | null} */ (prefs.explanation_style) ?? null
}

/**
 * 将 ApiError 归一为友好提示(spec §6.1 Error 表 + §5.5 mapSaveError 算法)
 * @param {import('../../services/preferences.js').ApiError | Error | unknown} err
 * @returns {string}
 */
function mapSaveError(err) {
  if (!err) return OnboardingStrings.errorNetwork
  const e = /** @type {any} */ (err)
  // 400 / 4000 参数非法
  if (e.code === 4000 || e.statusCode === 400) {
    return OnboardingStrings.errorBadRequest
  }
  // 5xx / 5000 服务端错误
  if (e.code === 5000 || (e.statusCode >= 500 && e.statusCode < 600)) {
    return OnboardingStrings.errorServer
  }
  // 其它(含 isNetworkError)→ 网络异常
  return OnboardingStrings.errorNetwork
}

// ─────────────── Local State(spec §4.1) ───────────────

/** @type {import('vue').Ref<string>} MVP 固定 userId */
const userId = ref(MVP_USER_ID)
/** @type {import('vue').Ref<StyleSettingViewMode>} 严格 5 枚举 */
const viewMode = ref('loading')
/** @type {import('vue').Ref<ExplanationStyle | null>} onLoad 拉取后的服务器原始值(可能 null) */
const currentStyle = ref(null)
/** @type {import('vue').Ref<ExplanationStyle>} 用户当前选中,永远有值(MVP 简化,per §5.3 J fallback) */
const selectedStyle = ref(FALLBACK_STYLE)
/** @type {import('vue').Ref<string | null>} GET / PUT 失败的友好提示 */
const saveError = ref(null)
/** @type {import('vue').Ref<boolean>} 首次拉取完成标记,防 fetch 完成前跳到 error 之外的态(沿 HomePage §4.1) */
const hasFetchedOnce = ref(false)
/** @type {import('vue').Ref<'get' | 'put' | null>} 上一次失败来源,决定重试方向(per §5.2 Step 6) */
const lastErrorSource = ref(/** @type {'get' | 'put' | null} */ (null))

// ─────────────── Computed ───────────────

/**
 * isDirty 派生 — MVP 简化:currentStyle=null 时视为 FALLBACK_STYLE(per §5.3 J)
 * 即新用户首登时若 selectedStyle 已是 FALLBACK_STYLE → 不算 dirty
 */
const isDirty = computed(() => {
  const effectiveCurrent = currentStyle.value || FALLBACK_STYLE
  return selectedStyle.value !== effectiveCurrent
})

/** isSaving 派生 */
const isSaving = computed(() => viewMode.value === 'saving')

/** 「保存」按钮可点判定:isDirty && !isSaving(per §3.6) */
const canSave = computed(() => {
  if (isSaving.value) return false
  return isDirty.value
})

/**
 * _FormHeader 当前风格短标签(per §3.5)
 * 复用 MyPageExplanationLabel 3 短标签(per §3.7 复用纪律,Project 内部展示一致)
 * 找不到时(理论不会)降级 fallback 字面「专业讲解」
 */
const currentStyleLabel = computed(() => {
  const v = currentStyle.value || FALLBACK_STYLE
  return MyPageExplanationLabel[v] || MyPageExplanationLabel.professional
})

// ─────────────── Store ───────────────
const userStore = useUserStore()

// ─────────────── Handlers ───────────────

/**
 * 入口:onMounted 替代 onLoad(沿 PersonalProfilePage / TripDetailPage 兼容层)
 * spec §5.1 页面进入
 */
function onLoadPage() {
  // 初始化 local state
  currentStyle.value = null
  selectedStyle.value = FALLBACK_STYLE
  saveError.value = null
  hasFetchedOnce.value = false
  lastErrorSource.value = null
  viewMode.value = 'loading'

  logger.info('[StyleSettingPage] onLoad enter', { userId: MVP_USER_ID })

  fetchPreferences()
}

/**
 * 调 userStore.fetchPreferences,按响应切 viewMode
 */
async function fetchPreferences() {
  try {
    await userStore.fetchPreferences()
    handleFetchResult({ ok: true })
  } catch (err) {
    logger.error('[StyleSettingPage] fetch failed', err)
    handleFetchResult({ ok: false, err })
  }
}

/**
 * 处理 fetch 结果(独立函数便于 review + retry 复用)
 * @param {{ ok: true } | { ok: false; err: any }} result
 */
function handleFetchResult(result) {
  hasFetchedOnce.value = true
  if (result.ok) {
    const cs = pickCurrentStyle(userStore.preferences)
    currentStyle.value = cs
    selectedStyle.value = cs || FALLBACK_STYLE
    saveError.value = null
    lastErrorSource.value = null
    viewMode.value = 'loaded'
    if (cs === null) {
      logger.info('[StyleSettingPage] new user fallback', {
        userId: MVP_USER_ID,
        selectedStyle: selectedStyle.value,
      })
    } else {
      logger.info('[StyleSettingPage] fetch ok', {
        userId: MVP_USER_ID,
        currentStyle: cs,
        selectedStyle: selectedStyle.value,
      })
    }
    return
  }
  // failure
  saveError.value = mapSaveError(result.err)
  viewMode.value = 'error'
  lastErrorSource.value = 'get'
}

/**
 * Header「←」点击:onBack 走 §5.4 简化决策(直接 navigateBack,**不**弹草稿弹窗)
 */
function onBack() {
  logger.info('[StyleSettingPage] back, no changes saved', {
    userId: MVP_USER_ID,
    currentStyle: currentStyle.value,
    selectedStyle: selectedStyle.value,
    isDirty: isDirty.value,
  })
  navigateBack()
}

/**
 * 用户点某行(_StyleOptionCard onTap)→ 更新 selectedStyle
 * @param {ExplanationStyle} value
 */
function onSelectOption(value) {
  const prev = selectedStyle.value
  selectedStyle.value = value
  logger.info('[StyleSettingPage] style switched', { from: prev, to: value })
}

/**
 * 「保存」按钮 → onSave 校验 → viewMode='saving' → 并行 PUT
 * spec §5.2 Step 3
 */
function onSave() {
  if (!canSave.value) {
    logger.warn('[StyleSettingPage] save blocked, no changes', {
      userId: MVP_USER_ID,
      isDirty: isDirty.value,
      isSaving: isSaving.value,
    })
    return
  }
  viewMode.value = 'saving'
  saveError.value = null
  logger.info('[StyleSettingPage] save start', {
    userId: MVP_USER_ID,
    from: currentStyle.value,
    to: selectedStyle.value,
  })
  doSave()
}

/**
 * 实际发起 PUT(spec §5.2 Step 4)
 * - PUT 走 userStore.updateProfile → services/preferences.updatePreferences
 * - 内部 routing 包 user_id + preferences 外壳
 * - 仅传 explanation_style 1 字段(per §6.4.2 PUT partial-update 字段级纪律)
 */
async function doSave() {
  try {
    await userStore.updateProfile({ explanation_style: selectedStyle.value })
    handleSaveResult({ ok: true })
  } catch (err) {
    logger.error('[StyleSettingPage] save failed', err)
    handleSaveResult({ ok: false, err })
  }
}

/**
 * 处理 PUT 结果
 * @param {{ ok: true } | { ok: false; err: any }} result
 */
function handleSaveResult(result) {
  if (result.ok) {
    currentStyle.value = selectedStyle.value
    viewMode.value = 'saved'
    saveError.value = null
    lastErrorSource.value = null
    logger.info('[StyleSettingPage] save ok', { userId: MVP_USER_ID })

    // Toast 提前(setTimeout 200ms 期间显示)
    uni.showToast({
      title: strings.saveSuccessToast,
      icon: 'success',
      duration: 1500,
    })

    // 200ms 后 navigateBack(per spec §3 备注 2 + §5.2 Step 4 Success 分支)
    setTimeout(() => {
      navigateBack()
    }, 200)
    return
  }
  // failure — 切 error,selectedStyle 保留(per AC-06)
  saveError.value = mapSaveError(result.err)
  viewMode.value = 'error'
  lastErrorSource.value = 'put'
}

/**
 * error 态「重试」:根据 lastErrorSource 决定重试方向(spec §5.2 Step 6 + AC-07)
 * - GET 失败 → 重新拉(loading 态)
 * - PUT 失败 → 重新提交 PUT(selectedStyle 保留)
 */
function onRetry() {
  logger.info('[StyleSettingPage] retry', {
    userId: MVP_USER_ID,
    source: lastErrorSource.value,
  })
  saveError.value = null
  if (lastErrorSource.value === 'get') {
    viewMode.value = 'loading'
    fetchPreferences()
  } else {
    // PUT 失败重试(selectedStyle 保留)
    viewMode.value = 'saving'
    doSave()
  }
}

/**
 * 统一的 navigateBack 封装:栈顶则正常 back;若 stack 异常(罕见,如 dev server reLaunch
 * 起始 + 多次 navigateTo 后 uni-app H5 端 navigateBack 静默 fail)则 reLaunch MyPage 兜底
 * (per PersonalProfilePage §3.6 4-path onBack 模式 + tabBar 子页跳转惯例)
 */
function navigateBack() {
  uni.navigateBack({
    delta: 1,
    fail: () => {
      logger.error('[StyleSettingPage] navigateBack failed, reLaunch MyPage as fallback')
      uni.reLaunch({ url: AppRoutes.My })
    },
  })
}

// ─────────────── Lifecycle ───────────────

onMounted(() => {
  onLoadPage()
})

onUnmounted(() => {
  logger.debug('[StyleSettingPage] onUnmounted, viewMode=' + viewMode.value)
})
</script>

<style scoped>
.ssp-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #F7F3EC;
  /* Surface,见 UI §二 */
  position: relative;
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
  flex-shrink: 0;
  box-sizing: border-box;
}

.header-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  min-width: 88rpx;
  min-height: 88rpx;
  /* ≥ 44pt tap area(88rpx = 44pt,spec §3.2) */
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
  /* 24px,见 spec §3.2 */
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
}

.body-inner {
  padding: 24rpx 40rpx 48rpx;
  /* space-lg / space-2xl,段间留白充足(spec §3.1 节奏 8/16/24) */
  box-sizing: border-box;
}

/* ───────── Center Panels(loading / saving / saved / error) ───────── */
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
  border-top-color: #2D6A5E;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.panel-center-title {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 32rpx;
  /* 16px */
  font-weight: 500;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  text-align: center;
}

.completed-check {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(45, 106, 94, 0.12);
  /* primarySoftStrong */
  color: #2D6A5E;
  font-size: 72rpx;
  line-height: 120rpx;
  text-align: center;
  font-weight: 600;
  margin-top: -8rpx;
}

.error-icon {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(196, 74, 58, 0.08);
  /* dangerSoft */
  color: #C44A3A;
  /* danger */
  font-size: 72rpx;
  line-height: 120rpx;
  text-align: center;
  font-weight: 600;
  margin-top: -8rpx;
}

.error-message {
  color: #C44A3A;
  /* danger */
  max-width: 80%;
}

.btn-retry {
  margin-top: 16rpx;
  /* space-md */
  min-height: 88rpx;
  /* ≥ 44pt tap area(spec §3.2 + AC-11) */
  padding: 0 48rpx;
  border-radius: 9999px;
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
}

.btn-retry-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.btn-retry-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* ───────── Form Panel ───────── */
.panel-form {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
  /* space-xl,段间 32rpx(spec §3.1 节奏) */
  box-sizing: border-box;
}

.form-header {
  margin-bottom: 8rpx;
  /* 段头与标题间紧凑 */
}

.form-title {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px,UI §三 中标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  margin-bottom: 8rpx;
}

.form-hint {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.4;
  margin-bottom: 16rpx;
  /* space-md */
}

/* ─── Option List(3 选项 v-for 容器) ─── */
.option-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md,3 行间 16rpx(spec §3.4 备注) */
  box-sizing: border-box;
}

/* ───────── Action Bar(单 CTA) ───────── */
.action-bar {
  margin-top: 16rpx;
  /* space-md,与末段间距 */
  box-sizing: border-box;
}

.btn-save {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area(88rpx = 44pt,spec §3.6) */
  border-radius: 9999px;
  /* radius-full */
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
  /* Primary 渐变,见 UI §八 */
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
  /* primaryShadow */
  box-sizing: border-box;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out, box-shadow 0.15s ease-out;
}

.btn-save-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.btn-save-disabled {
  opacity: 0.5;
  pointer-events: none;
  /* spec §3.6 disabled 态 */
}

.btn-save-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 32rpx;
  /* 16px */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
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

/* ───────── H5 ≥1024px 大屏居中(spec §3.7 + §10 NFR) ───────── */
@media (min-width: 1024px) {
  .body-inner {
    max-width: 640rpx;
    margin: 0 auto;
  }
}
</style>
