<!--
  pages/notification-setting/index.vue — 通知设置页(独立 route,从 MyPage「通知设置」菜单入口)

  Spec contract: specs/NotificationSettingPage.md v0.1.0
  Route: /pages/notification-setting/index
  入口:MyPage 第 4 项菜单「通知设置」 → uni.navigateTo({url: AppRoutes.NotificationSetting})
  出口:保存成功后 → uni.navigateBack()(保留 stack)→ MyPage.onShow 自动 re-fetch(实际 MyPage 不会感知)
        取消 → 直接 navigateBack(**不**弹草稿弹窗,per spec §5.4 MVP 简化)

  5 视图态(spec §3.7 / §4.1 / §5):
    loading — 初始 / uni.getStorageSync 同步读中(转圈 + 提示)
    loaded  — 拉 storage 成功(7 字段 100% 有值,4 开关 + 1 静默时段 + 保存按钮)
    saving  — 用户点「保存」且 isDirty + viewMode≠saving(uni.setStorageSync 同步写中,转圈 + 提示)
    saved   — 写成功 ✓ 大对勾(瞬时 ≤ 200ms 后 navigateBack)
    error   — 写 storage 失败(error banner + 重试)

  复用(spec §3.8 + §10 R-1~R-9):
    - AppColors(山水日志配色)
    - AppRoutes(已预声明 constants/routes.js:18)
    - NotificationSettingStrings + NotificationSettingDefaults + notificationSwitchConfigs(本规格新增)
    - OnboardingStrings.retry / errorFallback(跨页复用,避免重复定义)
    - components/ErrorBanner.vue(整页 error 态)
    - utils/logger

  不复用(spec §3.8 + §10 C-7~C-15):
    - _ErrorBanner 横向 banner(error 态整页复用)
    - _NotificationSwitchRow / _QuietHoursRow(页面私有 4 props + 1 emit / 5 props + 3 emits)
    - userStore / services.preferences / 任何 API(per §6.4.1 PD-001 决策 — 0 字段匹配走 client-only)
    - notificationSettingStore / notificationStore / services.notification.js(per §7.2 严禁新建)
    - _DraftConfirmDialog / 草稿弹窗(per §4.6 + §5.4 MVP 简化决策)

  关键决策(per spec §6.4.1/§6.4.2/§6.4.3):
    - 7 字段 vs `Preferences` 4 字段 0 匹配(PD-001)→ client-only + 本地 storage 持久化 + 0 API
    - 通知权限检测 MVP 简化(不调 uni.authorize / getSetting / openSetting)
    - storage key 固定 'notification_prefs'(MVP 单用户,per §6.4.3)
    - 5 视图态 v-if 互斥链(spec §3.7 严格 5 枚举)
    - saved 200ms 瞬时态(沿 StyleSettingPage §3 备注 2)
-->
<template>
  <view
    class="nsp-page"
    :aria-label="strings.pageAria"
  >
    <!-- Header(顶栏 44pt,左「←」中 title,沿用 StyleSettingPage / PersonalProfilePage 形态) -->
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

        <!-- ───────── loaded 态(7 字段 + 保存) ───────── -->
        <view
          v-else-if="viewMode === 'loaded'"
          class="panel-form"
        >
          <!-- _FormHeader(spec §3.3) -->
          <view class="form-header">
            <text class="form-title">{{ strings.formTitle }}</text>
            <text class="form-hint">{{ strings.formHint }}</text>
          </view>

          <!-- _NotificationSection(4 开关 v-for 渲染) -->
          <view class="notification-section">
            <text class="section-label">{{ strings.sectionNotificationLabel }}</text>
            <view class="switch-list">
              <NotificationSwitchRow
                v-for="cfg in notificationSwitchConfigs"
                :key="cfg.key"
                :icon="cfg.icon"
                :title="cfg.title"
                :desc="cfg.desc"
                :is-on="notificationPrefs[cfg.key]"
                @update:is-on="(value) => onSwitchToggle(cfg.key, value)"
              />
            </view>
          </view>

          <!-- _QuietHoursSection -->
          <view class="quiet-hours-section">
            <text class="section-label">{{ strings.sectionQuietHoursLabel }}</text>
            <QuietHoursRow
              :enabled="notificationPrefs.quiet_hours_enabled"
              :start="notificationPrefs.quiet_hours_start"
              :end="notificationPrefs.quiet_hours_end"
              :start-label="strings.pickerStartLabel"
              :end-label="strings.pickerEndLabel"
              @update:enabled="onQuietHoursToggle"
              @update:start="onQuietHoursStartChange"
              @update:end="onQuietHoursEndChange"
            />
          </view>

          <!-- _ActionBar 单按钮(spec §3.5) -->
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

        <!-- ───────── saving 态(storage 写中) ───────── -->
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

        <!-- ───────── error 态(storage 写失败) ───────── -->
        <view
          v-else-if="viewMode === 'error'"
          class="panel-error"
        >
          <ErrorBanner
            :message="saveError || OnboardingStrings.errorFallback"
            :retryable="true"
            @retry="onRetrySave"
          />
          <view
            class="btn-retry"
            role="button"
            :aria-label="OnboardingStrings.retry"
            hover-class="btn-retry-hover"
            :hover-stay-time="50"
            @click="onRetrySave"
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
  NotificationSettingStrings,
  NotificationSettingDefaults,
  notificationSwitchConfigs,
  OnboardingStrings,
} from '../../constants/strings.js'
import { logger } from '../../utils/logger.js'
import NotificationSwitchRow from './components/NotificationSwitchRow.vue'
import QuietHoursRow from './components/QuietHoursRow.vue'
import ErrorBanner from '../../components/ErrorBanner.vue'

const strings = NotificationSettingStrings

// ─────────────── 类型定义(spec §4.1) ───────────────
/**
 * @typedef {Object} NotificationPrefs
 * @property {boolean} trip_reminder         行程提醒
 * @property {boolean} buddy_activity        同伴动态
 * @property {boolean} system_message        系统消息
 * @property {boolean} marketing             营销推广
 * @property {boolean} quiet_hours_enabled   静默时段 toggle
 * @property {string}  quiet_hours_start     静默时段开始时间,'HH:mm' 格式
 * @property {string}  quiet_hours_end       静默时段结束时间,'HH:mm' 格式
 *
 * @typedef {'loading' | 'loaded' | 'saving' | 'saved' | 'error'} NotificationSettingViewMode
 *   严格 5 枚举(spec §3.7 + §4.1)
 */

// ─────────────── 常量 ───────────────
const STORAGE_KEY = 'notification_prefs'                    // MVP 单用户,per §6.4.3
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/                  // 7 字段 start/end 校验
const SWITCH_KEYS = Object.freeze([                          // 4 开关 key 白名单
  'trip_reminder',
  'buddy_activity',
  'system_message',
  'marketing',
])

// ─────────────── 静态辅助函数(spec §5.5) ───────────────

/**
 * 7 字段形状校验 + 浅合并 fallback(per §5.5 decideNotificationPrefsInitial)
 * 异常静默降级到 NotificationSettingDefaults(spec §5.3 A/B)
 * @param {unknown} cached
 * @returns {NotificationPrefs}
 */
function sanitizePrefs(cached) {
  if (!cached || typeof cached !== 'object') {
    return { ...NotificationSettingDefaults }
  }
  const src = /** @type {Record<string, unknown>} */ (cached)
  const result = { ...NotificationSettingDefaults, ...src }
  // 4 开关逐项类型校验
  for (const k of SWITCH_KEYS) {
    if (typeof result[k] !== 'boolean') {
      result[k] = /** @type {boolean} */ (NotificationSettingDefaults[k])
    }
  }
  // 静默时段 enabled 校验
  if (typeof result.quiet_hours_enabled !== 'boolean') {
    result.quiet_hours_enabled = NotificationSettingDefaults.quiet_hours_enabled
  }
  // 静默时段 start / end HH:mm 格式校验
  for (const k of /** @type {const} */ (['quiet_hours_start', 'quiet_hours_end'])) {
    if (typeof result[k] !== 'string' || !HHMM_RE.test(/** @type {string} */ (result[k]))) {
      result[k] = NotificationSettingDefaults[k]
    }
  }
  return /** @type {NotificationPrefs} */ (result)
}

/**
 * 7 字段深比较(per §5.5 isPrefsEqual)
 * @param {NotificationPrefs} a
 * @param {NotificationPrefs} b
 * @returns {boolean}
 */
function isPrefsEqual(a, b) {
  return (
    a.trip_reminder === b.trip_reminder &&
    a.buddy_activity === b.buddy_activity &&
    a.system_message === b.system_message &&
    a.marketing === b.marketing &&
    a.quiet_hours_enabled === b.quiet_hours_enabled &&
    a.quiet_hours_start === b.quiet_hours_start &&
    a.quiet_hours_end === b.quiet_hours_end
  )
}

/**
 * 浅拷贝(用于 originalPrefs 深克隆;MVP 7 字段无嵌套对象,浅拷贝够用,per §5.2 Step 6)
 * @param {NotificationPrefs} p
 * @returns {NotificationPrefs}
 */
function clonePrefs(p) {
  return {
    trip_reminder: p.trip_reminder,
    buddy_activity: p.buddy_activity,
    system_message: p.system_message,
    marketing: p.marketing,
    quiet_hours_enabled: p.quiet_hours_enabled,
    quiet_hours_start: p.quiet_hours_start,
    quiet_hours_end: p.quiet_hours_end,
  }
}

// ─────────────── Local State(spec §4.1) ───────────────

/** @type {import('vue').Ref<NotificationSettingViewMode>} 严格 5 枚举 */
const viewMode = ref('loading')
/** @type {import('vue').Ref<NotificationPrefs>} 7 字段,永远有值(MVP 简化) */
const notificationPrefs = ref({ ...NotificationSettingDefaults })
/** @type {import('vue').Ref<NotificationPrefs>} onLoad 拉 storage 成功后的原始快照 */
const originalPrefs = ref({ ...NotificationSettingDefaults })
/** @type {import('vue').Ref<string | null>} storage 写失败的友好提示 */
const saveError = ref(null)
/** @type {import('vue').Ref<boolean>} 首次拉取完成标记(沿 HomePage §4.1 模式) */
const hasFetchedOnce = ref(false)

// ─────────────── Computed ───────────────

/** isDirty 派生(per §4.1 + §5.2 Step 1)— 用深比较 */
const isDirty = computed(() => !isPrefsEqual(notificationPrefs.value, originalPrefs.value))

/** isSaving 派生 */
const isSaving = computed(() => viewMode.value === 'saving')

/** 「保存」按钮可点判定:!isSaving && isDirty(per §3.5 + §3.6) */
const canSave = computed(() => {
  if (isSaving.value) return false
  return isDirty.value
})

// ─────────────── Handlers ───────────────

/**
 * 入口:onMounted 替代 onLoad(沿 StyleSettingPage / PersonalProfilePage / TripDetailPage 兼容层)
 * spec §5.1 页面进入
 */
function onLoadPage() {
  // 初始化 local state
  viewMode.value = 'loading'
  notificationPrefs.value = { ...NotificationSettingDefaults }
  originalPrefs.value = { ...NotificationSettingDefaults }
  saveError.value = null
  hasFetchedOnce.value = false

  logger.info('[NotificationSettingPage] onLoad enter')

  loadFromStorage()
}

/**
 * 同步读 storage(per §5.1)
 * - 命中(有效 JSON + 7 字段形状校验通过)→ notificationPrefs = 解析值,originalPrefs = deepClone
 * - miss / 损坏 / 校验失败 → 静默降级到 NotificationSettingDefaults
 */
function loadFromStorage() {
  let cached = null
  try {
    cached = uni.getStorageSync(STORAGE_KEY)
  } catch (err) {
    logger.warn('[NotificationSettingPage] storage read exception, fallback', { err })
    cached = null
  }

  const sanitized = sanitizePrefs(cached)
  notificationPrefs.value = sanitized
  originalPrefs.value = clonePrefs(sanitized)
  hasFetchedOnce.value = true
  saveError.value = null
  viewMode.value = 'loaded'

  if (cached && typeof cached === 'object') {
    logger.info('[NotificationSettingPage] storage hit', sanitized)
  } else {
    logger.warn('[NotificationSettingPage] storage miss, fallback to defaults', { cached })
  }
}

/**
 * Header「←」点击:onBack 走 §5.4 简化决策(直接 navigateBack,**不**弹草稿弹窗)
 */
function onBack() {
  logger.info('[NotificationSettingPage] back, no changes saved', {
    isDirty: isDirty.value,
    notificationPrefs: notificationPrefs.value,
  })
  navigateBack()
}

/**
 * 4 开关任一行 toggle(per §5.2 Step 2)
 * @param {string} key
 * @param {boolean} value
 */
function onSwitchToggle(key, value) {
  if (!SWITCH_KEYS.includes(key)) {
    logger.warn('[NotificationSettingPage] switch toggle blocked, unknown key', { key })
    return
  }
  // 类型守护 + 阻断同值(避免冗余 trigger)
  if (notificationPrefs.value[key] === value) return
  notificationPrefs.value = { ...notificationPrefs.value, [key]: value }
  logger.info('[NotificationSettingPage] switch toggled', { key, value })
}

/**
 * 静默时段 toggle(per §5.2 Step 3)
 * @param {boolean} enabled
 */
function onQuietHoursToggle(enabled) {
  if (notificationPrefs.value.quiet_hours_enabled === enabled) return
  notificationPrefs.value = { ...notificationPrefs.value, quiet_hours_enabled: enabled }
  logger.info('[NotificationSettingPage] quiet hours toggled', { enabled })
}

/**
 * 静默时段开始时间 picker 变化(per §5.2 Step 4)
 * @param {string} value
 */
function onQuietHoursStartChange(value) {
  if (!HHMM_RE.test(value)) return
  if (notificationPrefs.value.quiet_hours_start === value) return
  notificationPrefs.value = { ...notificationPrefs.value, quiet_hours_start: value }
  logger.info('[NotificationSettingPage] quiet hours start changed', { start: value })
}

/**
 * 静默时段结束时间 picker 变化(per §5.2 Step 4)
 * @param {string} value
 */
function onQuietHoursEndChange(value) {
  if (!HHMM_RE.test(value)) return
  if (notificationPrefs.value.quiet_hours_end === value) return
  notificationPrefs.value = { ...notificationPrefs.value, quiet_hours_end: value }
  logger.info('[NotificationSettingPage] quiet hours end changed', { end: value })
}

/**
 * 「保存」按钮 → onSave 校验 → viewMode='saving' → 同步写 storage(per §5.2 Step 5)
 */
function onSave() {
  if (!canSave.value) {
    logger.warn('[NotificationSettingPage] save blocked, no changes', {
      isDirty: isDirty.value,
      isSaving: isSaving.value,
    })
    return
  }
  viewMode.value = 'saving'
  saveError.value = null
  logger.info('[NotificationSettingPage] save start', notificationPrefs.value)
  doSave()
}

/**
 * 实际写 storage(spec §5.2 Step 6)
 * - 同步 uni.setStorageSync(无 await)
 * - 异常罕见(本地空间满 / 隐私模式 / 系统错误)→ 切 error + 渲染 _ErrorBanner
 */
function doSave() {
  try {
    uni.setStorageSync(STORAGE_KEY, notificationPrefs.value)
    handleSaveResult({ ok: true })
  } catch (err) {
    logger.error('[NotificationSettingPage] save failed', err)
    handleSaveResult({ ok: false, err })
  }
}

/**
 * 处理写结果
 * @param {{ ok: true } | { ok: false; err: any }} result
 */
function handleSaveResult(result) {
  if (result.ok) {
    originalPrefs.value = clonePrefs(notificationPrefs.value)
    viewMode.value = 'saved'
    saveError.value = null
    logger.info('[NotificationSettingPage] save ok', notificationPrefs.value)

    // Toast 提前(setTimeout 200ms 期间显示)
    uni.showToast({
      title: strings.saveSuccessToast,
      icon: 'success',
      duration: 1500,
    })

    // 200ms 后 navigateBack(per spec §3 备注 2 + §5.2 Step 6 Success 分支)
    setTimeout(() => {
      navigateBack()
    }, 200)
    return
  }
  // failure — 切 error,notificationPrefs 保留(per AC-09)
  saveError.value = OnboardingStrings.errorFallback
  viewMode.value = 'error'
}

/**
 * error 态「重试」:重新触发写 storage(per §5.2 Step 8)
 */
function onRetrySave() {
  logger.info('[NotificationSettingPage] retry', { source: 'STORAGE_WRITE' })
  saveError.value = null
  viewMode.value = 'saving'
  doSave()
}

/**
 * 统一的 navigateBack 封装(沿 StyleSettingPage / PersonalProfilePage 模式)
 */
function navigateBack() {
  uni.navigateBack({
    delta: 1,
    fail: () => {
      // 兜底:若 stack 里没有上一页(罕见,如直接 navigateTo 后台被回收),不 reLaunch MyPage
      // (沿 StyleSettingPage §5.3 E 决策,避免影响 tabBar 状态)
      logger.error('[NotificationSettingPage] navigateBack failed, no fallback')
    },
  })
}

// ─────────────── Lifecycle ───────────────

onMounted(() => {
  onLoadPage()
})

onUnmounted(() => {
  logger.debug('[NotificationSettingPage] onUnmounted, viewMode=' + viewMode.value)
  // 释放引用(沿 §5.6 + §10.6 状态完整性)
  notificationPrefs.value = { ...NotificationSettingDefaults }
  originalPrefs.value = { ...NotificationSettingDefaults }
  saveError.value = null
})
</script>

<style scoped>
.nsp-page {
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

/* ───────── Center Panels(loading / saving / saved) ───────── */
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

/* ───────── Error Panel(整页 _ErrorBanner + retry) ───────── */
.panel-error {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 80rpx 0;
  gap: 24rpx;
  /* space-lg */
  box-sizing: border-box;
  min-height: 40vh;
}

.btn-retry {
  align-self: center;
  margin-top: 8rpx;
  /* space-sm */
  min-height: 88rpx;
  /* ≥ 44pt tap area(spec §10.2) */
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
  margin-bottom: 4rpx;
  /* 段头紧凑 */
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
  font-size: 26rpx;
  /* 13px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
}

/* ─── Section Label ─── */
.section-label {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 32rpx;
  /* 16px */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  margin-bottom: 16rpx;
  /* space-md */
}

/* ─── Notification Section(4 开关) ─── */
.notification-section {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.switch-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md,4 行间 16rpx(spec §3.4 备注) */
  box-sizing: border-box;
}

/* ─── Quiet Hours Section ─── */
.quiet-hours-section {
  display: flex;
  flex-direction: column;
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
  /* ≥ 44pt tap area(88rpx = 44pt,spec §3.5 + AC-14) */
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
