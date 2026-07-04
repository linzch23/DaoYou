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
          </view>

          <ErrorBanner
            v-if="formError"
            :message="formError"
            :retryable="false"
          />

          <!-- 4 字段表单(spec §3.4 + §4.1,v0.5.0 per user-round3-2026-06-26 草稿支持改时间:
   加回 start_date / end_date 2 字段;v0.4.0 TripCreateEditFix-001 移除 6 字段:
   city / companions / budget_range / transport_preference / status 共 5 块;
   保留 title + start_date + end_date + itineraryArrange) -->
          <view class="form-fields">
            <!-- Field 1: 行程标题(title)* 必填 可改 后端支持 -->
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

            <!-- v0.5.0(per user-round3-2026-06-26 草稿支持改时间)加回 start_date / end_date 字段
                 (原 v0.4.0 移除,user 实测需要) -->
            <!-- Field 2: 出发日期(start_date) 可改 后端支持 -->
            <view class="form-field">
              <text class="form-field-label">{{ NewTripStrings.fieldStartDate }}</text>
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
                  >{{ formData.start_date || NewTripStrings.placeholderStartDate }}</text>
                </view>
              </picker>
            </view>

            <!-- Field 3: 返回日期(end_date) 可改 后端支持(end date 受 start_date 联动约束) -->
            <view class="form-field">
              <text class="form-field-label">{{ NewTripStrings.fieldEndDate }}</text>
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
                  >{{ formData.end_date || NewTripStrings.placeholderEndDate }}</text>
                </view>
              </picker>
            </view>

            <!-- Field 4: 行程安排(itineraryArrange)UI-025 — 横向 scroll-view 拖动排序 + 每条需 date + start_time + end_time
                 v0.5.0(2026-06-25 per UserRound2-001 Bug A):接 item CRUD 事件
                 - @add    → onAddItem    POST /api/trip-items
                 - @update-item → onUpdateItem PUT /api/trip-items/{id}
                 - @remove → onRemoveItem DELETE /api/trip-items/{id}
                 v-model 仍走 update:modelValue 同步 formData；拖动 update 事件仅用于本地排序
            -->
            <ItineraryArrangeField
              v-model="formData.itineraryArrange"
              :readonly="false"
              @add="onAddItem"
              @update-item="onUpdateItem"
              @remove="onRemoveItem"
            />
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
import { ref, computed, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  EditTripStrings,
  NewTripStrings,
  OnboardingStrings,
} from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import { logger } from '../../utils/logger.js'
import { getTripItemErrorMessage } from '../../services/tripItemForm.js'
import { useHomeStore } from '../../stores/homeStore.js'
import {
  getTripDetail,
  updateTrip,
  loadEditDraft,
  saveEditDraft,
  clearEditDraft,
  // v0.5.0(2026-06-25 per UserRound2-001 Bug A):行程 item CRUD 3 函数
  //   - createTripItem  / updateTripItem / deleteTripItem
  //   - 沿 trips.js v0.5.0 模式(HTTP 优先 → 失败降级 mock)
  //   - 由 EditTripPage onAddItem / onUpdateItem / onRemoveItem 调用
  createTripItem,
  updateTripItem,
  deleteTripItem,
  // createTripDay 兜底:item.date 对应的 trip_day 在 trip.days[] 不存在时动态创建
  //   (per issue §1.3.2 onAddItem 决策 + 既有 trips.js v0.4.0 模式)
  createTripDay,
} from '../../services/trips.js'
// UI-023:草稿补全 db 入口(读 db_trips 字段预填 EditTripFormData,per issues/UI/UI-023-draft-page-prefill.md §3)
import { getTrip } from '../../db/index.js'
import ErrorBanner from '../../components/ErrorBanner.vue'
import DraftConfirmDialog from './components/DraftConfirmDialog.vue'
// UI-025:行程安排字段(跨页反向 import NewTripPage 私有子组件,
// 沿 guide-result → photo-guide 私有 dialog 模式,spec §10 R-2 不复制决策)
import ItineraryArrangeField from '../new-trip/components/ItineraryArrangeField.vue'

const strings = EditTripStrings

// ─────────────── 类型定义(spec §4.1) ───────────────
/**
 * @typedef {import('../../api/types').Trip} Trip
 * @typedef {import('../../api/types').ItineraryItem} ItineraryItem
 *
 * v0.5.0(per user-round3-2026-06-26 草稿支持改时间):加回 start_date / end_date 字段。
 *   v0.4.0(TripCreateEditFix-001 2026-06-24):移除 city / start_date / end_date /
 *     companions / budget_range / transport_preference / status 7 字段。保留 2 字段:
 *     title + itineraryArrange。
 *
 * @typedef {Object} EditTripFormData
 * @property {string} title                                          // 行程标题(必填,后端支持)
 * @property {string} start_date                                    // 出发日期(可改,v0.5.0 加回)
 * @property {string} end_date                                      // 返回日期(可改,v0.5.0 加回)
 * @property {ItineraryItem[]} itineraryArrange                      // 行程安排(UI-025,选填)
 *
 * @typedef {'loading' | 'editing' | 'saving' | 'success' | 'notfound' | 'error'} EditTripStep
 *   严格 6 枚举(spec §4.1 + §3.7)
 */

// ─────────────── 静态辅助函数 ───────────────

/**
 * 创建空的 EditTripFormData(spec §4.1 createEmpty,v0.5.0 4 字段)
 * @returns {EditTripFormData}
 */
function createEmptyFormData() {
  return {
    title: '',
    start_date: '',  // v0.5.0 加回,YYYY-MM-DD 字符串
    end_date: '',    // v0.5.0 加回,YYYY-MM-DD 字符串
    itineraryArrange: [], // UI-025 默认空数组
  }
}

/**
 * 从 GET 响应派生表单数据(spec §4.1 fromTrip,v0.5.0 加回 start_date / end_date)
 *
 * v0.5.0(per user-round3-2026-06-26 草稿支持改时间):加回 start_date / end_date 字段派生。
 *
 * v0.4.0(TripCreateEditFix-001):
 *   - 移除 city / dates / status / 4 选填字段派生(7 字段 UI 移除)
 *   - itineraryArrange **从 trip.days[].items[] 派生**(原 trip.itineraryArrange 不存在)
 *   - 每个 TripItem(后端)投影为 ItineraryItem(前端),date 从 day.trip_date 拿
 *
 * @param {Trip} trip
 * @returns {EditTripFormData}
 */
function formDataFromTrip(trip) {
  // itineraryArrange 派生:从 trip.days[].items[] 投影
  /** @type {ItineraryItem[]} */
  const itineraryArrange = []
  if (Array.isArray(trip.days)) {
    for (const day of trip.days) {
      if (!Array.isArray(day.items)) continue
      for (const item of day.items) {
        itineraryArrange.push({
          id: item.id,
          date: day.trip_date, // 关键:从 trip_day 拿 date
          city: item.city || '',
          title: item.title,
          start_time: item.start_time || '',
          end_time: item.end_time || '',
          item_type: item.item_type || 'other',
        })
      }
    }
  }
  return {
    title: trip.title || '',
    start_date: trip.start_date || '',  // v0.5.0 加回
    end_date: trip.end_date || '',      // v0.5.0 加回
    itineraryArrange,
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
 * 构造 PUT 请求体(spec §5.5 buildUpdateRequest,v0.5.0 简化)
 * 仅发 changed 字段,避免不必要的写入
 *
 * v0.5.0(2026-06-26 per user-round3-2026-06-26 草稿支持改时间):**加回** start_date / end_date 字段。
 *   后端 UpdateTripRequest 2026-06-26 v0.5.0 扩展(per `backend/app/schemas/trips.py:20-32`):
 *     `user_id, title?, status?, start_date?, end_date?`
 *
 * v0.7.0(per fix-trip-status-v0.7.0 2026-07-03 + issues/Cross-Page/TripStatusConsistent-001 §2.4):
 *   **加回** `status?: TripStatus` 字段(v0.4.0 移除,本次按 user Q1 决策 C 方案重新启用)
 *   **仅在隐式发布路径下发**:草稿 trip 满足「完整字段 + ≥1 item」时,doUpdate 自动附 status='active'
 *   后端 Pydantic UpdateTripRequest 已支持 status(per backend v0.5.0);前端 PUT 透传实测 200 OK
 *   不发 status 时,**不**主动发 'finished' 或 强切 'draft'(沿 v0.4.0 TripCreateEditFix-001 决策)
 *
 * v0.5.0(2026-06-25 per UserRound2-001 Bug A):**移除** itineraryArrange 字段,
 *   item CRUD 走独立 3 handler(onAddItem / onUpdateItem / onRemoveItem)
 *   + 独立 service 函数(createTripItem / updateTripItem / deleteTripItem)。
 *
 * v0.4.0(TripCreateEditFix-001):移除 status 字段(后端 UpdateTripRequest 不接收,
 *   spec §3.4 Field 8 移除),仅发 title? + itineraryArrange?。
 *
 * @returns {{ title?: string, start_date?: string, end_date?: string, status?: import('../../api/types').TripStatus }}
 *   status 默认 undefined;**只**在 doUpdate 隐式发布分支被注入
 */
function buildUpdateRequest() {
  /** @type {{ title?: string, start_date?: string, end_date?: string, status?: import('../../api/types').TripStatus }} */
  const req = {}
  if (formData.value.title.trim() !== originalData.value.title.trim()) {
    req.title = formData.value.title.trim()
  }
  // v0.5.0(per user-round3-2026-06-26)加回 start_date / end_date 字段(per spec §3.4)
  if (formData.value.start_date && formData.value.start_date !== originalData.value.start_date) {
    req.start_date = formData.value.start_date
  }
  if (formData.value.end_date && formData.value.end_date !== originalData.value.end_date) {
    req.end_date = formData.value.end_date
  }
  // 注:status 字段在此函数**不**主动设置;由 doUpdate 在隐式发布分支注入
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

/** 表单是否有变化(决定取消时是否弹草稿,v0.5.0:title + start_date + end_date + itineraryArrange) */
const hasChanged = computed(() => {
  return (
    formData.value.title.trim() !== originalData.value.title.trim()
    // v0.5.0(per user-round3-2026-06-26)加回 start_date / end_date 浅比较
    || formData.value.start_date !== originalData.value.start_date
    || formData.value.end_date !== originalData.value.end_date
    // UI-025:itineraryArrange 浅比较(数组 ID 序列比较,内部字段变化不感知,简化 MVP)
    || formData.value.itineraryArrange.map((it) => it.id).join(',')
      !== originalData.value.itineraryArrange.map((it) => it.id).join(',')
  )
})

/** v0.4.0(TripCreateEditFix-001):city / dates UI 字段移除,本 computed 永远 false 保留为 stub */
const isCityOrDateChanged = computed(() => false)

/** 1 必填是否都已填(v0.4.0:仅 title,移除 status 必填) */
const hasRequiredFields = computed(() => {
  return formData.value.title.trim() !== ''
})

/** 保存按钮可点判定(v0.4.0 简化:editing 态 + title 非空,移除 isCityOrDateChanged 校验) */
const canSave = computed(() => {
  if (currentStep.value !== 'editing') return false
  if (!hasRequiredFields.value) return false
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

/** _FormHeader 副提示文案(per issues/UI/UI-023-draft-page-prefill.md §步骤 2)
 *   - 'edit'  模式:沿用原 `strings.formHint` 「点击底部「保存」即可生效;...」
 *   - 'draft' 模式:「继续编辑草稿「X」 · 首次创建于 Y」(per issue §4)
 *     - X = trip.title(草稿标题)
 *     - Y = trip.createdAt(优先) || trip.start_date(兜底)
 *
 * 7 字符串拼接规则(per NewTripStrings.formHintCopyPrefix/Suffix 模式 + R-2 不重复字面值):
 *   - formHintDraftPrefix + trip.title + formHintDraftMiddle + date + formHintDraftSuffix
 *
 * v0.4.0(TripCreateEditFix-001):formHintDraftXxx 已移除(简化 hint 走 EditTripStrings.formHint);
 *  本 computed 简化为单一 fallback,保留 draft mode 字面 hint 以兼容历史 draft tripId。
 */
const formHintText = computed(() => {
  if (mode.value === 'draft' && trip.value) {
    const t = trip.value
    const dateStr = (/** @type {any} */ (t).createdAt
      ? String(/** @type {any} */ (t).createdAt).slice(0, 10)
      : (t.start_date || '')) || ''
    return `继续编辑草稿「${t.title || ''}」 · 首次创建于 ${dateStr}`
  }
  return strings.formHint
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
 * v0.5.0(per user-round3-2026-06-26 草稿支持改时间):加回 start_date / end_date 字段
 *
 * v0.4.0(TripCreateEditFix-001):移除 city / start_date / end_date / status(已删字段);保留 title + status + days(空)
 *
 * @type {import('../../api/types').Trip}
 */
const MOCK_DRAFT_TRIP = Object.freeze({
  id: 2,
  user_id: 1,
  title: '青岛两日周末',
  status: 'draft',
  start_date: '2026-07-04',  // v0.5.0 加回,date 字符串
  end_date: '2026-07-05',    // v0.5.0 加回,date 字符串
  days: [],
  createdAt: '2026-06-02T00:00:00+08:00',
})

/**
 * 草稿模式加载数据(per issues/UI/UI-023-draft-page-prefill.md §步骤 2)
 *
 * v0.5.0(per user-round3-2026-06-26 子 bug A 修复):草稿模式也调 getTripDetail 拉真实 days。
 *   原 v0.4.0 仅从 db_trips 读,db_trips 不含 days 字段(per `src/db/_seed.js:73-83`),
 *   导致 `ensureTripDayForDate` 调用 createTripDay 兜底时,后端 seed L201-203 已有
 *   day_index=1 → 4000「行程日序号或日期已存在」,即使用户 item.date 在 [start_date, end_date] 范围内
 *   也显示「添加失败」。
 *   现路径:先 GET 拉真实 trip(含 days[].items[]),失败 fallback 到 db_trips / MOCK_DRAFT_TRIP。
 *
 * 行为:
 *   1. **先** 尝试 `getTripDetail` 拉真实 trip(含 days[].items[] 全量)
 *   2. 后端 404 / 网络断 → fallback 到 db_trips 本地(防御性,真后端 404 时不至于 notfound)
 *   3. db_trips 也无 → fallback 到 MOCK_DRAFT_TRIP(理论上 db_trips 已有 seed)
 *   4. 派生 formData + originalData + trip
 *
 * 出口:直接切 currentStep='editing'(不走 loading → editing,跳过 GET)
 *
 * @param {number} id
 */
async function loadDraftModeData(id) {
  // 1. v0.5.0(per user-round3-2026-06-26 子 bug A 修复):先尝试从后端拉真实 trip
  //    这是修复子 bug A 的关键:草稿 mode 也走 GET,保证 trip.value.days 是真实数据
  let sourceTrip = null
  try {
    const res = await getTripDetail(id)
    sourceTrip = res.data
    logger.info('[EditTripPage] draft mode loaded from backend', {
      tripId: id,
      status: sourceTrip.status,
      days: sourceTrip.days?.length ?? 0,
    })
  } catch (err) {
    // 后端 404 / 网络断 → fallback 到 db_trips 本地
    logger.warn('[EditTripPage] draft mode getTripDetail failed, fallback to db_trips', {
      tripId: id,
      err: err?.message,
    })
    sourceTrip = getTrip(id)
    if (!sourceTrip) {
      sourceTrip = /** @type {any} */ (MOCK_DRAFT_TRIP)
      logger.warn('[EditTripPage] draft mode fallback to MOCK_DRAFT_TRIP', { tripId: id })
    }
  }

  // 2. 派生 formData + originalData + trip
  const fd = formDataFromTrip(/** @type {Trip} */ (sourceTrip))
  formData.value = fd
  originalData.value = { ...fd }
  trip.value = /** @type {Trip} */ (sourceTrip)

  // 3. 直接进 editing(不显示 loading,per issue §步骤 2)
  currentStep.value = 'editing'
  logger.info('[EditTripPage] draft mode loaded', {
    tripId: id,
    title: sourceTrip.title,
    start_date: sourceTrip.start_date,
    end_date: sourceTrip.end_date,
    days: sourceTrip.days?.length ?? 0,
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

  // 草稿模式:跳过 fetch,直接走 db_trips(v0.5.0 loadDraftModeData async,内部已 await getTripDetail)
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
 *
 * v0.4.0(TripCreateEditFix-001):
 *   - 校验 1:仅 title 非空(v0.4.0 移除 status 必填)
 *   - 移除校验 2:city / dates(UI 字段已移除,无需极端兜底)
 */
function onSave() {
  // 校验 1:必填(title)
  if (!formData.value.title.trim()) {
    formError.value = EditTripStrings.errorRequired
    logger.warn('[EditTripPage] save blocked, missing required (title)')
    return
  }
  formError.value = null
  currentStep.value = 'saving'
  submitError.value = null
  logger.info('[EditTripPage] save start', {
    tripId: tripId.value,
    title: formData.value.title,
    itineraryCount: formData.value.itineraryArrange.length, // UI-025 调试字段
  })
  doUpdate()
}

/**
 * 实际发起 PUT(spec §5.2 Step 3)
 *
 * v0.7.0 修订(per fix-trip-status-v0.7.0 2026-07-03 + issues/Cross-Page/TripStatusConsistent-001 §2.4):
 *   **隐式发布** 草稿 → active 升级:
 *     - 触发条件:trip 当前 status='draft' + 完整字段(title + start_date + end_date 都非空) + ≥1 item
 *     - 行为:req.status = 'active'(隐式发布,不需要 user 显式「发布」按钮)
 *     - 失败处理:整个 PUT 失败,currentStep='error',与既有错误处理一致
 *     - 不发 status 时,**不**主动发 'finished' 或 强切 'draft'(沿 v0.4.0 决策)
 *   这是 user 2026-07-03 12:39 Q1 决策 C 方案(完整字段 + ≥1 item 自动升级 active)
 */
async function doUpdate() {
  if (tripId.value === null) return
  currentStep.value = 'saving'
  const req = buildUpdateRequest()

  // v0.7.0 隐式发布判定(per user 2026-07-03 Q1 决策 C 方案):
  // 草稿 trip 在满足「完整字段 + 至少 1 item」时,保存时自动升级为 active
  // 不需要 user 显式「发布」按钮,降低 MVP 阶段操作成本
  const isDraftBeingPromoted = trip.value?.status === 'draft'
    && formData.value.title.trim() !== ''
    && formData.value.start_date !== ''
    && formData.value.end_date !== ''
    && formData.value.itineraryArrange.length > 0
  if (isDraftBeingPromoted) {
    req.status = 'active'
    logger.info('[EditTripPage] implicit publish draft → active', { tripId: tripId.value })
  }

  try {
    await updateTrip(/** @type {number} */ (tripId.value), req)
    currentStep.value = 'success'
    submitError.value = null
    logger.info('[EditTripPage] save ok', { tripId: tripId.value, statusAfter: req.status || trip.value?.status })
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

// ─────────────── 行程 item CRUD handlers(v0.5.0 per UserRound2-001 Bug A)───────────────
//
// 三 handler 各自独立调 service,不进 doUpdate 流程(避免 PUT /api/trips 走
// 整套 saving → success / error 状态机);失败仅 Toast + logger.error,
// 保持 currentStep='editing' 不变(用户可继续操作)。
//
// MVP 简化(per issue §1.3.2 决策):
//   - 乐观更新:addItem 不等 server 返 server-id 直接入 arr(client-id),server 返后 splice 替换
//   - 失败回滚:removeItem 先本地 splice,DELETE 失败 splice 回原位
//   - 拖动 reorder:不调 API(后端无 reorder 端点),仅本地展示顺序变化
//   - update item:仅 title / item_type / start_time / end_time 4 字段,其他字段不传

/**
 * 派生 item.date 对应的 trip_day_id
 *
 * MVP 简化(per issue §1.3.2 决策):
 *   1) 优先从 `trip.value.days[]` 找 day.trip_date === date 的 day;找到 → 用现成 id
 *   2) 找不到 → 动态调 createTripDay 创建(POST /api/trips/{tripId}/days)
 *      dayIndex = days.length + 1(从 1 开始,后端约定)
 *   3) 注:`trip.value` 在 formDataFromTrip / handleFetchResult 已塞好,保证 days[] 非空
 *      (新 trip 后端响应会返回空 days[] 时,首次 ensureTripDayForDate 走 createTripDay 兜底)
 *
 * @param {string} date 'YYYY-MM-DD'
 * @returns {Promise<number>} trip_day_id
 */
async function ensureTripDayForDate(date) {
  // 1) 优先从 trip.value.days[] 找
  const existing = trip.value?.days?.find((d) => d.trip_date === date)
  if (existing) {
    logger.debug('[EditTripPage] ensureTripDayForDate hit', { date, tripDayId: existing.id })
    return existing.id
  }
  // 2) 兜底:动态创建 trip_day
  if (!trip.value || trip.value.id == null) {
    logger.error('[EditTripPage] ensureTripDayForDate no trip context', { date })
    throw new Error('trip context missing, cannot ensureTripDayForDate')
  }
  const dayIndex = (trip.value.days?.length || 0) + 1
  logger.info('[EditTripPage] ensureTripDayForDate creating', { date, dayIndex, tripId: trip.value.id })
  const res = await createTripDay(trip.value.id, { day_index: dayIndex, trip_date: date })
  // 同步 push 到 trip.days[] 缓存(避免下次 add 又走 createTripDay)
  if (trip.value.days) {
    trip.value.days.push({
      id: res.data.trip_day_id,
      trip_id: trip.value.id,
      day_index: dayIndex,
      trip_date: date,
      summary: '',
      items: [],
    })
  }
  return res.data.trip_day_id
}

/**
 * 新增 item → POST /api/trip-items
 *
 * 流程(per issue §1.3.2 onAddItem 决策):
 *   1) ensureTripDayForDate 派生 / 兜底 trip_day_id
 *   2) await createTripItem;成功 → 把 server-id splice 回 formData.itineraryArrange 替换 client-id
 *   3) 失败 → Toast「新增失败」+ logger.error
 *
 * 重要:ItineraryArrangeField 已通过 v-model 乐观加本地(client-id),
 * handler 收到时 formData 已含 client-id 行;成功 splice 替换 server-id 行,失败由用户
 * 自行重试(不自动回滚,避免误删;失败行可继续在 UI 上编辑 / 删除)。
 *
 * @param {ItineraryItem} newItem 含 client-id 的新 item
 */
async function onAddItem(newItem) {
  if (!newItem || !newItem.date) {
    logger.warn('[EditTripPage] onAddItem blocked, newItem missing date', { newItem })
    return
  }
  logger.info('[EditTripPage] addItem start', { title: newItem.title, date: newItem.date, clientId: newItem.id })
  try {
    const tripDayId = await ensureTripDayForDate(newItem.date)
    const res = await createTripItem({
      trip_day_id: tripDayId,
      city: newItem.city,
      title: newItem.title,
      item_type: newItem.item_type || 'attraction',
      start_time: newItem.start_time || '',
      end_time: newItem.end_time || '',
    })
    // splice 替换 client-id 行 → server-id 行
    const idx = formData.value.itineraryArrange.findIndex((it) => it.id === newItem.id)
    if (idx >= 0) {
      formData.value.itineraryArrange.splice(idx, 1, {
        ...newItem,
        id: res.data.item_id,
        tripDayId,
      })
    } else {
      // 防御:如果 v-model 数组已被外部修改找不到 client-id 行 → push 兜底
      formData.value.itineraryArrange.push({ ...newItem, id: res.data.item_id, tripDayId })
    }
    uni.showToast({ title: EditTripStrings.itemAddedToast, icon: 'success', duration: 1500 })
    logger.info('[EditTripPage] addItem ok', { itemId: res.data.item_id, title: newItem.title })
  } catch (err) {
    logger.error('[EditTripPage] addItem failed', err)
    uni.showToast({
      title: getTripItemErrorMessage(err, EditTripStrings.itemAddFailToast),
      icon: 'none',
      duration: 3000,
    })
  }
}

/**
 * 更新 item → PUT /api/trip-items/{id}
 *
 * 流程(per issue §1.3.2 onUpdateItem 决策):
 *   1) 校验 idx 指向 item 有 server id(client-id 不允许 PUT,因后端无对应记录)
 *   2) await updateTripItem;成功 → 替换 formData.itineraryArrange[idx]
 *   3) 失败 → Toast「更新失败」+ logger.error(formData 保留客户端版本,用户可重试)
 *
 * @param {ItineraryItem} updatedItem 新内容
 */
async function onUpdateItem(updatedItem) {
  if (!updatedItem || !updatedItem.id) {
    logger.warn('[EditTripPage] updateItem blocked, item has no server id (new item not yet saved)')
    return
  }
  const idx = formData.value.itineraryArrange.findIndex((item) => item.id === updatedItem.id)
  if (idx < 0) {
    logger.warn('[EditTripPage] updateItem blocked, item not found', { id: updatedItem.id })
    return
  }
  logger.info('[EditTripPage] updateItem start', { idx, id: updatedItem.id, title: updatedItem.title })
  try {
    await updateTripItem(updatedItem.id, {
      city: updatedItem.city,
      title: updatedItem.title,
      item_type: updatedItem.item_type || 'attraction',
      start_time: updatedItem.start_time || '',
      end_time: updatedItem.end_time || '',
    })
    const currentIdx = formData.value.itineraryArrange.findIndex(
      (item) => item.id === updatedItem.id,
    )
    if (currentIdx >= 0) {
      formData.value.itineraryArrange.splice(currentIdx, 1, updatedItem)
    }
    uni.showToast({ title: EditTripStrings.itemUpdatedToast, icon: 'success', duration: 1500 })
    logger.info('[EditTripPage] updateItem ok', { id: updatedItem.id })
  } catch (err) {
    logger.error('[EditTripPage] updateItem failed', err)
    uni.showToast({
      title: getTripItemErrorMessage(err, EditTripStrings.itemUpdateFailToast),
      icon: 'none',
      duration: 3000,
    })
  }
}

/**
 * 删除 item → DELETE /api/trip-items/{id}
 *
 * 流程(per UserRound2-001 §1.3.2 + UserRound2-002 Bug C 修复):
 *   0) 2026-06-25 v0.5.1(per UserRound2-002 Bug C)修复:ItineraryArrangeField emit 顺序固定
 *      emit('remove', id) **先** + v-model splice **后** → 本 handler 收到事件时
 *      formData.itineraryArrange 还含 id(idx 有效,findIndex 不会 -1)
 *   1) 校验 idx(防御:handler 极端 race / 重复触发)
 *   2) item 有 server id → await deleteTripItem;成功 → Toast「已删除」
 *      失败 → Toast「删除失败」(**不**回滚 — v-model splice 已在父级发生,回滚会与 v-model 重复)
 *   3) item 无 server id(client-id,未 POST 过)→ 仅本地操作,无 API 调用
 *
 * @param {number} id 待删 item 的 id(client-id 或 server-id 都可能)
 */
async function onRemoveItem(id) {
  const idx = formData.value.itineraryArrange.findIndex((it) => it.id === id)
  if (idx < 0) {
    logger.warn('[EditTripPage] removeItem blocked, id not found', { id })
    return
  }
  const removed = formData.value.itineraryArrange[idx]
  if (!removed.id) {
    // client-id,未保存过 → 无 API 调用,纯本地操作(ItineraryArrangeField 已 splice)
    logger.info('[EditTripPage] removeItem local-only (no server id)', { title: removed.title })
    return
  }
  logger.info('[EditTripPage] removeItem start', { id, title: removed.title })
  try {
    await deleteTripItem(removed.id)
    uni.showToast({ title: EditTripStrings.itemDeletedToast, icon: 'success', duration: 1500 })
    logger.info('[EditTripPage] removeItem ok', { id: removed.id })
  } catch (err) {
    logger.error('[EditTripPage] removeItem failed', err)
    uni.showToast({ title: EditTripStrings.itemDeleteFailToast, icon: 'none', duration: 1500 })
    // 不回滚(用户主动删,失败由用户重试;若失败回滚会与 ItineraryArrangeField v-model splice 重复)
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
 * date-picker change(spec §3.4 Field 3-4,可改 v0.5.0 加回)
 * @param {'start_date' | 'end_date'} key
 * @param {UniApp.ChangeEvent} e
 *
 * v0.5.0(per user-round3-2026-06-26 草稿支持改时间):date picker UI 字段加回,
 *   恢复真逻辑(原 v0.4.0 是 no-op stub)
 */
function onDateChange(key, e) {
  // v0.5.0(per user-round3-2026-06-26)恢复真逻辑
  const v = e.detail.value
  if (typeof v === 'string' && v) {
    formData.value[key] = v
  }
}

/**
 * 交通偏好 radio 切换(spec §3.4 Field 7:4 选 1)
 *
 * v0.4.0(TripCreateEditFix-001):UI 字段已移除,本函数保留为 no-op stub
 * @param {TransportPreference} v
 */
function onTransportToggle(v) {
  // no-op(v0.4.0 UI 移除)
}

/**
 * 状态 chips 选择(spec §3.4 Field 8:3 选 1,必填)
 *
 * v0.4.0(TripCreateEditFix-001):UI 字段已移除,本函数保留为 no-op stub
 * @param {TripStatus} v
 */
function onStatusSelect(v) {
  // no-op(v0.4.0 UI 移除)
}

// ─────────────── Lifecycle ───────────────

/**
 * 从 uni-app 运行时拿当前页的 options(query 参数)
 * 优先用 onLoad(options) 钩子入参,fallback 用 getCurrentPages() 末项 options
 * (本工程未在 package.json 显式列 @dcloudio/uni-app,故 fallback 走 getCurrentPages,
 * 沿用 TripDetailPage / SpotDetailSheet 既有模式)
 * @returns {Record<string, string | undefined> | undefined}
 */
onLoad((options) => {
  onLoadPage(options || {})
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

.form-field-picker-text-placeholder {
  color: #9A9A9A;
  /* inkMuted,v0.5.0(per user-round3-2026-06-26)加回 start_date / end_date 字段 placeholder */
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
