// frontend/api/mock/chat.ts
// 覆盖 docs/API接口文档.md §15–§16
//   POST /api/chat         → chatMock
//   GET  /api/chat/history → chatHistoryMock

import type { ApiResponse, ChatMessage } from '../types'
import { seedChatHistory } from './_seed'

// ChatReplyData 1:1 对齐 docs/API接口文档.md §8.1 响应
//   { reply, intent, action_options, follow_up_questions }
// action_options 是 AgentActionOption[],MVP mock 阶段固定为空数组
// (per docs §8.1 L1143 + §8.2 L1204「Agent 无法生成可靠选项时为空数组」)
// 接口形状严格对齐 docs §3.9 AgentActionOption schema(等未来 chat 页真用时细化 any → AgentActionOption)
interface ChatReplyData {
  reply: string
  intent: string
  action_options: any[] // MVP 占位;docs §3.9 AgentActionOption 严格类型留 chat 页实装时引入
  follow_up_questions: string[]
}

export const chatMock: ApiResponse<ChatReplyData> = {
  code: 0,
  message: 'success',
  data: {
    reply: '这里是导友的演示回复。',
    intent: 'chat',
    action_options: [],
    follow_up_questions: [],
  },
}

export const chatHistoryMock: ApiResponse<{ messages: ChatMessage[] }> = {
  code: 0,
  message: 'success',
  data: { messages: seedChatHistory },
}
