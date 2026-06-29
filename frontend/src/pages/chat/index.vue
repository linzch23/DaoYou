<!--
  pages/chat/index.vue — 智能对话独立 route 化主页面
  (沿 §8.8 修复后命名 = 主页面无前缀;私有子组件 PascalCase 无 `_` 前缀)

  Spec contract: specs/ChatPage.md v0.1.0
  Route: /pages/chat/index
  入口(本规格 v0.1.0):
    1) TripDetailPage 顶部「💬 找 AI 改线」按钮(per TripDetailPage v0.2.0 §3.5)
    2) EditTripPage 顶部「💬 询问 AI」按钮(per EditTripPage v0.1.0 §3.5)
    3) MyPage 菜单项「💬 智能对话」(新增,per §1.4)
  出口:
    Header「←」/ 系统返回手势 → onBack → uni.navigateBack({delta:1, fail: reLaunch Home})

  5 视图态(spec §3.11 + §4.1):
    loading  — onLoad fetchHistory 飞行中;_LoadingPanel
    idle     — fetchHistory 完成 + messages 空;_IdlePanel + InputBar enabled 但 disabled
    sending  — POST /api/chat 飞行中;_SendingPanel + 末尾 _TypingIndicator
    chatting — sendMessage 成功 + reply 已渲染 / fetchHistory 成功 + messages 加载完
    error    — fetchHistory / sendMessage 失败兜底;_ErrorPanel + BtnRetry

  复用(spec §3.12 + §10 + AGENTS.md §8.6/§8.8):
    - AppColors / AppRoutes.Chat / AppRoutes.Home
    - ChatPageStrings 25 键(本页面专属)
    - OnboardingStrings.errorNetwork / errorServer / errorFallback / retry 4 键复用
    - ApiError class(services/chat.js re-export 自 services/preferences.js,跨 service 复用)
    - useChatStore.fetchHistory() / sendMessage()(2 actions)
    - components/ErrorBanner(per AGENTS.md §8.8 修复后命名,跨页通用,13 page 落地)
    - 2 私有子组件:ActionOptionsModal / ApplyPlanConfirmDialog(2026-06-24 Fix D 移除 ClearHistoryConfirmDialog)
    - utils/logger(0 console.*)

  不复用 / 不复制(spec §3.12 + §10 R-2/R-4):
    - components/EmptyState / NextButton / SpotCard / TripCard / PhotoGuidePage(本页面无对应场景)
    - MessageBubble 不抽组件(MVP YAGNI,inline 渲染,沿 PhotoGuidePage §4.1 备注 4 决策)
    - 不新建 chatStore 之外的 store(MVP YAGNI,沿 PhotoGuidePage photoStore 不建实证)
    - 不实现收藏 / 分享(MVP 后端无对应域,沿 §6.4.3/§6.4.4)

  5 视图态 vs GuideResultPage 5 视图态差异(per memory §10 + §8.4):
    GuideResultPage 5 态 = loading / loaded / chatting / notfound / error
    ChatPage 5 态 = loading / idle / sending / chatting / error(无 notfound,MVP 无 URL params)
-->
<template>
  <view
    class="chat-page"
    :aria-label="ChatPageStrings.pageAria"
  >
    <!-- ───────── Header(顶栏 44pt) ───────── -->
    <view class="header">
      <view
        class="header-back"
        role="button"
        :aria-label="ChatPageStrings.backAria"
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
        <text class="header-title">{{ ChatPageStrings.title }}</text>
      </view>
      <view class="header-spacer" />
    </view>

    <!-- ───────── Body:可滚动,内容最大宽度 640rpx 居中(spec §3.8 H5 兼容性) ───────── -->
    <scroll-view
      class="body"
      scroll-y
      :enhanced="true"
      :show-scrollbar="false"
      :scroll-top="scrollTop"
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
          <text class="panel-center-title">{{ ChatPageStrings.loadingText }}</text>
        </view>

        <!-- ───────── idle 态 ───────── -->
        <view
          v-else-if="viewMode === 'idle'"
          class="panel-idle"
        >
          <view
            class="idle-icon"
            aria-hidden="true"
          >{{ ChatPageStrings.idleIcon }}</view>
          <text class="idle-hint">{{ ChatPageStrings.idleHint }}</text>
          <text class="idle-hint-sub">{{ ChatPageStrings.idleHintSub }}</text>
        </view>

        <!-- ───────── sending 态 / chatting 态 ───────── -->
        <view
          v-else-if="viewMode === 'sending' || viewMode === 'chatting'"
          class="panel-chat"
        >
          <!-- _MessageList(滚动区,v-for 渲染 messages,inline MessageBubble) -->
          <view class="message-list">
            <view
              v-for="(msg, idx) in chatStore.messages"
              :key="msg.id !== undefined ? msg.id : `idx-${idx}`"
              class="message-bubble"
              :class="`message-bubble-${msg.role}`"
            >
              <text
                class="message-avatar"
                aria-hidden="true"
              >{{ msg.role === 'user' ? '🧑' : '🤖' }}</text>
              <view
                class="message-content"
                :class="`message-content-${msg.role}`"
              >
                <!-- v0.2.0 移除「我/AI」label(per spec §3.4 + §10 NFR);role 视觉由 emoji avatar 区分 -->
                <!-- v0.2.0 新增 MessageImage(role='user' + msg.image 时,inline 渲染缩略图;tap → 全屏放大) -->
                <view
                  v-if="msg.role === 'user' && msg.image"
                  class="message-image-wrap"
                >
                  <MessageImage
                    :src="msg.image"
                    :max-width="200"
                    @tap="onMessageImageTap(msg)"
                  />
                </view>
                <text
                  class="message-text"
                  :class="`message-text-${msg.role}`"
                >{{ truncateContent(msg.content) }}</text>
                <!-- _FollowUpChips(仅 assistant msg + 末尾追加) -->
                <view
                  v-if="msg.role === 'assistant' && msg.follow_up_questions && msg.follow_up_questions.length > 0"
                  class="follow-up-chips"
                >
                  <view
                    v-for="(q, qIdx) in msg.follow_up_questions"
                    :key="qIdx"
                    class="follow-up-chip"
                  :class="{ 'follow-up-chip-disabled': viewMode === 'sending' || idx !== chatStore.messages.length - 1 }"
                    role="button"
                    :aria-label="q"
                    :aria-disabled="viewMode === 'sending' || idx !== chatStore.messages.length - 1 ? 'true' : 'false'"
                    hover-class="follow-up-chip-hover"
                    :hover-stay-time="50"
                    @click="onFollowUpClick(q, idx)"
                  >
                    <text class="follow-up-chip-text">💡 {{ q }}</text>
                  </view>
                </view>
                <view
                  v-if="msg.role === 'assistant' && msg.clarification_options && msg.clarification_options.length > 0"
                  class="follow-up-chips"
                >
                  <view
                    v-for="option in msg.clarification_options"
                    :key="option.option_id"
                    class="follow-up-chip"
                    :class="{ 'follow-up-chip-disabled': viewMode === 'sending' || idx !== chatStore.messages.length - 1 }"
                    role="button"
                    :aria-label="option.label"
                    :aria-disabled="viewMode === 'sending' || idx !== chatStore.messages.length - 1 ? 'true' : 'false'"
                    hover-class="follow-up-chip-hover"
                    :hover-stay-time="50"
                    @click="onClarificationOptionClick(option, idx)"
                  >
                    <text class="follow-up-chip-text">{{ option.label }}</text>
                  </view>
                </view>
              </view>
            </view>

            <!-- _TypingIndicator(仅 sending 态显示) -->
            <view
              v-if="viewMode === 'sending'"
              class="message-bubble message-bubble-assistant typing-indicator"
            >
              <text
                class="message-avatar"
                aria-hidden="true"
              >🤖</text>
              <view class="message-content message-content-assistant">
                <!-- v0.2.0 移除「我/AI」label(per spec §3.4 备注 5) -->
                <view class="typing-row">
                  <text class="typing-text">{{ ChatPageStrings.typingIndicator }}</text>
                  <view
                    class="typing-spinner"
                    aria-hidden="true"
                  />
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- ───────── error 态(整页 _ErrorPanel) ───────── -->
        <view
          v-else-if="viewMode === 'error'"
          class="panel-center"
        >
          <view
            class="error-icon"
            aria-hidden="true"
          >⚠</view>
          <text class="panel-center-title error-message">{{ historyError || sendError || OnboardingStrings.errorFallback }}</text>
          <!-- v0.5.0(2026-06-24)trip_id 修复:无 active trip → 显「去新建」按钮(per Q2 a) -->
          <view
            v-if="isNoActiveTripErrorState"
            class="btn-retry"
            role="button"
            :aria-label="BTN_GO_CREATE_TRIP_LABEL"
            hover-class="btn-retry-hover"
            :hover-stay-time="50"
            @click="onErrorAction"
          >
            <text class="btn-retry-text">{{ BTN_GO_CREATE_TRIP_LABEL }}</text>
          </view>
          <view
            v-else
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

    <!-- ───────── InputBar(sticky bottom,在 sending / chatting 态常驻) ───────── -->
    <!-- 历史(2026-06-24 Fix D):清空按钮已移除,后端无对应端点 -->
    <!-- v0.2.0:3 列布局 PhotoActionButton + InputField + BtnSend(per spec §3.5) -->
    <view
      v-if="viewMode === 'sending' || viewMode === 'chatting' || viewMode === 'idle'"
      class="input-bar-wrap"
    >
      <PhotoActionButton
        :visible="true"
        :disabled="viewMode === 'sending'"
        :aria-label="ChatPageStrings.btnPhotoAria"
        @tap="onPhotoTap"
      />
      <view class="input-field-wrap">
        <input
          v-model="draftMessage"
          class="input-field"
          :placeholder="ChatPageStrings.inputPlaceholder"
          placeholder-class="input-field-placeholder"
          :maxlength="500"
          :disabled="viewMode === 'sending'"
          :aria-label="ChatPageStrings.inputPlaceholder"
          @confirm="onSendTap"
        />
      </view>
      <view
        class="btn-send"
        :class="{ 'btn-send-disabled': !canSend }"
        role="button"
        :aria-label="ChatPageStrings.btnSend"
        :aria-disabled="!canSend ? 'true' : 'false'"
        hover-class="btn-send-hover"
        :hover-stay-time="50"
        @click="onSendTap"
      >
        <text class="btn-send-text">{{ ChatPageStrings.btnSend }}</text>
      </view>
    </view>

    <!-- 2 个 modal(条件渲染,2026-06-24 Fix D 移除 ClearHistoryConfirmDialog) -->
    <ActionOptionsModal
      :visible="actionOptionsVisible"
      :options="actionOptions"
      :title="ChatPageStrings.actionOptionsTitle"
      :btn-confirm-label="ChatPageStrings.actionOptionsConfirm"
      :btn-cancel-label="ChatPageStrings.actionOptionsCancel"
      :submitting="isApplyingAction"
      :invalid-message="actionOptionsInvalidMessage"
      @confirm="onActionOptionConfirm"
      @cancel="onActionOptionCancel"
    />

    <ApplyPlanConfirmDialog
      :visible="applyPlanDialogVisible"
      :title="ChatPageStrings.applyPlanTitle"
      :message="ChatPageStrings.applyPlanMessage"
      :btn-confirm-label="ChatPageStrings.applyPlanConfirm"
      :btn-cancel-label="ChatPageStrings.applyPlanCancel"
      @confirm="onApplyPlanConfirm"
      @cancel="onApplyPlanCancel"
    />

    <ApplyPlanConfirmDialog
      :visible="deleteConfirmVisible"
      :title="ChatPageStrings.deleteActionTitle"
      :message="ChatPageStrings.deleteActionMessage"
      :btn-confirm-label="ChatPageStrings.deleteActionConfirm"
      :btn-cancel-label="ChatPageStrings.deleteActionCancel"
      :submitting="isApplyingAction"
      :danger="true"
      @confirm="onDeleteActionConfirm"
      @cancel="onDeleteActionCancel"
    />

    <!-- v0.2.0 新增 2 modal(per spec §3.10 PhotoActionSheet + §3.12 ImagePreviewModal) -->
    <PhotoActionSheet
      :visible="actionSheetVisible"
      :title="ChatPageStrings.actionSheetTitle"
      :options="photoOptions"
      :btn-cancel-label="ChatPageStrings.actionSheetCancel"
      @select="onPhotoOptionSelect"
      @cancel="onPhotoSheetCancel"
    />

    <ImagePreviewModal
      :visible="imagePreviewVisible"
      :src="imagePreviewSrc || ''"
      @close="onImagePreviewClose"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import {
  ChatPageStrings,
  OnboardingStrings,
} from '../../constants/strings.js'
import { AppRoutes } from '../../constants/routes.js'
import { logger } from '../../utils/logger.js'
import { useChatStore } from '../../stores/chatStore.js'
import { storeToRefs } from 'pinia'  // 2026-06-28 retro fix 修 silent drop:把 page-local actionOptions ref 改读 store.currentActionOptions
import { useHomeStore } from '../../stores/homeStore.js'
import { ApiError } from '../../services/chat.js'
import { createTripDay, createTripItem, deleteTripItem, updateTripItem } from '../../services/trips.js'
import { getCurrentLocation, checkLocationPermission } from '../../utils/location.js'
import ActionOptionsModal from './components/ActionOptionsModal.vue'
import ApplyPlanConfirmDialog from './components/ApplyPlanConfirmDialog.vue'
// v0.2.0 新增 4 私有子组件(spec §3.10/§3.11/§3.4/§3.12 + §8.5/§8.6/§8.7/§8.8)
import PhotoActionButton from './components/PhotoActionButton.vue'
import PhotoActionSheet from './components/PhotoActionSheet.vue'
import MessageImage from './components/MessageImage.vue'
import ImagePreviewModal from './components/ImagePreviewModal.vue'

// ─────────────── 类型定义(spec §4.1) ───────────────
/**
 * @typedef {import('../../api/types').ChatMessage} ChatMessage
 *
 * @typedef {Object} MessageBubbleData
 * @property {number} [id]
 * @property {'user' | 'assistant'} role
 * @property {string} content
 * @property {string} [created_at]
 * @property {string[]} [follow_up_questions]
 * @property {{option_id:string,label:string,message:string}[]} [clarification_options]
 * @property {string} [image]            v0.2.0 新增,role='user' 拍照 msg 时携带图片本地路径
 * @property {boolean} [image_failed]    v0.2.0 新增,sendPhotoMessage 失败时标 ❌(MVP 预留 hook)
 *
 * @typedef {'loading' | 'idle' | 'sending' | 'chatting' | 'error'} ChatViewMode
 *   严格 5 枚举(spec §3.11 + §4.1;v0.2.0 photo 飞行中**复用** sending,**不**新增第 6 枚举)
 */

// ─────────────── 静态辅助函数 ───────────────

/**
 * 截断 chat 文本(spec §4.1 + §5.3 Q:5000 字符上限,超出加 "...")
 * @param {string} content
 * @returns {string}
 */
function truncateContent(content) {
  if (typeof content !== 'string') return ''
  if (content.length <= 5000) return content
  return content.slice(0, 5000) + '...'
}

// ─────────────── v0.5.0(2026-06-24)trip_id 修复:无 active trip 兜底文案(per Q2 a 决策)───────────────
// 注:本任务硬规则「只动 6 个文件 + 1 deliverable.md」,**不**在 constants/strings.js 加新键;
//    故 errorNoActiveTrip / btnGoCreateTrip 走 page-local const,后续若 spec 修订可挪到 ChatPageStrings。
const ERROR_NO_ACTIVE_TRIP_TEXT = '请先创建或选择旅行'
const BTN_GO_CREATE_TRIP_LABEL = '去新建'

/**
 * mapHistoryError:fetchHistory 失败 → 友好提示(spec §5.5 伪代码)
 * @param {ApiError | Error | unknown} err
 * @returns {string}
 */
function mapHistoryError(err) {
  if (err && typeof err === 'object' && 'isNetworkError' in err && err.isNetworkError) {
    return OnboardingStrings.errorNetwork
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const e = /** @type {any} */ (err)
    // 2026-06-24 修复:无 active trip(4000 + '请先创建或选择旅行')→ 专门文案 + 「去新建」按钮
    if (e.code === 4000 && e.message === ERROR_NO_ACTIVE_TRIP_TEXT) return ERROR_NO_ACTIVE_TRIP_TEXT
    if (e.code === 4000 || e.statusCode === 400) return ChatPageStrings.errorBadRequest
    if (e.code === 4001 || e.statusCode === 404) return ChatPageStrings.errorTripNotFound
    if (e.code === 5000 || (e.statusCode >= 500 && e.statusCode < 600)) {
      return ChatPageStrings.errorLLM
    }
  }
  return OnboardingStrings.errorFallback
}

/**
 * mapSendError:sendMessage 失败 → 友好提示(spec §5.5 伪代码)
 * @param {ApiError | Error | unknown} err
 * @returns {string}
 */
function mapSendError(err) {
  if (err && typeof err === 'object' && 'isNetworkError' in err && err.isNetworkError) {
    return OnboardingStrings.errorNetwork
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const e = /** @type {any} */ (err)
    // 2026-06-24 修复:无 active trip(4000 + '请先创建或选择旅行')→ 专门文案 + 「去新建」按钮
    if (e.code === 4000 && e.message === ERROR_NO_ACTIVE_TRIP_TEXT) return ERROR_NO_ACTIVE_TRIP_TEXT
    if (e.code === 4000 || e.statusCode === 400) return ChatPageStrings.errorBadRequest
    if (e.code === 4001 || e.statusCode === 404) return ChatPageStrings.errorTripNotFound
    if (e.code === 5000 || (e.statusCode >= 500 && e.statusCode < 600)) {
      return ChatPageStrings.errorLLM
    }
  }
  return OnboardingStrings.errorFallback
}

/**
 * isNoActiveTripError:判定错误是否为"无 active trip"场景(per 2026-06-24 Q2 a 决策)
 * error 模板按这个分支切 UI(显示「去新建」按钮,onErrorAction 跳 AppRoutes.NewTrip)
 * @param {ApiError | Error | unknown} err
 * @returns {boolean}
 */
function isNoActiveTripError(err) {
  if (!err || typeof err !== 'object' || !('code' in err)) return false
  const e = /** @type {any} */ (err)
  return e.code === 4000 && e.message === ERROR_NO_ACTIVE_TRIP_TEXT
}

/**
 * 优雅降级取定位:page 层 try getCurrentLocation(),失败 → null(per 2026-06-24 Q3)
 *
 * v0.5.0(2026-06-25 per Cross-Page issue location-real-fix-v2-2026-06-25 §2.5)增强:
 *   - 先查 `checkLocationPermission()` 权限状态(per user 2026-06-25 16:12 硬要求
 *     「坚决不能 mock 兜底」+ 「让用户知道定位失败」)
 *   - 'denied' → 弹 modal 引导到系统设置(uni.openAppAuthorizeSetting),返回 null
 *   - 'authorized' / 'not determined' → 调 `getCurrentLocation()` 拿真实位置
 *   - 拿定位失败:
 *     * PERMISSION_DENIED → 弹 modal(与 denied 路径同)
 *     * 其它(UNAVAILABLE / TIMEOUT / CANCELED)→ toast「定位失败,本次消息不附带位置」
 *   - 任何情况都不静默 catch,也不抛错阻塞主流程;返回 null 让后续业务继续走
 *
 * 失败显式告知用户(per spec §10 NFR「让用户知道操作结果」):
 *   - toast `icon: 'none'` 不显示 icon(避免误导)
 *   - duration: 2000ms(沿用 13 页面惯例)
 *
 * logger.warn 留痕(便于真机诊断)
 * @returns {Promise<import('../../utils/location.js').LocationResult | null>}
 */
async function tryGetLocationSafe() {
  // 0. 先查权限状态(per cross-page issue §2.5)
  const status = await checkLocationPermission()
  if (status === 'denied') {
    logger.warn('[chat.tryGetLocationSafe] permission denied', { status })
    uni.showModal({
      title: '需要定位权限',
      content: '请在系统设置中开启定位权限,以便为您提供位置相关的智能建议。',
      confirmText: '去设置',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // #ifdef APP-PLUS
          uni.openAppAuthorizeSetting({
            success: () => logger.info('[chat.tryGetLocationSafe] openAppAuthorizeSetting ok'),
            fail: (err) => logger.warn('[chat.tryGetLocationSafe] openAppAuthorizeSetting failed', err),
          })
          // #endif
          // #ifndef APP-PLUS
          // H5 / MP 无 openAppAuthorizeSetting API,提示用户自行到浏览器/系统设置开启
          uni.showToast({ title: '请在浏览器/系统设置中开启定位权限', icon: 'none', duration: 2500 })
          // #endif
        }
      },
    })
    return null
  }

  // 1. 拿定位
  try {
    const loc = await getCurrentLocation()
    logger.info('[chat] location ok', {
      latitude: loc.latitude,
      longitude: loc.longitude,
    })
    return loc
  } catch (err) {
    // 2. 失败显式 toast,不阻塞主流程
    logger.warn('[chat.tryGetLocationSafe] failed', {
      code: err?.code,
      message: err?.message,
    })
    if (err?.code === 'PERMISSION_DENIED') {
      // 上面 checkLocationPermission 已查过;运行时再被拒(罕见,系统权限中途回收)
      // 同样弹 modal 引导
      uni.showModal({
        title: '需要定位权限',
        content: '定位权限被回收,请在系统设置中重新开启。',
        confirmText: '去设置',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // #ifdef APP-PLUS
            uni.openAppAuthorizeSetting({
              success: () => logger.info('[chat.tryGetLocationSafe] openAppAuthorizeSetting ok (runtime denied)'),
              fail: (openErr) => logger.warn('[chat.tryGetLocationSafe] openAppAuthorizeSetting failed', openErr),
            })
            // #endif
          }
        },
      })
      return null
    }
    // 其它失败(UNAVAILABLE / TIMEOUT / CANCELED)→ 静默 toast,主流程继续
    uni.showToast({
      title: '定位失败,本次消息不附带位置',
      icon: 'none',
      duration: 2000,
    })
    return null
  }
}

// ─────────────── Local State(spec §4.1) ───────────────

/** @type {import('vue').Ref<ChatViewMode>} 严格 5 枚举 */
const viewMode = ref('loading')
// 2026-06-28 retro fix 修 silent drop:actionOptions 来源从 page-local ref 改读 store.currentActionOptions
//   (由 L558-559 `const { currentActionOptions: actionOptions } = storeToRefs(chatStore)` 解构派生);
//   后端真传 `data.action_options` 时 store sendMessage 成功分支会写入,page 模板 `:options="actionOptions"` 自动响应。
/** @type {import('vue').Ref<number | null>} ActionOptionsModal 中选中的 option 索引 */
const selectedOptionIdx = ref(null)
/** @type {import('vue').Ref<string>} _InputBar text-input v-model 绑值 */
const draftMessage = ref('')
/** @type {import('vue').Ref<string | null>} send 失败友好提示(驱动 _ErrorPanel 整页) */
const sendError = ref(null)
/** @type {import('vue').Ref<string | null>} fetchHistory 失败友好提示(驱动 _ErrorPanel 整页) */
const historyError = ref(null)
  // 2026-06-24 真接入修复:当前 chat 绑定的 trip id;onMounted 从 options.tripId 读取
  // (trip-detail / edit-trip 跳 chat 时带),无入参时默认 1(MVP user 1 第一个 active trip)
  const currentTripId = ref(1)

/** @type {import('vue').Ref<boolean>} ActionOptionsModal 显示标记 */
const actionOptionsVisible = ref(false)
/** @type {import('vue').Ref<boolean>} 行程项操作写入中，防止重复确认 */
const isApplyingAction = ref(false)
/** @type {import('vue').Ref<boolean>} 永久删除二次确认弹窗 */
const deleteConfirmVisible = ref(false)
/** @type {import('vue').Ref<any | null>} 等待最终确认的删除选项 */
const pendingDeleteOption = ref(null)
/**
 * v0.3.0 新增:ActionOptionsModal 校验失败顶部 banner 提示文案
 * (per spec §3.9 step 6 + AC-24;空串 = 隐藏 banner,非空 = 显示 banner + confirm 按钮 disabled)
 */
const actionOptionsInvalidMessage = ref('')
/** @type {import('vue').Ref<boolean>} ApplyPlanConfirmDialog 显示标记 */
const applyPlanDialogVisible = ref(false)
/** @type {import('vue').Ref<number>} scroll-view 滚动位置(新 reply 到达后设 999999 强制滚到底) */
const scrollTop = ref(0)
/** @type {import('vue').Ref<number>} 上一次 messages 数量 */
const lastMessageCount = ref(0)

// ─────────────── v0.2.0 新增 Local State(spec §4.1 + §3.10/§3.12) ───────────────
/** @type {import('vue').Ref<boolean>} PhotoActionSheet 显示标记(v0.2.0 新增) */
const actionSheetVisible = ref(false)
/** @type {import('vue').Ref<boolean>} ImagePreviewModal 显示标记(v0.2.0 新增) */
const imagePreviewVisible = ref(false)
/** @type {import('vue').Ref<string | null>} 全屏放大的图片 src(v0.2.0 新增) */
const imagePreviewSrc = ref(null)

// ─────────────── Computed ───────────────

/** 发送按钮可点判定(沿 PhotoGuidePage / GuideResultPage 同模式) */
const canSend = computed(() => {
  if (viewMode.value === 'sending') return false
  return draftMessage.value.trim() !== ''
})

// v0.2.0 新增:PhotoActionSheet 选项列表(拍照 / 相册)— spec §3.10
const photoOptions = [
  { icon: '📷', label: ChatPageStrings.actionSheetCamera, value: 'camera' },
  { icon: '🖼', label: ChatPageStrings.actionSheetAlbum, value: 'album' },
]

// ─────────────── Store ───────────────
const chatStore = useChatStore()
// 2026-06-28 retro fix 修 silent drop:把 actionOptions 派生自 store.currentActionOptions
//   (storeToRefs 解构出 ref,响应式 1:1 对齐;`actionOptions.value = []` 重置仍可直接写,
//    storeToRefs 解构出的 ref 是双向绑定的)
const { currentActionOptions: actionOptions } = storeToRefs(chatStore)

// v0.5.0(2026-06-24)trip_id 修复:无 active trip 错误态派生(error 模板按这个切「去新建」按钮)
// 派生:取 historyError / sendError 第一个匹配 isNoActiveTripError 的
const isNoActiveTripErrorState = computed(() => {
  // 注:state field 存的是 friendly mapped string,**不**能反推 err.code;改用 chatStore.error
  // chatStore.error 存原始 ApiError 对象(per chatStore.js §error 字段注释)
  return isNoActiveTripError(chatStore.error)
})

// ─────────────── Handlers ───────────────

/**
 * onLoad 兼容层(沿 GuideResultPage §5.1 模式):
 * 本页面 MVP 无 URL params,仅取 options 兜底日志
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
    logger.warn('[ChatPage] getCurrentPages fail', err)
  }
  return undefined
}

/**
 * fetchHistory + 视图决策(spec §5.1)
 * success → viewMode='idle'(空)/ 'chatting'(非空);failure → viewMode='error'
 *
 * 2026-06-24 真接入修复:
 *   - tripId 透传改为由 chatStore 内部从 homeStore.currentTripId 派生(per Q1 决策)
 *   - try getCurrentLocation(失败静默降级,per Q3)
 */
async function fetchHistoryAndDecide() {
  try {
    // 2026-06-24 修复:try getCurrentLocation 失败静默降级(per Q3)
    const location = await tryGetLocationSafe()
    await chatStore.fetchHistory({ currentLocation: location })
    if (chatStore.messages.length === 0) {
      viewMode.value = 'idle'
    } else {
      viewMode.value = 'chatting'
      // 滚到底(初始 history 加载完成)
      await nextTick()
      scrollTop.value = 999999
    }
    lastMessageCount.value = chatStore.messages.length
    logger.info('[ChatPage] fetchHistory ok', {
      count: chatStore.messages.length,
      viewMode: viewMode.value,
      hasLocation: !!location,
    })
  } catch (err) {
    historyError.value = mapHistoryError(err)
    viewMode.value = 'error'
    logger.error('[ChatPage] fetchHistory failed', err)
  }
}

/**
 * onLoadPage 入口
 */
async function onLoadPage() {
  // 2026-06-24 真接入修复:从 page options 读 tripId 派生 currentTripId
  // (trip-detail / edit-trip 跳 chat 时带 query `tripId=N`);无 query 时用 ref 默认 1
  // 2026-06-24 扩展(per task「每行程有独立 chatSession」):tripId 有效时显式 setCurrentTripId
  // 到 homeStore.forcedTripId,让 chatStore.fetchHistory 派生走对 trip session
  // (沿 Q1 决策 chatStore 自动从 homeStore 拿,本调用拓展派生链,不改 store 形态)
  const pageOptions = getCurrentPageOptions() || {}
  const optionTripId = pageOptions.tripId ?? pageOptions.trip_id
  if (optionTripId !== undefined && optionTripId !== null && optionTripId !== '') {
    const parsed = Number(optionTripId)
    if (Number.isFinite(parsed) && parsed > 0) {
      currentTripId.value = parsed
      useHomeStore().setCurrentTripId(parsed)
    }
  }

  // 重置 local state
  viewMode.value = 'loading'
  actionOptions.value = []
  selectedOptionIdx.value = null
  draftMessage.value = ''
  sendError.value = null
  historyError.value = null
  actionOptionsVisible.value = false
  applyPlanDialogVisible.value = false
  deleteConfirmVisible.value = false
  pendingDeleteOption.value = null
  scrollTop.value = 0
  lastMessageCount.value = 0
  // v0.2.0 新增:PhotoActionSheet + ImagePreviewModal 重置(spec §5.4 兜底)
  actionSheetVisible.value = false
  imagePreviewVisible.value = false
  imagePreviewSrc.value = null

  // 触发 fetchHistory
  await fetchHistoryAndDecide()

  logger.info('[ChatPage] onLoad', { viewMode: viewMode.value })
}

/**
 * intent 路由(per spec §5.2 Step 3)
 * - intent='replan' + action_options.length > 0 → 弹 ActionOptionsModal
 * - intent='apply-plan' → 弹 ApplyPlanConfirmDialog
 * - intent='chat' / null → 不弹任何 modal
 */
function handleIntentRouting() {
  const intent = chatStore.currentIntent
  if (intent === 'replan' && Array.isArray(actionOptions.value) && actionOptions.value.length > 0) {
    actionOptionsVisible.value = true
    logger.info('[ChatPage] intent=replan, show action options', {
      count: actionOptions.value.length,
    })
  } else if (intent === 'apply-plan') {
    applyPlanDialogVisible.value = true
    logger.info('[ChatPage] intent=apply-plan, show apply plan confirm')
  } else {
    // chat / null → 不弹 modal
    logger.info('[ChatPage] intent=chat, normal flow', { intent })
  }
}

/**
 * 「发送」按钮(per spec §5.2 Step 2)
 * 校验 → **v0.2.0 立即清空 input**(在 await 之前)+ viewMode='sending'
 *   → 调 chatStore.sendMessage → 成功 viewMode='chatting' + 滚到底
 *
 * v0.2.0 关键 UX 决策(per spec §3.5 + §5.2 Step 2):
 *   - draftMessage.value = '' 必须**在 await 之前**,用户视觉看到"已发送"状态 = input 空 + typing indicator
 *   - retry 时 draftMessage 已清空(用户需手动重输)
 */
async function onSendTap() {
  const text = draftMessage.value.trim()
  if (!text) {
    logger.warn('[ChatPage] send blocked, empty message')
    return
  }
  if (viewMode.value === 'sending') {
    // 重复点保护
    return
  }

  // v0.2.0 关键 UX:立即清空 input(在 await 之前,per spec §3.5 备注 + §5.2 Step 2)
  draftMessage.value = ''

  // 切到 sending(per spec §5.2 Step 2 校验通过)
  viewMode.value = 'sending'
  sendError.value = null
  // 重置 modal 状态(避免上一次的 modal 残留)
  actionOptions.value = []
  selectedOptionIdx.value = null
  actionOptionsVisible.value = false
  applyPlanDialogVisible.value = false
  deleteConfirmVisible.value = false
  pendingDeleteOption.value = null

  logger.info('[ChatPage] send start', { len: text.length })

  try {
    // 2026-06-24 修复:try getCurrentLocation 失败静默降级(per Q3)
    const location = await tryGetLocationSafe()
    // 2026-06-24 修复:tripId 由 chatStore 内部从 homeStore.currentTripId 派生(per Q1)
    await chatStore.sendMessage(text, { currentLocation: location })
    // 成功 → viewMode='chatting' + 滚到底
    // 注:v0.2.0 input 已在 await 之前清空,此处**不**再清空
    await nextTick()
    scrollTop.value = 999999
    lastMessageCount.value = chatStore.messages.length
    viewMode.value = 'chatting'
    logger.info('[ChatPage] send ok', {
      intent: chatStore.currentIntent,
      messageCount: chatStore.messages.length,
      hasLocation: !!location,
    })
    // intent 路由(per spec §5.2 Step 3)
    handleIntentRouting()
  } catch (err) {
    // 失败 → sendError + viewMode='error'(per spec §5.2 Step 2 failure)
    sendError.value = mapSendError(err)
    viewMode.value = 'error'
    logger.error('[ChatPage] send failed', err)
  }
}

/**
 * follow-up chip 点击 → 自动填入 input + 触发发送(per spec §5.2 Step 4)
 * @param {string} q
 * @param {number} messageIndex
 */
function onFollowUpClick(q, messageIndex) {
  if (viewMode.value === 'sending') return
  if (messageIndex !== chatStore.messages.length - 1) return
  if (!q) return
  draftMessage.value = q
  logger.info('[ChatPage] follow-up clicked', { text: q })
  // 自动触发发送
  onSendTap()
}

/**
 * 澄清选项显示 label，但向模型发送完整的用户第一人称回答 message。
 * @param {{option_id:string,label:string,message:string}} option
 * @param {number} messageIndex
 */
function onClarificationOptionClick(option, messageIndex) {
  if (viewMode.value === 'sending') return
  if (messageIndex !== chatStore.messages.length - 1) return
  const message = typeof option?.message === 'string' ? option.message.trim() : ''
  if (!message) return
  draftMessage.value = message
  logger.info('[ChatPage] clarification option clicked', {
    optionId: option.option_id,
    label: option.label,
  })
  onSendTap()
}

/**
 * 2026-06-24 Fix D 移除:onClearHistoryTap / onClearHistoryConfirm / onClearHistoryCancel
 * (清空对话纯 client-side,后端无对应端点;移除整个 modal 触发链)
 */

/**
 * ActionOptionsModal:确认后按 operation 调用现有 TripItem API。
 *
 * v0.3.0 升级(per spec §3.9 + §6.6 + AC-22/23/24):
 *   - 步骤 1 校验前置:item_id 缺失 OR payload 字段不全 → 显示
 *     `ChatPageStrings.replanInvalid` 内联 banner + **不**发起请求(spec §3.9 step 6 + AC-24)
 *   - 步骤 2 trip_id 校验:option 的 trip_id 必须匹配 homeStore.currentTripId
 *   - 步骤 3 调对应 operation:
 *       - `create_trip_item` → services/trips.createTripItem(必要时先 createTripDay 自动建日)
 *       - `update_trip_item` → chatStore.applyReplanOption(per spec §3.9 真接 PUT,内部统一日志 + 成功后 fetchHistory 刷新)
 *   - 步骤 4 success:关闭 modal + Toast + 清 banner
 *   - 步骤 5 failure:关闭 modal + Toast「应用失败」 + **不**弹 _ErrorOverlay + **不**自动重试
 *
 * @param {any} selectedOption 后端 action_options[] 单元素形态
 *   { item_id?: number, operation: 'create_trip_item' | 'update_trip_item', payload: object, trip_id: number, trip_day_id?: number, target_day_index?: number, target_date?: string }
 */
async function onActionOptionConfirm(selectedOption) {
  if (isApplyingAction.value) return
  if (selectedOption?.operation === 'delete_trip_item') {
    pendingDeleteOption.value = selectedOption
    actionOptionsVisible.value = false
    deleteConfirmVisible.value = true
    return
  }
  await applyActionOption(selectedOption)
}

async function applyActionOption(selectedOption) {
  if (isApplyingAction.value) return false

  const boundTripId = useHomeStore().currentTripId
  const optionTripId = Number(selectedOption?.trip_id)

  if (!Number.isInteger(optionTripId) || optionTripId !== boundTripId) {
    uni.showToast({
      title: ChatPageStrings.actionOptionsInvalid,
      icon: 'none',
    })
    logger.warn('[ChatPage] action option trip mismatch', {
      optionTripId,
      boundTripId,
    })
    actionOptionsInvalidMessage.value = ''
    return false
  }

  const operation = selectedOption?.operation
  const rawPayload = selectedOption?.payload

  if (
    !selectedOption
    || !rawPayload
    || typeof rawPayload !== 'object'
    || Array.isArray(rawPayload)
  ) {
    actionOptionsInvalidMessage.value = ChatPageStrings.replanInvalid
    logger.warn('[ChatPage] action option invalid', { selectedOption })
    return false
  }

  const payload = sanitizeActionPayload(operation, rawPayload)

  // create 不要求 item_id；update/delete 必须有合法 item_id。
  if (
    ['update_trip_item', 'delete_trip_item'].includes(operation)
    && (!Number.isInteger(Number(selectedOption.item_id))
      || Number(selectedOption.item_id) <= 0)
  ) {
    actionOptionsInvalidMessage.value = ChatPageStrings.replanInvalid
    logger.warn('[ChatPage] action option missing item_id', {
      operation,
      itemId: selectedOption?.item_id,
    })
    return false
  }

  actionOptionsInvalidMessage.value = ''
  isApplyingAction.value = true

  try {
    if (operation === 'create_trip_item') {
      let tripDayId = Number(selectedOption?.trip_day_id)

      if (!Number.isInteger(tripDayId) || tripDayId <= 0) {
        const targetDayIndex = Number(selectedOption?.target_day_index)
        const targetDate = selectedOption?.target_date

        if (
          !Number.isInteger(targetDayIndex)
          || targetDayIndex <= 0
          || typeof targetDate !== 'string'
        ) {
          throw new Error('invalid trip day target')
        }

        const dayResult = await createTripDay(optionTripId, {
          day_index: targetDayIndex,
          trip_date: targetDate,
          summary: '',
        })

        tripDayId = Number(dayResult?.data?.trip_day_id)

        if (!Number.isInteger(tripDayId) || tripDayId <= 0) {
          throw new Error('invalid created trip_day_id')
        }
      }

      await createTripItem({
        trip_day_id: tripDayId,
        ...payload,
      })
    } else if (operation === 'update_trip_item') {
      const itemId = Number(selectedOption.item_id)

      // 使用 main 新增的 store 方法，成功后会刷新聊天历史。
      await chatStore.applyReplanOption({
        item_id: itemId,
        payload,
      })
    } else if (operation === 'delete_trip_item') {
      const itemId = Number(selectedOption.item_id)
      await deleteTripItem(itemId)
    } else {
      throw new Error('unsupported action operation')
    }

    actionOptionsVisible.value = false
    actionOptionsInvalidMessage.value = ''
    actionOptions.value = []

    const successTitle = operation === 'update_trip_item'
      ? ChatPageStrings.replanSuccess
      : ChatPageStrings.actionOptionsApplied

    uni.showToast({
      title: successTitle,
      icon: 'success',
      duration: 2000,
    })

    logger.info('[ChatPage] action option applied', {
      operation,
      optionTripId,
      itemId: selectedOption?.item_id,
    })

    return true
  } catch (err) {
    actionOptionsInvalidMessage.value = ''

    const failTitle = operation === 'update_trip_item'
      ? ChatPageStrings.replanError
      : ChatPageStrings.actionOptionsApplyFailed

    uni.showToast({
      title: failTitle,
      icon: 'none',
      duration: 2000,
    })

    logger.error('[ChatPage] action option apply failed', {
      operation,
      optionTripId,
      itemId: selectedOption?.item_id,
      error: err?.message,
      code: err?.code,
      statusCode: err?.statusCode,
    })

    return false
  } finally {
    isApplyingAction.value = false
  }
}

async function onDeleteActionConfirm() {
  if (!pendingDeleteOption.value || isApplyingAction.value) return
  const applied = await applyActionOption(pendingDeleteOption.value)
  if (applied) {
    deleteConfirmVisible.value = false
    pendingDeleteOption.value = null
  }
}

function onDeleteActionCancel() {
  if (isApplyingAction.value) return
  deleteConfirmVisible.value = false
  pendingDeleteOption.value = null
  actionOptionsVisible.value = true
}

function sanitizeActionPayload(operation, source) {
  if (!source || typeof source !== 'object') return {}
  const createFields = new Set([
    'city', 'title', 'item_type', 'start_time', 'end_time', 'address',
    'latitude', 'longitude', 'notes',
  ])
  const allowedFields = operation === 'update_trip_item'
    ? new Set([...createFields, 'status'])
    : createFields
  return Object.fromEntries(
    Object.entries(source).filter(([key, value]) => allowedFields.has(key) && value != null)
  )
}

/**
 * ActionOptionsModal:取消
 */
function onActionOptionCancel() {
  if (isApplyingAction.value) return
  actionOptionsVisible.value = false
  logger.info('[ChatPage] action option cancelled')
}

/**
 * ApplyPlanConfirmDialog:确认应用 → MVP 阶段仅 Toast「即将上线」(per spec §3.10)
 */
function onApplyPlanConfirm() {
  applyPlanDialogVisible.value = false
  uni.showToast({
    title: ChatPageStrings.applyPlanComingSoon,
    icon: 'none',
    duration: 2000,
  })
  logger.info('[ChatPage] apply plan confirmed (coming-soon toast)')
}

/**
 * ApplyPlanConfirmDialog:取消
 */
function onApplyPlanCancel() {
  applyPlanDialogVisible.value = false
  logger.info('[ChatPage] apply plan cancelled')
}

// ─────────────── v0.2.0 新增拍照 handlers(per spec §5.5 Step A/B/C/D)───────────────

/**
 * PhotoActionButton tap → 弹 PhotoActionSheet(spec §5.5 Step A)
 */
function onPhotoTap() {
  if (viewMode.value === 'sending') {
    // sending 态禁用(per spec §3.11 disabled 派生 + spec §3.14 InputBar 行为)
    return
  }
  actionSheetVisible.value = true
  logger.info('[ChatPage] photo action sheet open')
}

/**
 * PhotoActionSheet 选项 select(camera / album)→ uni.chooseImage(spec §5.5 Step A + §5.3 X)
 *
 * @param {string} value 'camera' | 'album'
 */
function onPhotoOptionSelect(value) {
  actionSheetVisible.value = false
  const sourceType = value === 'camera' ? 'camera' : 'album'
  logger.info('[ChatPage] choose image start', { sourceType })
  uni.chooseImage({
    count: 1,
    sourceType: [sourceType],
    success: (res) => {
      const imagePath = res?.tempFilePaths?.[0]
      if (imagePath) {
        logger.info('[ChatPage] choose image success', { sourceType })
        doSendPhotoMessage(imagePath)
      } else {
        logger.warn('[ChatPage] choose image success but no tempFilePaths', { res })
      }
    },
    fail: (err) => {
      // 用户取消(errMsg 含 'cancel')→ 静默(per spec §5.3 X);其它失败 → toast
      const errMsg = err?.errMsg || ''
      if (errMsg.indexOf('cancel') !== -1) {
        logger.info('[ChatPage] choose image cancelled', { errMsg })
        return
      }
      logger.warn('[ChatPage] choose image failed', { err })
      uni.showToast({
        title: ChatPageStrings.errorPhotoChoose,
        icon: 'none',
        duration: 2000,
      })
    },
  })
}

/**
 * PhotoActionSheet 取消(蒙层 / 取消按钮)
 */
function onPhotoSheetCancel() {
  actionSheetVisible.value = false
  logger.info('[ChatPage] photo sheet cancel')
}

/**
 * 调 chatStore.sendPhotoMessage 发送图片(spec §5.5 Step B)
 *
 * v0.2.0 错误处理(per spec §5.3 V + AC-16):
 *   - 不**切** viewMode='error'(避免污染 _ErrorPanel 整页)
 *   - 失败 → toast「图片发送失败」+ viewMode 回到之前的态(chatting)
 *   - chatStore 内部已经回退 user msg(per chatStore.sendPhotoMessage contract)
 * @param {string} imagePath
 */
async function doSendPhotoMessage(imagePath) {
  const prevViewMode = viewMode.value
  viewMode.value = 'sending'
  sendError.value = null
  logger.info('[ChatPage] photo send start')
  try {
    // 2026-06-24 修复:try getCurrentLocation 失败静默降级(per Q3)
    const location = await tryGetLocationSafe()
    await chatStore.sendPhotoMessage(imagePath, { currentLocation: location })
    // 成功 → viewMode='chatting' + 滚到底
    await nextTick()
    scrollTop.value = 999999
    lastMessageCount.value = chatStore.messages.length
    viewMode.value = 'chatting'
    logger.info('[ChatPage] photo send ok', {
      messageCount: chatStore.messages.length,
      hasLocation: !!location,
    })
  } catch (err) {
    // 失败 → 不切 error 态(per spec §5.3 V),回退到 prev viewMode(chatting 或 idle)
    logger.error('[ChatPage] photo send failed', err)
    viewMode.value = prevViewMode === 'sending' ? 'chatting' : prevViewMode
    uni.showToast({
      title: ChatPageStrings.errorPhotoSend,
      icon: 'none',
      duration: 2000,
    })
  }
}

/**
 * MessageImage tap → 全屏放大(spec §5.5 Step D)
 * @param {MessageBubbleData} msg
 */
function onMessageImageTap(msg) {
  if (!msg || !msg.image) return
  imagePreviewVisible.value = true
  imagePreviewSrc.value = msg.image
  logger.info('[ChatPage] image preview open', { src: msg.image })
}

/**
 * ImagePreviewModal 关闭(✕ / 蒙层 / 系统返回)
 */
function onImagePreviewClose() {
  imagePreviewVisible.value = false
  imagePreviewSrc.value = null
  logger.info('[ChatPage] image preview close')
}

/**
 * error 态「重试」按钮(per spec §5.3 O + P)
 * fetchHistory 失败 → 重调 fetchHistory;sendMessage 失败 → 重新 sendMessage
 * (draftMessage 在 send 失败时保留,直接重试)
 */
async function onRetry() {
  if (historyError.value !== null) {
    // fetchHistory 失败 → 重新 fetchHistory
    historyError.value = null
    viewMode.value = 'loading'
    logger.info('[ChatPage] retry fetchHistory')
    await fetchHistoryAndDecide()
  } else if (sendError.value !== null) {
    // sendMessage 失败 → 重新 sendMessage(draftMessage 保留)
    sendError.value = null
    logger.info('[ChatPage] retry send', { len: draftMessage.value.length })
    await onSendTap()
  } else {
    // 兜底(理论上不会发生)
    viewMode.value = 'loading'
    logger.info('[ChatPage] retry (fallback to fetchHistory)')
    await fetchHistoryAndDecide()
  }
}

/**
 * v0.5.0(2026-06-24)trip_id 修复:error 态「去新建」按钮(无 active trip 时显示)
 * 跳 AppRoutes.NewTrip(per Q2 a 决策,用户主动创建旅行)
 */
function onErrorAction() {
  logger.info('[ChatPage] no active trip, jump to new trip', {
    currentHistoryError: historyError.value,
    currentSendError: sendError.value,
  })
  uni.reLaunch({ url: AppRoutes.NewTrip })
}

/**
 * Header「←」/ 系统返回手势 → 走 onBack 流程(per spec §5.4)
 * - stack 存在 → uni.navigateBack({delta:1, fail: reLaunch Home})
 * - stack 不存在(直接深链)→ reLaunch Home 兜底
 */
function onBack() {
  logger.info('[ChatPage] back', {
    viewMode: viewMode.value,
    messageCount: chatStore.messages.length,
  })
  try {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    if (Array.isArray(pages) && pages.length > 1) {
      uni.navigateBack({
        delta: 1,
        fail: (err) => {
          logger.warn('[ChatPage] navigateBack failed, fallback to reLaunch', err)
          uni.reLaunch({ url: AppRoutes.Home })
        },
      })
      return
    }
  } catch (err) {
    logger.warn('[ChatPage] getCurrentPages fail in onBack', err)
  }
  // 兜底:stack 不存在或检测失败
  uni.reLaunch({ url: AppRoutes.Home })
}

// ─────────────── Lifecycle ───────────────

onMounted(() => {
  const options = getCurrentPageOptions() || {}
  logger.info('[ChatPage] onMounted, options=', options)
  onLoadPage()
})

onUnmounted(() => {
  // 兜底重置可见性(per spec §5.4;2026-06-24 Fix D:清空 dialog 已删)
  actionOptionsVisible.value = false
  applyPlanDialogVisible.value = false
  deleteConfirmVisible.value = false
  pendingDeleteOption.value = null
  // v0.2.0 新增:PhotoActionSheet + ImagePreviewModal 兜底关闭(spec §5.4)
  actionSheetVisible.value = false
  imagePreviewVisible.value = false
  imagePreviewSrc.value = null
  // 2026-06-24 扩展(per task「每行程有独立 chatSession」):清 homeStore.forcedTripId,
  // 避免 trip N 永远 forced 下次进 home page 又拿 trip N
  useHomeStore().clearCurrentTripId()
  logger.debug('[ChatPage] onUnmounted, viewMode=' + viewMode.value)
})
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  /* 2026-06-24 UI fix:从 min-height: 100vh 改 height: 100vh(同时用 100dvh 兜 iOS Safari
     地址栏跳)。min-height 在内容多(消息流长)时会撑高 page,window 出现整体滚动条,
     整页一起滚 → header 跟滚出 viewport。改 height 严格 100vh,window 永远不滚,
     body 内部 scroll-view 自己滚,header / input-bar 始终在 viewport 边缘 sticky。
     H5:100dvh 是 dynamic viewport(Chrome 108+/iOS Safari 15.4+),避免地址栏
     出现/消失时 viewport 跳。fallback 到 100vh 覆盖老浏览器。 */
  height: 100vh;
  height: 100dvh;
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
  box-sizing: border-box;
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

.header-spacer {
  width: 88rpx;
  /* 与 header-back 同宽,保证标题居中 */
  flex-shrink: 0;
}

/* ───────── Body ───────── */
.body {
  flex: 1;
  min-height: 0;
  /* 2026-06-24 UI fix:加 overflow: hidden,scroll-view 内嵌自己滚(uni-app H5
     编译为 div with overflow:auto)。外层 hidden 兜底,避免历史 chat 消息多时
     scroll-view 内容溢出 .body 边界撑高 page → window 滚动条又出现。
     注:scroll-view 标签自带 scroll-y,H5 端实际行为是 div with overflow:auto,
     父 .body hidden 不会卡死 scroll-view 内部滚动。 */
  overflow: hidden;
}

.body-inner {
  padding: 24rpx 40rpx 32rpx;
  /* space-lg / space-xl */
  box-sizing: border-box;
}

/* ───────── Panel Center(loading / error)───────── */
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
  justify-content: center;
  padding: 160rpx 40rpx;
  gap: 16rpx;
  min-height: 60vh;
  box-sizing: border-box;
}

.idle-icon {
  font-size: 120rpx;
  line-height: 1;
  text-align: center;
  margin-bottom: 16rpx;
}

.idle-hint {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 36rpx;
  /* 18px */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  text-align: center;
}

.idle-hint-sub {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
  text-align: center;
  max-width: 480rpx;
}

/* ───────── Chat Panel(sending / chatting)────────── */
.panel-chat {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding-bottom: 24rpx;
  box-sizing: border-box;
}

/* ───────── _MessageList ───────── */
.message-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  box-sizing: border-box;
}

.message-bubble {
  display: flex;
  align-items: flex-start;
  gap: 8rpx;
  box-sizing: border-box;
}

.message-bubble-user {
  flex-direction: row-reverse;
}

.message-avatar {
  font-size: 32rpx;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 4rpx;
}

.message-content {
  max-width: 70%;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  padding: 12rpx 16rpx;
  border-radius: 12px;
  box-sizing: border-box;
  word-break: break-word;
}

.message-content-user {
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft */
  border-bottom-right-radius: 0;
  align-items: flex-end;
}

.message-content-assistant {
  background: #FDFBF7;
  /* surfaceCard */
  border: 1.5rpx solid rgba(45, 106, 94, 0.06);
  border-bottom-left-radius: 0;
}

/* v0.2.0 移除 .message-role(per spec §3.4 备注 5 + §10 NFR):chat bubble 不渲染 roleUser/roleAssistant 文本,
   role 视觉由 emoji avatar 区分(🧑/🤖);roleUser/roleAssistant 字符串保留供 aria-label 使用 */

/* v0.2.0 新增:MessageImage wrap(在 message-content 内 inline 渲染) */
.message-image-wrap {
  display: block;
  margin-bottom: 4rpx;
  box-sizing: border-box;
}

.message-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-text-user {
  color: #2D6A5E;
  /* primary */
}

.message-text-assistant {
  color: #2C2C2C;
  /* ink */
}

/* ───────── _FollowUpChips ───────── */
.follow-up-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 8rpx;
  box-sizing: border-box;
}

.follow-up-chip {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 88rpx;
  /* ≥ 44pt tap area(per spec AC-11 + §10 NFR) */
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

/* ───────── _TypingIndicator ───────── */
.typing-indicator {
  margin-top: 4rpx;
}

.typing-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.typing-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  color: #5A5A5A;
  line-height: 1.4;
}

.typing-spinner {
  width: 24rpx;
  height: 24rpx;
  border: 3rpx solid rgba(45, 106, 94, 0.12);
  border-top-color: #2D6A5E;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* ───────── _InputBar(sticky bottom)────────── */
.input-bar-wrap {
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

/* 历史(2026-06-24 Fix D):清空按钮 CSS 同步清理,见 L215 audit trail */

.input-field-wrap {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
}

.input-field {
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

.input-field-placeholder {
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
  /* Sticky input bar 在大屏下也需保持原位(不被 max-width 截断),
     故 padding 反向抵消后保持全宽(沿用 PhotoGuidePage §8.3 + GuideResultPage §8.4 模式) */
  .input-bar-wrap {
    margin-left: calc(50% - 320rpx);
    margin-right: calc(50% - 320rpx);
  }
}
</style>
