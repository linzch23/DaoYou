// frontend/api/mock/chat.ts
// 覆盖 docs/API接口文档.md §15–§16
//   POST /api/chat         → chatMock
//   GET  /api/chat/history → chatHistoryMock

import type { ApiResponse, ChatMessage } from '../types'
import { seedChatHistory } from './_seed'

interface ChatReplyData {
  reply: string
  intent: string
  follow_up_questions: string[]
}

export const chatMock: ApiResponse<ChatReplyData> = {
  code: 0,
  message: 'success',
  data: {
    reply: '这里是导友的演示回复。',
    intent: 'chat',
    follow_up_questions: [],
  },
}

export const chatHistoryMock: ApiResponse<{ messages: ChatMessage[] }> = {
  code: 0,
  message: 'success',
  data: { messages: seedChatHistory },
}
