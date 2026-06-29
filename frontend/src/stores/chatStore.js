// frontend/stores/chatStore.js
// 智能对话域 Pinia store —— 唯一 owner of `messages` / `isLoading` / `error` / `currentIntent`
//
// Spec contract: specs/ChatPage.md §7.1
//
// state
//   messages        : MessageBubbleData[]    chat 历史消息列表(初始 [];MVP 不持久化,per spec §1)
//   isLoading       : boolean                fetchHistory 飞行标记(初始 false)
//   error           : ApiError | null        fetchHistory / sendMessage 失败的 ApiError(初始 null;**不**存 friendly mapped)
//   currentIntent   : string | null          最近一次 sendMessage 成功响应的 intent 字段(初始 null)
//   currentActionOptions: any[]               最近一次 sendMessage 成功响应的 action_options 字段(初始 [];2026-06-28
//                                              retro fix 修 silent drop,per issues/Spec/ChatPage-action-options-silent-drop-001.md)
//
// action
//   fetchHistory()              : Promise<void>          调 services/chat.getChatHistory();成功更新 messages + error=null;失败更新 error
//   sendMessage(text)           : Promise<void>          调 services/chat.sendChatMessage({ message: text });成功 append user msg + assistant msg + 更新 currentIntent;失败回退 user msg + 更新 error
//   sendPhotoMessage(imagePath) : Promise<void>          (v0.2.0)调 services/photos.explainPhoto;成功 append user msg(image)+ assistant msg(recognition_result + explanation);失败回退 user msg + 更新 error
//   applyReplanOption(option)   : Promise<void>          (v0.3.0)调 services/trips.updateTripItem(option.item_id, option.payload);成功 → fetchHistory 刷新;失败 → rethrow ApiError(per spec §3.9 + §6.6 + AC-22/23/24)
// (2026-06-24 Fix D:后端无对应端点,清空 action 整体移除,见 L218 audit trail)
//
// 复用(per AGENTS.md §5 store 惯例 + spec §3.12):
//   - ApiError class(services/preferences.js 跨 service 复用)
//   - services/chat.sendChatMessage + getChatHistory(HTTP 包装在 service,store 只调)
//   - logger(utils/logger.js)
//
// MVP 简化决策(spec §1 + §7.1 备注):
//   - messages **不**持久化到 uni.setStorageSync(沿 PhotoGuidePage chatHistory page-local 模式)
//   - currentIntent 放 store(便于跨页派生,per task 原文 L34 + plan-chat-p0a.yaml L131)
//   - error 字段存 ApiError 对象,**不**存 friendly mapped(由 page 层 mapHistoryError / mapSendError 派生)
//   - 错误向上抛,**不**静默吞(page 层 catch 后映射到 sendError / historyError)

import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  sendChatMessage as svcSendChatMessage,
  getChatHistory as svcGetChatHistory,
} from '../services/chat.js'
import { explainPhoto as svcExplainPhoto } from '../services/photos.js'
import { updateTripItem as svcUpdateTripItem } from '../services/trips.js'
import { ApiError } from '../services/preferences.js'
import { logger } from '../utils/logger.js'
import { useHomeStore } from './homeStore.js'

/**
 * @typedef {import('../api/types').ChatMessage} ChatMessage
 *
 * @typedef {Object} MessageBubbleData
 * @property {number} [id]                       server-side ChatMessage.id;page-local 临时 msg 可无
 * @property {'user' | 'assistant'} role        沿用 api/types.ts:156 ChatRole 2 枚举(去掉 'system',本页面无系统提示)
 * @property {string} content
 * @property {string} [created_at]               ISO 8601;server-side ChatMessage.created_at;page-local 临时 msg 可无
 * @property {string[]} [follow_up_questions]    仅最后一条 assistant msg 含此字段(从 ChatReplyData 派生);历史 assistant msg 不含
 * @property {string} [image]                    v0.2.0 新增,user msg 拍照时携带图片本地路径
 * @property {boolean} [image_failed]            v0.2.0 新增,sendPhotoMessage 失败时(预留 hook,本任务 MVP 标 true 但 UI 未消费)
 *
 * @typedef {string} ChatIntent  4 枚举(per spec §3.5):'replan' | 'apply-plan' | 'chat' | 'photo-guide'
 */

export const useChatStore = defineStore('chat', () => {
  // ───────── State ─────────
  /** @type {import('vue').Ref<MessageBubbleData[]>} */
  const messages = ref([])
  /** @type {import('vue').Ref<boolean>} */
  const isLoading = ref(false)
  /** @type {import('vue').Ref<ApiError | null>} */
  const error = ref(null)
  /** @type {import('vue').Ref<ChatIntent | null>} */
  const currentIntent = ref(null)
  /** @type {import('vue').Ref<any[]>} 2026-06-28 retro fix 修 silent drop(spec §3.9 + §9 AC-05 violation);
   *  最近一次 sendMessage 成功响应的 action_options 字段(初始 []);
   *  fetchHistory / sendPhotoMessage 入口处重置(防御性,sendPhotoMessage 不用 action_options) */
  const currentActionOptions = ref([])

  // ───────── Actions ─────────

  /**
   * 拉取历史对话 —— 调用 GET /api/chat/history
   * 成功 → messages = data.messages + error = null + currentIntent = null(per spec §5.1 步骤)
   * 失败 → error = err 向上抛(由 page 层 catch 后 mapHistoryError)
   *
   * 2026-06-24 真接入修复:
   *   - tripId **不**再从参数透传,内部从 useHomeStore().currentTripId 派生
   *     (per Q1 决策「chatStore 自动从 homeStore 拿」)
   *   - 无 active trip → 抛 ApiError(4000, '请先创建或选择旅行')(per Q2 a)
   *   - 接受 options.currentLocation(MVP 阶段 service getChatHistory 不接 location,**不**透传,留 hook 给未来)
   *
   * @param {{ currentLocation?: any }} [options]
   * @returns {Promise<void>}
   * @throws  {ApiError}
   */
  async function fetchHistory(options = {}) {
    isLoading.value = true
    try {
      // 2026-06-24 修复:tripId 从 homeStore.currentTripId 派生注入
      const tripId = useHomeStore().currentTripId
      if (tripId === null) {
        throw new ApiError({
          code: 4000,
          message: '请先创建或选择旅行',
          statusCode: 400,
        })
      }
      // 注:getChatHistory 是 GET,currentLocation 不参与(MVP 简化,per spec §6.2)
      const res = await svcGetChatHistory({ tripId })
      // 沿用 api/types.ts:158 ChatMessage 4 字段形状(spec §4.1 备注:fetchHistory 拉的消息不含 follow_up_questions)
      messages.value = Array.isArray(res?.data?.messages) ? res.data.messages : []
      error.value = null
      currentIntent.value = null
      // 2026-06-28 retro fix 修 silent drop:fetchHistory 入口重置 currentActionOptions(避免上次 session 残留)
      currentActionOptions.value = []
      logger.info('[chatStore.fetchHistory] ok', {
        count: messages.value.length,
        tripId,
        hasLocation: !!options.currentLocation,
      })
    } catch (err) {
      logger.error('[chatStore.fetchHistory] failed', err)
      error.value = err instanceof ApiError ? err : new ApiError({
        code: null,
        message: 'fetchHistory 未知错误',
        statusCode: 0,
      })
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 发送对话消息 —— 调用 POST /api/chat
   *
   * 实现(spec §5.2 Step 2):
   *   - 1) append user msg 到 messages(optimistic update,id 留空,等 server 响应)
   *   - 2) 调 sendChatMessage({ message: text.trim(), tripId, currentLocation })
   *   - 3a) Success → append assistant msg(含 follow_up_questions)+ 更新 currentIntent
   *   - 3b) Failure → 回退 user msg(messages.pop())+ error = err
   *
   * 入参 text 由 page 层先 trim + 校验(必填,本函数兜底再校验一次)
   *
   * 2026-06-24 真接入修复:
   *   - tripId **不**再从参数透传,内部从 useHomeStore().currentTripId 派生
   *     (per Q1 决策「chatStore 自动从 homeStore 拿」)
   *   - 无 active trip → 抛 ApiError(4000, '请先创建或选择旅行')(per Q2 a)
   *   - options.currentLocation: page 层 try getCurrentLocation 拿到才传(MVP 优雅降级,
   *     没拿到 → service 内部不上送该字段,per Q3)
   *
   * @param {string} text
   * @param {{ currentLocation?: any }} [options]
   * @returns {Promise<void>}
   * @throws  {ApiError}
   */
  async function sendMessage(text, options = {}) {
    const trimmed = typeof text === 'string' ? text.trim() : ''
    if (!trimmed) {
      logger.warn('[chatStore.sendMessage] empty message, skip')
      throw new ApiError({
        code: 4000,
        message: '消息内容不能为空',
        statusCode: 400,
      })
    }

    // 2026-06-24 修复:tripId 从 homeStore.currentTripId 派生注入
    const tripId = useHomeStore().currentTripId
    if (tripId === null) {
      throw new ApiError({
        code: 4000,
        message: '请先创建或选择旅行',
        statusCode: 400,
      })
    }

    // 1) append user msg(optimistic,id 留空)
    /** @type {MessageBubbleData} */
    const userMsg = {
      id: undefined,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    }
    messages.value.push(userMsg)
    const userMsgIndex = messages.value.length - 1

    try {
      // 2) 调 service(2026-06-24:带 tripId + 可选 currentLocation)
      const res = await svcSendChatMessage({
        message: trimmed,
        tripId,
        currentLocation: options.currentLocation,
      })
      // 3a) Success → append assistant msg
      const data = res?.data
      if (!data || typeof data.reply !== 'string') {
        throw new ApiError({
          code: 5000,
          message: 'AI 响应数据格式错误',
          statusCode: 500,
        })
      }
      /** @type {MessageBubbleData} */
      const assistantMsg = {
        id: undefined, // server 不返 msg id,仅返 reply 文本
        role: 'assistant',
        content: data.reply,
        created_at: new Date().toISOString(),
        follow_up_questions: Array.isArray(data.follow_up_questions) ? data.follow_up_questions : [],
      }
      messages.value.push(assistantMsg)
      currentIntent.value = (typeof data.intent === 'string' ? data.intent : 'chat')
      // 2026-06-28 retro fix 修 silent drop(spec §3.9 + §9 AC-05 violation):
      //   后端真传 data.action_options(replan 2 选项 / apply-plan apply 选项),前端必须写到 store
      //   让 page 层 handleIntentRouting 判定 `action_options.length > 0` 触发 ActionOptionsModal
      currentActionOptions.value = Array.isArray(data.action_options) ? data.action_options : []
      error.value = null
      logger.info('[chatStore.sendMessage] ok', {
        intent: currentIntent.value,
        messageCount: messages.value.length,
        tripId,
        hasLocation: !!options.currentLocation,
        action_options_count: currentActionOptions.value.length,
      })
    } catch (err) {
      // 3b) Failure → 回退 user msg(避免 user msg 单独残留)
      if (messages.value.length > userMsgIndex && messages.value[userMsgIndex] === userMsg) {
        messages.value.splice(userMsgIndex, 1)
      }
      logger.error('[chatStore.sendMessage] failed, user msg rolled back', err)
      error.value = err instanceof ApiError ? err : new ApiError({
        code: null,
        message: 'sendMessage 未知错误',
        statusCode: 0,
      })
      throw err
    }
  }

  /**
   * (2026-06-24 Fix D:清空 action 已删;store 暴露 fetchHistory + sendMessage 共 2 个 action)
   *
   * v0.2.0(2026-06-25)新增 sendPhotoMessage action(per spec §7.1.1):
   *   - 拍照讲解入口走 POST /api/photos/explain(multipart,per services/photos.explainPhoto)
   *   - 复用 services/photos.explainPhoto 既有函数(per spec §6.4 决策 #5 跨 service 复用)
   *   - 复用 services/preferences.ApiError 跨 service 错误归一
   *   - state 4 字段不变(messages / isLoading / error / currentIntent)
   *   - action 扩到 3 个(fetchHistory / sendMessage / sendPhotoMessage)
   */

  /**
   * v0.2.0(2026-06-25)新增 — 拍照讲解入口(action 3)
   *
   * 实现(spec §7.1.1):
   *   - 1) 入参校验:imagePath 非空
   *   - 2) 派生 tripId = useHomeStore().currentTripId(无 active trip → 抛 ApiError 4000)
   *   - 3) append user msg({role:'user', content:imageMessageTag, image:imagePath, created_at})
   *   - 4) 调 services/photos.explainPhoto({image:imagePath, tripId, currentLocation:options.currentLocation})
   *   - 5a) Success → append assistant msg({role:'assistant',
   *         content:recognition_result + '\n\n' + explanation,
   *         follow_up_questions, created_at}) + currentIntent='photo-guide' + error=null
   *   - 5b) Failure → 回退 user msg(splice(userMsgIndex, 1))+ error = err + rethrow
   *
   * 入参 imagePath 由 page 层 uni.chooseImage 返回的 tempFilePaths[0] 提供
   * options.currentLocation 由 page 层 try getCurrentLocation 拿到才传(MVP 优雅降级)
   *
   * @param {string} imagePath
   * @param {{ currentLocation?: import('../utils/location.js').LocationResult }} [options]
   * @returns {Promise<void>}
   * @throws  {ApiError}
   */
  async function sendPhotoMessage(imagePath, options = {}) {
    // 1) 入参校验
    if (typeof imagePath !== 'string' || !imagePath) {
      logger.warn('[chatStore.sendPhotoMessage] empty imagePath, reject')
      throw new ApiError({
        code: 4000,
        message: 'image 路径不能为空',
        statusCode: 400,
      })
    }

    // 2) 派生 tripId(与 sendMessage 同步,无 active trip → 抛 ApiError 4000)
    const tripId = useHomeStore().currentTripId
    if (tripId === null) {
      logger.warn('[chatStore.sendPhotoMessage] no active trip')
      throw new ApiError({
        code: 4000,
        message: '请先创建或选择旅行',
        statusCode: 400,
      })
    }

    // 3) append user msg(optimistic,id 留空)
    /** @type {MessageBubbleData} */
    const userMsg = {
      id: undefined,
      role: 'user',
      content: '[图片]',
      image: imagePath,
      created_at: new Date().toISOString(),
    }
    messages.value.push(userMsg)
    const userMsgIndex = messages.value.length - 1
    // 2026-06-28 retro fix 修 silent drop:sendPhotoMessage 入口重置 currentActionOptions(防御性,
    // photo 流程不触发改线意图,photo 接口也不返 action_options)
    currentActionOptions.value = []
    logger.info('[chatStore.sendPhotoMessage] start', {
      tripId,
      userMsgIndex,
      hasLocation: !!options.currentLocation,
    })

    try {
      // 4) 调 photo 接口(跨 service 复用 services/photos.explainPhoto)
      const res = await svcExplainPhoto({
        image: imagePath,
        tripId,
        currentLocation: options.currentLocation,
      })

      // 5a) Success → append assistant msg
      const data = res?.data
      if (!data || typeof data.recognition_result !== 'string' || typeof data.explanation !== 'string') {
        throw new ApiError({
          code: 5000,
          message: 'AI 讲解响应数据格式错误',
          statusCode: 500,
        })
      }
      /** @type {MessageBubbleData} */
      const assistantMsg = {
        id: undefined,
        role: 'assistant',
        content: `${data.recognition_result}\n\n${data.explanation}`,
        created_at: new Date().toISOString(),
        follow_up_questions: Array.isArray(data.follow_up_questions)
          ? data.follow_up_questions
          : [],
      }
      messages.value.push(assistantMsg)
      // photo 不触发改线意图(intent='photo-guide' 是 page-local 语义标签,page 层不弹 modal)
      currentIntent.value = 'photo-guide'
      error.value = null
      logger.info('[chatStore.sendPhotoMessage] ok', {
        photoId: data.photo_id,
        messageCount: messages.value.length,
        tripId,
      })
    } catch (err) {
      // 5b) Failure → 回退 user msg + error = err + rethrow
      if (
        messages.value.length > userMsgIndex
        && messages.value[userMsgIndex] === userMsg
      ) {
        messages.value.splice(userMsgIndex, 1)
      }
      logger.error('[chatStore.sendPhotoMessage] failed, user msg rolled back', err)
      error.value = err instanceof ApiError ? err : new ApiError({
        code: null,
        message: 'sendPhotoMessage 未知错误',
        statusCode: 0,
      })
      throw err
    }
  }

  /**
   * v0.3.0(2026-06-28)新增 — replan option 二次确认 → 调 PUT /api/trip-items/{item_id}
   * (per spec §3.9 step 1-6 + §6.6 端点契约 + AC-22/23/24)
   *
   * 实现:
   *   - 1) 校验 option 形状(option.item_id + option.payload 必填,缺则抛 Error 给 page 层 catch)
   *   - 2) 调 services/trips.updateTripItem(option.item_id, option.payload)
   *      (user_id 由 service 内部从 MVP_USER_ID 注入,page / store 不感知)
   *   - 3) Success → 刷新 chat history(per §3.9 step 4 + AC-22)
   *   - 4) Failure → rethrow ApiError(page 层 catch 后关闭 modal + Toast「改线失败」,**不**弹 _ErrorOverlay)
   *
   * 注:
   *   - 复用 services/trips.js:updateTripItem(per spec §6.6 端点契约 + AGENTS.md §4 跨 service 复用)
   *   - 复用 services/preferences.ApiError 跨 service 错误归一
   *   - 错误向上抛,**不**静默吞(per AGENTS.md §5 协议)
   *   - 不新建 services/chat-replan.js(spec §6.4 决策 #6 MVP YAGNI 显式登记)
   *
   * @param {any} option 后端 action_options[] 单元素形态
   *   { item_id: number, payload: object /* UpdateTripItemRequest subset *\/ }
   * @returns {Promise<void>} 成功 / 失败通知由 caller 处理(Toast)
   * @throws  {ApiError} PUT 失败透传
   * @throws  {Error} option 字段不全防御性兜底
   */
  async function applyReplanOption(option) {
    // 1) 防御性兜底:option / item_id / payload 缺失 → 抛 Error 让 page 层 catch
    if (
      !option
      || typeof option.item_id !== 'number'
      || !option.payload
      || typeof option.payload !== 'object'
    ) {
      logger.warn('[chatStore.applyReplanOption] invalid option shape', { option })
      throw new Error('replan option 字段不全(item_id / payload 缺失)')
    }

    const tripItemId = option.item_id
    const payload = option.payload

    logger.info('[chatStore.applyReplanOption] start', {
      tripItemId,
      payloadKeys: Object.keys(payload),
    })

    try {
      // 2) 调 service(沿 services/trips.updateTripItem v0.5.0 PUT partial-update + user_id 自动注入)
      await svcUpdateTripItem(tripItemId, payload)
      // 3) Success → 刷新 chat history(per spec §3.9 step 4 + AC-22)
      //   注:不解析 PUT 返回 data(per spec §6.6 备注「前端 MVP **不**消费 data 字段」);
      //   仅刷 history 让 user 看到含 replan 上下文的最新 messages。
      await fetchHistory()
      logger.info('[chatStore.applyReplanOption] ok', { tripItemId })
    } catch (err) {
      // 4) Failure → rethrow ApiError(page 层 catch 后走 §3.9 step 5 failure 分支:
      //   关闭 modal + Toast「改线失败」 + **不**自动重试 + **不**弹 _ErrorOverlay)
      logger.error('[chatStore.applyReplanOption] failed', err)
      throw err
    }
  }

  return {
    // state
    messages,
    isLoading,
    error,
    currentIntent,
    currentActionOptions,   // 2026-06-28 retro fix 暴露:per issues/Spec/ChatPage-action-options-silent-drop-001.md
    // actions
    fetchHistory,
    sendMessage,
    sendPhotoMessage,
    applyReplanOption,      // v0.3.0 新增:per spec §3.9 + §6.6 + AC-22
  }
})
