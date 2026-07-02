<!--
  pages/new-trip/index.vue — 新建行程页(独立 route 化表单页,非 Tab)

  Spec contract: specs/NewTripPage.md v0.7.0
  Route: /pages/new-trip/index
  入口:HomePage BtnAddTrip / EmptyState CTA → uni.navigateTo({url: AppRoutes.NewTrip})
  出口(fix-trip-bugs-v1 2026-06-18):POST 成功后 reLaunch 跳 AppRoutes.Home
    (原跳 TripDetailPage 已被废弃 — reLaunch 清空整页栈,TripDetailPage onBack
     navigateBack 必然失败 → 兜底 reLaunch Home(整页刷新,体验糟))

  4 视图态(spec §3.7 / §5,v0.7.0 简化,6 → 4):
    form       — 默认(v0.7.0 起直接进 form,跳过 input + analyzing);4 字段表单 + 取消/确认 + (3 必填未填时 _ErrorBanner)
    submitting — POST 飞行中(转圈 + 提示;无取消按钮)
    completed  — ✓ 创建成功(瞬时 ≤ 200ms 后 reLaunch)
    error      — 提交失败(error overlay + 重试)
    ~~input~~      — v0.7.0 已删除(Greeting + textarea + 文件 chips + 取消/确定,直接进入 form)
    ~~analyzing~~  — v0.7.0 已删除(AI 模拟 setTimeout 1.5-2.5s + extractFormDataFromText 整段删除,per §6.4.1)

  复用:
    - AppColors(山水日志配色)
    - AppRoutes.NewTrip / AppRoutes.Home
    - NewTripStrings(obsolete 字符串如 greetingTitle/analyzingTitle/textareaAria/btnSubmit/errorNoContent 保留,新代码不引用)
    - useHomeStore.fetchTrips()(POST 成功后刷新列表)
    - services/trips.createTrip + updateTrip + saveDraft
    - _ErrorBanner(3 必填校验失败提示,retryable=false)

  不复用:不直接复用 NextButton / SpotDetailSheet(本页面双按钮,非单一 CTA)

  草稿(spec §5.4 + §6.4.3,v0.7.0 起 TripDraft 3 字段 = id + created_at + formData):
    - 取消且有内容 → _DraftConfirmDialog(3 按钮)
    - 「保存草稿」→ uni.setStorageSync('trip_drafts', [...]) + Toast + reLaunch Home
    - 「不保存」→ reLaunch Home
    - 「继续编辑」→ 关闭弹窗,currentStep 保持 form
-->
<template>
  <view class="newtrip-page">
    <!-- Header(顶栏 44pt,左「←」右 title) -->
    <view class="header">
      <view
        class="header-back"
        role="button"
        :aria-label="backAria"
        hover-class="header-back-hover"
        :hover-stay-time="50"
        @click="onBack"
      >
        <text class="header-back-text" aria-hidden="true">←</text>
      </view>
      <text class="header-title">{{ strings.pageTitle }}</text>
      <view class="header-spacer" />
    </view>

    <!-- Body:可滚动,内容最大宽度 640rpx 居中(spec §3.8 H5 兼容性) -->
    <scroll-view
      class="body"
      scroll-y
      :enhanced="true"
      :show-scrollbar="false"
    >
      <view class="body-inner">
        <!-- ───────── form 态(v0.7.0 起默认视图) ───────── -->
        <view
          v-if="currentStep === 'form'"
          class="panel-form"
        >
          <view v-if="!isCopyMode" class="ai-import-card">
            <text class="ai-import-title">{{ strings.greetingTitle }}</text>
            <text class="form-hint">{{ strings.greetingHint }}</text>
            <textarea
              v-model="inputText"
              class="trip-text-input"
              :maxlength="2000"
              :placeholder="strings.inputPlaceholder"
              :aria-label="strings.textareaAria"
            />
            <text v-if="parseError" class="parse-error">{{ parseError }}</text>
            <view
              class="btn-parse-trip"
              :class="{ 'btn-parse-trip-disabled': !canAnalyze || isParsing }"
              role="button"
              @click="onAnalyze"
            >
              <text>{{ isParsing ? strings.analyzingTitle : strings.btnAnalyze }}</text>
            </view>
          </view>

          <view class="form-header">
            <text class="form-title">{{ strings.formTitle }}</text>
            <text class="form-hint">{{ formHintText }}</text>
          </view>

          <ErrorBanner
            v-if="formSubmitError"
            :message="formSubmitError"
            :retryable="false"
          />

          <view v-if="parseWarnings.length" class="parse-warning-card">
            <text class="parse-warning-title">{{ strings.parseWarningTitle }}</text>
            <text v-for="warning in parseWarnings" :key="warning" class="parse-warning-text">
              • {{ warning }}
            </text>
          </view>

          <!-- 4 字段表单(TripCreateEditFix-001 v0.4.0:移除 city / companions / budget_range / transport_preference / special_needs) -->
          <view class="form-fields">
            <!-- Field 1: 行程标题(title)* 必填 -->
            <view class="form-field">
              <text class="form-field-label">
                {{ strings.fieldTitle }}
                <text
                  v-if="!formData.title.trim()"
                  class="required-mark"
                >*</text>
              </text>
              <input
                v-model="formData.title"
                class="form-field-input"
                :placeholder="titlePlaceholder"
                placeholder-class="form-field-input-placeholder"
              />
            </view>

            <!-- Field 2: 出发日期(start_date)*  -->
            <view class="form-field">
              <text class="form-field-label">
                {{ strings.fieldStartDate }}
                <text
                  v-if="!formData.start_date"
                  class="required-mark"
                >*</text>
              </text>
              <picker
                mode="date"
                :value="formData.start_date"
                :start="datePickerStart"
                :end="datePickerEnd"
                @change="(e) => onDateChange('start_date', e)"
              >
                <view class="form-field-picker">
                  <text
                    class="form-field-picker-text"
                    :class="{ 'form-field-picker-text-placeholder': !formData.start_date }"
                  >{{ formData.start_date || strings.placeholderStartDate }}</text>
                </view>
              </picker>
            </view>

            <!-- Field 3: 返回日期(end_date)*  -->
            <view class="form-field">
              <text class="form-field-label">
                {{ strings.fieldEndDate }}
                <text
                  v-if="!formData.end_date"
                  class="required-mark"
                >*</text>
              </text>
              <picker
                mode="date"
                :value="formData.end_date"
                :start="formData.start_date || datePickerStart"
                :end="datePickerEnd"
                @change="(e) => onDateChange('end_date', e)"
              >
                <view class="form-field-picker">
                  <text
                    class="form-field-picker-text"
                    :class="{ 'form-field-picker-text-placeholder': !formData.end_date }"
                  >{{ formData.end_date || strings.placeholderEndDate }}</text>
                </view>
              </picker>
            </view>

            <!-- Field 4: 行程安排(itineraryArrange)UI-025 — 横向 scroll-view 拖动排序 + 每条需 date + start_time + end_time -->
            <ItineraryArrangeField
              v-model="formData.itineraryArrange"
              :readonly="false"
            />
          </view>

          <view class="action-row">
            <view
              class="btn btn-cancel"
              role="button"
              :aria-label="strings.btnCancel"
              hover-class="btn-cancel-hover"
              :hover-stay-time="50"
              @click="onCancel"
            >
              <text class="btn-cancel-text">{{ strings.btnCancel }}</text>
            </view>
            <view
              class="btn btn-submit"
              role="button"
              :aria-label="btnConfirmText"
              :class="{ 'btn-submit-disabled': !hasRequiredFields }"
              hover-class="btn-submit-hover"
              :hover-stay-time="50"
              @click="onConfirm"
            >
              <text class="btn-submit-text">{{ btnConfirmText }}</text>
            </view>
          </view>
        </view>

        <!-- ───────── submitting 态 ───────── -->
        <view
          v-else-if="currentStep === 'submitting'"
          class="panel-center"
        >
          <view class="loading-spinner" aria-hidden="true" />
          <text class="panel-center-title">{{ strings.submittingText }}</text>
        </view>

        <!-- ───────── completed 态(瞬时 ≤ 200ms) ───────── -->
        <view
          v-else-if="currentStep === 'completed'"
          class="panel-center"
        >
          <view class="completed-check" aria-hidden="true">✓</view>
          <text class="panel-center-title">{{ strings.completedText }}</text>
        </view>

        <!-- ───────── error 态(POST 失败) ───────── -->
        <view
          v-else-if="currentStep === 'error'"
          class="panel-center"
        >
          <view class="error-icon" aria-hidden="true">⚠</view>
          <text class="panel-center-title error-message">{{ submitError }}</text>
          <view
            class="btn-retry"
            role="button"
            :aria-label="strings.errorRetry"
            hover-class="btn-retry-hover"
            :hover-stay-time="50"
            @click="onRetry"
          >
            <text class="btn-retry-text">{{ strings.errorRetry }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 草稿确认弹窗(取消时弹) -->
    <DraftConfirmDialog
      :visible="dialogVisible"
      :title="strings.draftDialogTitle"
      :message="strings.draftDialogMessage"
      :btn-save-label="strings.draftSave"
      :btn-dont-save-label="strings.draftDontSave"
      :btn-continue-label="strings.draftContinue"
      @save="onDialogSave"
      @dont-save="onDialogDontSave"
      @continue="onDialogContinue"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { NewTripStrings } from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import { logger } from '../../utils/logger.js'
import { buildTripDraftPayload, mergeParsedTripIntoForm } from '../../utils/tripParsing.js'
import { useHomeStore } from '../../stores/homeStore.js'
import { createTrip, createTripFromDraft, parseTripText, saveDraft } from '../../services/trips.js'
import { loadTrips } from '../../db/trips.js'
import ErrorBanner from '../../components/ErrorBanner.vue'
import DraftConfirmDialog from './components/DraftConfirmDialog.vue'
import ItineraryArrangeField from './components/ItineraryArrangeField.vue'

const strings = NewTripStrings
const backAria = '返回'

// ─────────────── 类型定义(spec §4.1) ───────────────
/**
 * @typedef {import('../../api/types').ItineraryItem} ItineraryItem
 *
 * @typedef {Object} NewTripFormData
 * @property {string} title             // 行程标题(必填,v0.4.0 新增显式收集,沿 NewTripStrings.fieldTitle)
 * @property {string} start_date        // 'YYYY-MM-DD'
 * @property {string} end_date          // 'YYYY-MM-DD'
 * @property {ItineraryItem[]} itineraryArrange  // UI-025(v0.4.0 每条 item 含 date? 字段)
 *
 * v0.4.0(TripCreateEditFix-001 2026-06-24):移除 city / companions / budget_range /
 *   transport_preference / special_needs 5 字段。user 2026-06-19 自报「service 和 store
 *   只是调用 API,具体操作仅由后端执行」,5 选填 client-only 字段 UI 一并移除(spec §6.4.2 PD-001)。
 *   保留 4 字段:title + start_date + end_date + itineraryArrange。
 */

/**
 * @typedef {'form' | 'submitting' | 'completed' | 'error'} NewTripStep
 *
 * v0.7.0 简化:6 枚举 → 4 枚举(spec §3.7 + §4.1);input / analyzing 视图态已删除,
 * 页面进入即 default 'form'。spec-auditor 严格核对 enum 集为 4 个,不允许第 5 枚举值。
 */

// ─────────────── 静态辅助函数 ───────────────

/**
 * 创建空的 NewTripFormData(spec §4.1 createEmpty,v0.4.0 4 字段)
 * @returns {NewTripFormData}
 */
function createEmptyFormData() {
  return {
    title: '',
    start_date: '',
    end_date: '',
    itineraryArrange: [], // UI-025 默认空数组
  }
}

/**
 * 计算两个日期之间的天数差(包含首尾,故 +1)
 * @param {string} start 'YYYY-MM-DD'
 * @param {string} end   'YYYY-MM-DD'
 * @returns {number} 天数(>= 1)
 */
function dayDiff(start, end) {
  if (!start || !end) return 0
  const d1 = new Date(start).getTime()
  const d2 = new Date(end).getTime()
  if (Number.isNaN(d1) || Number.isNaN(d2) || d2 < d1) return 0
  return Math.round((d2 - d1) / 86400000) + 1
}

/**
 * 派生 trip.title — v0.6.0(per user-round4-2026-06-26)修订
 *
 * 严格使用 fd.title.trim(),**不**做任何拼接兜底。
 * 触发原因:user 2026-06-26 19:46 报 bug,成功创建行程时 trip.title 错误显示为
 * 「行程 {start_date} - {end_date} {days}天」拼接字符串,而**应该**用 fd.title.trim()。
 * 根因 = v0.4.0 旧实现:fd.title 为空时 fallback 到日期拼接兜底。
 * v0.6.0 决策:删除日期拼接 fallback,严格返回 fd.title.trim()。
 * title 为空 → 返回空字符串,onSubmit 拦截不让提交(formSubmitError banner 提示)。
 *
 * @param {NewTripFormData | null | undefined} fd
 * @returns {string} trim 后的 title(title 为空 → 空字符串)
 */
function deriveTitle(fd) {
  if (!fd) return ''
  return (fd.title || '').trim()
}

/**
 * 派生 TripItem.city 字段(per Cross-Page issue location-real-fix-v2-2026-06-25 §2.4 +
 * Cross-Page issue TripCreateEditFix-001)
 *
 * 后端 Pydantic CreateTripItemRequest.city: str 必填(per backend/app/schemas/trips.py:36),
 * 前端 NewTripPage form 表单**不**含 city 字段(spec 7 字段设计:title / city / start_date /
 * end_date / companions / budget / transport / special_needs,后端只接 city 必填,
 * 其余 4 选填 client-only),所以从 trip.title 启发式提取城市名。
 *
 * 提取策略:
 *   1. trip.title.trim() 非空 → 取前 1-3 个连续中文字符作为 city(启发式)
 *   2. 提取不到中文(全部英文/数字/标点)→ fallback 用 trip.title 字面值
 *      (后端 Pydantic min_length=1, max_length=200 接受任意非空字符串)
 *   3. trip.title 为空 → 返回空字符串(沿用 v0.4.0 兜底;理论上 3 必填校验已过,
 *      title 一定有值,这里仅防御)
 *
 * @param {string} tripTitle  派生后的 trip.title(由 `deriveTitle(formData)` 派生)
 * @returns {string}  city 字段值(允许空字符串兜底,但后端会 422)
 */
function deriveCity(tripTitle) {
  if (!tripTitle || !tripTitle.trim()) return ''
  // 启发式:取 trip.title 中开头的 1-3 个连续中文字符
  const m = tripTitle.match(/^[\u4e00-\u9fa5]{1,3}/)
  if (m) return m[0]
  // fallback:无中文开头则用 trip.title 字面值
  return tripTitle.trim().slice(0, 50)
}

/**
 * 复制模式 fallback mock(per UI-024 任务原文 + issue §3.1 + UI-025 §5)
 * 当 db_trips 暂无该 tripId 时(Plan 1 落地后 db_trips 仍空,因任务 2 仅 seed users),
 * 用此 mock 兜底(形状基于 api/mock/_seed.ts:205 seedTrip3 西安四日)
 *
 * UI-025:扩展 itineraryArrange 字段(任务 4 复制行程预填),
 * 形状 = api/types.ts ItineraryItem[] 6 字段(id / title / start_time / end_time / item_type / date?);
 *
 * v0.4.0(TripCreateEditFix-001):移除 city 字段(后端无 city 列),itineraryArrange 每条带 date 字段。
 *
 * @type {import('../../api/types').Trip & { itineraryArrange?: import('../../api/types').ItineraryItem[] }}
 */
const MOCK_TRIP_FOR_COPY = Object.freeze({
  id: 3,
  user_id: 1,
  title: '西安四日文化行',
  start_date: '2026-05-01',
  end_date: '2026-05-04',
  status: 'finished',
  days: [],
  // UI-025 任务 4 复制预填(西安四日典型行程),v0.4.0 每条带 date 字段
  itineraryArrange: [
    { id: 30001, date: '2026-05-01', title: '兵马俑',     start_time: '09:00', end_time: '12:00', item_type: 'attraction' },
    { id: 30002, date: '2026-05-01', title: '午餐:肉夹馍', start_time: '12:30', end_time: '13:30', item_type: 'food' },
    { id: 30003, date: '2026-05-01', title: '古城墙骑行',  start_time: '15:00', end_time: '17:00', item_type: 'attraction' },
    { id: 30004, date: '2026-05-01', title: '回民街夜市',  start_time: '19:00', end_time: '21:00', item_type: 'food' },
  ],
})

/**
 * 将 ApiError 归一为友好提示(spec §6.1 Error 表 + §5.3 D-G)
 * @param {import('../../services/preferences.js').ApiError | Error | unknown} err
 * @returns {string}
 */
function mapErrorToMessage(err) {
  if (!err) return NewTripStrings.errorNetwork
  const e = /** @type {any} */ (err)
  // 400 / 4000 参数非法
  if (e.code === 4000 || e.statusCode === 400) {
    return NewTripStrings.errorBadRequest
  }
  // 5xx / 5000 服务端错误
  if (e.code === 5000 || (e.statusCode >= 500 && e.statusCode < 600)) {
    return NewTripStrings.errorServer
  }
  // 4001 资源不存在(理论不会发生)
  if (e.code === 4001 || e.statusCode === 404) {
    return NewTripStrings.errorFallback
  }
  // 网络断开 / 其它
  return NewTripStrings.errorNetwork
}

// ─────────────── Local State(spec §4.1,v0.7.0 简化) ───────────────

/** @type {import('vue').Ref<NewTripFormData>} */
const formData = ref(createEmptyFormData())
/** @type {import('vue').Ref<NewTripStep>} AI 是表单内的可选能力，不单独占用页面状态。 */
const currentStep = ref('form')
const inputText = ref('')
const isParsing = ref(false)
const parseError = ref('')
const parseWarnings = ref([])
const creationKey = ref('')
/** @type {import('vue').Ref<string | null>} POST 失败的友好提示,驱动 _ErrorOverlay */
const submitError = ref(null)
/** @type {import('vue').Ref<string | null>} form 内部 3 必填校验失败提示 */
const formSubmitError = ref(null)
/** @type {import('vue').Ref<boolean>} 草稿弹窗可见 */
const dialogVisible = ref(false)

// ─────────────── UI-024 复制模式状态 ───────────────
/** @type {import('vue').Ref<number | null>} 解析自 URL ?copyFrom=xxx,无效 → null */
const copyFromTripId = ref(null)
/** @type {import('vue').Ref<string>} 源 trip.title,用于 form 顶部 hint + submit title 派生 */
const originalTripTitle = ref('')
/** 是否为「复制」模式(由 copyFromTripId !== null 决定,沿 spec 6 视图态机 — 不新增第 7 枚举) */
const isCopyMode = computed(() => copyFromTripId.value !== null)

// ─────────────── Computed ───────────────

/** 是否有内容(formData 非空)用于判定弹草稿
 * v0.4.0(TripCreateEditFix-001):移除 city / companions / budget / transport / needs 5 字段校验
 * v0.7.0 简化:移除 inputText / attachedFiles 2 字段(input 态已删除);
 * hasContent = formData 任一字段非 createEmpty 默认值 */
const hasContent = computed(() => {
  return (
    formData.value.title.trim() !== '' ||
    formData.value.start_date !== '' ||
    formData.value.end_date !== '' ||
    formData.value.itineraryArrange.length > 0 ||
    inputText.value.trim() !== ''
  )
})

/** 3 必填是否都已填(form 态点「确认」前校验,v0.4.0:title + start_date + end_date) */
const hasRequiredFields = computed(() => {
  return (
    formData.value.title.trim() !== '' &&
    formData.value.start_date !== '' &&
    formData.value.end_date !== '' &&
    formData.value.itineraryArrange.every((item) => item.title && item.date)
  )
})

const canAnalyze = computed(() => inputText.value.trim().length > 0 && inputText.value.length <= 2000)

/** title 输入框 placeholder(v0.4.0 新增,显式 title 字段) */
const titlePlaceholder = computed(() => '例如:大连三日游')

/** date-picker 起始日期(今天) */
const datePickerStart = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

/** date-picker 截止日期(2 年后) */
const datePickerEnd = computed(() => {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

/** UI-024:form 顶部 hint 文案 — 复制模式显示「复制自「XX」,可修改...」,普通模式显示 AI 填写提示 */
const formHintText = computed(() => {
  if (isCopyMode.value) {
    return `${NewTripStrings.formHintCopyPrefix}${originalTripTitle.value}${NewTripStrings.formHintCopySuffix}`
  }
  return strings.formHint
})

/** UI-024:form 态主 CTA 文案 — 复制模式显示「保存新行程」,普通模式显示「确认」 */
const btnConfirmText = computed(() =>
  isCopyMode.value ? NewTripStrings.btnSaveNew : strings.btnConfirm
)

// ─────────────── Store ───────────────
const homeStore = useHomeStore()

async function onAnalyze() {
  if (!canAnalyze.value || isParsing.value || currentStep.value !== 'form') return
  isParsing.value = true
  parseError.value = ''
  try {
    const response = await parseTripText(inputText.value.trim())
    const parsed = response.data || {}
    formData.value = mergeParsedTripIntoForm(formData.value, parsed)
    parseWarnings.value = Array.isArray(parsed.warnings) ? parsed.warnings : []
    if (Array.isArray(parsed.missing_required_fields) && parsed.missing_required_fields.length) {
      parseWarnings.value = [...parseWarnings.value, strings.parsePartial]
    }
    logger.info('[NewTripPage] parse ok', {
      itemCount: formData.value.itineraryArrange.length,
      missingCount: parsed.missing_required_fields?.length || 0,
    })
  } catch (err) {
    logger.error('[NewTripPage] parse failed', err)
    parseError.value = strings.parseFailed
  } finally {
    isParsing.value = false
  }
}

// ─────────────── UI-024 复制模式入口 ───────────────

/**
 * 从 db_trips 读该 trip,缺失则 fallback 到 MOCK_TRIP_FOR_COPY
 * 派生 formData 7 字段(沿 NewTripFormData 形状)+ originalTripTitle
 * 不调任何 API,纯本地 storage + 兜底 mock(per 任务原文「优先 mock,因本任务聚焦复制流程」)
 * @param {number} tripId
 */
function loadAndPrefillFromTrip(tripId) {
  if (!Number.isFinite(tripId) || tripId <= 0) return

  // 1. 优先从 db_trips 读(Plan 1 落地后 db_trips 仍空,但保留扩展 hook)
  let sourceTrip = null
  try {
    const allTrips = loadTrips()
    sourceTrip = allTrips[String(tripId)] || allTrips[tripId] || null
  } catch (err) {
    logger.warn('[NewTripPage] loadTrips fail in copy', err)
  }

  // 2. fallback 到 mock(基于 seedTrip3 西安四日)
  if (!sourceTrip) {
    sourceTrip = MOCK_TRIP_FOR_COPY
    logger.info('[NewTripPage] copy fallback to mock seedTrip3', { tripId })
  }

  // 3. 派生 formData(v0.4.0 4 字段:title + start_date + end_date + itineraryArrange)
  formData.value = {
    title: sourceTrip.title || '',
    start_date: sourceTrip.start_date || '',
    end_date: sourceTrip.end_date || '',
    // UI-025:itineraryArrange 预填(从源 trip 派生,无则空数组)
    itineraryArrange: Array.isArray(sourceTrip.itineraryArrange)
      ? sourceTrip.itineraryArrange.map((it) => ({ ...it }))
      : [],
  }
  originalTripTitle.value = sourceTrip.title || ''

  logger.info('[NewTripPage] copy prefill ok', {
    tripId,
    sourceTitle: originalTripTitle.value,
    start_date: formData.value.start_date,
    end_date: formData.value.end_date,
    itineraryCount: formData.value.itineraryArrange.length,
  })
}

/**
 * 从 uni-app 运行时拿当前页的 options(query 参数)
 * 优先用 onLoad(options) 钩子入参,fallback 用 getCurrentPages() 末项 options
 * (与 TripDetailPage 同样模式,本工程未在 package.json 显式列 @dcloudio/uni-app)
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
    logger.warn('[NewTripPage] getCurrentPages fail', err)
  }
  return undefined
}

/**
 * 页面初始化入口(UI-024)
 * 解析 ?copyFrom=xxx,有效 → loadAndPrefillFromTrip + 切 form 态
 * 缺省 / 无效 → 走默认 form 态(v0.7.0 起 currentStep 默认 'form',无需切换)
 * @param {Record<string, string | undefined> | undefined} options
 */
function onLoadPage(options) {
  logger.info('[NewTripPage] initialize', { options })

  const raw = options?.copyFrom
  if (raw === undefined || raw === null || raw === '') {
    return // 缺省 = 普通新建模式,currentStep 已 default 'form'(v0.7.0 简化)
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) {
    logger.info('[NewTripPage] notfound, bad copyFrom', { rawCopyFrom: raw })
    return
  }

  copyFromTripId.value = n
  loadAndPrefillFromTrip(n)
  currentStep.value = 'form'
  submitError.value = null
  formSubmitError.value = null
  logger.info('[NewTripPage] enter copy mode', { tripId: n })
}

// ─────────────── Handlers ───────────────

/**
 * form 态:点「确认」 → submitting(spec §5.2 Step 3-4)
 * 校验:3 必填非空(AC-06)→ 否则 formSubmitError + 保持 form 态
 * UI-024:复制模式 → title 固定用「{originalTitle} 副本」(不随 formData 字段变)
 * v0.4.0(TripCreateEditFix-001):3 必填 = title + start_date + end_date(移除 city)
 */
function onConfirm() {
  if (!hasRequiredFields.value) {
    formSubmitError.value = NewTripStrings.errorRequired
    logger.warn('[NewTripPage] submit blocked, missing required')
    return
  }
  formSubmitError.value = null

  // UI-024:复制模式 title 派生固定为「原 title 副本」
  // v0.6.0(per user-round4-2026-06-26):copy mode 后缀「副本」**保留**(user 没报这个 bug,
  // copy mode 是 feature);仅普通模式下 deriveTitle 严格走 fd.title.trim() 不再做日期拼接兜底
  const title = isCopyMode.value
    ? `${originalTripTitle.value} 副本`
    : deriveTitle(formData.value)
  if (!title) {
    // v0.6.0 修订:title 为空 → 用 formSubmitError banner 显示明确错误提示
    // (不切 currentStep='error',仅在 form 顶部 ErrorBanner 提示;user 仍可继续填写)
    // 防御:hasRequiredFields 已包含 title.trim() 必填,但用户可能在 form 已展开后清空 title 再提交
    formSubmitError.value = NewTripStrings.errorRequired  // '请填写完整'
    logger.warn('[NewTripPage] submit blocked, title empty after form validate')
    return
  }

  const days = dayDiff(formData.value.start_date, formData.value.end_date)
  logger.info('[NewTripPage] submit start', {
    days,
    copyMode: isCopyMode.value,
    title,
    itineraryCount: formData.value.itineraryArrange.length, // UI-025 调试字段
  })

  currentStep.value = 'submitting'
  submitError.value = null
  submitTripRequest(title)
}

/**
 * 实际发起 POST(AC-07 + AC-08 + AC-09)
 *
 * v0.4.0(TripCreateEditFix-001):
 *   - 移除 city 字段(后端 CreateTripRequest extra=ignore 静默丢)
 *   - createTrip 成功后,如果 itineraryArrange 非空,**串行**为每个 item
 *     调 createTripDay → createTripItem,失败 logger.warn 不阻塞
 * @param {string} title
 */
async function submitTripRequest(title) {
  try {
    if (!creationKey.value) {
      creationKey.value = `trip-${Date.now()}-${Math.random().toString(36).slice(2)}`
    }
    const cityFallback = deriveCity(title)
    const payload = buildTripDraftPayload(formData.value, title, creationKey.value, cityFallback)
    const res = await createTripFromDraft(payload)
    const tripId = res.data?.trip_id
    if (!tripId) {
      throw new Error('createTripFromDraft response missing trip_id')
    }
    currentStep.value = 'completed'
    submitError.value = null
    logger.info('[NewTripPage] submit ok', { tripId })

    // 200ms 后 reLaunch(AC-08:≤ 200ms,避免黑屏)
    setTimeout(async () => {
      // 刷新 HomePage 列表(失败仅 warn,不阻塞 reLaunch)
      homeStore.fetchTrips()
        .catch((err) => logger.warn('[NewTripPage] fetchTrips after submit failed', err))
        .finally(() => {
          // fix-trip-bugs-v1:创建后直接 reLaunch Home(per user 2026-06-18),
          // 不走 TripDetail。原因:reLaunch 清空整页栈 → TripDetailPage onBack
          // navigateBack 必然失败 → 兜底 reLaunch Home(整页刷新,体验糟)。
          // HomePage onShow 自动 re-fetch,新 trip 出现在 Section 2「行程列表」。
          uni.reLaunch({ url: AppRoutes.Home }).catch((err) => {
            logger.error('[NewTripPage] reLaunch Home failed', err)
          })
        })
    }, 200)
  } catch (err) {
    logger.error('[NewTripPage] submit failed', err)
    submitError.value = mapErrorToMessage(err)
    currentStep.value = 'error'
  }
}

/**
 * error 态:点「重试」 → submitting(formData 保留,spec §5.2 Step 6)
 */
function onRetry() {
  logger.info('[NewTripPage] retry')
  const title = deriveTitle(formData.value)
  if (!title) {
    submitError.value = NewTripStrings.errorBadRequest
    return
  }
  currentStep.value = 'submitting'
  submitError.value = null
  submitTripRequest(title)
}

/**
 * 取消(底部「取消」按钮)→ 走草稿弹窗逻辑(spec §5.4)
 */
function onCancel() {
  logger.info('[NewTripPage] cancel, hasContent=' + hasContent.value)
  if (!hasContent.value) {
    // 无内容 → 直接退出
    uni.reLaunch({ url: AppRoutes.Home })
    return
  }
  dialogVisible.value = true
}

/**
 * Header ← 按钮:等同取消
 */
function onBack() {
  onCancel()
}

/**
 * _DraftConfirmDialog:保存草稿
 *
 * v0.5.0(2026-06-26 per user-round3「首页不显示草稿」修复)草稿推上后端触发:
 *   - 策略:有 start_date / end_date → 走 `createTrip` 真后端(草稿推上 HomePage);
 *          没日期(只填了 title)→ fallback 旧 `saveDraft` 本地 storage
 *          (后端 CreateTripRequest start_date / end_date 必填,不能空)
 *   - 后端 `createTrip` 失败(网络断开 / 5xx)→ 降级到 `saveDraft` 本地 storage 兜底
 *   - 草稿**至少**有 title(否则没意义)
 *   - 草稿**不**带 itineraryArrange(itineraryArrange 是 form 态才有)
 *   - 创建成功后**不**调 `updateTrip(status='active')`(创建时已 'draft',不需要再切)
 *
 * v0.5.1(2026-06-26 per user 19:37 bug)无日期守卫:
 *   - 入口加守卫:`!fd.start_date || !fd.end_date` → 拒绝保存 + Toast「未选择日期,无法保存为草稿」
 *   - 不调 createTrip / saveDraft,关闭 _DraftConfirmDialog,currentStep 保持不变
 *   - 仅针对"没日期"场景;createTrip 失败的 fallback 路径**不**受影响(仍走 saveDraft)
 *
 * v0.7.0 简化:
 *   - TripDraft 形状从 5 字段 → 3 字段(spec §4.3):删除 `inputText` + `attachedFiles`
 *     (input 态已删除,这两个字段无内容可存)
 *   - `currentStep` 失败回退路径从 'input' 改 'form'(input 态已删除)
 *
 * @returns {Promise<void>}
 */
async function onDialogSave() {
  const fd = formData.value
  dialogVisible.value = false

  if ((!fd.start_date || !fd.end_date) && inputText.value.trim()) {
    const ok = saveDraft({
      id: Date.now(),
      created_at: new Date().toISOString(),
      inputText: inputText.value,
      formData: fd,
    })
    uni.showToast({
      title: ok ? NewTripStrings.draftSavedToast : NewTripStrings.draftSaveFailedToast,
      icon: ok ? 'success' : 'none',
      duration: 1500,
    })
    if (ok) setTimeout(() => uni.reLaunch({ url: AppRoutes.Home }), 1200)
    return
  }

  // v0.5.1(per user 19:37 bug)无日期守卫:没日期 → 拒绝保存 + Toast 提示
  // 草稿若没 start_date / end_date,后端 CreateTripRequest 必填 → 不可能推上去;
  // 旧 v0.5.0 走本地 storage fallback 路径,user 实测发现这违反期望:
  // "没日期的草稿在首页 / 回收站 都没意义(无 day 可生成),不应允许存"
  if (!fd.start_date || !fd.end_date) {
    logger.warn('[NewTripPage] saveDraft rejected: missing dates', {
      hasStartDate: !!fd.start_date,
      hasEndDate: !!fd.end_date,
    })
    uni.showToast({
      title: NewTripStrings.draftNoDatesToast,
      icon: 'none',
      duration: 2000,
    })
    return
  }

  // 草稿至少需要 title(否则没意义,fallback saveDraft 旧路径)
  const title = fd.title.trim() || '未命名草稿'

  // 策略 1:有 start_date / end_date → 走 createTrip 真后端(草稿推上 HomePage)
  if (fd.start_date && fd.end_date) {
    try {
      const res = await createTrip({
        title,
        start_date: fd.start_date,
        end_date: fd.end_date,
        itineraryArrange: [], // 草稿无 itinerary
        status: 'draft', // 显式声明草稿(后端默认也是 'draft',显式更清晰)
      })
      const tripId = res.data?.trip_id
      if (!tripId) throw new Error('createTrip response missing trip_id')
      logger.info('[NewTripPage] saveDraft push ok', { tripId })
      uni.showToast({
        title: NewTripStrings.draftSavedToast,
        icon: 'success',
        duration: 1500,
      })
      // 刷新首页列表(失败仅 warn,不阻塞 reLaunch)
      homeStore
        .fetchTrips()
        .catch((err) =>
          logger.warn('[NewTripPage] fetchTrips after draft save failed', err),
        )
        .finally(() => {
          setTimeout(() => {
            uni.reLaunch({ url: AppRoutes.Home })
          }, 1200)
        })
      return
    } catch (err) {
      // 创建失败(网络 / 后端 5xx)→ fallback 旧 saveDraft 本地 storage
      logger.warn(
        '[NewTripPage] saveDraft push failed, fallback to local storage',
        err,
      )
      // 继续走到下方 saveDraft fallback 逻辑(不 return)
    }
  }

  // 策略 2:fallback — 旧 saveDraft 本地 storage 路径
  //   触发条件:无 start_date/end_date(只填了 title)
  //            或策略 1 createTrip 抛错
  // v0.7.0 简化:TripDraft 3 字段 = id + created_at + formData(删除 inputText + attachedFiles)
  const draft = {
    id: Date.now(),
    created_at: new Date().toISOString(),
    formData: fd,
  }
  const ok = saveDraft(draft)
  if (ok) {
    logger.info('[NewTripPage] saveDraft ok (local fallback)', {
      draftId: draft.id,
    })
    uni.showToast({
      title: NewTripStrings.draftSavedToast,
      icon: 'success',
      duration: 1500,
    })
    setTimeout(() => {
      uni.reLaunch({ url: AppRoutes.Home })
    }, 1200)
  } else {
    // storage 写异常(spec §5.3.K)
    logger.warn('[NewTripPage] saveDraft failed (local fallback), stay in form')
    uni.showToast({
      title: NewTripStrings.draftSaveFailedToast,
      icon: 'none',
      duration: 1500,
    })
    currentStep.value = 'form'
  }
}

/**
 * _DraftConfirmDialog:不保存
 */
function onDialogDontSave() {
  logger.info('[NewTripPage] draft discarded')
  dialogVisible.value = false
  uni.reLaunch({ url: AppRoutes.Home })
}

/**
 * _DraftConfirmDialog:继续编辑
 */
function onDialogContinue() {
  logger.info('[NewTripPage] cancel draft, continue edit')
  dialogVisible.value = false
  currentStep.value = 'form'
}

/**
 * date-picker change
 * @param {'start_date' | 'end_date'} key
 * @param {UniApp.ChangeEvent} e
 */
function onDateChange(key, e) {
  const v = e.detail.value
  if (typeof v === 'string' && v) {
    formData.value[key] = v
  }
}

/**
 * 交通偏好 radio 切换(spec §3.5 Field 6:4 选 1)
 *
 * v0.4.0(TripCreateEditFix-001):UI 字段已移除,本函数保留为 no-op stub
 * 避免模板引用产生 undefined 错误(模板在 F 方向已清空 chip-row,
 *   但若有残留引用也不会抛错)
 * @param {'flight' | 'train' | 'car' | 'walk'} v
 */
function onTransportToggle(v) {
  // no-op(v0.4.0 UI 移除,保留函数签名避免模板残留引用崩溃)
}

/**
 * 特殊需求 checkbox 切换(spec §3.5 Field 7:多选)
 *
 * v0.4.0(TripCreateEditFix-001):UI 字段已移除,本函数保留为 no-op stub
 * @param {'less_walking' | 'with_children' | 'with_elderly' | 'accessible'} v
 */
function onNeedsToggle(v) {
  // no-op(v0.4.0 UI 移除,保留函数签名避免模板残留引用崩溃)
}

// ─────────────── Lifecycle ───────────────

/**
 * 页面挂载:解析 ?copyFrom={tripId} 决定是否走复制模式(UI-024)
 * 沿用 TripDetailPage 模式(getCurrentPages() 末项 options)
 */
onMounted(() => {
  const options = getCurrentPageOptions()
  onLoadPage(options)
})

onUnmounted(() => {
  // v0.7.0 简化:clearAnalyzingTimer 已删除(input/analyzing 态不存在,无 setTimeout 句柄需清)
  logger.debug('[NewTripPage] onUnmounted, currentStep=' + currentStep.value)
})
</script>

<style scoped>
.newtrip-page {
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

.ai-import-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 24rpx;
  margin-bottom: 28rpx;
  border: 2rpx solid rgba(45, 106, 94, 0.22);
  border-radius: 20rpx;
  background: rgba(45, 106, 94, 0.05);
}

.ai-import-title {
  color: #2D6A5E;
  font-size: 30rpx;
  font-weight: 600;
}

.trip-text-input {
  width: 100%;
  min-height: 240rpx;
  padding: 24rpx;
  box-sizing: border-box;
  border: 2rpx solid #E3DBCF;
  border-radius: 20rpx;
  background: #FDFBF7;
  color: #2C2C2C;
  font-size: 28rpx;
  line-height: 1.7;
}

.btn-parse-trip {
  align-self: flex-end;
  min-height: 72rpx;
  padding: 0 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: #2D6A5E;
  color: #FFFFFF;
  font-size: 26rpx;
  font-weight: 600;
}

.btn-parse-trip-disabled {
  opacity: 0.45;
  pointer-events: none;
}

.parse-error {
  color: #C44A3A;
  font-size: 24rpx;
  line-height: 1.5;
}

.parse-warning-card {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: rgba(196, 126, 32, 0.08);
}

.parse-warning-title {
  color: #8A5A16;
  font-size: 26rpx;
  font-weight: 600;
}

.parse-warning-text {
  color: #6E5838;
  font-size: 24rpx;
  line-height: 1.5;
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
  /* ≥ 44pt tap area(88rpx = 44pt) */
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
}

.body-inner {
  padding: 24rpx 40rpx 32rpx;
  /* space-lg / space-xl */
  box-sizing: border-box;
}

/* ───────── GreetingBlock(input 态) ───────── */
.greeting-block {
  margin-bottom: 32rpx;
  /* space-xl */
}

.greeting-title {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px,UI §三 中标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  margin-bottom: 8rpx;
  /* space-sm */
}

.greeting-hint {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
}

/* ───────── Textarea(input 态) ───────── */
.textarea-wrap {
  background: #FDFBF7;
  /* surfaceCard */
  border: 1.5px solid #E8E0D4;
  /* divider */
  border-radius: 12px;
  /* radius-md */
  padding: 16rpx 20rpx;
  /* space-md / space-lg ÷ 2 */
  margin-bottom: 24rpx;
  /* space-lg */
  box-sizing: border-box;
  min-height: 240rpx;
  /* spec §3 textarea 最小高度 */
}

.textarea {
  width: 100%;
  min-height: 200rpx;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  color: #2C2C2C;
  /* ink */
  line-height: 1.5;
  box-sizing: border-box;
}

.textarea-placeholder {
  color: #9A9A9A;
  /* inkMuted */
}

/* ───────── File chips(input 态) ───────── */
.file-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 32rpx;
  /* space-xl */
  box-sizing: border-box;
}

.btn-attach-file {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  /* space-sm */
  min-height: 88rpx;
  /* spec §10 NFR 44pt 触达(88rpx = 44pt,§3.3 56rpx 描述与 §10 NFR 冲突,按 NFR 优先) */
  padding: 0 24rpx;
  background: transparent;
  border: 1.5px dashed #9A9A9A;
  /* inkMuted 虚线 */
  border-radius: 9999px;
  /* radius-full */
  box-sizing: border-box;
  transition: background 0.15s ease-out, transform 0.15s ease-out;
}

.btn-attach-file-hover {
  background: rgba(45, 106, 94, 0.06);
  transform: scale(0.96);
}

.btn-attach-file-emoji {
  font-size: 28rpx;
  /* 14px */
  line-height: 1;
}

.btn-attach-file-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

.file-chip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  /* space-sm */
  background: #F2EBE0;
  /* surfaceWarm */
  border-radius: 8px;
  /* radius-sm */
  padding: 8rpx 8rpx 8rpx 16rpx;
  box-sizing: border-box;
  max-width: 320rpx;
}

.file-chip-name {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220rpx;
}

.file-chip-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  /* 32pt,合理的内联 X 按钮尺寸 */
  min-width: 64rpx;
  min-height: 64rpx;
  border-radius: 9999px;
  background: rgba(45, 106, 94, 0.08);
  box-sizing: border-box;
}

.file-chip-remove-hover {
  background: rgba(45, 106, 94, 0.15);
}

.file-chip-remove-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 20rpx;
  color: #5A5A5A;
  line-height: 1;
  margin-top: -2rpx;
}

/* ───────── Action Row(双按钮横排) ───────── */
.action-row {
  display: flex;
  gap: 16rpx;
  /* space-md */
  margin-top: 24rpx;
  /* space-lg */
  box-sizing: border-box;
}

.btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area(88rpx = 44pt) */
  border-radius: 9999px;
  /* radius-full */
  box-sizing: border-box;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out;
}

/* 次按钮:取消 */
.btn-cancel {
  background: #F2EBE0;
  /* surfaceWarm,见 UI §八 */
}

.btn-cancel-hover {
  opacity: 0.8;
}

.btn-cancel-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 32rpx;
  /* 16px */
  font-weight: 500;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

/* 主按钮:确定 / 确认 */
.btn-submit {
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
  /* Primary 渐变,见 UI §八 */
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
  /* primaryShadow */
}

.btn-submit-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.btn-submit-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.btn-submit-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 32rpx;
  /* 16px */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* ───────── Center Panels(analyzing / submitting / completed / error) ───────── */
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

.panel-center-hint {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #9A9A9A;
  /* inkMuted */
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
  /* ≥ 44pt tap area */
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
.form-header {
  margin-bottom: 24rpx;
  /* space-lg */
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

.form-input-preview {
  background: #F2EBE0;
  /* surfaceWarm */
  border-radius: 8px;
  /* radius-sm */
  padding: 12rpx 16rpx;
  box-sizing: border-box;
}

.form-input-preview-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md,字段间 16rpx(spec §3.1) */
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  /* space-sm,标签与输入间 8rpx(spec §3.1) */
}

.form-field-label {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px,正文 */
  font-weight: 500;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.required-mark {
  color: #C44A3A;
  /* danger,见 UI §二 */
  font-size: 32rpx;
  /* 16px,见 spec §3.1 */
  margin-left: 4rpx;
}

.form-field-input {
  width: 100%;
  height: 80rpx;
  /* 输入框标准高度,>= 44pt 触达 */
  padding: 0 20rpx;
  background: #FDFBF7;
  /* surfaceCard */
  border: 1.5px solid #E8E0D4;
  /* divider */
  border-radius: 12px;
  /* radius-md */
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  box-sizing: border-box;
}

.form-field-input-placeholder {
  color: #9A9A9A;
  /* inkMuted */
}

.form-field-picker {
  height: 80rpx;
  display: flex;
  align-items: center;
  padding: 0 20rpx;
  background: #FDFBF7;
  /* surfaceCard */
  border: 1.5px solid #E8E0D4;
  /* divider */
  border-radius: 12px;
  /* radius-md */
  box-sizing: border-box;
}

.form-field-picker-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.form-field-picker-text-placeholder {
  color: #9A9A9A;
  /* inkMuted */
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  box-sizing: border-box;
}

.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  /* space-sm */
  min-height: 88rpx;
  /* ≥ 44pt tap area(spec §10 NFR 7 字段 chips) */
  padding: 0 24rpx;
  background: #FDFBF7;
  /* surfaceCard */
  border: 1.5px solid #E8E0D4;
  /* divider */
  border-radius: 9999px;
  /* radius-full */
  box-sizing: border-box;
  transition: background 0.15s ease-out, border-color 0.15s ease-out, transform 0.15s ease-out;
}

.chip-hover {
  transform: scale(0.96);
}

.chip-selected {
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft */
  border-color: #2D6A5E;
  /* primary */
}

.chip-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.chip-text-selected {
  color: #2D6A5E;
  /* primary */
  font-weight: 500;
}

.chip-check {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  color: #2D6A5E;
  /* primary */
  line-height: 1;
  margin-left: 4rpx;
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

/* ───────── H5 ≥1024px 大屏居中(spec §3.8 + §10 NFR) ───────── */
@media (min-width: 1024px) {
  .body-inner {
    max-width: 640rpx;
    margin: 0 auto;
  }
}
</style>
