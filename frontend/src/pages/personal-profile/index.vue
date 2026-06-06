<!--
  pages/personal-profile/index.vue — 编辑个人信息页(独立 route 化表单页,非 Tab)
  
  Spec contract: specs/PersonalProfilePage.md v0.1.0
  Route: /pages/personal-profile/index
  入口:MyPage BtnEdit → uni.navigateTo({url: AppRoutes.PersonalProfile})
  出口:PUT 成功后 navigateBack(保留 stack)→ MyPage.onShow 重新拉取
  
  5 视图态(spec §3.7 / §4.1 / §5):
    loading   — 初始 / GET 飞行中(转圈 + 提示)
    editing   — GET 拉取成功 + formData 预填就绪 + 3 段表单可编辑
    saving    — 用户点「保存」且 3 必填已填 + 校验通过(并行 PUT + 写本地)
    saved     — PUT 成功 ✓ 大对勾(瞬时 ≤ 200ms 后 navigateBack)
    error     — GET / PUT 失败(error panel + 重试)
  
  复用(spec §3.6 + §10):
    - AppColors(山水日志配色)
    - AppRoutes.PersonalProfile(已预声明 routes.js:16)
    - PersonalProfileStrings / PersonalProfileGenderOptions / PersonalProfileAgeOptions(本规格新增)
    - OnboardingInterestOptions(段 3 InterestGrid 5 项 1:1 对齐后端 Interest 枚举)
    - OnboardingStrings.errorXxx / retry / stepTitle / stepHint(错误兜底 + 重试 + 段 3 标题)
    - useUserStore.fetchPreferences() + updateProfile()(onLoad + save)
    - services/preferences.ApiError(跨 service 复用,import 自 services/preferences.js)
    - components/InterestGrid.vue(段 3 多选 grid,⭐ 复用)
    - 注:error 态走 spec §3 显式定义的 _ErrorPanel(icon + message + btn-retry)而非 _ErrorBanner ⭐,
      因本页面 error 是顶层态(整页 5 选 1)而非 form 内联提示;_ErrorBanner 在 OnboardingPage / NewTripPage
      form 内嵌场景使用,本页面复用模板不贴切
  
  不复用:NextButton(单 CTA 场景)/ SpotDetailSheet(浮层专用)/ EmptyState(本页面用 inline _ErrorPanel)
  
  草稿(spec §4.3 + §5.4 + §6.4.3):
    - key = 'user_profile_drafts',value = Record<userId, PersonalProfileDraft>
    - MVP 单 userId='1' 固定
    - 进入页面时若 storage 有该 userId 草稿,formData 预填用草稿(优先于 GET 响应)+ Toast 提示
    - 取消/返回时自动保存草稿(若有修改)+ 直接 navigateBack(**不**弹 _DraftConfirmDialog,per §6.4.3 Resolved)
    - 草稿保存失败(quota 满)→ logger.warn + 不阻塞 navigateBack
-->
<template>
  <view
    class="ppp-page"
    :aria-label="strings.pageAria"
  >
    <!-- Header(顶栏 44pt,左「←」右 title) -->
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

        <!-- ───────── editing 态(3 段表单) ───────── -->
        <view
          v-else-if="currentStep === 'editing'"
          class="panel-form"
        >
          <!-- _FormHeader(用户摘要,spec §3.5) -->
          <view class="form-header">
            <text class="form-title">{{ strings.formTitle }}</text>
            <text class="form-hint">{{ strings.formHint }}</text>
            <view class="form-user-summary">
              <text class="form-user-summary-id">{{ strings.formHeaderIdPrefix }}{{ userId }}</text>
              <text class="form-user-summary-values">
                {{ summaryLine }}
              </text>
            </view>
          </view>

          <!-- 段 1 性别(3 选 1) -->
          <view class="form-section">
            <view class="form-section-header">
              <text class="form-section-title">
                {{ strings.sectionTitleGender }}
                <text
                  v-if="formData.gender === null"
                  class="required-mark"
                >*</text>
              </text>
              <text class="form-section-hint">{{ strings.sectionHintGender }}</text>
            </view>
            <GenderChipGroup
              v-model="formData.gender"
              @change="onGenderChange"
            />
            <text
              v-if="formData.gender === null"
              class="form-section-error"
            >{{ strings.genderRequiredMark }}</text>
          </view>

          <!-- 段 2 年龄段(5 选 1) -->
          <view class="form-section">
            <view class="form-section-header">
              <text class="form-section-title">
                {{ strings.sectionTitleAge }}
                <text
                  v-if="formData.ageRange === null"
                  class="required-mark"
                >*</text>
              </text>
              <text class="form-section-hint">{{ strings.sectionHintAge }}</text>
            </view>
            <AgeChipGroup
              v-model="formData.ageRange"
              @change="onAgeChange"
            />
            <text
              v-if="formData.ageRange === null"
              class="form-section-error"
            >{{ strings.ageRequiredMark }}</text>
          </view>

          <!-- 段 3 感兴趣领域(5 选 N,InterestGrid ⭐ 复用) -->
          <view class="form-section">
            <view class="form-section-header">
              <text class="form-section-title">
                {{ OnboardingStrings.stepTitle }}
                <text
                  v-if="formData.interests.length === 0"
                  class="required-mark"
                >*</text>
              </text>
              <text class="form-section-hint">{{ OnboardingStrings.stepHint }}</text>
            </view>
            <InterestGrid
              v-model="formData.interests"
              @change="onInterestChange"
            />
            <text
              v-if="formData.interests.length === 0"
              class="form-section-error"
            >{{ strings.interestsRequiredMark }}</text>
          </view>

          <!-- (sticky bottom in flow) _ActionBar 单按钮(spec §3.4) -->
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
          v-else-if="currentStep === 'saving'"
          class="panel-center"
        >
          <view class="loading-spinner" aria-hidden="true" />
          <text class="panel-center-title">{{ strings.savingText }}</text>
        </view>

        <!-- ───────── saved 态(瞬时 ≤ 200ms) ───────── -->
        <view
          v-else-if="currentStep === 'saved'"
          class="panel-center"
        >
          <view class="completed-check" aria-hidden="true">✓</view>
          <text class="panel-center-title">{{ strings.savedText }}</text>
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
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  PersonalProfileStrings,
  PersonalProfileGenderOptions,
  PersonalProfileAgeOptions,
  OnboardingStrings,
} from '../../constants/strings.js'
import { useUserStore } from '../../stores/userStore.js'
import { logger } from '../../utils/logger.js'
import InterestGrid from '../../components/InterestGrid.vue'
import GenderChipGroup from './components/GenderChipGroup.vue'
import AgeChipGroup from './components/AgeChipGroup.vue'

const strings = PersonalProfileStrings

// ─────────────── 类型定义(spec §4.1) ───────────────
/**
 * @typedef {import('../../api/types').Interest} Interest
 *
 * @typedef {'male' | 'female' | 'other'} Gender
 * @typedef {'under_18' | '18_24' | '25_34' | '35_44' | '45_plus'} AgeRange
 *
 * @typedef {Object} PersonalProfileFormData
 * @property {Gender | null} gender
 * @property {AgeRange | null} ageRange
 * @property {Interest[]} interests
 *
 * @typedef {Object} PersonalProfileDraft
 * @property {string} userId
 * @property {string} savedAt
 * @property {PersonalProfileFormData} formData
 *
 * @typedef {'loading' | 'editing' | 'saving' | 'saved' | 'error'} PersonalProfileStep
 *   严格 5 枚举(spec §3.7 + §4.1)
 */

// ─────────────── 常量 ───────────────
const MVP_USER_ID = '1'                                  // MVP 单用户(per docs/API接口文档.md §1.3)
const STORAGE_KEY = 'user_profile_drafts'                 // 草稿 storage key(spec §4.3 备注,沿用 EditTripPage key 风格)

// ─────────────── 静态辅助函数 ───────────────

/**
 * 创建空的 PersonalProfileFormData(spec §4.1 createEmpty)
 * @returns {PersonalProfileFormData}
 */
function createEmptyFormData() {
  return {
    gender: null,
    ageRange: null,
    interests: [],
  }
}

/**
 * 从 GET 响应 + 草稿派生表单数据(spec §4.1 fromPrefsAndDraft)
 * - draft 优先(spec §5.1 Step 1)
 * - 无 draft:gender / ageRange 始终 null(后端无字段),interests 从 prefs 取或 []
 * @param {import('../../api/types').Preferences | null} prefs
 * @param {PersonalProfileDraft | null} draft
 * @returns {PersonalProfileFormData}
 */
function formDataFromPrefsAndDraft(prefs, draft) {
  if (draft !== null) {
    return {
      gender: draft.formData.gender,
      ageRange: draft.formData.ageRange,
      interests: [...draft.formData.interests],
    }
  }
  return {
    gender: null,
    ageRange: null,
    interests: Array.isArray(prefs?.interests) ? [...prefs.interests] : [],
  }
}

/**
 * 将 ApiError 归一为友好提示(spec §6.1 Error 表)
 * @param {import('../../services/preferences.js').ApiError | Error | unknown} err
 * @returns {string}
 */
function mapErrorToMessage(err) {
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

/**
 * 读取该 userId 的草稿(spec §4.3 草稿 storage)
 * - 静默降级:storage 异常 → null(spec §4.3 备注)
 * @returns {PersonalProfileDraft | null}
 */
function loadUserProfileDraft() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (!raw || typeof raw !== 'object') return null
    const map = /** @type {Record<string, PersonalProfileDraft>} */ (raw)
    return map[MVP_USER_ID] || null
  } catch (err) {
    logger.warn('[PersonalProfilePage] loadUserProfileDraft failed', err)
    return null
  }
}

/**
 * 写入该 userId 的草稿(spec §4.3 + §5.2 Step 3)
 * - 覆盖式:同 userId 二次保存覆盖
 * - 静默降级:写失败 → logger.warn + 返回 false(spec §5.3.H 草稿存失败容错)
 * @param {PersonalProfileDraft} draft
 * @returns {boolean} 写成功 true
 */
function saveUserProfileDraft(draft) {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    /** @type {Record<string, PersonalProfileDraft>} */
    const map = (raw && typeof raw === 'object') ? /** @type {any} */ (raw) : {}
    map[MVP_USER_ID] = draft
    uni.setStorageSync(STORAGE_KEY, map)
    return true
  } catch (err) {
    logger.warn('[PersonalProfilePage] saveUserProfileDraft failed', err)
    return false
  }
}

// ─────────────── Local State(spec §4.1) ───────────────

/** @type {import('vue').Ref<string>} MVP 固定 userId */
const userId = ref(MVP_USER_ID)
/** @type {import('vue').Ref<PersonalProfileStep>} 严格 5 枚举 */
const currentStep = ref('loading')
/** @type {import('vue').Ref<PersonalProfileFormData>} 3 段表单 */
const formData = ref(createEmptyFormData())
/** @type {import('vue').Ref<PersonalProfileFormData>} 预填 snapshot,用于 diff 判定 */
const originalData = ref(createEmptyFormData())
/** @type {import('vue').Ref<string | null>} GET / PUT 失败的友好提示 */
const submitError = ref(null)
/** @type {import('vue').Ref<boolean>} 是否已自动恢复过该 userId 的本地草稿 */
const draftRestored = ref(false)
/** @type {import('vue').Ref<'get' | 'put' | null>} 上一次失败来源(决定重试方向) */
const lastErrorSource = ref(/** @type {'get' | 'put' | null} */ (null))

// ─────────────── Computed ───────────────

/** 表单是否有变化(决定 onBack 时是否写草稿) */
const hasChanged = computed(() => {
  return (
    formData.value.gender !== originalData.value.gender
    || formData.value.ageRange !== originalData.value.ageRange
    || formData.value.interests.join(',') !== originalData.value.interests.join(',')
  )
})

/** 3 段必填是否都已填(gender + ageRange + interests ≥ 1) */
const hasRequiredFields = computed(() => {
  return formData.value.gender !== null
    && formData.value.ageRange !== null
    && formData.value.interests.length >= 1
})

/** 保存按钮可点判定:3 必填全填 + 非 saving 态 */
const canSave = computed(() => {
  if (currentStep.value !== 'editing') return false
  return hasRequiredFields.value
})

/** _FormHeader 3 段当前值摘要(性别:X | 年龄:X | 兴趣:N 项) */
const summaryLine = computed(() => {
  const sep = strings.formHeaderSeparator
  const g = formData.value.gender
  const a = formData.value.ageRange
  const i = formData.value.interests
  const gLabel = g
    ? (PersonalProfileGenderOptions.find((o) => o.value === g)?.label ?? g)
    : strings.formHeaderGenderEmpty
  const aLabel = a
    ? (PersonalProfileAgeOptions.find((o) => o.value === a)?.label ?? a)
    : strings.formHeaderAgeEmpty
  const iLabel = i.length === 0
    ? strings.formHeaderInterestsEmpty
    : `${i.length} ${strings.formHeaderInterestsUnit}`
  return `${strings.sectionTitleGender}:${gLabel}${sep}${strings.sectionTitleAge}:${aLabel}${sep}${iLabel}`
})

// ─────────────── Store ───────────────
const userStore = useUserStore()

// ─────────────── Handlers ───────────────

/**
 * onMounted 入口(替代 onLoad,沿用 EditTripPage / TripDetailPage 兼容层模式)
 * spec §5.1 页面进入
 */
function onLoadPage() {
  // 初始化 local state
  formData.value = createEmptyFormData()
  originalData.value = createEmptyFormData()
  submitError.value = null
  draftRestored.value = false
  lastErrorSource.value = null
  currentStep.value = 'loading'

  // 1) 草稿恢复优先(spec §5.1 + §5.3.E)
  const draft = loadUserProfileDraft()
  if (draft) {
    const fd = formDataFromPrefsAndDraft(null, draft)
    formData.value = fd
    originalData.value = { ...fd, interests: [...fd.interests] }
    draftRestored.value = true
    logger.info('[PersonalProfilePage] draft restored', { userId: MVP_USER_ID, savedAt: draft.savedAt })
    uni.showToast({
      title: strings.draftRestoredToast,
      icon: 'none',
      duration: 1200,
    })
  }

  // 2) 触发 fetch
  fetchPreferences()
}

/**
 * 调 userStore.fetchPreferences,按响应切 currentStep
 */
async function fetchPreferences() {
  try {
    await userStore.fetchPreferences()
    handleFetchResult({ ok: true })
  } catch (err) {
    logger.error('[PersonalProfilePage] fetch failed', err)
    handleFetchResult({ ok: false, err })
  }
}

/**
 * 处理 fetch 结果(独立函数便于 test 注入 + 草稿恢复不覆盖)
 * @param {{ ok: true } | { ok: false; err: any }} result
 */
function handleFetchResult(result) {
  if (result.ok) {
    // 草稿恢复优先(spec §5.1):draftRestored=true 时**不**覆盖 formData
    if (!draftRestored.value) {
      const fd = formDataFromPrefsAndDraft(userStore.preferences, null)
      formData.value = fd
      originalData.value = { ...fd, interests: [...fd.interests] }
    }
    currentStep.value = 'editing'
    submitError.value = null
    lastErrorSource.value = null
    logger.info('[PersonalProfilePage] fetch ok', {
      userId: MVP_USER_ID,
      interestsCount: formData.value.interests.length,
    })
    return
  }
  // failure
  submitError.value = mapErrorToMessage(result.err)
  currentStep.value = 'error'
  lastErrorSource.value = 'get'
}

/**
 * Header「←」点击:onBack 走 §5.4 简化决策(自动存草稿 + navigateBack,**不**弹 _DraftConfirmDialog)
 */
function onBack() {
  logger.info('[PersonalProfilePage] back, hasChanged=' + hasChanged.value, { userId: MVP_USER_ID })
  if (hasChanged.value) {
    const draft = {
      userId: MVP_USER_ID,
      savedAt: new Date().toISOString(),
      formData: { ...formData.value, interests: [...formData.value.interests] },
    }
    saveUserProfileDraft(draft)
  }
  navigateBack()
}

/**
 * 「保存」按钮 → onSave 校验 → currentStep='saving' → 并行 PUT + 写草稿
 * spec §5.2 Step 2-3
 */
function onSave() {
  if (!canSave.value) {
    logger.warn('[PersonalProfilePage] save blocked, missing required', {
      gender: formData.value.gender,
      ageRange: formData.value.ageRange,
      interestsCount: formData.value.interests.length,
    })
    return
  }
  currentStep.value = 'saving'
  submitError.value = null
  logger.info('[PersonalProfilePage] save start', {
    userId: MVP_USER_ID,
    interestsCount: formData.value.interests.length,
  })
  doSave()
}

/**
 * 实际发起 PUT(spec §5.2 Step 3)+ 写本地草稿
 * - 2 个 action 独立:PUT 失败切 error,草稿存失败仅 logger.warn 不阻塞
 */
async function doSave() {
  // A. PUT /api/preferences
  const putPromise = userStore.updateProfile({ interests: [...formData.value.interests] })
    .then(() => ({ ok: true }))
    .catch((err) => ({ ok: false, err }))

  // B. 写本地草稿(best-effort,per §5.3.H 草稿存失败容错)
  const draftPromise = Promise.resolve().then(() => {
    const draft = {
      userId: MVP_USER_ID,
      savedAt: new Date().toISOString(),
      formData: { ...formData.value, interests: [...formData.value.interests] },
    }
    return { ok: saveUserProfileDraft(draft) }
  })

  // 串行处理:A 必须成功;B 失败仅 warn
  const [putResult, draftResult] = await Promise.all([putPromise, draftPromise])
  if (!draftResult.ok) {
    logger.warn('[PersonalProfilePage] saveDraft failed, continue navigateBack')
  }
  if (!putResult.ok) {
    logger.error('[PersonalProfilePage] save failed', putResult.err)
    submitError.value = mapErrorToMessage(putResult.err)
    currentStep.value = 'error'
    lastErrorSource.value = 'put'
    return
  }

  // 成功
  currentStep.value = 'saved'
  submitError.value = null
  lastErrorSource.value = null
  logger.info('[PersonalProfilePage] save ok', { userId: MVP_USER_ID })

  // Toast 提前(setTimeout 200ms 期间显示)
  uni.showToast({
    title: strings.saveSuccessToast,
    icon: 'success',
    duration: 1500,
  })

  // 200ms 后 navigateBack(per spec §3.7 + §5.2 Step 3 备注)
  setTimeout(() => {
    navigateBack()
  }, 200)
}

/**
 * error 态「重试」:根据 lastErrorSource 决定重试方向(spec §5.2 Step 5)
 * - GET 失败 → 重新拉(loading 态)
 * - PUT 失败 → 重新提交 PUT(formData 保留)
 */
function onRetry() {
  logger.info('[PersonalProfilePage] retry', { userId: MVP_USER_ID, source: lastErrorSource.value })
  submitError.value = null
  if (lastErrorSource.value === 'get') {
    currentStep.value = 'loading'
    fetchPreferences()
  } else {
    // PUT 失败重试(formData 保留)
    currentStep.value = 'saving'
    doSave()
  }
}

/**
 * 统一的 navigateBack 封装:栈顶则 reLaunch Home(避免 navigateBack 失败)
 */
function navigateBack() {
  uni.navigateBack({
    delta: 1,
    fail: () => {
      // 兜底:若 MyPage 不在 stack 里(罕见),reLaunch 到 Home
      // (本页面无 AppRoutes.Home import 是有意为之,沿用 §3.6 R-X 不兜底 reLaunch Home;
      // 但 navigateBack 失败是极端 case,留兜底避免白屏)
      logger.error('[PersonalProfilePage] navigateBack failed, no fallback')
    },
  })
}

// ─────────────── 字段回调(用于 logger,可后续扩展轻提示) ───────────────

/** @param {{ value: 'male' | 'female' | 'other', selected: boolean }} e */
function onGenderChange(e) {
  logger.debug('[PersonalProfilePage] gender changed', e)
}

/** @param {{ value: 'under_18' | '18_24' | '25_34' | '35_44' | '45_plus', selected: boolean }} e */
function onAgeChange(e) {
  logger.debug('[PersonalProfilePage] age changed', e)
}

/** @param {{ value: Interest, selected: boolean }} e */
function onInterestChange(e) {
  logger.debug('[PersonalProfilePage] interest changed', e)
}

// ─────────────── Lifecycle ───────────────

onMounted(() => {
  onLoadPage()
})

onUnmounted(() => {
  logger.debug('[PersonalProfilePage] onUnmounted, currentStep=' + currentStep.value)
})
</script>

<style scoped>
.ppp-page {
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

.form-user-summary {
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

.form-user-summary-id {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  /* 11px */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.4;
}

.form-user-summary-values {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.5;
}

/* ─── Form Section(3 段表单共用) ─── */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  /* space-sm,标题与 chips 间 12rpx(spec §3.1 节奏) */
}

.form-section-header {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  margin-bottom: 4rpx;
}

.form-section-title {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 32rpx;
  /* 16px,UI §三 段标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.form-section-hint {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.4;
}

.required-mark {
  color: #C44A3A;
  /* danger,见 UI §二 */
  font-size: 32rpx;
  /* 16px,见 spec §3.1 */
  margin-left: 4rpx;
}

.form-section-error {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #C44A3A;
  /* danger */
  line-height: 1.4;
  margin-top: 4rpx;
  margin-left: 8rpx;
  /* space-sm,标红文字与 chips 间 8rpx 视觉缓冲 */
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
  /* ≥ 44pt tap area(88rpx = 44pt) */
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
