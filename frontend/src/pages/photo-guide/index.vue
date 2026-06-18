<!--
  pages/photo-guide/index.vue — 拍照讲解页(独立 route,Tab 入口,深链 ?fromSpot=spotId&tripId=tripId)

  Spec contract: specs/PhotoGuidePage.md v0.1.0
  Route: /pages/photo-guide/index
  入口:
    1) 底部 Tab「拍照讲解」→ uni.switchTab({url: AppRoutes.PhotoGuide})
    2) SpotDetailSheet 浮层「拍照讲解」按钮 → uni.switchTab + '?fromSpot=spotId&tripId=tripId'
  出口:
    1) 取消/系统返回手势 → uni.navigateBack()(若来自 SpotDetailSheet 浮层,保留 stack)
                       / uni.switchTab({url: AppRoutes.Home})(底部 Tab 直入,无 stack)
    2) 追问循环在 _ResultPanel 内闭环

  6 视图态(spec §3.7 / §4.1 / §5):
    idle       — 初始;_IdlePanel + 2 chips(拍照/相册) + 大图标 + 提示语
    preview    — 已选图待确认;_PreviewPanel + 风格选择 + 重选/开始讲解
    analyzing  — POST 飞行中;_AnalyzingPanel(小图 + 转圈 + 提示语 30s 超时)
    result     — AI 响应成功;_ResultPanel(4 块讲解 + _ChatHistory + _ChatInputBar)
    chatting   — 追问循环飞行中;复用 _ResultPanel + 末尾追加 _ChatTyping
    error      — 上传超时 / API 5xx / 5001 LLM / chooseImage 权限拒绝 / 系统错误
                 → _ErrorOverlay(友好提示 + 「重试」按钮)

  复用(spec §3.9 + §10 R-1~R-4):
    - AppColors(山水日志配色) / AppRoutes.PhotoGuide / AppRoutes.Home
    - PhotoGuideStrings / PhotoGuideStyleOptions / PhotoGuideStyleFromPrefMap
    - useUserStore.fetchPreferences()(默认风格映射,无则 fallback 'professional')
    - useHomeStore.trips / fetchTrips()(?tripId 携带时找 trip title)
    - useHomeStore.today.today_items(?fromSpot 携带时找 spot context)
    - services/photos.explainPhoto(POST /api/photos/explain,30s timeout,multipart/form-data)
    - services/preferences.ApiError(跨域复用,来自 services/photos.js import)
    - components/_ErrorBanner(trip 关联弱化 + 追问失败内联)
    - components/SpotCard(?fromSpot 携带时只展示不响应点击)

  不复用(per spec §3.9 + §10 R-4):
    - components/EmptyState / NextButton / TripCard / SpotTimeAxis / SpotDetailSheet
    - _DraftConfirmDialog(3 按钮草稿 vs 本页面 2 按钮清空,语义不同)
    - 新建 photoStore(追问 history 是 page-local state,per §1 MVP YAGNI)

  追问循环(spec §3.5 + §5.2 Step 5):
    - 复用 POST /api/photos/explain,**不**新建追问 API,**不**传 history 字段
    - 后端按 photo_id 关联会话(spec §6.3.2)
    - chatting 失败 → _ErrorBanner 内联(input 上方,retryable=true),不切全屏 error
    - _ClearChatConfirmDialog 二次确认(2 按钮:取消/清空;清空红色 Danger)
-->
<template>
  <view
    class="pgp-page"
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
        @click="onCancel"
      >
        <text class="header-back-text" aria-hidden="true">←</text>
      </view>
      <view class="header-title-wrap">
        <text class="header-title">{{ strings.title }}</text>
        <text
          v-if="currentTrip"
          class="header-subtitle"
        >{{ fromTripBannerTitle }}</text>
      </view>
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
        <!-- ───────── idle 态 ───────── -->
        <view
          v-if="currentStep === 'idle'"
          class="panel-idle"
        >
          <!-- _FromSpotBanner(若 fromSpot 携带且找到) -->
          <view
            v-if="fromSpot"
            class="from-spot-banner"
          >
            <view class="from-spot-banner-header">
              <text class="from-spot-banner-eyebrow">{{ fromSpotBannerTitle }}</text>
            </view>
            <view class="from-spot-banner-card">
              <SpotCard
                :spot="fromSpot"
                :state="fromSpotState"
                :is-favorite="false"
              />
            </view>
          </view>

          <!-- _ErrorBanner(若 ?tripId 解析失败 → 找不到 trip,内联提示不阻塞) -->
          <ErrorBanner
            v-if="currentTripId !== null && currentTrip === null"
            :message="strings.errorNoTrip"
            :retryable="false"
          />

          <view class="idle-block">
            <text class="idle-icon" aria-hidden="true">{{ strings.idleIcon }}</text>
            <text class="idle-hint">{{ strings.idleHint }}</text>
          </view>

          <view class="mode-toggle">
            <view
              class="mode-chip mode-chip-camera"
              role="button"
              :aria-label="strings.modeCamera"
              :aria-pressed="false"
              hover-class="mode-chip-hover"
              :hover-stay-time="50"
              @click="onChooseImage('camera')"
            >
              <text class="mode-chip-text">📸 {{ strings.modeCamera }}</text>
            </view>
            <view
              class="mode-chip mode-chip-album"
              role="button"
              :aria-label="strings.modeAlbum"
              :aria-pressed="false"
              hover-class="mode-chip-hover"
              :hover-stay-time="50"
              @click="onChooseImage('album')"
            >
              <text class="mode-chip-text">🖼 {{ strings.modeAlbum }}</text>
            </view>
          </view>

          <text class="idle-hint2">{{ strings.idleHint2 }}</text>
        </view>

        <!-- ───────── preview 态 ───────── -->
        <view
          v-else-if="currentStep === 'preview'"
          class="panel-preview"
        >
          <view class="image-preview-wrap">
            <image
              class="image-preview"
              :src="imagePath || ''"
              mode="aspectFit"
              @error="onImageError"
            />
            <text
              v-if="imageLoadFailed"
              class="image-load-failed"
            >{{ strings.imageLoadFailed }}</text>
          </view>

          <text class="image-meta">{{ imageMetaText }}</text>

          <view class="action-bar">
            <view
              class="btn btn-retake"
              role="button"
              :aria-label="strings.btnRetake"
              hover-class="btn-retake-hover"
              :hover-stay-time="50"
              @click="onRetake"
            >
              <text class="btn-retake-text">{{ strings.btnRetake }}</text>
            </view>
            <view
              class="btn btn-confirm"
              role="button"
              :aria-label="strings.btnConfirm"
              hover-class="btn-confirm-hover"
              :hover-stay-time="50"
              @click="onConfirmAnalyze"
            >
              <text class="btn-confirm-text">{{ strings.btnConfirm }}</text>
            </view>
          </view>
        </view>

        <!-- ───────── analyzing 态 ───────── -->
        <view
          v-else-if="currentStep === 'analyzing'"
          class="panel-center"
        >
          <view class="analyzing-image-wrap">
            <image
              class="analyzing-image"
              :src="imagePath || ''"
              mode="aspectFit"
            />
          </view>
          <view class="loading-spinner" aria-hidden="true" />
          <text class="panel-center-title">{{ strings.analyzingText }}</text>
          <text class="panel-center-hint">{{ strings.analyzingSubtext }}</text>
        </view>

        <!-- ───────── result 态 / chatting 态(衍生:复用 _ResultPanel + 末尾 typing) ───────── -->
        <view
          v-else-if="currentStep === 'result' || currentStep === 'chatting'"
          class="panel-result"
        >
          <!-- 顶部小图 + 风格徽章 -->
          <view class="result-top">
            <image
              class="result-top-image"
              :src="imagePath || ''"
              mode="aspectFill"
            />
            <view class="result-style-badge">
              <text class="result-style-badge-text">{{ styleBadgeText }}</text>
            </view>
          </view>

          <!-- 4 块讲解(spec §3.4 _ContentCard 表格) -->
          <!-- 块 1:景点识别 -->
          <view class="content-block">
            <text class="content-block-title">{{ strings.block1Title }}</text>
            <text
              v-if="explainResult?.recognition_result"
              class="content-block-body"
            >{{ explainResult.recognition_result }}</text>
            <text
              v-else
              class="content-block-empty"
            >{{ strings.block1Empty }}</text>
          </view>

          <!-- 块 2:详细讲解 -->
          <view class="content-block">
            <text class="content-block-title">{{ strings.block2Title }}</text>
            <text
              v-if="explainResult?.explanation"
              class="content-block-body content-block-body-pre"
            >{{ explainResult.explanation }}</text>
            <text
              v-else
              class="content-block-empty"
            >{{ strings.block2Empty }}</text>
          </view>

          <!-- 块 3:实用信息(同 explanation 字段复用,per spec §6.3.1) -->
          <view class="content-block">
            <text class="content-block-title">{{ strings.block3Title }}</text>
            <text
              v-if="explainResult?.explanation"
              class="content-block-body content-block-body-pre"
            >{{ explainResult.explanation }}</text>
            <text
              v-else
              class="content-block-empty"
            >{{ strings.block3Empty }}</text>
          </view>

          <!-- 块 4:相关问答(chips) -->
          <view class="content-block">
            <text class="content-block-title">{{ strings.block4Title }}</text>
            <view
              v-if="explainResult?.follow_up_questions?.length"
              class="follow-up-row"
            >
              <view
                v-for="(q, idx) in explainResult.follow_up_questions"
                :key="idx"
                class="follow-up-chip"
                role="button"
                :aria-label="q"
                :aria-disabled="currentStep === 'chatting' ? 'true' : 'false'"
                :class="{ 'follow-up-chip-disabled': currentStep === 'chatting' }"
                hover-class="follow-up-chip-hover"
                :hover-stay-time="50"
                @click="onChipTap(q)"
              >
                <text class="follow-up-chip-text">❓ {{ q }}</text>
              </view>
            </view>
            <text
              v-else
              class="content-block-empty"
            >{{ strings.block4Empty }}</text>
          </view>

          <!-- 追问失败内联(per spec §5.3.K,chatting 失败 → _ErrorBanner 不切全屏) -->
          <ErrorBanner
            v-if="currentStep === 'result' && chatError"
            :message="chatError"
            :retryable="true"
            @retry="onRetryChat"
          />

          <!-- 追问 history 流(只在 chatHistory.length > 0 时渲染) -->
          <view
            v-if="chatHistory.length > 0"
            class="chat-history"
          >
            <view
              v-for="(msg, idx) in chatHistory"
              :key="idx"
              class="chat-bubble-wrap"
              :class="`chat-bubble-wrap-${msg.role}`"
            >
              <text
                class="chat-bubble-avatar"
                aria-hidden="true"
              >{{ msg.role === 'user' ? strings.chatUserAvatar : strings.chatAssistantAvatar }}</text>
              <view
                class="chat-bubble"
                :class="`chat-bubble-${msg.role}`"
              >
                <text
                  class="chat-bubble-role"
                >{{ msg.role === 'user' ? strings.chatRoleUser : strings.chatRoleAssistant }}</text>
                <text class="chat-bubble-content">{{ msg.content }}</text>
              </view>
            </view>
          </view>

          <!-- 聊天占位(currentStep='chatting' 时显示) -->
          <view
            v-if="currentStep === 'chatting'"
            class="chat-typing-wrap"
          >
            <text
              class="chat-bubble-avatar"
              aria-hidden="true"
            >{{ strings.chatAssistantAvatar }}</text>
            <view class="chat-bubble chat-bubble-assistant chat-bubble-typing">
              <text
                class="chat-bubble-role"
              >{{ strings.chatRoleAssistant }}</text>
              <view class="chat-typing-row">
                <text class="chat-typing-text">{{ strings.chatTyping }}</text>
                <view class="chat-typing-spinner" aria-hidden="true" />
              </view>
            </view>
          </view>

          <!-- _ChatInputBar(sticky bottom)— 在 result/chatting 态底部 -->
          <view class="chat-input-bar-wrap">
            <view
              v-if="chatHistory.length > 0"
              class="btn-clear-chat"
              role="button"
              :aria-label="strings.btnClearChat"
              hover-class="btn-clear-chat-hover"
              :hover-stay-time="50"
              @click="onClearChatTap"
            >
              <text class="btn-clear-chat-text" aria-hidden="true">🗑</text>
            </view>
            <view class="chat-input-field-wrap">
              <input
                v-model="chatInputDraft"
                class="chat-input-field"
                :placeholder="strings.chatInputPlaceholder"
                placeholder-class="chat-input-field-placeholder"
                :maxlength="500"
                :disabled="currentStep === 'chatting'"
                :aria-label="strings.chatInputPlaceholder"
                @confirm="onSendChat"
              />
            </view>
            <view
              class="btn-send"
              :class="{ 'btn-send-disabled': !canSendChat }"
              role="button"
              :aria-label="strings.btnSend"
              :aria-disabled="!canSendChat ? 'true' : 'false'"
              hover-class="btn-send-hover"
              :hover-stay-time="50"
              @click="onSendChat"
            >
              <text class="btn-send-text">{{ strings.btnSend }}</text>
            </view>
          </view>
        </view>

        <!-- ───────── error 态(全屏 _ErrorOverlay) ───────── -->
        <view
          v-else-if="currentStep === 'error'"
          class="panel-center"
        >
          <view class="error-icon" aria-hidden="true">⚠</view>
          <text class="panel-center-title error-message">{{ analyzeError || strings.errorFallback }}</text>
          <view
            class="btn-retry"
            role="button"
            :aria-label="OnboardingStrings.retry"
            hover-class="btn-retry-hover"
            :hover-stay-time="50"
            @click="onRetryAnalyze"
          >
            <text class="btn-retry-text">{{ OnboardingStrings.retry }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 清空对话确认弹窗(2 按钮:取消 / 清空,清空红色 Danger) -->
    <ClearChatConfirmDialog
      :visible="clearDialogVisible"
      :title="strings.clearDialogTitle"
      :message="strings.clearDialogMessage"
      :btn-confirm-label="strings.clearDialogConfirm"
      :btn-cancel-label="strings.clearDialogCancel"
      @confirm="onDialogConfirm"
      @cancel="onDialogCancel"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  PhotoGuideStrings,
  PhotoGuideStyleOptions,
  PhotoGuideStyleFromPrefMap,
  OnboardingStrings,
} from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import { logger } from '../../utils/logger.js'
import { useUserStore } from '../../stores/userStore.js'
import { useHomeStore } from '../../stores/homeStore.js'
import { explainPhoto, saveGuideResult } from '../../services/photos.js'
import { ApiError } from '../../services/preferences.js'
import ErrorBanner from '../../components/ErrorBanner.vue'
import SpotCard from '../../components/SpotCard.vue'
import ClearChatConfirmDialog from './components/ClearChatConfirmDialog.vue'

const strings = PhotoGuideStrings

// ─────────────── 类型定义(spec §4.1) ───────────────
/**
 * @typedef {import('../../api/types').PhotoStyle} PhotoStyle
 * @typedef {import('../../api/types').TripItem} TripItem
 * @typedef {import('../../api/types').TripSummary} TripSummary
 *
 * @typedef {Object} PhotoExplainData
 * @property {number} photo_id
 * @property {string} image_path
 * @property {string} recognition_result
 * @property {string} explanation
 * @property {string[]} follow_up_questions
 *
 * @typedef {Object} ChatMessage
 * @property {'user' | 'assistant'} role   沿用 api/types.ts:122 ChatRole 2 枚举(去掉 'system')
 * @property {string} content
 *
 * @typedef {'idle' | 'preview' | 'analyzing' | 'result' | 'chatting' | 'error'} PhotoGuideStep
 *   严格 6 枚举(spec §3.7 + §4.1)
 */

// ─────────────── 静态辅助函数(spec §5.5) ───────────────

/**
 * 从 `Preferences.explanation_style` 派生 `PhotoStyle`(per spec §4.2 + §5.5)
 * 缺省 / 异常 → fallback 'professional'
 * @param {import('../../api/types').Preferences | null} prefs
 * @returns {PhotoStyle}
 */
function decideStyleFromPrefs(prefs) {
  if (!prefs || !prefs.explanation_style) return 'professional'
  return /** @type {PhotoStyle} */ (
    PhotoGuideStyleFromPrefMap[prefs.explanation_style] || 'professional'
  )
}

/**
 * mapChooseError:uni.chooseImage fail 分支映射
 * - 主动 cancel → 返回空字符串(不切 error)
 * - 权限拒绝 / 系统错误 → 友好提示
 * @param {UniApp.GeneralCallbackResult | undefined} err
 * @returns {string} 友好提示;空字符串 = 用户主动取消(不切 error)
 */
function mapChooseError(err) {
  const msg = err?.errMsg || ''
  if (msg.includes('cancel')) return ''
  if (msg.includes('auth') || msg.includes('permission')) {
    return PhotoGuideStrings.errorBadRequest
  }
  return PhotoGuideStrings.errorFallback
}

/**
 * mapAnalyzeError:explainPhoto 失败映射 → 友好提示 + isUploadTimeout
 * @param {ApiError | Error | unknown} err
 * @returns {{ message: string, isUploadTimeout: boolean }}
 */
function mapAnalyzeError(err) {
  if (err && typeof err === 'object' && 'isNetworkError' in err && err.isNetworkError) {
    const m = /** @type {any} */ (err).message || ''
    return {
      message: m.includes('timeout') ? PhotoGuideStrings.errorUploadTimeout : PhotoGuideStrings.errorNetwork,
      isUploadTimeout: m.includes('timeout') || false,
    }
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const e = /** @type {any} */ (err)
    if (e.code === 4000 || e.statusCode === 400) return { message: PhotoGuideStrings.errorBadRequest, isUploadTimeout: false }
    if (e.code === 4002) return { message: PhotoGuideStrings.errorBadRequest, isUploadTimeout: false }
    if (e.code === 5001) return { message: PhotoGuideStrings.errorLLM, isUploadTimeout: false }
    if (e.code === 5000 || (e.statusCode >= 500 && e.statusCode < 600)) return { message: PhotoGuideStrings.errorServer, isUploadTimeout: false }
    return { message: PhotoGuideStrings.errorFallback, isUploadTimeout: false }
  }
  return { message: PhotoGuideStrings.errorFallback, isUploadTimeout: false }
}

/**
 * mapChatError:chatting 失败映射(同 mapAnalyzeError 但**不**切全屏 error,改内联 _ErrorBanner)
 * @param {ApiError | Error | unknown} err
 * @returns {string}
 */
function mapChatError(err) {
  return mapAnalyzeError(err).message
}

// ─────────────── Local State(spec §4.1) ───────────────

/** @type {import('vue').Ref<number | null>} URL ?fromSpot 解析结果 */
const fromSpotId = ref(null)
/** @type {import('vue').Ref<number | null>} URL ?tripId 解析结果(null → 后端 trip_id=0) */
const currentTripId = ref(null)
/** @type {import('vue').Ref<{ tripId: number; title: string } | null>} ?tripId 携带时找 homeStore.trips 派生 */
const currentTrip = ref(null)
/** @type {import('vue').Ref<TripItem | null>} ?fromSpot 携带时从 homeStore.today.today_items 找 */
const fromSpot = ref(null)
/** @type {import('vue').Ref<PhotoGuideStep>} 严格 6 枚举 */
const currentStep = ref('idle')
/** @type {import('vue').Ref<string | null>} 本地图片临时路径(由 uni.chooseImage 返回) */
const imagePath = ref(null)
/** @type {import('vue').Ref<string | null>} 预留字段(MVP 不使用,base64 上传由 uni.uploadFile 内部处理) */
const imageBase64 = ref(null)
/** @type {import('vue').Ref<number | null>} 图片字节数(由 uni.getFileInfo 拿) */
const imageSize = ref(null)
/** 当前讲解风格(从 userStore.preferences.explanation_style 派生,reactive 跟随 prefs 变化) */
const currentStyle = computed(() => decideStyleFromPrefs(userStore.preferences))
/** @type {import('vue').Ref<PhotoExplainData | null>} AI 响应数据(整段保存) */
const explainResult = ref(null)
/** @type {import('vue').Ref<ChatMessage[]>} 追问 history,page-local state */
const chatHistory = ref([])
/** @type {import('vue').Ref<boolean>} 上传超时子态(> 30s 触发) */
const isUploadTimeout = ref(false)
/** @type {import('vue').Ref<string | null>} 上传/AI 失败的友好提示(驱动 _ErrorOverlay 整页面板) */
const analyzeError = ref(null)
/** @type {import('vue').Ref<string | null>} chatting 失败的友好提示(驱动 _ErrorBanner 内联) */
const chatError = ref(null)
/** @type {import('vue').Ref<boolean>} _ClearChatConfirmDialog 显示标记 */
const clearDialogVisible = ref(false)
/** @type {import('vue').Ref<boolean>} image 加载失败占位标记 */
const imageLoadFailed = ref(false)
/** @type {import('vue').Ref<string>} chat input 草稿(input v-model) */
const chatInputDraft = ref('')
/** @type {import('vue').Ref<number | null>} 30s 超时 setTimeout id */
const analyzingTimerId = ref(null)
/** @type {import('vue').Ref<number | null>} 来自 SpotDetailSheet 浮层时,uni.navigateBack 优先 */
const previousPageIsFromSpot = ref(false)

// ─────────────── Computed ───────────────

/** analyzing 期间飞行中(派生) */
const isUploading = computed(() => currentStep.value === 'analyzing')
/** chatting 期间飞行中(派生,供 input + send 按钮 disabled 判定) */
const isChatting = computed(() => currentStep.value === 'chatting')
/** 4 块讲解卡有内容时,styleBadge 显示对应 label */
const styleBadgeText = computed(() => {
  if (!currentStyle.value) return strings.styleBadge
  const opt = PhotoGuideStyleOptions.find((o) => o.value === currentStyle.value)
  const label = opt ? opt.label : currentStyle.value
  return strings.styleBadge.replace('[style]', label)
})
/** 顶栏副标题「正在为 [tripTitle] 讲解」 */
const fromTripBannerTitle = computed(() => {
  if (!currentTrip.value) return ''
  return strings.fromTripBannerTitle.replace('[tripTitle]', currentTrip.value.title)
})
/** _FromSpotBanner 副标题「正在为 [spotTitle] 讲解」 */
const fromSpotBannerTitle = computed(() => {
  if (!fromSpot.value) return ''
  return strings.fromSpotBannerTitle.replace('[spotTitle]', fromSpot.value.title)
})
/** SpotCard 状态(MVP 简化:从 today 找出来的 spot,沿用原 status 派生) */
const fromSpotState = computed(() => {
  if (!fromSpot.value) return 'upcoming'
  // 简单派生:status='done' → done;'changed' → changed;否则 upcoming
  if (fromSpot.value.status === 'done') return 'done'
  if (fromSpot.value.status === 'changed') return 'changed'
  return 'upcoming'
})
/** 图片元信息:imagePath 截断 + size(失败 fallback) */
const imageMetaText = computed(() => {
  if (!imagePath.value) return strings.imageMetaFallback
  const name = imagePath.value.split('/').pop() || strings.imageMetaFallback
  if (typeof imageSize.value === 'number' && imageSize.value > 0) {
    const mb = (imageSize.value / 1024 / 1024).toFixed(2)
    return `${name} · ${mb}MB`
  }
  return name
})
/** chat 发送按钮可点判定:input 非空 + 不在 chatting 飞行中 */
const canSendChat = computed(() => {
  if (currentStep.value === 'chatting') return false
  return chatInputDraft.value.trim() !== ''
})

// ─────────────── Store ───────────────
const userStore = useUserStore()
const homeStore = useHomeStore()

// ─────────────── Handlers ───────────────

/**
 * onLoad 兼容层:从 uni-app 运行时拿当前页的 options(query 参数)
 * 优先用 onLoad(options) 钩子入参,fallback 用 getCurrentPages() 末项 options
 * (本工程未在 package.json 显式列 @dcloudio/uni-app,沿用 EditTripPage / TripDetailPage / SpotDetailSheet 既有模式)
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
    logger.warn('[PhotoGuidePage] getCurrentPages fail', err)
  }
  return undefined
}

/**
 * 解析 URL ?fromSpot + ?tripId(spec §5.1 步骤)
 * @param {Record<string, string | undefined> | undefined} query
 */
function parseQuery(query) {
  const rawFromSpot = query?.fromSpot
  const rawTripId = query?.tripId
  const parsedFromSpot = Number(rawFromSpot)
  const parsedTripId = Number(rawTripId)
  fromSpotId.value = Number.isFinite(parsedFromSpot) && parsedFromSpot > 0 ? parsedFromSpot : null
  currentTripId.value = Number.isFinite(parsedTripId) && parsedTripId > 0 ? parsedTripId : null
  // 浮层判断:若 fromSpot 携带,栈里有 SpotDetailSheet 来源
  if (fromSpotId.value !== null) {
    try {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      if (Array.isArray(pages) && pages.length > 1) {
        previousPageIsFromSpot.value = true
      }
    } catch (err) {
      logger.warn('[PhotoGuidePage] check fromSpot stack fail', err)
    }
  }
}

/**
 * 确保 userStore.preferences 已加载(供 currentStyle computed 派生)
 * 已有缓存 → 跳过;无则 fetch 一次;失败 fallback professional(由 decideStyleFromPrefs 兜底)
 * 不阻塞 UI(per spec §5.1)
 */
async function deriveDefaultStyle() {
  if (userStore.preferences) return
  try {
    await userStore.fetchPreferences()
  } catch (err) {
    // 失败时 preferences 保持 null → currentStyle computed 自然 fallback 'professional'
    logger.warn('[PhotoGuidePage] fetchPreferences failed, fallback to professional', err)
  }
}

/**
 * 派生 currentTrip + fromSpot 上下文(异步,不阻塞 UI)
 * per spec §5.1 步骤 2 + 3
 */
async function deriveContext() {
  // 步骤 2: ?tripId 携带 → 找 trip title
  if (currentTripId.value !== null) {
    try {
      if (homeStore.trips.length === 0 && !homeStore.isFetchingTrips) {
        await homeStore.fetchTrips()
      }
      const trip = homeStore.trips.find((t) => t.id === currentTripId.value)
      if (trip) {
        currentTrip.value = { tripId: trip.id, title: trip.title }
      } else {
        currentTrip.value = null
        logger.warn('[PhotoGuidePage] trip not found, fallback to trip context lost', { tripId: currentTripId.value })
      }
    } catch (err) {
      currentTrip.value = null
      logger.warn('[PhotoGuidePage] fetchTrips failed, fallback to trip context lost', err)
    }
  }

  // 步骤 3: ?fromSpot 携带 → 找 spot context
  if (fromSpotId.value !== null) {
    const items = homeStore.today?.today_items
    if (Array.isArray(items)) {
      const found = items.find((i) => i.id === fromSpotId.value)
      if (found) {
        fromSpot.value = /** @type {TripItem} */ (found)
      }
    }
  }
}

/**
 * onLoadPage 入口
 * @param {Record<string, string | undefined> | undefined} query
 */
async function onLoadPage(query) {
  // 重置 local state
  imagePath.value = null
  imageBase64.value = null
  imageSize.value = null
  currentStep.value = 'idle'
  explainResult.value = null
  chatHistory.value = []
  analyzeError.value = null
  chatError.value = null
  clearDialogVisible.value = false
  imageLoadFailed.value = false
  chatInputDraft.value = ''
  isUploadTimeout.value = false
  if (analyzingTimerId.value !== null) {
    clearTimeout(analyzingTimerId.value)
    analyzingTimerId.value = null
  }
  currentTrip.value = null
  fromSpot.value = null
  previousPageIsFromSpot.value = false

  // 解析 URL
  parseQuery(query)

  // 异步触发:默认风格映射 + 上下文派生(不阻塞 UI,per spec §5.1)
  deriveDefaultStyle()
  deriveContext()

  if (fromSpotId !== null && fromSpot.value) {
    logger.info('[PhotoGuidePage] onLoad with fromSpot', {
      fromSpotId: fromSpotId.value,
      currentTripId: currentTripId.value,
      spotTitle: fromSpot.value.title,
      tripTitle: currentTrip.value?.title || null,
      currentStyle: currentStyle.value,
    })
  } else {
    logger.info('[PhotoGuidePage] onLoad', {
      fromSpotId: fromSpotId.value,
      currentTripId: currentTripId.value,
      currentStyle: currentStyle.value,
    })
  }
}

/**
 * 用户点 拍照 / 相册 chip(per spec §5.2 Step 1)
 * @param {'camera' | 'album'} mode
 */
function onChooseImage(mode) {
  const sourceType = mode === 'camera' ? ['camera'] : ['album']
  uni.chooseImage({
    count: 1,
    sourceType,
    success: (res) => {
      const path = res?.tempFilePaths?.[0]
      if (!path) {
        // 异常:success 但没路径,降级为 fallback
        analyzeError.value = PhotoGuideStrings.errorFallback
        currentStep.value = 'error'
        logger.warn('[PhotoGuidePage] chooseImage success but no tempFilePaths', res)
        return
      }
      imagePath.value = path
      imageBase64.value = null
      imageLoadFailed.value = false
      // 拿图片 size(失败静默降级,fallback '已选图片')
      try {
        uni.getFileInfo({
          filePath: path,
          success: (info) => {
            if (typeof info?.size === 'number') {
              imageSize.value = info.size
            }
          },
          fail: () => {
            imageSize.value = null
          },
        })
      } catch (err) {
        imageSize.value = null
      }
      currentStep.value = 'preview'
      logger.info(mode === 'camera'
        ? '[PhotoGuidePage] image chosen (camera)'
        : '[PhotoGuidePage] image chosen (album)', { path: imagePath.value })
    },
    fail: (err) => {
      const mapped = mapChooseError(err)
      if (mapped === '') {
        // 主动 cancel
        logger.info('[PhotoGuidePage] chooseImage cancelled')
        return
      }
      // 权限拒绝或系统错误
      if (err?.errMsg?.includes('auth') || err?.errMsg?.includes('permission')) {
        logger.warn('[PhotoGuidePage] chooseImage permission denied', err)
      } else {
        logger.warn('[PhotoGuidePage] chooseImage failed', err)
      }
      analyzeError.value = mapped
      currentStep.value = 'error'
    },
  })
}

/**
 * 图片加载失败占位(spec §3.3 备注)
 */
function onImageError() {
  imageLoadFailed.value = true
  logger.warn('[PhotoGuidePage] image load error', { path: imagePath.value })
}

/**
 * preview 态点「重选」→ 清空 imagePath + imageBase64 + imageSize + 回 idle
 */
function onRetake() {
  imagePath.value = null
  imageBase64.value = null
  imageSize.value = null
  imageLoadFailed.value = false
  currentStep.value = 'idle'
  logger.info('[PhotoGuidePage] retake, back to idle')
}

/**
 * preview 态点「开始讲解」→ currentStep='analyzing' + 启动 30s 超时 + 调 explainPhoto
 * spec §5.2 Step 2
 */
function onConfirmAnalyze() {
  if (!imagePath.value) {
    // 防御性兜底(disabled 已防,这里是 0 概率兜底)
    analyzeError.value = PhotoGuideStrings.errorBadRequest
    currentStep.value = 'error'
    return
  }
  if (currentStep.value === 'analyzing' || currentStep.value === 'chatting') {
    return
  }
  currentStep.value = 'analyzing'
  analyzeError.value = null
  chatError.value = null
  isUploadTimeout.value = false
  logger.info('[PhotoGuidePage] analyze start', {
    style: currentStyle.value,
    imagePath: imagePath.value,
  })
  // 启动 30s 超时 setTimeout(spec §5.2 + §5.6 stale setTimeout guard)
  if (analyzingTimerId.value !== null) {
    clearTimeout(analyzingTimerId.value)
  }
  analyzingTimerId.value = setTimeout(() => {
    if (currentStep.value !== 'analyzing') return
    isUploadTimeout.value = true
    analyzeError.value = PhotoGuideStrings.errorUploadTimeout
    currentStep.value = 'error'
    logger.warn('[PhotoGuidePage] upload timeout')
  }, 30000)
  // 发起请求
  doExplainAnalyze()
}

/**
 * 实际发起 POST /api/photos/explain(主流程 analyze)
 */
async function doExplainAnalyze() {
  if (!imagePath.value) return
  const req = {
    image: imagePath.value,
  }
  try {
    const res = await explainPhoto(req)
    if (currentStep.value !== 'analyzing') return
    if (analyzingTimerId.value !== null) {
      clearTimeout(analyzingTimerId.value)
      analyzingTimerId.value = null
    }
    const data = res.data
    if (!data) {
      throw new ApiError({ code: res.code, message: res.message, statusCode: 200 })
    }
    explainResult.value = data
    chatHistory.value = [] // 每次新讲解清空 history
    // 配套:写入本地缓存,GuideResultPage ?photoId=xxx 直读(per specs/GuideResultPage.md §5.5 + C-7)
    // best-effort 语义:失败仅 logger.warn,不阻塞主流程(per spec §4.5)
    try {
      await saveGuideResult(data)
    } catch (err) {
      logger.warn('[PhotoGuidePage] saveGuideResult failed (non-fatal)', err)
    }
    currentStep.value = 'result'
    logger.info('[PhotoGuidePage] analyze ok', { photo_id: data.photo_id })
  } catch (err) {
    if (analyzingTimerId.value !== null) {
      clearTimeout(analyzingTimerId.value)
      analyzingTimerId.value = null
    }
    if (currentStep.value !== 'analyzing') return
    const mapped = mapAnalyzeError(err)
    isUploadTimeout.value = mapped.isUploadTimeout
    analyzeError.value = mapped.message
    currentStep.value = 'error'
    logger.error('[PhotoGuidePage] analyze failed', err)
  }
}

/**
 * chat input 发送按钮(per spec §5.2 Step 5 + §5.3.L 防抖)
 */
function onSendChat() {
  const content = chatInputDraft.value.trim()
  if (!content) return
  if (currentStep.value === 'chatting') return
  // push user msg
  chatHistory.value = [...chatHistory.value, { role: 'user', content }]
  chatInputDraft.value = ''
  chatError.value = null
  currentStep.value = 'chatting'
  logger.info('[PhotoGuidePage] chat sent', { content })
  // 发起请求
  doExplainChat()
}

/**
 * 实际发起追问 POST(per spec §5.2 Step 5)
 */
async function doExplainChat() {
  if (!imagePath.value) return
  const req = {
    image: imagePath.value,
  }
  try {
    const res = await explainPhoto(req)
    if (currentStep.value !== 'chatting') return
    const data = res.data
    if (!data) {
      throw new ApiError({ code: res.code, message: res.message, statusCode: 200 })
    }
    // push assistant msg(spec §5.2 + §5.3.A:移除 _ChatTyping 即 currentStep='result')
    const assistantContent = (data.explanation || data.recognition_result || '').toString()
    if (assistantContent) {
      chatHistory.value = [...chatHistory.value, { role: 'assistant', content: assistantContent }]
    }
    currentStep.value = 'result'
    logger.info('[PhotoGuidePage] chat reply ok', { content: assistantContent })
  } catch (err) {
    if (currentStep.value !== 'chatting') return
    // **不**清空 chatHistory(user msg 保留,per spec §5.3.K)
    const mapped = mapChatError(err)
    chatError.value = mapped
    // 不切全屏 error(整页面板过重,改内联 _ErrorBanner)
    currentStep.value = 'result'
    logger.error('[PhotoGuidePage] chat failed', err)
  }
}

/**
 * _ErrorBanner(chatting 失败内联)「重试」→ 重新 push user msg + 切 chatting + 重发
 */
function onRetryChat() {
  if (chatError.value === null) return
  if (chatHistory.length === 0) return
  const lastUserIdx = [...chatHistory.value].reverse().findIndex((m) => m.role === 'user')
  if (lastUserIdx === -1) return
  // 移除失败标记,回到 chatting 态重发
  chatError.value = null
  currentStep.value = 'chatting'
  logger.info('[PhotoGuidePage] chat retry')
  doExplainChat()
}

/**
 * 4 块 chip 点击 → 自动填入 input + 自动发送
 * per spec §5.2 Step 4 + §9 AC-15
 * @param {string} q
 */
function onChipTap(q) {
  if (currentStep.value === 'chatting') return
  if (!q) return
  chatInputDraft.value = q
  logger.info('[PhotoGuidePage] follow-up chip tapped', { content: q })
  // 自动触发发送(等同用户手输 + 点发送)
  onSendChat()
}

/**
 * 「🗑」清空按钮 → 弹 _ClearChatConfirmDialog
 */
function onClearChatTap() {
  if (chatHistory.value.length === 0) return
  clearDialogVisible.value = true
}

/**
 * _ClearChatConfirmDialog:确认清空
 * spec §5.2 Step 4 + §9 AC-16
 */
function onDialogConfirm() {
  const prevLength = chatHistory.value.length
  chatHistory.value = []
  clearDialogVisible.value = false
  logger.info('[PhotoGuidePage] chat cleared', { prevLength })
}

/**
 * _ClearChatConfirmDialog:取消 / 蒙层点击
 */
function onDialogCancel() {
  clearDialogVisible.value = false
}

/**
 * error 态「重试」→ 重新发起
 * spec §5.2 + §9 AC-11
 * - 上传超时 / analyze 失败 → 重新调 doExplainAnalyze(imagePath 保留)
 */
function onRetryAnalyze() {
  if (!imagePath.value) {
    // 没图 → 回到 idle
    currentStep.value = 'idle'
    analyzeError.value = null
    return
  }
  analyzeError.value = null
  chatError.value = null
  isUploadTimeout.value = false
  currentStep.value = 'analyzing'
  logger.info('[PhotoGuidePage] retry analyze')
  if (analyzingTimerId.value !== null) {
    clearTimeout(analyzingTimerId.value)
  }
  analyzingTimerId.value = setTimeout(() => {
    if (currentStep.value !== 'analyzing') return
    isUploadTimeout.value = true
    analyzeError.value = PhotoGuideStrings.errorUploadTimeout
    currentStep.value = 'error'
    logger.warn('[PhotoGuidePage] upload timeout (retry)')
  }, 30000)
  doExplainAnalyze()
}

/**
 * Header「←」/ 系统返回手势 → 走 onCancel 流程
 * spec §5.4
 */
function onCancel() {
  logger.info('[PhotoGuidePage] cancel', { currentStep: currentStep.value, hasImage: !!imagePath.value })
  if (currentStep.value === 'analyzing' || currentStep.value === 'chatting') {
    // 飞行中,无法中断(无 API abort);允许意图取消,等飞行结束自然切走
    logger.info('[PhotoGuidePage] cancel intent during flight, wait for completion')
    return
  }
  // 清理本地资源(per spec §5.4 + §5.6)
  imagePath.value = null
  imageBase64.value = null
  imageSize.value = null
  explainResult.value = null
  chatHistory.value = []
  analyzeError.value = null
  chatError.value = null
  if (analyzingTimerId.value !== null) {
    clearTimeout(analyzingTimerId.value)
    analyzingTimerId.value = null
  }
  // 关闭页面
  if (previousPageIsFromSpot.value) {
    // 来自 SpotDetailSheet 浮层 → 保留 stack
    uni.navigateBack({
      delta: 1,
      fail: () => {
        uni.switchTab({ url: AppRoutes.Home })
      },
    })
  } else {
    // 底部 Tab 直入 → 切到 Home Tab
    uni.switchTab({ url: AppRoutes.Home })
  }
}

// ─────────────── Lifecycle ───────────────

onMounted(() => {
  const options = getCurrentPageOptions() || {}
  onLoadPage(options)
})

onUnmounted(() => {
  if (analyzingTimerId.value !== null) {
    clearTimeout(analyzingTimerId.value)
    analyzingTimerId.value = null
  }
  logger.debug('[PhotoGuidePage] onUnmounted, currentStep=' + currentStep.value)
})
</script>

<style scoped>
.pgp-page {
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
  font-size: 40rpx;
  /* 20px */
  color: #2C2C2C;
  /* ink */
  line-height: 1;
  margin-top: -2rpx;
  /* 视觉居中补偿 */
}

.header-title-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  gap: 2rpx;
}

.header-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 44rpx;
  /* 22px,UI §三 page title */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.2;
  text-align: center;
}

.header-subtitle {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  /* 11px,小副标题 */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
  text-align: center;
  max-width: 80%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

/* ───────── Panel Center(analyzing / error) ───────── */
.panel-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
  gap: 16rpx;
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
  margin-top: 8rpx;
}

.panel-center-hint {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.4;
  text-align: center;
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

/* ───────── Idle Panel ───────── */
.panel-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0 80rpx;
  gap: 24rpx;
  box-sizing: border-box;
}

.from-spot-banner {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  box-sizing: border-box;
}

.from-spot-banner-header {
  display: flex;
  align-items: center;
  padding: 0 8rpx;
}

.from-spot-banner-eyebrow {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

.from-spot-banner-card {
  display: flex;
  align-items: stretch;
  /* SpotCard 是 240rpx 宽,居中显示 */
  justify-content: flex-start;
  box-sizing: border-box;
}

.idle-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  margin-top: 24rpx;
  box-sizing: border-box;
}

.idle-icon {
  font-size: 96rpx;
  line-height: 1;
}

.idle-hint {
  font-family: 'Noto Serif SC', serif;
  font-size: 32rpx;
  /* 16px,中标题 */
  font-weight: 500;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  text-align: center;
}

.idle-hint2 {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.4;
  text-align: center;
  margin-top: 8rpx;
}

/* ───────── Mode Toggle(2 chips) ───────── */
.mode-toggle {
  display: flex;
  width: 100%;
  gap: 16rpx;
  margin-top: 16rpx;
  box-sizing: border-box;
}

.mode-chip {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area */
  background: #FDFBF7;
  /* surfaceCard */
  border: 1.5px solid #E8E0D4;
  /* divider */
  border-radius: 9999px;
  /* radius-full */
  box-sizing: border-box;
  transition: background 0.15s ease-out, transform 0.15s ease-out;
}

.mode-chip-hover {
  transform: scale(0.96);
  background: #F2EBE0;
  /* surfaceWarm */
}

.mode-chip-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 500;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

/* ───────── Preview Panel ───────── */
.panel-preview {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  box-sizing: border-box;
}

.image-preview-wrap {
  width: 100%;
  aspect-ratio: 4 / 3;
  background: #F2EBE0;
  /* surfaceWarm */
  border-radius: 16px;
  /* radius-lg */
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  position: relative;
}

.image-preview {
  width: 100%;
  height: 100%;
}

.image-load-failed {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #9A9A9A;
  /* inkMuted */
}

.image-meta {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  /* 11px */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.4;
  margin-top: -8rpx;
}

/* ───────── Action Bar(双按钮横排) ───────── */
.action-bar {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
  box-sizing: border-box;
}

.btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area */
  border-radius: 9999px;
  box-sizing: border-box;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out;
}

.btn-retake {
  background: #F2EBE0;
  /* surfaceWarm */
}

.btn-retake-hover {
  opacity: 0.8;
}

.btn-retake-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 500;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.btn-confirm {
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
}

.btn-confirm-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.btn-confirm-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* ───────── Analyzing Panel ───────── */
.analyzing-image-wrap {
  width: 60%;
  aspect-ratio: 4 / 3;
  background: #F2EBE0;
  border-radius: 16px;
  overflow: hidden;
  opacity: 0.6;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
  box-sizing: border-box;
}

.analyzing-image {
  width: 100%;
  height: 100%;
}

/* ───────── Result Panel ───────── */
.panel-result {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding-bottom: 24rpx;
  box-sizing: border-box;
}

.result-top {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: 8rpx;
  box-sizing: border-box;
}

.result-top-image {
  width: 128rpx;
  height: 128rpx;
  border-radius: 12px;
  /* radius-md */
  background: #F2EBE0;
  flex-shrink: 0;
}

.result-style-badge {
  position: absolute;
  bottom: 0;
  left: 144rpx;
  /* image width 128 + 16 gap */
  padding: 4rpx 16rpx;
  background: rgba(45, 106, 94, 0.12);
  /* primarySoftStrong */
  border-radius: 9999px;
}

.result-style-badge-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  /* 11px */
  font-weight: 500;
  color: #2D6A5E;
  /* primary */
  line-height: 1.5;
}

/* ───────── Content Block(4 块讲解共用样式) ───────── */
.content-block {
  background: #FDFBF7;
  /* surfaceCard */
  border: 1.5rpx solid rgba(45, 106, 94, 0.06);
  /* borderSubtle */
  border-radius: 12px;
  /* radius-md */
  padding: 20rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.content-block-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 32rpx;
  /* 16px,块标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.content-block-body {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #2C2C2C;
  /* ink */
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}

.content-block-body-pre {
  white-space: pre-wrap;
}

.content-block-empty {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.5;
  font-style: italic;
}

/* ───────── Follow-up Chips(块 4) ───────── */
.follow-up-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 4rpx;
  box-sizing: border-box;
}

.follow-up-chip {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 88rpx;
  /* ≥ 44pt tap area */
  padding: 8rpx 20rpx;
  background: #F2EBE0;
  /* surfaceWarm */
  border-radius: 9999px;
  box-sizing: border-box;
  max-width: 100%;
  transition: background 0.15s ease-out, transform 0.15s ease-out;
}

.follow-up-chip-hover {
  background: #E8E0D4;
  transform: scale(0.96);
}

.follow-up-chip-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.follow-up-chip-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

/* ───────── Chat History(追问 history) ───────── */
.chat-history {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 8rpx;
  box-sizing: border-box;
}

.chat-bubble-wrap {
  display: flex;
  align-items: flex-start;
  gap: 8rpx;
  box-sizing: border-box;
}

.chat-bubble-wrap-user {
  flex-direction: row-reverse;
}

.chat-bubble-avatar {
  font-size: 32rpx;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 4rpx;
}

.chat-bubble {
  max-width: 75%;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  padding: 12rpx 16rpx;
  border-radius: 12px;
  box-sizing: border-box;
  word-break: break-word;
}

.chat-bubble-user {
  background: #F2EBE0;
  /* surfaceWarm */
  border-bottom-right-radius: 4rpx;
}

.chat-bubble-assistant {
  background: #FDFBF7;
  /* surfaceCard */
  border: 1.5rpx solid rgba(45, 106, 94, 0.06);
  border-bottom-left-radius: 4rpx;
}

.chat-bubble-typing {
  flex-direction: row;
  align-items: center;
  gap: 8rpx;
}

.chat-bubble-role {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 20rpx;
  /* 10px,小标签 */
  color: #9A9A9A;
  /* inkMuted */
  line-height: 1.4;
}

.chat-bubble-content {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #2C2C2C;
  /* ink */
  line-height: 1.5;
  white-space: pre-wrap;
}

.chat-typing-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.chat-typing-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  color: #5A5A5A;
  line-height: 1.4;
}

.chat-typing-spinner {
  width: 24rpx;
  height: 24rpx;
  border: 3rpx solid rgba(45, 106, 94, 0.12);
  border-top-color: #2D6A5E;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.chat-typing-wrap {
  display: flex;
  align-items: flex-start;
  gap: 8rpx;
  margin-top: 8rpx;
  box-sizing: border-box;
}

/* ───────── Chat Input Bar(sticky bottom) ───────── */
.chat-input-bar-wrap {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  background: #FDFBF7;
  /* surfaceCard */
  border-top: 1px solid rgba(45, 106, 94, 0.1);
  /* borderStrong */
  margin: 16rpx -40rpx -32rpx;
  /* 撑满 body-inner 水平边距外 */
  box-sizing: border-box;
}

.btn-clear-chat {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  min-width: 88rpx;
  min-height: 88rpx;
  /* ≥ 44pt tap area */
  border-radius: 9999px;
  background: #F2EBE0;
  /* surfaceWarm */
  flex-shrink: 0;
  box-sizing: border-box;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out;
}

.btn-clear-chat-hover {
  opacity: 0.8;
  transform: scale(0.96);
}

.btn-clear-chat-text {
  font-size: 32rpx;
  line-height: 1;
}

.chat-input-field-wrap {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
}

.chat-input-field {
  width: 100%;
  height: 80rpx;
  padding: 0 20rpx;
  background: #FDFBF7;
  border: 1.5px solid #E8E0D4;
  border-radius: 9999px;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  color: #2C2C2C;
  line-height: 1.4;
  box-sizing: border-box;
}

.chat-input-field-placeholder {
  color: #9A9A9A;
}

.btn-send {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  min-width: 120rpx;
  padding: 0 24rpx;
  background: linear-gradient(135deg, #2D6A5E 0%, #3D8B7D 100%);
  border-radius: 9999px;
  box-shadow: 0 4rpx 16rpx rgba(45, 106, 94, 0.35);
  flex-shrink: 0;
  box-sizing: border-box;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out;
}

.btn-send-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.btn-send-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.btn-send-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
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
  /* Sticky chat input bar 在大屏下也需保持原位(不被 max-width 截断),
     故 padding 反向抵消后保持全宽 */
  .chat-input-bar-wrap {
    margin-left: calc(50% - 320rpx);
    margin-right: calc(50% - 320rpx);
  }
}
</style>
