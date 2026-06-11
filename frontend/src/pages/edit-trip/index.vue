<!--
  pages/edit-trip/index.vue — 编辑行程页(独立 route 化表单页,非 Tab)
  
  Spec contract: specs/EditTripPage.md v0.1.0
  Route: /pages/edit-trip/index
  入口:TripDetailPage BtnModify → uni.navigateTo({url: AppRoutes.EditTrip + '?tripId=' + tripId})
  出口:PUT 成功后 navigateBack(保留 stack)→ TripDetailPage.onShow 重新拉取
  
  6 视图态(spec §3.7 / §4.1 / §5):
    loading   — 初始 / GET 飞行中(转圈 + 提示)
    editing   — GET 拉取成功 + trip.status !== 'deleted' + 表单预填
    saving    — 用户点「保存」且 2 必填校验通过 + city/dates 未变(PUT 飞行中,无取消)
    success   — PUT 成功 ✓ 大对勾(瞬时 ≤ 200ms 后 navigateBack)
    notfound  — URL 缺参/非数字/<=0/资源不存在/已被软删
    error     — GET / PUT 失败(error overlay + 重试)
  
  复用(spec §3.6 + §10 R-1~R-3):
    - AppColors(山水日志配色)
    - AppRoutes.EditTrip(已预声明) + AppRoutes.Home
    - EditTripStrings(本规格新增)+ EditTripStatusOptions
    - NewTripStrings.fieldXxx / placeholderXxx / draftDialogXxx(7 字段 label 复用)
    - NewTripTransportOptions / NewTripNeedsOptions(选填 chips 复用)
    - useHomeStore.fetchTrips()(PUT 成功后刷新列表)
    - services/trips.updateTrip / getTripDetail / loadEditDraft / saveEditDraft / clearEditDraft
    - _ErrorBanner(form 内部 2 必填校验失败提示,retryable=false)
    - _DraftConfirmDialog(本页面私有 3 按钮 modal)
  
  不复用:NextButton(单 CTA 场景)/ SpotDetailSheet(浮层专用)/ EmptyState / SpotCard
  
  草稿(spec §4.3 + §5.4 + §6.4.3):
    - 取消且有 diff → _DraftConfirmDialog(3 按钮)
    - 「保存草稿」→ uni.setStorageSync('edit_trip_drafts', {[tripId]: draft})(keyed by tripId)+ Toast + navigateBack
    - 「不保存」→ clearEditDraft + navigateBack
    - 「继续编辑」→ 关闭弹窗,currentStep 保持 editing
    - 草稿恢复优先于 GET 响应(spec §5.1 + §5.3.H):若 storage 有该 tripId 草稿,formData 预填用草稿,GET 后不覆盖
-->
<template>
  <view
    class="edittrip-page"
    :aria-label="strings.pageAria"
  >
    <!-- Header(顶栏 44pt,左「✕」右 title) -->
    <view class="header">
      <view
        class="header-close"
        role="button"
        :aria-label="strings.closeAria"
        hover-class="header-close-hover"
        :hover-stay-time="50"
        @click="onClose"
      >
        <text class="header-close-text" aria-hidden="true">✕</text>
      </view>
      <text class="header-title">{{ strings.title }}</text>
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
        <!-- ───────── loading 态 ───────── -->
        <view
          v-if="currentStep === 'loading'"
          class="panel-center"
        >
          <view class="loading-spinner" aria-hidden="true" />
          <text class="panel-center-title">{{ strings.loadingText }}</text>
        </view>

        <!-- ───────── editing 态(8 字段表单) ───────── -->
        <view
          v-else-if="currentStep === 'editing'"
          class="panel-form"
        >
          <view class="form-header">
            <text class="form-title">{{ strings.formTitle }}</text>
            <text class="form-hint">{{ formHintText }}</text>
            <view
              v-if="trip"
              class="form-trip-summary"
            >
              <text class="form-trip-summary-id">id: {{ trip.id }}</text>
              <text class="form-trip-summary-title">{{ tripSummaryTitle }}</text>
              <text
                v-if="tripStatusBadge"
                class="form-trip-summary-badge"
                :class="`form-trip-summary-badge-${tripStatusBadgeClass}`"
              >{{ tripStatusBadge }}</text>
            </view>
          </view>

          <ErrorBanner
            v-if="formError"
            :message="formError"
            :retryable="false"
          />

          <!-- 8 字段表单(spec §3.4 + §4.1) -->
          <view class="form-fields">
            <!-- Field 1: 行程标题(title)* 可改 后端支持 -->
            <view class="form-field">
              <text class="form-field-label">
                {{ NewTripStrings.fieldTitle }}
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

            <!-- Field 2: 目的地(city) disabled 灰色 后端不支持 -->
            <view class="form-field">
              <text class="form-field-label">
                {{ NewTripStrings.fieldCity }}
              </text>
              <input
                v-model="formData.city"
                class="form-field-input form-field-input-disabled"
                :placeholder="NewTripStrings.placeholderCity"
                placeholder-class="form-field-input-placeholder"
                :disabled="true"
                :aria-disabled="true"
              />
            </view>

            <!-- Field 3: 出发日期(start_date) disabled 灰色 -->
            <view class="form-field">
              <text class="form-field-label">
                {{ NewTripStrings.fieldStartDate }}
              </text>
              <picker
                mode="date"
                :value="formData.start_date"
                :start="datePickerStart"
                :end="datePickerEnd"
                :disabled="true"
                @change="(e) => onDateChange('start_date', e)"
              >
                <view class="form-field-picker form-field-picker-disabled">
                  <text
                    class="form-field-picker-text"
                  >{{ formData.start_date }}</text>
                </view>
              </picker>
            </view>

            <!-- Field 4: 返回日期(end_date) disabled 灰色 -->
            <view class="form-field">
              <text class="form-field-label">
                {{ NewTripStrings.fieldEndDate }}
              </text>
              <picker
                mode="date"
                :value="formData.end_date"
                :start="formData.start_date || datePickerStart"
                :end="datePickerEnd"
                :disabled="true"
                @change="(e) => onDateChange('end_date', e)"
              >
                <view class="form-field-picker form-field-picker-disabled">
                  <text
                    class="form-field-picker-text"
                  >{{ formData.end_date }}</text>
                </view>
              </picker>
            </view>

            <!-- Field 5: 同行成员(companions)选填 client-only -->
            <view class="form-field">
              <text class="form-field-label">{{ NewTripStrings.fieldCompanions }}</text>
              <input
                v-model="formData.companions"
                class="form-field-input"
                :placeholder="NewTripStrings.placeholderCompanions"
                placeholder-class="form-field-input-placeholder"
              />
            </view>

            <!-- Field 6: 预算范围(budget_range)选填 client-only -->
            <view class="form-field">
              <text class="form-field-label">{{ NewTripStrings.fieldBudget }}</text>
              <input
                v-model="formData.budget_range"
                class="form-field-input"
                :placeholder="NewTripStrings.placeholderBudget"
                placeholder-class="form-field-input-placeholder"
              />
            </view>

            <!-- Field 6.5: 行程安排(itineraryArrange)UI-025 — 横向 scroll-view 拖动排序 -->
            <ItineraryArrangeField
              v-model="formData.itineraryArrange"
              :readonly="false"
            />

            <!-- Field 7: 交通偏好(transport_preference)选填 client-only radio chips -->
            <view class="form-field">
              <text class="form-field-label">{{ NewTripStrings.fieldTransport }}</text>
              <view class="chip-row">
                <view
                  v-for="opt in transportOptions"
                  :key="opt.value"
                  class="chip"
                  :class="{ 'chip-selected': formData.transport_preference === opt.value }"
                  role="button"
                  :aria-label="opt.label"
                  :aria-pressed="formData.transport_preference === opt.value"
                  hover-class="chip-hover"
                  :hover-stay-time="50"
                  @click="onTransportToggle(opt.value)"
                >
                  <text
                    class="chip-text"
                    :class="{ 'chip-text-selected': formData.transport_preference === opt.value }"
                  >{{ opt.label }}</text>
                </view>
              </view>
            </view>

            <!-- Field 8: 状态(status)* 可改 后端支持(3 chips) -->
            <view class="form-field">
              <text class="form-field-label">
                {{ strings.fieldStatus }}
                <text
                  v-if="formData.status === null"
                  class="required-mark"
                >*</text>
              </text>
              <view class="chip-row">
                <view
                  v-for="opt in statusOptions"
                  :key="opt.value"
                  class="chip"
                  :class="{ 'chip-selected': formData.status === opt.value }"
                  role="button"
                  :aria-label="opt.label"
                  :aria-pressed="formData.status === opt.value"
                  hover-class="chip-hover"
                  :hover-stay-time="50"
                  @click="onStatusSelect(opt.value)"
                >
                  <text
                    class="chip-text"
                    :class="{ 'chip-text-selected': formData.status === opt.value }"
                  >{{ opt.label }}</text>
                </view>
              </view>
            </view>
          </view>

          <view class="action-row">
            <view
              class="btn btn-cancel"
              role="button"
              :aria-label="strings.btnCancel"
              hover-class="btn-cancel-hover"
              :hover-stay-time="50"
              @click="onClose"
            >
              <text class="btn-cancel-text">{{ strings.btnCancel }}</text>
            </view>
            <view
              class="btn btn-save"
              role="button"
              :aria-label="strings.btnSave"
              :class="{ 'btn-save-disabled': !canSave }"
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
          v-else-if="currentStep === 'saving'"
          class="panel-center"
        >
          <view class="loading-spinner" aria-hidden="true" />
          <text class="panel-center-title">{{ strings.savingText }}</text>
        </view>

        <!-- ───────── success 态(瞬时 ≤ 200ms) ───────── -->
        <view
          v-else-if="currentStep === 'success'"
          class="panel-center"
        >
          <view class="completed-check" aria-hidden="true">✓</view>
          <text class="panel-center-title">{{ strings.successText }}</text>
        </view>

        <!-- ───────── notfound 态 ───────── -->
        <view
          v-else-if="currentStep === 'notfound'"
          class="panel-center"
        >
          <text class="notfound-emoji" aria-hidden="true">{{ strings.errorNotFoundEmoji }}</text>
          <text class="panel-center-title">{{ strings.errorNotFoundMessage }}</text>
          <view
            class="btn-retry"
            role="button"
            :aria-label="strings.errorNotFoundButton"
            hover-class="btn-retry-hover"
            :hover-stay-time="50"
            @click="onNotFoundAction"
          >
            <text class="btn-retry-text">{{ strings.errorNotFoundButton }}</text>
          </view>
        </view>

        <!-- ───────── error 态(GET / PUT 失败) ───────── -->
        <view
          v-else-if="currentStep === 'error'"
          class="panel-center"
        >
          <view class="error-icon" aria-hidden="true">⚠</view>
          <text class="panel-center-title error-message">{{ submitError }}</text>
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

    <!-- 草稿确认弹窗(取消时弹) -->
    <DraftConfirmDialog
      :visible="dialogVisible"
      :title="NewTripStrings.draftDialogTitle"
      :message="NewTripStrings.draftDialogMessage"
      :btn-save-label="NewTripStrings.draftSave"
      :btn-dont-save-label="NewTripStrings.draftDontSave"
      :btn-continue-label="NewTripStrings.draftContinue"
      @save="onDialogSave"
      @dont-save="onDialogDontSave"
      @continue="onDialogContinue"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  EditTripStrings,
  EditTripStatusOptions,
  NewTripStrings,
  NewTripTransportOptions,
  TripDetailStatusLabel,
  OnboardingStrings,
} from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import { logger } from '../../utils/logger.js'
import { useHomeStore } from '../../stores/homeStore.js'
import {
  getTripDetail,
  updateTrip,
  loadEditDraft,
  saveEditDraft,
  clearEditDraft,
} from '../../services/trips.js'
// UI-023:草稿补全 db 入口(读 db_trips 字段预填 EditTripFormData,per issues/UI/UI-023-draft-page-prefill.md §3)
import { getTrip } from '../../db/index.js'
import ErrorBanner from '../../components/ErrorBanner.vue'
import DraftConfirmDialog from './components/DraftConfirmDialog.vue'
// UI-025:行程安排字段(跨页反向 import NewTripPage 私有子组件,
// 沿 guide-result → photo-guide _ClearChatConfirmDialog 模式,spec §10 R-2 不复制决策)
import ItineraryArrangeField from '../new-trip/components/ItineraryArrangeField.vue'

const strings = EditTripStrings
const statusOptions = EditTripStatusOptions
const transportOptions = NewTripTransportOptions

// ─────────────── 类型定义(spec §4.1) ───────────────
/**
 * @typedef {import('../../api/types').Trip} Trip
 * @typedef {import('../../api/types').TripStatus} TripStatus
 * @typedef {import('../../api/types').ItineraryItem} ItineraryItem
 *
 * @typedef {'flight' | 'train' | 'car' | 'walk'} TransportPreference
 * @typedef {'less_walking' | 'with_children' | 'with_elderly' | 'accessible'} SpecialNeedItem
 *
 * @typedef {Object} EditTripFormData
 * @property {string} title               // 行程标题(必填,后端支持)
 * @property {string} city                // 目的地(不可改)
 * @property {string} start_date          // 出发日期 'YYYY-MM-DD'(不可改)
 * @property {string} end_date            // 返回日期 'YYYY-MM-DD'(不可改)
 * @property {string} companions          // 同行成员(选填,client-only)
 * @property {string} budget_range        // 预算范围(选填,client-only)
 * @property {TransportPreference | null} transport_preference  // 交通偏好(选填,client-only)
 * @property {SpecialNeedItem[]} special_needs                 // 特殊需求(选填,client-only)
 * @property {TripStatus | null} status                         // 状态(必填,后端支持)
 * @property {ItineraryItem[]} itineraryArrange                 // 行程安排(UI-025,选填,后端是否存未确定)
 *
 * @typedef {'loading' | 'editing' | 'saving' | 'success' | 'notfound' | 'error'} EditTripStep
 *   严格 6 枚举(spec §4.1 + §3.7)
 */

// ─────────────── 静态辅助函数 ───────────────

/**
 * 创建空的 EditTripFormData(spec §4.1 createEmpty)
 * @returns {EditTripFormData}
 */
function createEmptyFormData() {
  return {
    title: '',
    city: '',
    start_date: '',
    end_date: '',
    companions: '',
    budget_range: '',
    transport_preference: null,
    special_needs: [],
    status: null,
    itineraryArrange: [], // UI-025 新增,默认空数组
  }
}

/**
 * 从 GET 响应派生表单数据(spec §4.1 fromTrip)
 * - 4 选填字段因后端无回显置 '' / null / []
 * - status 预填 trip.status(若是 'deleted' 已被前置 notfound 拦截)
 * - UI-025:itineraryArrange 后端 GET 是否回显**未确定**(per spec §6.4.x PD-001),
 *   若 trip.itineraryArrange 存在则预填,否则空数组
 * @param {Trip & { itineraryArrange?: ItineraryItem[] }} trip
 * @returns {EditTripFormData}
 */
function formDataFromTrip(trip) {
  return {
    title: trip.title || '',
    city: trip.city || '',
    start_date: trip.start_date || '',
    end_date: trip.end_date || '',
    companions: '',
    budget_range: '',
    transport_preference: null,
    special_needs: [],
    // status 不含 'deleted'(已在前置 notfound 拦截)
    status: trip.status === 'deleted' ? null : trip.status,
    // UI-025:行程安排预填(后端无回显时 = 空数组)
    itineraryArrange: Array.isArray(trip.itineraryArrange)
      ? trip.itineraryArrange.map((it) => ({ ...it }))
      : [],
  }
}

/**
 * 将 ApiError 归一为友好提示(spec §6.1 Error 表 + §5.3)
 * @param {import('../../services/preferences.js').ApiError | Error | unknown} err
 * @returns {string}
 */
function mapErrorToMessage(err) {
  if (!err) return EditTripStrings.errorNetwork
  const e = /** @type {any} */ (err)
  // 400 / 4000 参数非法
  if (e.code === 4000 || e.statusCode === 400) {
    return EditTripStrings.errorBadRequest
  }
  // 5xx / 5000 服务端错误
  if (e.code === 5000 || (e.statusCode >= 500 && e.statusCode < 600)) {
    return EditTripStrings.errorServer
  }
  // 4001 / 404 资源不存在(GET → 当前若是 GET 错误,page 应已切 notfound;PUT 错误兜底)
  if (e.code === 4001 || e.statusCode === 404) {
    return EditTripStrings.errorFallback
  }
  // 网络断开 / 其它
  return EditTripStrings.errorNetwork
}

/**
 * 决定视图模式 — GET 之后(spec §5.5 decideViewModeAfterFetch)
 * @param {{ ok: true; trip: Trip } | { ok: false; err: any }} result
 * @returns {'editing' | 'notfound' | 'error'}
 */
function decideAfterFetch(result) {
  if (result.ok) {
    if (result.trip.status === 'deleted') return 'notfound'
    return 'editing'
  }
  const err = result.err
  const e = /** @type {any} */ (err)
  if (e?.code === 4001 || e?.statusCode === 404) return 'notfound'
  return 'error'
}

/**
 * 构造 PUT 请求体(spec §5.5 buildUpdateRequest)
 * 仅发 changed 字段,避免不必要的写入
 *
 * UI-025 扩展:itineraryArrange 是可选字段,仅当与 originalData 不同时携带;
 * 比较方式与 hasChanged 保持一致(ID 序列浅比较)
 *
 * @returns {{ title?: string, status?: TripStatus, itineraryArrange?: ItineraryItem[] }}
 */
function buildUpdateRequest() {
  /** @type {{ title?: string, status?: TripStatus, itineraryArrange?: ItineraryItem[] }} */
  const req = {}
  if (formData.value.title.trim() !== originalData.value.title.trim()) {
    req.title = formData.value.title.trim()
  }
  if (formData.value.status !== originalData.value.status) {
    req.status = formData.value.status
  }
  // UI-025:仅当 itineraryArrange ID 序列与 originalData 不同时携带
  const currentIds = formData.value.itineraryArrange.map((it) => it.id).join(',')
  const originalIds = originalData.value.itineraryArrange.map((it) => it.id).join(',')
  if (currentIds !== originalIds) {
    req.itineraryArrange = formData.value.itineraryArrange
  }
  return req
}

// ─────────────── Local State(spec §4.1) ───────────────

/** @type {import('vue').Ref<number | null>} URL ?tripId 解析结果 */
const tripId = ref(null)
/** @type {import('vue').Ref<EditTripStep>} 严格 6 枚举 */
const currentStep = ref('loading')
/** @type {import('vue').Ref<'edit' | 'draft'>} 入口模式(per issues/UI/UI-023-draft-page-prefill.md §步骤 2)
 *   - 'edit'  (默认): TripDetailPage BtnModify 进入,走 GET 拉远端
 *   - 'draft'       : HomePage 行程列表 status='draft' 进入,走 db_trips 读字段
 */
const mode = ref('edit')
/** @type {import('vue').Ref<Trip | null>} GET 响应原始数据 */
const trip = ref(null)
/** @type {import('vue').Ref<EditTripFormData>} 8 字段表单 */
const formData = ref(createEmptyFormData())
/** @type {import('vue').Ref<EditTripFormData>} 预填 snapshot,用于 diff 判定 */
const originalData = ref(createEmptyFormData())
/** @type {import('vue').Ref<string | null>} GET/PUT 失败的友好提示,驱动 _ErrorOverlay */
const submitError = ref(null)
/** @type {import('vue').Ref<string | null>} form 内部 2 必填校验失败提示 */
const formError = ref(null)
/** @type {import('vue').Ref<boolean>} 草稿弹窗可见 */
const dialogVisible = ref(false)
/** @type {import('vue').Ref<boolean>} 是否已自动恢复过该 trip 的本地草稿 */
const draftRestored = ref(false)

// ─────────────── Computed ───────────────

/** 表单是否有变化(决定取消时是否弹草稿) */
const hasChanged = computed(() => {
  return (
    formData.value.title.trim() !== originalData.value.title.trim()
    || formData.value.city !== originalData.value.city
    || formData.value.start_date !== originalData.value.start_date
    || formData.value.end_date !== originalData.value.end_date
    || formData.value.companions !== originalData.value.companions
    || formData.value.budget_range !== originalData.value.budget_range
    || formData.value.transport_preference !== originalData.value.transport_preference
    || formData.value.special_needs.join(',') !== originalData.value.special_needs.join(',')
    || formData.value.status !== originalData.value.status
    // UI-025:itineraryArrange 浅比较(数组 ID 序列比较,内部字段变化不感知,简化 MVP)
    || formData.value.itineraryArrange.map((it) => it.id).join(',')
      !== originalData.value.itineraryArrange.map((it) => it.id).join(',')
  )
})

/** city / dates 是否被改(spec §4.1 + §5.2 校验 2) */
const isCityOrDateChanged = computed(() => {
  return (
    formData.value.city !== originalData.value.city
    || formData.value.start_date !== originalData.value.start_date
    || formData.value.end_date !== originalData.value.end_date
  )
})

/** 2 必填是否都已填(title + status) */
const hasRequiredFields = computed(() => {
  return formData.value.title.trim() !== '' && formData.value.status !== null
})

/** 保存按钮可点判定:必填已填 + 非 saving 态 + city/dates 未变(后者为极端兜底) */
const canSave = computed(() => {
  if (currentStep.value !== 'editing') return false
  if (!hasRequiredFields.value) return false
  if (isCityOrDateChanged.value) return false
  return true
})

/** title 输入框 placeholder */
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

/** _FormHeader trip title 简称(> 12 字截断) */
const tripSummaryTitle = computed(() => {
  const t = trip.value?.title || ''
  if (t.length <= 12) return t
  return `${t.slice(0, 12)}…`
})

/** _FormHeader 副提示文案(per issues/UI/UI-023-draft-page-prefill.md §步骤 2)
 *   - 'edit'  模式:沿用原 `strings.formHint` 「点击底部「保存」即可生效;...」
 *   - 'draft' 模式:「继续编辑草稿「X」 · 首次创建于 Y」(per issue §4)
 *     - X = trip.title(草稿标题)
 *     - Y = trip.createdAt(优先) || trip.start_date(兜底)
 *
 * 7 字符串拼接规则(per NewTripStrings.formHintCopyPrefix/Suffix 模式 + R-2 不重复字面值):
 *   - formHintDraftPrefix + trip.title + formHintDraftMiddle + date + formHintDraftSuffix
 */
const formHintText = computed(() => {
  if (mode.value === 'draft' && trip.value) {
    const t = trip.value
    const dateStr = /** @type {any} */ (t).createdAt
      ? String(/** @type {any} */ (t).createdAt).slice(0, 10)
      : (t.start_date || '')
    return `${EditTripStrings.formHintDraftPrefix}${t.title || ''}${EditTripStrings.formHintDraftMiddle}${dateStr}${EditTripStrings.formHintDraftSuffix}`
  }
  return strings.formHint
})

/** _FormHeader 状态徽章文案:沿用 TripDetailStatusLabel 5 键 + currentSubStatus 派生 */
const tripStatusBadge = computed(() => {
  if (!trip.value) return ''
  const t = trip.value
  if (t.status === 'deleted') return ''
  // active × 日期交叉
  if (t.status === 'active') {
    const now = new Date()
    const start = new Date(t.start_date)
    const end = new Date(t.end_date)
    if (now < start) return TripDetailStatusLabel.upcoming
    if (now > end) return TripDetailStatusLabel.expired
    return TripDetailStatusLabel.inProgress
  }
  if (t.status === 'finished') return TripDetailStatusLabel.finished
  if (t.status === 'draft') return TripDetailStatusLabel.draft
  return ''
})

/** 状态徽章颜色 class(按 spec §3.1 TripDetailPage 配色矩阵) */
const tripStatusBadgeClass = computed(() => {
  if (!trip.value) return ''
  const t = trip.value
  if (t.status === 'active') {
    const now = new Date()
    const start = new Date(t.start_date)
    const end = new Date(t.end_date)
    if (now < start) return 'upcoming'
    if (now > end) return 'expired'
    return 'inProgress'
  }
  return t.status
})

// ─────────────── Store ───────────────
const homeStore = useHomeStore()

// ─────────────── Handlers ───────────────

/**
 * 草稿模式 fallback mock(per issues/UI/UI-023-draft-page-prefill.md §步骤 2)
 *
 * 当 db_trips 暂无该 tripId 时(理论上不会发生,因 initLocalDb 已 seed 5 条),
 * 用此 mock 兜底(形状基于 `api/mock/_seed.ts:184-202` seedTrip2 青岛)
 *
 * @type {import('../../api/types').Trip}
 */
const MOCK_DRAFT_TRIP = Object.freeze({
  id: 2,
  user_id: 1,
  title: '青岛两日周末',
  city: '青岛',
  start_date: '2026-08-15',
  end_date: '2026-08-16',
  status: 'draft',
  createdAt: '2026-06-02T00:00:00+08:00',
})

/**
 * 草稿模式加载数据(per issues/UI/UI-023-draft-page-prefill.md §步骤 2)
 *
 * 行为:
 *   1. 从 db_trips 读 trip(任务 2 Plan 1 已 seed 5 条)
 *   2. 缺失则 fallback 到 MOCK_DRAFT_TRIP(防御性兜底)
 *   3. 派生 formData + originalData + trip
 *   4. **不**调任何 API(per issue §步骤 2:草稿不拉远端)
 *
 * 出口:直接切 currentStep='editing'(不走 loading → editing,跳过 GET)
 *
 * @param {number} id
 */
function loadDraftModeData(id) {
  // 1. 优先从 db_trips 读
  let sourceTrip = getTrip(id)

  // 2. fallback 到 mock(防御性,理论上 db_trips 已有 seed)
  if (!sourceTrip) {
    sourceTrip = /** @type {any} */ (MOCK_DRAFT_TRIP)
    logger.warn('[EditTripPage] draft mode fallback to mock', { tripId: id })
  }

  // 3. 派生 formData + originalData
  const fd = formDataFromTrip(/** @type {Trip} */ (sourceTrip))
  formData.value = fd
  originalData.value = { ...fd }
  trip.value = /** @type {Trip} */ (sourceTrip)

  // 4. 直接进 editing(不显示 loading,per issue §步骤 2)
  currentStep.value = 'editing'
  logger.info('[EditTripPage] draft mode loaded', {
    tripId: id,
    title: sourceTrip.title,
    city: sourceTrip.city,
  })
}

/**
 * onLoad:解析 URL → 初始化 state → 检查草稿恢复 → 触发 fetchTripDetail / loadDraftModeData
 * spec §5.1 页面进入
 *
 * 草稿模式(per issues/UI/UI-023-draft-page-prefill.md §步骤 2):
 *   - ?mode=draft → 跳过 fetchTripDetail(草稿不一定有后端数据)
 *   - 从 db_trips[tripId] 读 formData → 直接 currentStep='editing'
 *   - fallback 到 MOCK_DRAFT_TRIP(防御性)
 *   - 顶部 hint 改走 formHintText computed(显示「继续编辑草稿「X」」)
 */
function onLoadPage(query) {
  const rawTripId = query?.tripId
  const parsed = Number(rawTripId)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    // URL 校验放第一步(AC-09 + §5.3.A)
    currentStep.value = 'notfound'
    logger.info('[EditTripPage] notfound, bad tripId', { rawTripId })
    return
  }
  tripId.value = parsed
  trip.value = null
  formData.value = createEmptyFormData()
  originalData.value = createEmptyFormData()
  currentStep.value = 'loading'
  submitError.value = null
  formError.value = null
  dialogVisible.value = false
  draftRestored.value = false

  // 解析 mode(per UI-023 §步骤 2)
  const rawMode = (query?.mode || 'edit').toString().toLowerCase()
  mode.value = rawMode === 'draft' ? 'draft' : 'edit'

  // 草稿恢复优先(spec §5.1 备注 + §5.3.H):在 GET 飞行中先同步恢复,避免覆盖
  // 草稿模式(draft 入口)**不**触发 editDraft 恢复 —— editDraft 是「用户曾在 edit 页保存过
  // 中间态」的语义,草稿模式直接走 db_trips seed(per UI-023 §步骤 2)
  if (mode.value !== 'draft') {
    const draft = loadEditDraft(parsed)
    if (draft) {
      formData.value = { ...createEmptyFormData(), ...draft.formData }
      originalData.value = { ...createEmptyFormData(), ...draft.formData }
      draftRestored.value = true
      logger.info('[EditTripPage] draft restored', { tripId: parsed, savedAt: draft.savedAt })
      uni.showToast({
        title: EditTripStrings.draftRestoredToast,
        icon: 'none',
        duration: 1200,
      })
    }
  }

  // 草稿模式:跳过 fetch,直接走 db_trips
  if (mode.value === 'draft') {
    loadDraftModeData(parsed)
    return
  }

  // 触发 fetch(edit 模式)
  fetchTripDetail()
}

/**
 * 调 getTripDetail,按响应结果切 currentStep
 */
async function fetchTripDetail() {
  if (tripId.value === null) return
  try {
    const res = await getTripDetail(/** @type {number} */ (tripId.value))
    const result = { ok: true, trip: res.data }
    handleFetchResult(result)
  } catch (err) {
    logger.error('[EditTripPage] fetch failed', err)
    const result = { ok: false, err }
    handleFetchResult(result)
  }
}

/**
 * 处理 fetch 结果(独立函数便于 test 注入)
 * @param {{ ok: true; trip: Trip } | { ok: false; err: any }} result
 */
function handleFetchResult(result) {
  const decision = decideAfterFetch(result)
  if (decision === 'notfound') {
    if (result.ok) {
      logger.info('[EditTripPage] notfound, trip deleted', { tripId: tripId.value })
    } else {
      const e = /** @type {any} */ (result.err)
      logger.info('[EditTripPage] notfound, trip 404', { tripId: tripId.value, code: e?.code, statusCode: e?.statusCode })
    }
    currentStep.value = 'notfound'
    submitError.value = null
    return
  }
  if (decision === 'error') {
    submitError.value = mapErrorToMessage(result.err)
    currentStep.value = 'error'
    return
  }
  // decision === 'editing'
  const t = /** @type {Trip} */ (result.trip)
  trip.value = t
  // 草稿恢复优先:若 draftRestored=true,GET 响应**不**覆盖 formData(避免覆盖用户已恢复的草稿,§5.3.H)
  if (!draftRestored.value) {
    const fd = formDataFromTrip(t)
    formData.value = fd
    originalData.value = { ...fd }
  }
  currentStep.value = 'editing'
  logger.info('[EditTripPage] fetch ok', { tripId: tripId.value, status: t.status })
}

/**
 * Header「✕」或底部「取消」:走草稿弹窗逻辑(spec §5.4)
 */
function onClose() {
  logger.info('[EditTripPage] cancel, hasChanged=' + hasChanged.value)
  if (!hasChanged.value) {
    // 无变化 → 直接退出
    navigateBack()
    return
  }
  dialogVisible.value = true
}

/**
 * notfound 态「返回首页」按钮 → uni.reLaunch AppRoutes.Home
 */
function onNotFoundAction() {
  logger.info('[EditTripPage] notfound, back to home', { tripId: tripId.value })
  uni.reLaunch({ url: AppRoutes.Home })
}

/**
 * error 态「重试」:根据 submitError 来源决定重试方向
 * - 当前实现:submitError 仅记录文案,无 source 字段;**默认**按 PUT 失败重试(若 formData 已就绪),
 *   否则按 GET 失败重试(formData 为空 / trip 未拉取)
 */
function onRetry() {
  logger.info('[EditTripPage] retry', { tripId: tripId.value })
  if (trip.value === null) {
    // GET 失败重试
    currentStep.value = 'loading'
    submitError.value = null
    fetchTripDetail()
  } else {
    // PUT 失败重试(formData 保留)
    doUpdate()
  }
}

/**
 * 「保存」按钮 → onSave 校验 → currentStep='saving' → PUT
 * spec §5.2 Step 2-3
 */
function onSave() {
  // 校验 1:必填
  if (!formData.value.title.trim() || !formData.value.status) {
    formError.value = EditTripStrings.errorRequired
    logger.warn('[EditTripPage] save blocked, missing required')
    return
  }
  // 校验 2:city / dates(极端兜底)
  if (isCityOrDateChanged.value) {
    uni.showToast({
      title: EditTripStrings.cityOrDateNotModifiableToast,
      icon: 'none',
      duration: 2000,
    })
    logger.warn('[EditTripPage] save blocked, city or dates changed', {
      city: { from: originalData.value.city, to: formData.value.city },
      start_date: { from: originalData.value.start_date, to: formData.value.start_date },
      end_date: { from: originalData.value.end_date, to: formData.value.end_date },
    })
    return
  }
  formError.value = null
  currentStep.value = 'saving'
  submitError.value = null
  logger.info('[EditTripPage] save start', {
    tripId: tripId.value,
    title: formData.value.title,
    status: formData.value.status,
    itineraryCount: formData.value.itineraryArrange.length, // UI-025 调试字段
  })
  doUpdate()
}

/**
 * 实际发起 PUT(spec §5.2 Step 3)
 */
async function doUpdate() {
  if (tripId.value === null) return
  currentStep.value = 'saving'
  const req = buildUpdateRequest()
  try {
    await updateTrip(/** @type {number} */ (tripId.value), req)
    currentStep.value = 'success'
    submitError.value = null
    logger.info('[EditTripPage] save ok', { tripId: tripId.value })
    // 200ms 后:刷新 HomePage 列表 + navigateBack(AC-05)
    setTimeout(() => {
      homeStore.fetchTrips()
        .catch((err) => {
          logger.warn('[EditTripPage] fetchTrips after save failed', err)
        })
        .finally(() => {
          // PUT 成功后清空该 tripId 的草稿(若存在)
          clearEditDraft(/** @type {number} */ (tripId.value))
          uni.navigateBack()
            .catch((err) => {
              logger.error('[EditTripPage] navigateBack failed', err)
            })
        })
    }, 200)
    // Toast 在 success 态显示前先发
    uni.showToast({
      title: EditTripStrings.saveSuccessToast,
      icon: 'success',
      duration: 1500,
    })
  } catch (err) {
    logger.error('[EditTripPage] save failed', err)
    submitError.value = mapErrorToMessage(err)
    currentStep.value = 'error'
  }
}

/**
 * _DraftConfirmDialog:保存草稿
 */
function onDialogSave() {
  if (tripId.value === null) return
  const draft = {
    tripId: tripId.value,
    savedAt: new Date().toISOString(),
    formData: { ...formData.value },
  }
  const ok = saveEditDraft(draft)
  dialogVisible.value = false
  if (ok) {
    logger.info('[EditTripPage] saveDraft ok', { tripId: tripId.value })
    uni.showToast({
      title: NewTripStrings.draftSavedToast,
      icon: 'success',
      duration: 1500,
    })
    setTimeout(() => {
      navigateBack()
    }, 1200)
  } else {
    // storage 写异常(spec §5.3.K)
    logger.warn('[EditTripPage] saveDraft failed, stay in editing')
    uni.showToast({
      title: NewTripStrings.draftSaveFailedToast,
      icon: 'none',
      duration: 1500,
    })
  }
}

/**
 * _DraftConfirmDialog:不保存
 */
function onDialogDontSave() {
  if (tripId.value !== null) {
    clearEditDraft(tripId.value)
  }
  logger.info('[EditTripPage] draft discarded', { tripId: tripId.value })
  dialogVisible.value = false
  navigateBack()
}

/**
 * _DraftConfirmDialog:继续编辑
 */
function onDialogContinue() {
  logger.info('[EditTripPage] cancel draft, continue edit')
  dialogVisible.value = false
}

/**
 * 统一的 navigateBack 封装:栈顶则 reLaunch Home(避免 navigateBack 失败)
 */
function navigateBack() {
  uni.navigateBack({
    delta: 1,
    fail: () => {
      uni.reLaunch({ url: AppRoutes.Home })
    },
  })
}

/**
 * date-picker change(spec §3.4 Field 3-4 不可改,disabled 阻止常规用户)
 * @param {'start_date' | 'end_date'} key
 * @param {UniApp.ChangeEvent} e
 */
function onDateChange(key, e) {
  // disabled 兜底:即便绕过 disabled 也走 isCityOrDateChanged 校验
  const v = e.detail.value
  if (typeof v === 'string' && v) {
    formData.value[key] = v
  }
}

/**
 * 交通偏好 radio 切换(spec §3.4 Field 7:4 选 1)
 * @param {TransportPreference} v
 */
function onTransportToggle(v) {
  formData.value.transport_preference =
    formData.value.transport_preference === v ? null : v
}

/**
 * 状态 chips 选择(spec §3.4 Field 8:3 选 1,必填)
 * @param {TripStatus} v
 */
function onStatusSelect(v) {
  formData.value.status = v
}

// ─────────────── Lifecycle ───────────────

/**
 * 从 uni-app 运行时拿当前页的 options(query 参数)
 * 优先用 onLoad(options) 钩子入参,fallback 用 getCurrentPages() 末项 options
 * (本工程未在 package.json 显式列 @dcloudio/uni-app,故 fallback 走 getCurrentPages,
 * 沿用 TripDetailPage / SpotDetailSheet 既有模式)
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
    logger.warn('[EditTripPage] getCurrentPages fail', err)
  }
  return undefined
}

onMounted(() => {
  const options = getCurrentPageOptions() || {}
  onLoadPage(options)
})

onUnmounted(() => {
  logger.debug('[EditTripPage] onUnmounted, currentStep=' + currentStep.value)
})
</script>

<style scoped>
.edittrip-page {
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

.header-close {
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

.header-close-hover {
  background: rgba(45, 106, 94, 0.06);
  /* primarySoft */
  transform: scale(0.96);
}

.header-close-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 40rpx;
  /* 20px,略小于「←」箭头以视觉对称 */
  color: #2C2C2C;
  /* ink */
  line-height: 1;
  margin-top: -2rpx;
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
  /* 与 header-close 同宽,保证标题居中 */
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

/* ───────── Center Panels(loading / saving / success / notfound / error) ───────── */
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

.notfound-emoji {
  font-size: 96rpx;
  line-height: 1;
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

.form-trip-summary {
  background: #F2EBE0;
  /* surfaceWarm */
  border-radius: 12px;
  /* radius-md */
  padding: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  box-sizing: border-box;
}

.form-trip-summary-id {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  /* 11px */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.4;
}

.form-trip-summary-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 32rpx;
  /* 16px */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-trip-summary-badge {
  align-self: flex-start;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  /* 11px */
  font-weight: 500;
  padding: 2rpx 12rpx;
  border-radius: 9999px;
  line-height: 1.5;
  margin-top: 4rpx;
  box-sizing: border-box;
}

.form-trip-summary-badge-inProgress {
  background: rgba(45, 106, 94, 0.12);
  /* primarySoftStrong */
  color: #2D6A5E;
  /* primary */
}

.form-trip-summary-badge-upcoming {
  background: rgba(216, 208, 196, 0.4);
  color: #5A5A5A;
  /* inkLight */
}

.form-trip-summary-badge-expired,
.form-trip-summary-badge-finished {
  background: rgba(154, 154, 154, 0.15);
  color: #9A9A9A;
  /* inkMuted */
}

.form-trip-summary-badge-draft {
  background: rgba(212, 160, 58, 0.15);
  color: #D4A03A;
  /* warning */
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

.form-field-input-disabled {
  background: #E8E0D4;
  /* divider */
  color: #9A9A9A;
  /* inkMuted */
  border-color: transparent;
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

.form-field-picker-disabled {
  background: #E8E0D4;
  /* divider */
  border-color: transparent;
}

.form-field-picker-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.form-field-picker-disabled .form-field-picker-text {
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

/* 主按钮:保存 */
.btn-save {
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
  /* Primary 渐变,见 UI §八 */
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
  /* primaryShadow */
}

.btn-save-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.btn-save-disabled {
  opacity: 0.5;
  pointer-events: none;
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

/* ───────── H5 ≥1024px 大屏居中(spec §3.8 + §10 NFR) ───────── */
@media (min-width: 1024px) {
  .body-inner {
    max-width: 640rpx;
    margin: 0 auto;
  }
}
</style>
