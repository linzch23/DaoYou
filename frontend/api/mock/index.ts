// frontend/api/mock/index.ts
// 统一 re-export —— 上层 `import { todayHomeMock } from '@/api/mock'` 即可
//
// 2026-06-24 retro fix:删 `export * from './replan'`(per AGENTS.md §8.4 ChatPage v0.1.1 P1 cleanup
// + specs/ChatPage.md §6.4 PD-001 #4 决策,replan/apply-plan 改线意图合并到 /api/chat 单一入口,
// replan.ts 整文件已删,这里 re-export 漏清导致 vite parse 时找不到模块 → 整个 app 白屏)

export * from './health'
export * from './home'
export * from './trips'
export * from './trash'
export * from './trip-days'
export * from './trip-items'
export * from './chat'
export * from './photos'
export * from './reminders'
export * from './preferences'
export * from './memory'
