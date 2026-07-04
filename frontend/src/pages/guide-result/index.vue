<!--
  pages/guide-result/index.vue — 讲解结果独立展示页(独立 route,深链 ?photoId=xxx 必填)

  Spec contract: specs/GuideResultPage.md v0.1.0
  Route: /pages/guide-result/index
  入口:
    1) PhotoGuidePage 「查看完整讲解」/ 追问完成后 → uni.navigateTo({url: AppRoutes.GuideResult + '?photoId=xxx'})
    2) HomePage / MyPage「最近讲解」列表项(per docs/交互设计.md §7.4 + §7.8)
    3) push 通知 / 外部 H5 深链(per spec §6.4.1 留 hook,MVP 缓存 miss 高)
  出口:
    1) Header「←」/ 系统返回手势 → onBack → uni.navigateBack({delta:1, fail: reLaunch Home})
    2) _NotFoundOverlay「返回首页」按钮 → uni.reLaunch({url: AppRoutes.Home})

  5 视图态(spec §3.7 / §4.1 / §5):
    loading  — 初始;_LoadingPanel + 转圈 + GuideResultStrings.loadingText
    loaded   — 缓存命中;_LoadedPanel(4 块讲解 + _ChatHistory + _ChatInputBar)
    chatting — 追问循环飞行中(衍生:复用 _LoadedPanel + 末尾追加 _ChatTyping,**不**切独立 7 态)
    notfound — URL 缺参/非数字/<=0 OR getGuideResult 返回 null(缓存 miss)→ _NotFoundOverlay
    error    — getGuideResult 抛 ApiError(网络断开 / 5xx) → _ErrorOverlay + 「重试」按钮

  复用(spec §3.9 + §10 R-1~R-4):
    - AppColors / AppRoutes.GuideResult / AppRoutes.Home
    - PhotoGuideStrings 25+ 键(顶栏 backAria / 4 块 / 风格 3 label / 追问循环 / 清空弹窗 / 错误兜底 / aria)
    - PhotoGuideStyleOptions + PhotoGuideStyleFromPrefMap(风格 chips 数据源 + 默认风格派生)
    - GuideResultStrings 7 键独有(title / loadingText / notFound × 3 / styleChangedToast / chatMockReply)
    - useUserStore.fetchPreferences()(默认风格映射,无则 fallback 'professional')
    - useHomeStore.fetchTrips() + homeStore.trips + homeStore.today(?tripId / ?fromSpot 携带时派生)
    - services/photos.getGuideResult(photoId) + saveGuideResult + loadGuideResults + clearGuideResult(本地缓存)
    - services/preferences.ApiError(跨域复用,来自 services/photos.js re-export)
    - components/_ErrorBanner(trip 解析失败内联 + 追问失败内联错误隔离,per §3 备注 3)
    - components/SpotCard(?fromSpot 携带时只展示不响应点击,沿用 PhotoGuidePage §3.9 决策)
    - pages/photo-guide/components/2 按钮清空确认 dialog(2026-06-24 Fix D 删除,沿用 chat page 移除决策)

  不复用 / 不复制(spec §3.9 + §10 R-4):
    - components/EmptyState / NextButton / TripCard / SpotTimeAxis / SpotDetailSheet(本页面无对应场景)
    - _DraftConfirmDialog(3 按钮草稿 vs 本页面 2 按钮清空,语义不同)
    - 不抽 _ContentCard / _ChatBubble / _LoadedPanel / _NotFoundOverlay / _ErrorOverlay(MVP YAGNI,inline 渲染)
    - 不新建 guideResultStore / chatStore(per §7.3 客户端 local 状态路径)
    - 不实现收藏 / 分享功能(per §6.4.3 / §6.4.4 MVP 后端无域)

  风格切换(spec §3.2 + §6.4.2):
    - MVP 阶段**纯前端**视觉态,只更新 page-local `currentStyle` + 风格徽章文案
    - **不**调任何 API(PATCH /api/users/me 不存在;PUT /api/preferences 由 StyleSettingPage 接管)
    - **不**触发 explanation 重生成(AI 已生成整段文本无法局部重生成)

  追问循环(spec §3.5 + §6.4.5):
    - MVP 阶段**不**真发追问:`explainPhoto` 内部走 uni.uploadFile 要求 filePath 本地路径,
      本页面读的是 server 缓存 image_path(per §6.1 冲突 + §6.4.5 Resolved)
    - page-local `setTimeout(500-1000ms)` 模拟 AI 响应(沿用 NewTripPage §5.3 客户端 mock 模式)
    - 模拟响应固定话术:GuideResultStrings.chatMockReply
    - 未来如需真追问,IssueManager 提议后端扩 `GET /api/photos/{photoId}/follow-up?question=xxx`
-->
<template>
  <view
    class="grp-page"
    :aria-label="PhotoGuideStrings.pageAria"
  >
    <!-- Header(顶栏 44pt,左「←」右 title) -->
    <view class="header">
      <view
        class="header-back"
        role="button"
        :aria-label="PhotoGuideStrings.backAria"
        hover-class="header-back-hover"
        :hover-stay-time="50"
        @click="onBack"
      >
        <text
          class="header-back-text"
          aria-hidden="true"
        >←</text>
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
        <!-- ───────── loading 态 ───────── -->
        <view
          v-if="viewMode === 'loading'"
          class="panel-center"
        >
          <view
            class="loading-spinner"
            aria-hidden="true"
          />
          <text class="panel-center-title">{{ strings.loadingText }}</text>
        </view>

        <!-- ───────── loaded 态 / chatting 态(衍生) ───────── -->
        <view
          v-else-if="viewMode === 'loaded' || viewMode === 'chatting'"
          class="panel-loaded"
        >
          <!-- 顶部 _ImagePreview(小图 128rpx,image_path 拼接 BASE_URL,失败占位) -->
          <view class="result-top">
            <image
              v-if="explainResult?.image_path"
              class="result-top-image"
              :src="fullImageUrl"
              mode="aspectFill"
              @error="onImageError"
            />
            <view
              v-else
              class="result-top-image result-top-image-placeholder"
            >
              <text class="result-top-image-placeholder-text">{{ PhotoGuideStrings.imageLoadFailed }}</text>
            </view>
            <view
              v-if="imageLoadFailed"
              class="result-top-image-failed"
            >
              <text class="result-top-image-failed-text">{{ PhotoGuideStrings.imageLoadFailed }}</text>
            </view>
            <view class="result-style-badge">
              <text class="result-style-badge-text">{{ styleBadgeText }}</text>
            </view>
          </view>

          <!-- (conditional) _FromSpotBanner -->
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

          <!-- (conditional) _FromTripBanner / _ErrorBanner(trip 解析失败) -->
          <view
            v-if="currentTrip"
            class="from-trip-banner"
          >
            <text class="from-trip-banner-text">{{ fromTripBannerTitle }}</text>
          </view>
          <ErrorBanner
            v-if="fromTripId !== null && currentTrip === null"
            :message="PhotoGuideStrings.errorNoTrip"
            :retryable="false"
          />

          <!-- _StyleSelector(3 chips) -->
          <view class="style-selector">
            <view
              v-for="opt in styleOptions"
              :key="opt.value"
              class="style-chip"
              :class="{ 'style-chip-selected': currentStyle === opt.value }"
              role="button"
              :aria-label="opt.label"
              :aria-pressed="currentStyle === opt.value"
              hover-class="style-chip-hover"
              :hover-stay-time="50"
              @click="onStyleChange(opt.value)"
            >
              <text
                class="style-chip-text"
                :class="{ 'style-chip-text-selected': currentStyle === opt.value }"
              >{{ opt.label }}</text>
            </view>
          </view>

          <!-- 4 块讲解(沿用 PhotoGuidePage inline 模式 per spec §3 备注 5) -->
          <!-- 块 1:景点识别 -->
          <view class="content-block">
            <text class="content-block-title">{{ PhotoGuideStrings.block1Title }}</text>
            <text
              v-if="explainResult?.recognition_result"
              class="content-block-body"
            >{{ explainResult.recognition_result }}</text>
            <text
              v-else
              class="content-block-empty"
            >{{ PhotoGuideStrings.block1Empty }}</text>
          </view>

          <!-- 块 2:详细讲解 -->
          <view class="content-block">
            <text class="content-block-title">{{ PhotoGuideStrings.block2Title }}</text>
            <text
              v-if="explainResult?.explanation"
              class="content-block-body content-block-body-pre"
            >{{ explainResult.explanation }}</text>
            <text
              v-else
              class="content-block-empty"
            >{{ PhotoGuideStrings.block2Empty }}</text>
          </view>

          <!-- 块 3:实用信息(同 explanation 字段复用,per spec §6.3.1 PD-001) -->
          <view class="content-block">
            <text class="content-block-title">{{ PhotoGuideStrings.block3Title }}</text>
            <text
              v-if="explainResult?.explanation"
              class="content-block-body content-block-body-pre"
            >{{ explainResult.explanation }}</text>
            <text
              v-else
              class="content-block-empty"
            >{{ PhotoGuideStrings.block3Empty }}</text>
          </view>

          <!-- 块 4:相关问答(chips,点击 → 自动填入 + 发送) -->
          <view class="content-block">
            <text class="content-block-title">{{ PhotoGuideStrings.block4Title }}</text>
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
                :aria-disabled="viewMode === 'chatting' ? 'true' : 'false'"
                :class="{ 'follow-up-chip-disabled': viewMode === 'chatting' }"
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
            >{{ PhotoGuideStrings.block4Empty }}</text>
          </view>

          <!-- 追问失败内联(per spec §5.3.K,chatting 失败 → _ErrorBanner 不切全屏) -->
          <ErrorBanner
            v-if="viewMode === 'loaded' && chatError"
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
              >{{ msg.role === 'user' ? PhotoGuideStrings.chatUserAvatar : PhotoGuideStrings.chatAssistantAvatar }}</text>
              <view
                class="chat-bubble"
                :class="`chat-bubble-${msg.role}`"
              >
                <text
                  class="chat-bubble-role"
                >{{ msg.role === 'user' ? PhotoGuideStrings.chatRoleUser : PhotoGuideStrings.chatRoleAssistant }}</text>
                <text class="chat-bubble-content">{{ msg.content }}</text>
              </view>
            </view>
          </view>

          <!-- 聊天占位(viewMode='chatting' 时显示) -->
          <view
            v-if="viewMode === 'chatting'"
            class="chat-typing-wrap"
          >
            <text
              class="chat-bubble-avatar"
              aria-hidden="true"
            >{{ PhotoGuideStrings.chatAssistantAvatar }}</text>
            <view class="chat-bubble chat-bubble-assistant chat-bubble-typing">
              <text
                class="chat-bubble-role"
              >{{ PhotoGuideStrings.chatRoleAssistant }}</text>
              <view class="chat-typing-row">
                <text class="chat-typing-text">{{ PhotoGuideStrings.chatTyping }}</text>
                <view
                  class="chat-typing-spinner"
                  aria-hidden="true"
                />
              </view>
            </view>
          </view>

          <!-- _ChatInputBar(sticky bottom)— 在 loaded/chatting 态底部 -->
          <!-- 历史(2026-06-24 Fix D):清空按钮已移除,后端无对应端点 -->
          <view class="chat-input-bar-wrap">
            <view class="chat-input-field-wrap">
              <input
                v-model="chatInputDraft"
                class="chat-input-field"
                :placeholder="PhotoGuideStrings.chatInputPlaceholder"
                placeholder-class="chat-input-field-placeholder"
                :maxlength="500"
                :disabled="viewMode === 'chatting'"
                :aria-label="PhotoGuideStrings.chatInputPlaceholder"
                @confirm="onSendChat"
              />
            </view>
            <view
              class="btn-send"
              :class="{ 'btn-send-disabled': !canSendChat }"
              role="button"
              :aria-label="PhotoGuideStrings.btnSend"
              :aria-disabled="!canSendChat ? 'true' : 'false'"
              hover-class="btn-send-hover"
              :hover-stay-time="50"
              @click="onSendChat"
            >
              <text class="btn-send-text">{{ PhotoGuideStrings.btnSend }}</text>
            </view>
          </view>
        </view>

        <!-- ───────── notfound 态(全屏 _NotFoundOverlay) ───────── -->
        <view
          v-else-if="viewMode === 'notfound'"
          class="panel-center"
        >
          <view
            class="notfound-emoji"
            aria-hidden="true"
          >{{ strings.notFoundEmoji }}</view>
          <text class="panel-center-title notfound-message">{{ strings.notFoundMessage }}</text>
          <view
            class="btn-back-home"
            role="button"
            :aria-label="strings.notFoundButton"
            hover-class="btn-back-home-hover"
            :hover-stay-time="50"
            @click="onNotFoundHome"
          >
            <text class="btn-back-home-text">{{ strings.notFoundButton }}</text>
          </view>
        </view>

        <!-- ───────── error 态(全屏 _ErrorOverlay) ───────── -->
        <view
          v-else-if="viewMode === 'error'"
          class="panel-center"
        >
          <view
            class="error-icon"
            aria-hidden="true"
          >⚠</view>
          <text class="panel-center-title error-message">{{ loadError || PhotoGuideStrings.errorFallback }}</text>
          <view
            class="btn-retry"
            role="button"
            :aria-label="OnboardingStrings.retry"
            hover-class="btn-retry-hover"
            :hover-stay-time="50"
            @click="onRetryLoad"
          >
            <text class="btn-retry-text">{{ OnboardingStrings.retry }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 2026-06-24 Fix D 移除:清空确认 dialog 整段(沿用 chat page 移除决策) -->
  </view>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  PhotoGuideStrings,
  PhotoGuideStyleOptions,
  PhotoGuideStyleFromPrefMap,
  GuideResultStrings,
  OnboardingStrings,
} from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import { logger } from '../../utils/logger.js'
import { useUserStore } from '../../stores/userStore.js'
import { useHomeStore } from '../../stores/homeStore.js'
import { getGuideResult, ApiError } from '../../services/photos.js'
import { BASE_URL } from '../../services/config.js'
import ErrorBanner from '../../components/ErrorBanner.vue'
import SpotCard from '../../components/SpotCard.vue'
// 2026-06-24 Fix D 移除:清空确认 dialog import + 整文件删除(沿用 chat page 移除决策)

const strings = GuideResultStrings
const styleOptions = PhotoGuideStyleOptions

// ─────────────── 类型定义(spec §4.1) ───────────────
/**
 * @typedef {import('../../api/types').PhotoStyle} PhotoStyle
 * @typedef {import('../../api/types').TripItem} TripItem
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
 * @typedef {'loading' | 'loaded' | 'chatting' | 'notfound' | 'error'} GuideResultStep
 *   严格 5 枚举(spec §3.7 + §4.1)
 */

// ─────────────── 静态辅助函数 ───────────────

/**
 * 拼装 image_path 完整 URL(spec §3.3 备注:`uploads/images/yurenmatou.jpg` → `${BASE_URL}/uploads/images/...`)
 * @param {string | undefined | null} imagePath
 * @returns {string}
 */
function buildFullImageUrl(imagePath) {
  if (!imagePath) return ''
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath
  return `${BASE_URL}/${imagePath.replace(/^\/+/, '')}`
}

/**
 * mapLoadError:getGuideResult 失败映射 → 友好提示
 * @param {ApiError | Error | unknown} err
 * @returns {string}
 */
function mapLoadError(err) {
  if (err && typeof err === 'object' && 'isNetworkError' in err && err.isNetworkError) {
    return PhotoGuideStrings.errorNetwork
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const e = /** @type {any} */ (err)
    if (e.code === 4000 || e.statusCode === 400) return PhotoGuideStrings.errorBadRequest
    if (e.code === 5000 || (e.statusCode >= 500 && e.statusCode < 600)) return PhotoGuideStrings.errorServer
    if (e.code === 4001 || e.statusCode === 404) return PhotoGuideStrings.errorFallback
  }
  return PhotoGuideStrings.errorFallback
}

// ─────────────── Local State(spec §4.1) ───────────────

/** @type {import('vue').Ref<number | null>} URL ?photoId 解析结果(null → notfound) */
const photoId = ref(null)
/** @type {import('vue').Ref<number | null>} URL ?fromSpot 解析结果 */
const fromSpotId = ref(null)
/** @type {import('vue').Ref<number | null>} URL ?tripId 解析结果 */
const fromTripId = ref(null)
/** @type {import('vue').Ref<{ tripId: number; title: string } | null>} ?tripId 携带时找 homeStore.trips 派生 */
const currentTrip = ref(null)
/** @type {import('vue').Ref<TripItem | null>} ?fromSpot 携带时从 homeStore.today.today_items 找 */
const fromSpot = ref(null)
/** @type {import('vue').Ref<GuideResultStep>} 严格 5 枚举 */
const viewMode = ref('loading')
/** @type {import('vue').Ref<PhotoStyle>} 当前讲解风格(初始从 userStore 派生) */
const currentStyle = ref('professional')
/** @type {import('vue').Ref<PhotoExplainData | null>} AI 响应数据(从本地缓存读取) */
const explainResult = ref(null)
/** @type {import('vue').Ref<ChatMessage[]>} 追问 history,page-local state */
const chatHistory = ref([])
/** @type {import('vue').Ref<string | null>} getGuideResult 失败的友好提示(驱动 _ErrorOverlay 整页面板) */
const loadError = ref(null)
/** @type {import('vue').Ref<string | null>} 追问失败的友好提示(驱动 _ErrorBanner 内联,不切 viewMode) */
const chatError = ref(null)
/** @type {import('vue').Ref<boolean>} image 加载失败占位标记 */
const imageLoadFailed = ref(false)
/** @type {import('vue').Ref<string>} chat input 草稿(input v-model) */
const chatInputDraft = ref('')
/** @type {import('vue').Ref<number | null>} page-local 追问模拟 setTimeout id */
const mockChatTimerId = ref(null)

// ─────────────── Computed ───────────────

/** chatting 期间飞行中(派生,供 input + send 按钮 disabled 判定) */
const isChatting = computed(() => viewMode.value === 'chatting')
/** image_path 拼接 BASE_URL 后的完整 URL */
const fullImageUrl = computed(() => buildFullImageUrl(explainResult.value?.image_path))
/** 风格徽章文案「按 [style] 讲解」占位符替换 */
const styleBadgeText = computed(() => {
  if (!currentStyle.value) return PhotoGuideStrings.styleBadge
  const opt = PhotoGuideStyleOptions.find((o) => o.value === currentStyle.value)
  const label = opt ? opt.label : currentStyle.value
  return PhotoGuideStrings.styleBadge.replace('[style]', label)
})
/** 顶栏副标题「正在为 [tripTitle] 讲解」 */
const fromTripBannerTitle = computed(() => {
  if (!currentTrip.value) return ''
  return PhotoGuideStrings.fromTripBannerTitle.replace('[tripTitle]', currentTrip.value.title)
})
/** _FromSpotBanner 副标题「正在为 [spotTitle] 讲解」 */
const fromSpotBannerTitle = computed(() => {
  if (!fromSpot.value) return ''
  return PhotoGuideStrings.fromSpotBannerTitle.replace('[spotTitle]', fromSpot.value.title)
})
/** SpotCard 状态(MVP 简化:沿用 PhotoGuidePage §3.9 决策) */
const fromSpotState = computed(() => {
  if (!fromSpot.value) return 'upcoming'
  if (fromSpot.value.status === 'done') return 'done'
  if (fromSpot.value.status === 'changed') return 'changed'
  return 'upcoming'
})
/** chat 发送按钮可点判定:input 非空 + 不在 chatting 飞行中 */
const canSendChat = computed(() => {
  if (viewMode.value === 'chatting') return false
  return chatInputDraft.value.trim() !== ''
})

// ─────────────── Store ───────────────
const userStore = useUserStore()
const homeStore = useHomeStore()

// ─────────────── Handlers ───────────────

/**
 * onLoad 兼容层:从 uni-app 运行时拿当前页的 options(query 参数)
 * 优先用 onLoad(options) 钩子入参,fallback 用 getCurrentPages() 末项 options
 * (本工程未在 package.json 显式列 @dcloudio/uni-app,沿用 PhotoGuidePage / TripDetailPage / EditTripPage 既有模式)
 * @returns {Record<string, string | undefined> | undefined}
 */

/**
 * 解析 URL ?photoId + ?fromSpot + ?tripId(spec §5.1 步骤)
 * photoId 必填校验:缺参 / 非数字 / <= 0 → null(由 onLoadPage 立即判 notfound)
 * fromSpotId / fromTripId 缺省/无效 → null(不强制要求)
 * @param {Record<string, string | undefined> | undefined} query
 */
function parseQuery(query) {
  const rawPhotoId = query?.photoId
  const parsedPhotoId = Number(rawPhotoId)
  photoId.value = Number.isFinite(parsedPhotoId) && parsedPhotoId > 0 ? parsedPhotoId : null

  const rawFromSpot = query?.fromSpot
  const parsedFromSpot = Number(rawFromSpot)
  fromSpotId.value = Number.isFinite(parsedFromSpot) && parsedFromSpot > 0 ? parsedFromSpot : null

  const rawTripId = query?.tripId
  const parsedTripId = Number(rawTripId)
  fromTripId.value = Number.isFinite(parsedTripId) && parsedTripId > 0 ? parsedTripId : null
}

/**
 * 默认风格派生:读 userStore.preferences 缓存,无则 fetch 一次
 * 失败 fallback 'professional',不阻塞 UI(per spec §4.2 + §5.1)
 */
async function deriveDefaultStyle() {
  if (userStore.preferences) {
    currentStyle.value = decideStyleFromPrefs(userStore.preferences)
    return
  }
  try {
    await userStore.fetchPreferences()
    currentStyle.value = decideStyleFromPrefs(userStore.preferences)
  } catch (err) {
    currentStyle.value = 'professional'
    logger.warn('[GuideResultPage] fetchPreferences failed, fallback to professional', err)
  }
}

/**
 * 从 `Preferences.explanation_style` 派生 `PhotoStyle`(per spec §4.2)
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
 * 派生 currentTrip + fromSpot 上下文(异步,不阻塞 UI)
 * per spec §5.1 步骤 2 + 3
 */
async function deriveContext() {
  // 步骤 2: ?tripId 携带 → 找 trip title
  if (fromTripId.value !== null) {
    try {
      if (homeStore.trips.length === 0 && !homeStore.isFetchingTrips) {
        await homeStore.fetchTrips()
      }
      const trip = homeStore.trips.find((t) => t.id === fromTripId.value)
      if (trip) {
        currentTrip.value = { tripId: trip.id, title: trip.title }
      } else {
        currentTrip.value = null
        logger.warn('[GuideResultPage] trip not found', { tripId: fromTripId.value })
      }
    } catch (err) {
      currentTrip.value = null
      logger.warn('[GuideResultPage] fetchTrips failed', err)
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
 * 读本地缓存讲解数据(spec §5.1 步骤 4 + §6.0)
 * cache hit → 'loaded';cache miss → 'notfound';ApiError → 'error'
 */
async function loadGuideResultFromCache() {
  if (photoId.value === null) return // 防御性兜底(理论上 onLoadPage 已判 notfound)
  try {
    const data = await getGuideResult(photoId.value)
    if (data) {
      explainResult.value = data
      viewMode.value = 'loaded'
      logger.info('[GuideResultPage] cache hit', { photoId: photoId.value })
    } else {
      // cache miss
      viewMode.value = 'notfound'
      logger.warn('[GuideResultPage] cache miss, notfound', { photoId: photoId.value })
    }
  } catch (err) {
    viewMode.value = 'error'
    loadError.value = mapLoadError(err)
    logger.error('[GuideResultPage] cache load failed', err)
  }
}

/**
 * onLoadPage 入口
 * @param {Record<string, string | undefined> | undefined} query
 */
async function onLoadPage(query) {
  // 重置 local state
  viewMode.value = 'loading'
  explainResult.value = null
  chatHistory.value = []
  loadError.value = null
  chatError.value = null
  imageLoadFailed.value = false
  chatInputDraft.value = ''
  if (mockChatTimerId.value !== null) {
    clearTimeout(mockChatTimerId.value)
    mockChatTimerId.value = null
  }
  currentStyle.value = 'professional'
  currentTrip.value = null
  fromSpot.value = null
  photoId.value = null
  fromSpotId.value = null
  fromTripId.value = null

  // 解析 URL
  parseQuery(query)

  // Step A(per spec §5.1):photoId 必填校验,缺省/无效 → 立即 notfound
  if (photoId.value === null) {
    viewMode.value = 'notfound'
    logger.warn('[GuideResultPage] notfound, bad photoId', { rawPhotoId: query?.photoId })
    return
  }

  // 异步触发:默认风格映射 + 上下文派生(不阻塞 UI)
  deriveDefaultStyle()
  deriveContext()

  // 读本地缓存(spec §5.1 步骤 4)
  await loadGuideResultFromCache()

  logger.info('[GuideResultPage] onLoad', {
    photoId: photoId.value,
    fromSpotId: fromSpotId.value,
    fromTripId: fromTripId.value,
    currentStyle: currentStyle.value,
    viewMode: viewMode.value,
  })
}

/**
 * 风格 chip 切换(per spec §3.2 + §5.2 Step 2 + §6.4.2 MVP 纯前端)
 * **不**发任何 API;只更新 page-local `currentStyle` + 风格徽章文案
 * @param {PhotoStyle} v
 */
function onStyleChange(v) {
  if (v === currentStyle.value) return
  const prev = currentStyle.value
  currentStyle.value = v
  logger.info('[GuideResultPage] style switched', { from: prev, to: v })
}

/**
 * 图片加载失败占位(per spec §3.3 备注)
 */
function onImageError() {
  imageLoadFailed.value = true
  logger.warn('[GuideResultPage] image load error', { path: explainResult.value?.image_path })
}

/**
 * 4 块 chip 点击 → 自动填入 input + 自动发送
 * per spec §5.2 Step 2 + §5.3.F
 * @param {string} q
 */
function onChipTap(q) {
  if (viewMode.value === 'chatting') return
  if (!q) return
  chatInputDraft.value = q
  logger.info('[GuideResultPage] follow-up chip tapped', { content: q })
  // 自动触发发送(等同用户手输 + 点发送)
  onSendChat()
}

/**
 * chat input 发送按钮(per spec §5.2 Step 3 + §5.3.H 防抖)
 * MVP 走 page-local mock(per §6.4.5),**不**真发 explainPhoto
 */
function onSendChat() {
  const content = chatInputDraft.value.trim()
  if (!content) return
  if (viewMode.value === 'chatting') return
  // push user msg
  chatHistory.value = [...chatHistory.value, { role: 'user', content }]
  chatInputDraft.value = ''
  chatError.value = null
  viewMode.value = 'chatting'
  logger.info('[GuideResultPage] chat sent (mock)', { content })
  // page-local mock 模拟 AI 响应(per spec §6.4.5)
  doMockChatReply(content)
}

/**
 * page-local mock 追问响应(per spec §6.4.5 + NewTripPage §5.3 客户端 AI mock 模式)
 * setTimeout(500-1000ms) → push assistant msg + viewMode='loaded'
 * 任何 0% 概率失败(此处无真网络)走 chatError 内联错误隔离
 * @param {string} _userContent
 */
function doMockChatReply(_userContent) {
  if (mockChatTimerId.value !== null) {
    clearTimeout(mockChatTimerId.value)
  }
  const delay = 500 + Math.floor(Math.random() * 500)
  mockChatTimerId.value = setTimeout(() => {
    // stale setTimeout guard(spec §5.6 模式)
    if (viewMode.value !== 'chatting') return
    // 模拟响应:固定话术(per spec §6.4.5)
    const assistantContent = GuideResultStrings.chatMockReply
    chatHistory.value = [...chatHistory.value, { role: 'assistant', content: assistantContent }]
    viewMode.value = 'loaded'
    logger.info('[GuideResultPage] chat reply ok (mock)', { content: assistantContent })
    mockChatTimerId.value = null
  }, delay)
}

/**
 * _ErrorBanner(chatting 失败内联)「重试」→ 重新 push user msg + 切 chatting + 重发
 * (MVP mock 阶段不重发,只清 chatError 标记;若未来真追问,此函数扩展 doExplainChat)
 */
function onRetryChat() {
  if (chatError.value === null) return
  chatError.value = null
  logger.info('[GuideResultPage] chat retry (no-op for mock)')
}

/**
 * 2026-06-24 Fix D 移除:onClearChatTap / onDialogConfirm / onDialogCancel
 * (清空对话纯 client-side,后端无对应端点;移除整个 modal 触发链)
 */

/**
 * error 态「重试」→ 重新读缓存(per spec §5.3 + §9 AC-08)
 */
function onRetryLoad() {
  if (photoId.value === null) return
  loadError.value = null
  viewMode.value = 'loading'
  logger.info('[GuideResultPage] retry load')
  loadGuideResultFromCache()
}

/**
 * notfound 态「返回首页」按钮 → uni.reLaunch({url: AppRoutes.Home})
 * (per spec §5.3 + §9 AC-03)
 */
function onNotFoundHome() {
  logger.info('[GuideResultPage] notfound, back to home')
  uni.reLaunch({ url: AppRoutes.Home })
}

/**
 * Header「←」/ 系统返回手势 → 走 onBack 流程(per spec §5.4)
 * - stack 存在 → uni.navigateBack({delta:1, fail: reLaunch Home})
 * - stack 不存在(直接深链)→ reLaunch Home 兜底
 */
function onBack() {
  logger.info('[GuideResultPage] back', { viewMode: viewMode.value })
  try {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    if (Array.isArray(pages) && pages.length > 1) {
      uni.navigateBack({
        delta: 1,
        fail: (err) => {
          logger.warn('[GuideResultPage] navigateBack failed, fallback to reLaunch', err)
          uni.reLaunch({ url: AppRoutes.Home })
        },
      })
      return
    }
  } catch (err) {
    logger.warn('[GuideResultPage] getCurrentPages fail in onBack', err)
  }
  // 兜底:stack 不存在或检测失败
  uni.reLaunch({ url: AppRoutes.Home })
}

// ─────────────── Lifecycle ───────────────

onLoad((options) => {
  onLoadPage(options || {})
})

onUnmounted(() => {
  if (mockChatTimerId.value !== null) {
    clearTimeout(mockChatTimerId.value)
    mockChatTimerId.value = null
  }
  // 历史(2026-06-24 Fix D):清空 dialog 可见性已删
  logger.debug('[GuideResultPage] onUnmounted, viewMode=' + viewMode.value)
})
</script>

<style scoped>
.grp-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #F7F3EC;
  /* Surface,见 UI §二 */
  position: relative;
  box-sizing: border-box;
  animation: pageEnter 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
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

/* ───────── Panel Center(loading / notfound / error) ───────── */
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

.notfound-emoji {
  font-size: 96rpx;
  line-height: 1;
  text-align: center;
}

.notfound-message {
  max-width: 80%;
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

.btn-back-home {
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

.btn-back-home-hover {
  transform: scale(0.96);
  box-shadow: 0 2rpx 8rpx rgba(45, 106, 94, 0.35);
}

.btn-back-home-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 30rpx;
  /* 15px */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.4;
}

/* ───────── Loaded Panel ───────── */
.panel-loaded {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding-bottom: 24rpx;
  box-sizing: border-box;
}

/* ───────── _FromSpotBanner ───────── */
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
  justify-content: flex-start;
  box-sizing: border-box;
}

/* ───────── _FromTripBanner ───────── */
.from-trip-banner {
  width: 100%;
  background: rgba(45, 106, 94, 0.06);
  /* primarySoft */
  border-radius: 12px;
  /* radius-md */
  padding: 12rpx 20rpx;
  box-sizing: border-box;
}

.from-trip-banner-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #2D6A5E;
  /* primary */
  font-weight: 500;
  line-height: 1.4;
}

/* ───────── _ImagePreview(top)───────── */
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
  /* surfaceWarm */
  flex-shrink: 0;
}

.result-top-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-top-image-placeholder-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  color: #9A9A9A;
  text-align: center;
  padding: 0 8rpx;
}

.result-top-image-failed {
  position: absolute;
  top: 0;
  left: 0;
  width: 128rpx;
  height: 128rpx;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.result-top-image-failed-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  color: #FFFFFF;
  text-align: center;
  padding: 0 8rpx;
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

/* ───────── Style Selector(3 chips) ───────── */
.style-selector {
  display: flex;
  gap: 12rpx;
  margin-top: 8rpx;
  box-sizing: border-box;
}

.style-chip {
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
  transition: background 0.15s ease-out, border-color 0.15s ease-out, transform 0.15s ease-out;
}

.style-chip-hover {
  transform: scale(0.96);
}

.style-chip-selected {
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft */
  border-color: #2D6A5E;
  /* primary */
}

.style-chip-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.style-chip-text-selected {
  color: #2D6A5E;
  /* primary */
  font-weight: 500;
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

/* 历史(2026-06-24 Fix D):清空按钮 CSS 同步清理,见 L312 audit trail */

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
  /* ≥ 44pt tap area(per spec AC-11 + §10 NFR) */
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
     故 padding 反向抵消后保持全宽(沿用 PhotoGuidePage §8.3 模式) */
  .chat-input-bar-wrap {
    margin-left: calc(50% - 320rpx);
    margin-right: calc(50% - 320rpx);
  }
}
</style>
