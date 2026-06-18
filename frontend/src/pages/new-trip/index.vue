<!--
  pages/new-trip/index.vue — 新建行程页(独立 route 化表单页,非 Tab)
  
  Spec contract: specs/NewTripPage.md v0.1.0
  Route: /pages/new-trip/index
  入口:HomePage BtnAddTrip / EmptyState CTA → uni.navigateTo({url: AppRoutes.NewTrip})
  出口(fix-trip-bugs-v1 2026-06-18):POST 成功后 reLaunch 跳 AppRoutes.Home
    (原跳 TripDetailPage 已被废弃 — reLaunch 清空整页栈,TripDetailPage onBack
     navigateBack 必然失败 → 兜底 reLaunch Home(整页刷新,体验糟))
  
  6 视图态(spec §3.7 / §5):
    input      — 默认(Greeting + textarea + 文件 chips + 取消/确定)
    analyzing  — 模拟 AI 推理 1.5-2.5s(转圈 + 提示)
    form       — 7 字段表单 + 取消/确认 + (3 必填未填时 _ErrorBanner)
    submitting — POST 飞行中(转圈 + 提示;无取消按钮)
    completed  — ✓ 创建成功(瞬时 ≤ 200ms 后 reLaunch)
    error      — 提交失败(error overlay + 重试)
  
  复用:
    - AppColors(山水日志配色)
    - AppRoutes.NewTrip / AppRoutes.Home
    - NewTripStrings / NewTripTransportOptions / NewTripNeedsOptions
    - useHomeStore.fetchTrips()(POST 成功后刷新列表)
    - services/trips.createTrip + updateTrip + saveDraft
    - _ErrorBanner(3 必填校验失败提示,retryable=false)
  
  不复用:不直接复用 NextButton / SpotDetailSheet(本页面双按钮,非单一 CTA)
  
  草稿(spec §5.4 + §6.4.3):
    - 取消且有内容 → _DraftConfirmDialog(3 按钮)
    - 「保存草稿」→ uni.setStorageSync('trip_drafts', [...]) + Toast + reLaunch Home
    - 「不保存」→ reLaunch Home
    - 「继续编辑」→ 关闭弹窗,currentStep 回到 input
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
        <!-- ───────── input 态 ───────── -->
        <view
          v-if="currentStep === 'input'"
          class="panel-input"
        >
          <view class="greeting-block">
            <text class="greeting-title">{{ strings.greetingTitle }}</text>
            <text class="greeting-hint">{{ strings.greetingHint }}</text>
          </view>

          <view class="textarea-wrap">
            <textarea
              v-model="inputText"
              class="textarea"
              :placeholder="textareaPlaceholder"
              :aria-label="strings.textareaAria"
              placeholder-class="textarea-placeholder"
              :auto-height="true"
              :disable-default-padding="true"
              :maxlength="1000"
            />
          </view>

          <view class="file-row">
            <view
              class="btn-attach-file"
              role="button"
              :aria-label="strings.btnAttachFile"
              hover-class="btn-attach-file-hover"
              :hover-stay-time="50"
              @click="onAttachFile"
            >
              <text class="btn-attach-file-emoji" aria-hidden="true">{{ strings.btnAttachFileEmoji }}</text>
              <text class="btn-attach-file-text">{{ strings.btnAttachFile }}</text>
            </view>
            <view
              v-for="(f, idx) in attachedFiles"
              :key="idx"
              class="file-chip"
            >
              <text class="file-chip-name">{{ f.name }}</text>
              <view
                class="file-chip-remove"
                role="button"
                aria-label="remove"
                hover-class="file-chip-remove-hover"
                :hover-stay-time="50"
                @click="onRemoveFile(idx)"
              >
                <text class="file-chip-remove-text" aria-hidden="true">✕</text>
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
              @click="onCancel"
            >
              <text class="btn-cancel-text">{{ strings.btnCancel }}</text>
            </view>
            <view
              class="btn btn-submit"
              role="button"
              :aria-label="strings.btnSubmit"
              :class="{ 'btn-submit-disabled': !hasContent }"
              hover-class="btn-submit-hover"
              :hover-stay-time="50"
              @click="onSubmit"
            >
              <text class="btn-submit-text">{{ strings.btnSubmit }}</text>
            </view>
          </view>
        </view>

        <!-- ───────── analyzing 态 ───────── -->
        <view
          v-else-if="currentStep === 'analyzing'"
          class="panel-center"
        >
          <view class="loading-spinner" aria-hidden="true" />
          <text class="panel-center-title">{{ strings.analyzingTitle }}</text>
          <text class="panel-center-hint">{{ strings.analyzingHint }}</text>
        </view>

        <!-- ───────── form 态 ───────── -->
        <view
          v-else-if="currentStep === 'form'"
          class="panel-form"
        >
          <view class="form-header">
            <text class="form-title">{{ strings.formTitle }}</text>
            <text class="form-hint">{{ formHintText }}</text>
            <view
              v-if="inputText.trim()"
              class="form-input-preview"
            >
              <text class="form-input-preview-text">{{ inputTextPreview }}</text>
            </view>
          </view>

          <ErrorBanner
            v-if="formSubmitError"
            :message="formSubmitError"
            :retryable="false"
          />

          <!-- 7 字段表单 -->
          <view class="form-fields">
            <!-- Field 1: 目的地(city)*  -->
            <view class="form-field">
              <text class="form-field-label">
                {{ strings.fieldCity }}
                <text
                  v-if="!formData.city"
                  class="required-mark"
                >*</text>
              </text>
              <input
                v-model="formData.city"
                class="form-field-input"
                :placeholder="strings.placeholderCity"
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

            <!-- Field 4: 同行成员(companions)选填 -->
            <view class="form-field">
              <text class="form-field-label">{{ strings.fieldCompanions }}</text>
              <input
                v-model="formData.companions"
                class="form-field-input"
                :placeholder="strings.placeholderCompanions"
                placeholder-class="form-field-input-placeholder"
              />
            </view>

            <!-- Field 5: 预算范围(budget_range)选填 -->
            <view class="form-field">
              <text class="form-field-label">{{ strings.fieldBudget }}</text>
              <input
                v-model="formData.budget_range"
                class="form-field-input"
                :placeholder="strings.placeholderBudget"
                placeholder-class="form-field-input-placeholder"
              />
            </view>

            <!-- Field 5.5: 行程安排(itineraryArrange)UI-025 — 横向 scroll-view 拖动排序 -->
            <ItineraryArrangeField
              v-model="formData.itineraryArrange"
              :readonly="false"
            />

            <!-- Field 6: 交通偏好(transport_preference)选填,radio chips -->
            <view class="form-field">
              <text class="form-field-label">{{ strings.fieldTransport }}</text>
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

            <!-- Field 7: 特殊需求(special_needs)选填,checkbox chips -->
            <view class="form-field">
              <text class="form-field-label">{{ strings.fieldNeeds }}</text>
              <view class="chip-row">
                <view
                  v-for="opt in needsOptions"
                  :key="opt.value"
                  class="chip"
                  :class="{ 'chip-selected': formData.special_needs.includes(opt.value) }"
                  role="button"
                  :aria-label="opt.label"
                  :aria-pressed="formData.special_needs.includes(opt.value)"
                  hover-class="chip-hover"
                  :hover-stay-time="50"
                  @click="onNeedsToggle(opt.value)"
                >
                  <text
                    class="chip-text"
                    :class="{ 'chip-text-selected': formData.special_needs.includes(opt.value) }"
                  >{{ opt.label }}</text>
                  <text
                    v-if="formData.special_needs.includes(opt.value)"
                    class="chip-check"
                    aria-hidden="true"
                  >✓</text>
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
import { NewTripStrings, NewTripTransportOptions, NewTripNeedsOptions } from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import { logger } from '../../utils/logger.js'
import { useHomeStore } from '../../stores/homeStore.js'
import { createTrip, saveDraft, updateTrip } from '../../services/trips.js'
import { loadTrips } from '../../db/trips.js'
import ErrorBanner from '../../components/ErrorBanner.vue'
import DraftConfirmDialog from './components/DraftConfirmDialog.vue'
import ItineraryArrangeField from './components/ItineraryArrangeField.vue'

const strings = NewTripStrings
const transportOptions = NewTripTransportOptions
const needsOptions = NewTripNeedsOptions
const backAria = '返回'

// ─────────────── 类型定义(spec §4.1) ───────────────
/**
 * @typedef {'flight' | 'train' | 'car' | 'walk'} TransportPreference
 * @typedef {'less_walking' | 'with_children' | 'with_elderly' | 'accessible'} SpecialNeedItem
 * @typedef {import('../../api/types').ItineraryItem} ItineraryItem
 *
 * @typedef {Object} NewTripFormData
 * @property {string} city
 * @property {string} start_date
 * @property {string} end_date
 * @property {string} companions
 * @property {string} budget_range
 * @property {TransportPreference | null} transport_preference
 * @property {SpecialNeedItem[]} special_needs
 * @property {ItineraryItem[]} itineraryArrange  // UI-025 新增(spec §3.5 Field 6)
 */

/**
 * @typedef {'input' | 'analyzing' | 'form' | 'submitting' | 'completed' | 'error'} NewTripStep
 */

// ─────────────── 静态辅助函数 ───────────────

/**
 * 创建空的 NewTripFormData(spec §4.1 createEmpty)
 * @returns {NewTripFormData}
 */
function createEmptyFormData() {
  return {
    city: '',
    start_date: '',
    end_date: '',
    companions: '',
    budget_range: '',
    transport_preference: null,
    special_needs: [],
    itineraryArrange: [], // UI-025 新增,默认空数组
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
 * 派生 title(spec §6.4.4)
 * @param {NewTripFormData} fd
 * @returns {string}
 */
function deriveTitle(fd) {
  if (fd.city && fd.start_date && fd.end_date) {
    const days = dayDiff(fd.start_date, fd.end_date)
    return `${fd.city} ${fd.start_date} - ${fd.end_date} ${days}天游`
  }
  if (fd.start_date && fd.end_date) {
    return `Trip ${fd.start_date} - ${fd.end_date}`
  }
  return ''
}

/**
 * 复制模式 fallback mock(per UI-024 任务原文 + issue §3.1 + UI-025 §5)
 * 当 db_trips 暂无该 tripId 时(Plan 1 落地后 db_trips 仍空,因任务 2 仅 seed users),
 * 用此 mock 兜底(形状基于 api/mock/_seed.ts:205 seedTrip3 西安四日)
 *
 * UI-025:扩展 itineraryArrange 字段(任务 4 复制行程预填),
 * 形状 = api/types.ts ItineraryItem[] 5 字段(id / title / start_time / end_time / item_type);
 * Trip 类型本身**不**含 itineraryArrange(per spec §硬规则:不**改**既有 trips shape),
 * 故用 intersection 类型表达,既满足 Trip 字面又携带额外字段。
 *
 * @type {import('../../api/types').Trip & { itineraryArrange?: import('../../api/types').ItineraryItem[] }}
 */
const MOCK_TRIP_FOR_COPY = Object.freeze({
  id: 3,
  user_id: 1,
  title: '西安四日文化行',
  city: '西安',
  start_date: '2026-05-01',
  end_date: '2026-05-04',
  status: 'finished',
  days: [],
  // UI-025 任务 4 复制预填(西安四日典型行程)
  itineraryArrange: [
    { id: 30001, title: '兵马俑',    start_time: '09:00', end_time: '12:00', item_type: 'attraction' },
    { id: 30002, title: '午餐:肉夹馍', start_time: '12:30', end_time: '13:30', item_type: 'food' },
    { id: 30003, title: '古城墙骑行', start_time: '15:00', end_time: '17:00', item_type: 'attraction' },
    { id: 30004, title: '回民街夜市',  start_time: '19:00', end_time: '21:00', item_type: 'food' },
  ],
})

/**
 * 从 inputText 极简正则提取 city / start_date / end_date(spec §5.5 视图决策算法)
 * @param {string} text
 * @returns {{ city: string, start_date: string, end_date: string }}
 */
function extractFormDataFromText(text) {
  const result = { city: '', start_date: '', end_date: '' }
  if (!text) return result

  // 城市:匹配 "去|飞|玩|在" + 1-3 个中文字符
  const cityMatch = text.match(/(?:去|飞|玩|在)([\u4e00-\u9fa5]{1,3}?)(?:玩|旅游|旅行|游|$|[，。])/)
  if (cityMatch) {
    result.city = cityMatch[1]
  }

  // 日期:优先 YYYY-MM-DD
  const isoDates = text.match(/\d{4}-\d{2}-\d{2}/g) || []
  if (isoDates.length >= 2) {
    result.start_date = isoDates[0]
    result.end_date = isoDates[1]
  } else {
    // fallback:MM月DD日 / M月D日
    const cnDates = text.match(/(\d{1,2})月(\d{1,2})日/g) || []
    if (cnDates.length >= 2) {
      const year = new Date().getFullYear()
      const m1 = cnDates[0].match(/(\d{1,2})月(\d{1,2})日/)
      const m2 = cnDates[1].match(/(\d{1,2})月(\d{1,2})日/)
      if (m1 && m2) {
        result.start_date = `${year}-${m1[1].padStart(2, '0')}-${m1[2].padStart(2, '0')}`
        result.end_date = `${year}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`
      }
    }
  }

  return result
}

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

// ─────────────── Local State(spec §4.1) ───────────────

/** @type {import('vue').Ref<string>} */
const inputText = ref('')
/** @type {import('vue').Ref<Array<{name: string, size: number, path: string}>>} */
const attachedFiles = ref([])
/** @type {import('vue').Ref<NewTripFormData>} */
const formData = ref(createEmptyFormData())
/** @type {import('vue').Ref<NewTripStep>} 严格 6 枚举 */
const currentStep = ref('input')
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

/** 是否有内容(inputText 非空 / 文件非空 / formData 非空)用于判定弹草稿 */
const hasContent = computed(() => {
  return (
    inputText.value.trim() !== '' ||
    attachedFiles.value.length > 0 ||
    formData.value.city !== '' ||
    formData.value.start_date !== '' ||
    formData.value.end_date !== '' ||
    formData.value.companions !== '' ||
    formData.value.budget_range !== '' ||
    formData.value.transport_preference !== null ||
    formData.value.special_needs.length > 0 ||
    formData.value.itineraryArrange.length > 0 // UI-025 新增
  )
})

/** 3 必填是否都已填(form 态点「确认」前校验) */
const hasRequiredFields = computed(() => {
  return (
    formData.value.city.trim() !== '' &&
    formData.value.start_date !== '' &&
    formData.value.end_date !== ''
  )
})

/** textarea placeholder(选填,用静态提示) */
const textareaPlaceholder = computed(() => '例如:7 月去大连玩 3 天,带老婆孩子,预算 5000,坐飞机')

/** inputText 折叠预览(> 30 字截断) */
const inputTextPreview = computed(() => {
  const t = inputText.value.trim()
  if (t.length <= 30) return t
  return `${t.slice(0, 30)}…`
})

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

// ─────────────── 内部 helper ───────────────

/** 上一次 setTimeout 的 id(分析态去重,spec §5.3.L) */
let analyzingTimerId = null

function clearAnalyzingTimer() {
  if (analyzingTimerId !== null) {
    clearTimeout(analyzingTimerId)
    analyzingTimerId = null
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

  // 3. 派生 formData(8 字段含 UI-025 itineraryArrange)
  formData.value = {
    city: sourceTrip.city || '',
    start_date: sourceTrip.start_date || '',
    end_date: sourceTrip.end_date || '',
    companions: sourceTrip.companions || '',
    budget_range: sourceTrip.budget_range || '',
    transport_preference: sourceTrip.transport_preference || null,
    special_needs: Array.isArray(sourceTrip.special_needs) ? sourceTrip.special_needs : [],
    // UI-025:itineraryArrange 预填(从源 trip 派生,无则空数组)
    itineraryArrange: Array.isArray(sourceTrip.itineraryArrange)
      ? sourceTrip.itineraryArrange.map((it) => ({ ...it }))
      : [],
  }
  originalTripTitle.value = sourceTrip.title || ''

  logger.info('[NewTripPage] copy prefill ok', {
    tripId,
    sourceTitle: originalTripTitle.value,
    city: formData.value.city,
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
 * 缺省 / 无效 → 走默认 input 态(沿 spec §3.7)
 * @param {Record<string, string | undefined> | undefined} options
 */
function onLoadPage(options) {
  logger.info('[NewTripPage] initialize', { options })

  const raw = options?.copyFrom
  if (raw === undefined || raw === null || raw === '') {
    return // 缺省 = 普通新建模式,currentStep 保持 'input'
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
  logger.info('[NewTripPage] enter copy mode, skip input/analyzing', { tripId: n })
}

// ─────────────── Handlers ───────────────

/**
 * input 态:点「确定」 → analyzing(spec §5.2 Step 1)
 * 校验:text + files 二选一非空(AC-02)
 */
function onSubmit() {
  if (!hasContent.value) {
    uni.showToast({
      title: NewTripStrings.errorNoContent,
      icon: 'none',
      duration: 1500,
    })
    logger.warn('[NewTripPage] submit blocked, no content')
    return
  }

  logger.info('[NewTripPage] analyze start', {
    inputTextLen: inputText.value.length,
    files: attachedFiles.value.length,
  })

  currentStep.value = 'analyzing'
  submitError.value = null
  formSubmitError.value = null

  // 1.5-2.5s 随机延迟模拟 AI(spec §6.4.1 + §5.5)
  clearAnalyzingTimer()
  const delay = 1500 + Math.random() * 1000
  analyzingTimerId = setTimeout(() => {
    analyzingTimerId = null
    // guard:防止 spec §5.3.L 描述的"快速来回切"导致旧 timer 触发新 step
    if (currentStep.value !== 'analyzing') return

    const extracted = extractFormDataFromText(inputText.value)
    formData.value = {
      ...createEmptyFormData(),
      city: extracted.city,
      start_date: extracted.start_date,
      end_date: extracted.end_date,
    }
    currentStep.value = 'form'
    logger.info('[NewTripPage] analyze done', {
      city: formData.value.city,
      start_date: formData.value.start_date,
      end_date: formData.value.end_date,
    })
  }, delay)
}

/**
 * form 态:点「确认」 → submitting(spec §5.2 Step 3-4)
 * 校验:3 必填非空(AC-06)→ 否则 formSubmitError + 保持 form 态
 * UI-024:复制模式 → title 固定用「{originalTitle} 副本」(不随 formData 字段变)
 */
function onConfirm() {
  if (!hasRequiredFields.value) {
    formSubmitError.value = NewTripStrings.errorRequired
    logger.warn('[NewTripPage] submit blocked, missing required')
    return
  }
  formSubmitError.value = null

  // UI-024:复制模式 title 派生固定为「原 title 副本」
  const title = isCopyMode.value
    ? `${originalTripTitle.value} 副本`
    : deriveTitle(formData.value)
  if (!title) {
    // 防御:3 必填已通过校验,理论 title 一定有值
    submitError.value = NewTripStrings.errorBadRequest
    currentStep.value = 'error'
    logger.error('[NewTripPage] derive title failed unexpectedly')
    return
  }

  const days = dayDiff(formData.value.start_date, formData.value.end_date)
  logger.info('[NewTripPage] submit start', {
    city: formData.value.city,
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
 * @param {string} title
 */
async function submitTripRequest(title) {
  try {
    const res = await createTrip({
      title,
      city: formData.value.city,
      start_date: formData.value.start_date,
      end_date: formData.value.end_date,
      // UI-025:行程安排字段(空数组也合法,service 内部会过滤)
      itineraryArrange: formData.value.itineraryArrange,
    })
    const tripId = res.data?.trip_id
    if (!tripId) {
      throw new Error('createTrip response missing trip_id')
    }
    currentStep.value = 'completed'
    submitError.value = null
    logger.info('[NewTripPage] submit ok', { tripId })

    // 200ms 后 reLaunch(AC-08:≤ 200ms,避免黑屏)
    setTimeout(async () => {
      // fix-trip-bugs-v1:MVP 兜底 — 后端 Trip.status default='draft' + create_trip 不设 status,
      // 创建后调 PUT /api/trips/{id} 改 status='active'。失败仅 logger.warn,不阻塞 reLaunch
      try {
        await updateTrip(tripId, { status: 'active' })
        logger.info('[NewTripPage] set status active ok', { tripId })
      } catch (err) {
        logger.warn('[NewTripPage] set status active failed, trip may stay draft', {
          tripId,
          err: err?.message,
        })
      }
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
 */
function onDialogSave() {
  const draft = {
    id: Date.now(),
    created_at: new Date().toISOString(),
    inputText: inputText.value,
    attachedFiles: attachedFiles.value,
    formData: formData.value,
  }
  const ok = saveDraft(draft)
  dialogVisible.value = false
  if (ok) {
    logger.info('[NewTripPage] saveDraft ok', { draftId: draft.id })
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
    logger.warn('[NewTripPage] saveDraft failed, stay in input')
    uni.showToast({
      title: NewTripStrings.draftSaveFailedToast,
      icon: 'none',
      duration: 1500,
    })
    currentStep.value = 'input'
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
  currentStep.value = 'input'
}

/**
 * 添加文件(uni.chooseFile,跨端 API)
 *
 * MVP 简化(spec §3.3):仅展示文件名 + 大小,不解析内容,POST 不上传。
 * 失败 → 仅 logger.warn,不阻塞 UI。
 */
function onAttachFile() {
  uni.chooseFile({
    count: 5,
    success: (res) => {
      const files = res.tempFiles || []
      for (const f of files) {
        attachedFiles.value.push({
          name: f.name,
          size: f.size,
          path: f.path,
        })
      }
      logger.info('[NewTripPage] attach files', { count: files.length })
    },
    fail: (err) => {
      logger.warn('[NewTripPage] chooseFile fail', err)
    },
  })
}

/**
 * 移除已选文件
 * @param {number} idx
 */
function onRemoveFile(idx) {
  const f = attachedFiles.value[idx]
  if (!f) return
  attachedFiles.value.splice(idx, 1)
  logger.info('[NewTripPage] remove file', { name: f.name })
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
 * @param {'flight' | 'train' | 'car' | 'walk'} v
 */
function onTransportToggle(v) {
  formData.value.transport_preference =
    formData.value.transport_preference === v ? null : v
}

/**
 * 特殊需求 checkbox 切换(spec §3.5 Field 7:多选)
 * @param {'less_walking' | 'with_children' | 'with_elderly' | 'accessible'} v
 */
function onNeedsToggle(v) {
  const arr = formData.value.special_needs
  const i = arr.indexOf(v)
  if (i >= 0) {
    arr.splice(i, 1)
  } else {
    arr.push(v)
  }
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
  clearAnalyzingTimer()
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
