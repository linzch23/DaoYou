# DaoYou Frontend — AGENTS.md

> Project memory for the DaoYou frontend. Holds conventions established by `code-writer` across
> page implementations. Read this **before** writing any new code.
>
> Owner: `code-writer` (users-andrew-desktop-vivo-daoyou-frontend--code-writer)
> Last updated: 2026-06-03

## 0. Project structure (flat, not `src/`-nested)

The Code Style Guide §1 describes a `src/features/<name>/` layout, but the actual project
uses a **flat** structure at the repository root:

```
frontend/
├── api/         # TypeScript types + mock data (READ-ONLY for code-writer)
│   ├── types.ts
│   └── mock/
├── components/  # Reusable components (⭐) + page-private components (🟦 in `pages/<page>/components/`)
├── pages/       # UniApp pages (one subdir per Page, kebab-case; route is `<Page>/index`)
├── services/    # API wrappers (uni.request); one file per business domain
├── stores/      # Pinia stores; one file per feature
├── constants/   # strings / colors / routes; central per Code Style §10/§11
├── utils/       # logger etc.
├── docs/        # (READ-ONLY)
├── specs/       # (READ-ONLY)
├── issues/      # (READ-ONLY except own subdir)
├── workflow/    # PageStatus.yaml / FixQueue.md (FixQueue is READ-ONLY)
└── .harness/    # rein agent.md files (READ-ONLY)
```

> When the Code Style Guide says "src/...", translate to the project root. The flat
> layout is the source of truth.

## 1. Code-writer workflow

1. **Read first** (in this order):
   - `workflow/PageStatus.yaml` — confirm `Architecture=Pass` and `Development=NotStarted`
   - `workflow/FixQueue.md` — if non-empty, fix the top issue (Priority > IssueType > CreatedAt);
     if empty, go to step 2.
   - `specs/<PageName>.md` — the spec is the contract; **never** modify it.
   - `docs/Frontend Code Style Guide.md` — conventions
   - `docs/UI风格定义.md` (Shanshui Diary palette) — colors / typography
   - `api/types.ts` — type definitions referenced in JSDoc
   - `api/mock/*.ts` — DTO shapes (READ-ONLY; do not modify)
2. **Code** strictly per the spec's `Acceptance Criteria` / `State Flow` / `API Contract` /
   `Store Contract` / `Component Contract` / `NFR`. Do not add features not in the spec.
3. **Update `PageStatus.yaml`** on completion (see §6 below).
4. **Write `deliverable.md`** in `outputs/<task-id>/` with file list + PageStatus deltas.

## 2. Page implementation contract

Every page is a Vue 3 SFC in `pages/<page-kebab>/index.vue` with this order:

```vue
<template>...</template>
<script setup>...</script>
<style scoped>...</style>
```

Mandatory patterns:

- **Local state** declared in `<script setup>` with `ref()` / `computed()`. Type via JSDoc.
- **Constants** for all user-facing text — never hardcode Chinese in template.
  - `import { OnboardingStrings } from '@/constants/strings.js'` (or analogous)
  - Add a new section per page (e.g. `HomeStrings`, `TripDetailStrings`).
- **Routes** for all `uni.reLaunch` / `uni.navigateTo` — never hardcode paths.
  - `import { AppRoutes } from '@/constants/routes.js'`
- **Logger** for non-trivial events (success, skip, failure) — never `console.*`.
  - `import { logger } from '@/utils/logger.js'`
- **Store** consumed via `useXxxStore()` from `../stores/<name>.js`.
- **Service** called **only** by stores. Pages and components never import `uni.request`.
- **Components** imported from `../components/<Name>.vue`; private page components
  live in `pages/<page>/components/<Name>.vue` (no `_` prefix — Vue 3 compiler
  does not recognize underscore-prefixed tag names as components).

## 3. 4-state async submit composition

For any page with a "submit → success/error" flow (OnboardingPage, etc.), use the
`currentStep` enum + `submitError` field pattern — never a 4th enum value:

```js
const currentStep = ref('interests')   // 'interests' | 'submitting' | 'completed'
const submitError = ref(null)           // string | null
const isSubmitting = computed(() => currentStep.value === 'submitting')
```

- On submit: `currentStep='submitting'`, `submitError=null`, then `await store.action(...)`.
- On success: `currentStep='completed'`, then Toast + reLaunch.
- On failure: `currentStep='interests'`, `submitError=mapError(err)`, show `_ErrorBanner` (v-if).
- Skip button: disabled in submitting state; enabled in interests / error states.

Spec-auditors will check the enum has **exactly** 3 values; do not add a 4th.

## 4. Service layer conventions

- One file per business domain (`preferences.js`, `trips.js`, etc.).
- Expose named functions returning `Promise`; never use `async/await` inside `uni.request`
  wrapper — keep it as a `new Promise((resolve, reject) => { uni.request({success, fail}) })`
  for control over error mapping.
- Inject MVP-fixed fields (`user_id=1`) at the service layer. Pages never set these.
- Field-level filtering: page sends only the fields it changed. Service wraps with
  `data: { user_id, preferences: payload }`. Backend merges via PUT semantics.
- Expose a typed `ApiError` class with `code` / `statusCode` / `isNetworkError`.
  - `code` is the backend business code; null on network failure.
  - `statusCode` is the HTTP status; 0 on network failure.
  - `isNetworkError` is true only when `uni.request` fail callback fires.

## 5. Store conventions

- Pinia setup-store form (`defineStore('name', () => { ... })`) over options form.
- State typed via JSDoc `@typedef` and `import('../api/types').<Type>`.
- Actions return `Promise<void>` for async work; never expose the raw service result.
- Errors propagate to the caller — store does **not** catch and swallow.
- Action naming: `updateProfile(payload)` is the generic business-intent name (preferred);
  do not invent page-specific verbs like `updateInterests` unless the spec says so.
- `isXxx` boolean flags on state for loading indicators.

## 6. PageStatus.yaml transitions

Code-writer owns these fields (per `workflow/AGENT_CONTRACTS.md` §2.4 / §3):

| Path | Code-writer writable |
|---|---|
| `pages/`, `components/`, `stores/`, `services/`, `constants/`, `utils/` | RW |
| `workflow/PageStatus.yaml` → `Development`, `Review.{ui,spec,test}`, `FinalStatus` | RW |
| `specs/*`, `issues/*`, `workflow/FixQueue.md` | R (cannot modify) |
| `docs/`, `api/`, `.harness/`, `workflow/PRODUCT_DECISIONS.md` | R |

**New development completion** (no Issue to fix):

```yaml
Development:
  status: Completed
Review:
  ui: Pending
  spec: Pending
  test: Pending
FinalStatus: ReadyForReview
```

**Issue fix completion**:

```yaml
FinalStatus: NeedReview
Review:
  ui: Pending
  spec: Pending
  test: Pending
```

`Review.{ui,spec,test}` is **always** reset to `Pending` for all three after any code change
(AGENT_CONTRACTS §4.3 invariant 2).

## 7. Hard rules (per AGENT_CONTRACTS §2.4)

- ❌ Do not modify `specs/*` (raise `issues/Spec/<Page>-<seq>.md` if conflict).
- ❌ Do not close Issues (`code-writer` can only `Open → InProgress`).
- ❌ Do not add features not in the spec.
- ✅ One page per session.
- ✅ When Issue ↔ Spec conflict, **stop** and write a `issues/Spec/<Page>-<seq>.md` conflict.
- ✅ When task message and spec disagree on file path / naming, follow the task literally
  (the orchestrator is the most recent direct directive). Document in deliverable.

## 8. Established conventions (from OnboardingPage, 2026-06-02)

| Convention | Where | Notes |
|---|---|---|
| `constants/strings.js` | `<PageName>Strings` + `<PageName><Domain>Options` (e.g. `OnboardingInterestOptions`) | Object.freeze enum-derived option lists |
| `constants/colors.js` | `AppColors` (Shanshui Diary palette) | Reused across all pages; not per-page |
| `constants/routes.js` | `AppRoutes` enum | Add entries as pages get implemented |
| `utils/logger.js` | `logger.info / warn / error / debug` | Replaces `console.*` |
| Service `ApiError` | `code / statusCode / isNetworkError` | All HTTP wrappers |
| 4-state submit | `currentStep` 3-enum + `submitError` nullable | Established in OnboardingPage |
| Skip during submitting | `pointer-events: none` + `opacity: 0.5` | spec §5.3.D |
| Field-level PUT | Page sends only changed fields; service injects `user_id` | OnboardingPage preference; not always required |

## 8.1 Established conventions (from HomePage, 2026-06-02)

| Convention | Where | Notes |
|---|---|---|
| 5 视图态决策 | `pages/home/index.vue` + `stores/homeStore.js` | `viewMode: 'loading' \| 'diary' \| 'trips' \| 'empty' \| 'error'`;配合 `hasFetchedOnce` 布尔 gate,避免 fetch 完成前跳到 error 之外的态;spec-auditor 严格核对 5 枚举,不许第 6 个 |
| 4 浮层关闭方式 | `components/SpotDetailSheet.vue` | 蒙层点击 / 拖动条点击 / ✕ 按钮 / 路由离开(父 `onUnmounted` 重置 `selectedSpot = null`、`sheetVisible = false`);`isClosing` flag + `setTimeout(280ms)` 让退场动画可见 |
| 多个 Object.freeze 枚举映射(1 enum → N maps) | `constants/strings.js` `HomeItemTypeEmoji` / `HomeItemStatusLabel` / `HomeTripStatusLabel` / `HomeReminderTypeLabel` | 同一后端枚举若有多套 UI 派生(emoji / 短标签 / 状态 / 角色),拆 N 份 Object.freeze map,**不**合并为 1 大对象(检索成本 + 改动面爆炸) |
| 本地收藏 + `uni.setStorageSync` | `services/home.js` `loadFavorites` / `saveFavorites` + `pages/home/index.vue` `favoriteIds` ref | 纯本地状态(无后端 API)用 storage 持久化;异常静默降级 + `logger.warn`,不抛错阻塞 UI;task 优先于 spec 时按 task 实现并在 deliverable §3 显式登记 |
| 乐观更新(无远端同步) | `stores/homeStore.js` `markSpotVisited` | MVP 阶段本地立即 `item.status = 'done'`,**不**发 PUT;下次 `fetchToday` 由服务端覆盖;spec §7.5 标注"可选实现"时走此路径 |
| 并行 fetch + 独立 error | `stores/homeStore.js` `refreshAll` | `Promise.allSettled` 包装,任一 reject 不阻塞另一 promise;首个 reject 写入 `store.error`,viewMode='error';此模式可推广到任何"多源数据 + 单一错误显示"场景 |
| TabBar page `onShow` 强制重拉 | `pages/home/index.vue` `onShow` | `onShow` → `refreshAll()`,无缓存命中(即使 `lastFetchedAt` < 60s);`lastFetchedAt` 字段保留为 spec hint,但 MVP 不强制走缓存 |
| H5 ≥1024px @media 居中 | `pages/onboarding/index.vue` L249-251 + `pages/home/index.vue` L557-566 | `.welcome-container` / `.state-diary/.state-trips/.state-empty/.state-error` 施加 `max-width: 640rpx; margin: 0 auto;`;仅作用于内容容器,`position: fixed` 浮动按钮(如 `.btn-add-trip`)不受影响;移动端(< 1024px)零变化;spec §10 NFR 兼容性硬要求 |

## 8.2 Established conventions (from NewTripPage, 2026-06-03)

| Convention | Where | Notes |
|---|---|---|
| 6 视图态多步表单 | `pages/new-trip/index.vue` | `currentStep: 'input' \| 'analyzing' \| 'form' \| 'submitting' \| 'completed' \| 'error'`(input 替代 loading / completed 替代 success / analyzing 与 submitting 是流程分支 / form 是核心交互 / error 兜底);spec-auditor 严格核对 6 枚举,不许第 7 个;**扩展** §3 4-state + §4 5-state |
| 双错误字段语义分离 | `pages/new-trip/index.vue` `submitError` + `formSubmitError` | `submitError` = POST 失败,触发 `currentStep='error'` + 整页 _ErrorOverlay + 重试;`formSubmitError` = form 内 3 必填校验失败,**不**触发 transition,只在 form 顶部显示 `<_ErrorBanner :retryable="false" />`;spec-auditor 复核 AC-06 时核对"是否仍保持 form 态";spec §4.1 未命名此字段,deliverable §3 主动登记命名决策 |
| Stale setTimeout guard | `pages/new-trip/index.vue` `analyzingTimerId` + 回调内 `if (currentStep.value !== 'analyzing') return` | 用户可中途切状态的 setTimeout 回调必备 2 层防护:onSubmit 开头 `clearAnalyzingTimer()` 防堆叠 / 回调内 guard 防 stale / onUnmounted 兜底清;spec §5.3.L "快速来回切" 竞态 |
| Client-side AI mock(PD-001 触发) | `pages/new-trip/index.vue` `extractFormDataFromText` + `setTimeout(1500 + Math.random() * 1000)` | 后端无 `POST /api/ai/analyze` 时,前端 setTimeout 1.5-2.5s 模拟 AI + 极简正则(`去\|飞\|玩\|在` + 1-3 中文字 / YYYY-MM-DD / M月D日)提取结构化字段;提取不到 → 字段留空 + 标红,**不**切 error 态 |
| 本地草稿 storage(扩 §11 favorites) | `services/trips.js` `loadDrafts` / `saveDraft` + `pages/new-trip/index.vue` `_DraftConfirmDialog` | key = `trip_drafts`,value = `TripDraft[]`(`{id, created_at, inputText, attachedFiles, formData}`);saveDraft 返回 boolean(false → Toast「保存失败」+ currentStep='input' 保留内容);**不**新建 draftStore(MVP YAGNI);TrashPage 接管读取,本页面**只**写不读 |
| 3 按钮 modal `_DraftConfirmDialog` | `pages/new-trip/components/_DraftConfirmDialog.vue` | 私有组件 `_` 前缀;3 按钮(不保存 / 继续编辑 / 保存草稿) + 蒙层点击 = 不保存;`fadeIn 0.2s + slideUp 0.3s ease-spring` 动效;MVP 唯一调用方,**不**抽 `components/`(沿用 SpotDetailSheet _ErrorOverlay 模式) |
| 跨端 `<picker mode="date">` | `pages/new-trip/index.vue` Field 2/3 | `value='YYYY-MM-DD'` + `start/end` 字符串约束 + 包一个 `<view>` 内部显示当前值(空值显示 placeholder);级联 picker(`end` 的 `start` = `formData.start_date`);**不**自写 calendar |
| `services/trips.js` 新建 | `services/trips.js` 154 行 | `createTrip(req)` POST `/api/trips`(内部注入 `user_id=1`,5 字段 1:1 对齐 `api/types.ts:CreateTripRequest`)+ `loadDrafts/saveDraft`;复用 `services/preferences.js:ApiError` + mapSuccess/mapFail helper;**不**复制代码 |
| 7 字段表单(task vs spec 字段数差异) | `pages/new-trip/index.vue` `.form-fields` | 任务原文 5 字段(title/city/start_date/end_date/companions/budget_min+budget_max/transport/special_needs),spec §3.5 是 7 字段(city/start_date/end_date/companions/budget_range/transport_preference/special_needs);**按 spec 7 字段实现**,deliverable §3.2 显式登记 task 偏差(title 派生 / budget 合并 1 字段 / companions 逗号分隔文本);per memory「行为类 → spec 永远赢」 |

## 8.3 Established conventions (from PhotoGuidePage, 2026-06-03)

| Convention | Where | Notes |
|---|---|---|
| 6 视图态拍照讲解 | `pages/photo-guide/index.vue` | `currentStep: 'idle' \| 'preview' \| 'analyzing' \| 'result' \| 'chatting' \| 'error'`(idle 选模式 / preview 预览+风格 / analyzing POST 飞行中 / result 4 块讲解+追问 input / chatting result 衍生态+末尾 typing / error 兜底);**注意**:`result` 是 success 衍生态(不切 completed 态,因为追问循环需继续复用 result 卡片);`chatting` 是 result 的"飞行中"标签,不切独立 7 态;spec-auditor 严格核对 6 枚举 |
| 6 视图态 vs NewTripPage 6 视图态差异 | `pages/photo-guide/index.vue` vs `pages/new-trip/index.vue` | NewTripPage = `input \| analyzing \| form \| submitting \| completed \| error`(有 completed 终态);PhotoGuidePage = `idle \| preview \| analyzing \| result \| chatting \| error`(无 completed,result 是常驻成功态);**共同点**:analyzing/error 始终存在,spec-auditor 核对枚举集时检查具体 key 名 |
| 4 块讲解内联(块 3 复用 explanation 同字段,触发 PD-001) | `pages/photo-guide/index.vue` L235-285 | 4 个 `<view class="content-block">` 兄弟节点 inline 渲染(块 1 `recognition_result` / 块 2 `explanation` / 块 3 `explanation` 同字段 / 块 4 `follow_up_questions` chips);**不**抽 `_ContentBlock.vue`(spec §3 备注 5 MVP YAGNI 允许);块 3 子标题用 emoji + 子项列表「🕒 实用信息(开放时间 / 门票价格 / 最佳游览时长 / 拍照点推荐)」引导,**不**做关键词切分 |
| 追问循环复用同接口不传 history | `pages/photo-guide/index.vue` `onSendChat` + `services/photos.js` | 复用 `POST /api/photos/explain` + **不传** `history` 字段(spec §6.3.2 决策);后端按 `photo_id` 关联会话;chatHistory page-local state(`ref<ChatMessage[]>([])`,**不**新建 photoStore,**不**持久化);MVP YAGNI |
| chat 流 inline v-for 不抽 `_ChatBubble` | `pages/photo-guide/index.vue` `_ChatHistory` 区段 | `<view v-for="(msg, idx) in chatHistory" :key="idx" :class="chat-bubble-wrap-${msg.role}">` 内联渲染;按 role 派生 left/right 对齐(`user` 右对齐+surfaceWarm / `assistant` 左对齐+surfaceCard);MVP YAGNI(spec §3 备注 4 允许);若未来多端统一,IssueManager 提议抽公共 |
| 30s 上传超时 3 层防护 | `pages/photo-guide/index.vue` `onConfirmAnalyze` + `onRetryAnalyze` + `onUnmounted` | 第 1 层:`onConfirmAnalyze` 启动 `setTimeout(30000)` 前先 `clearAnalyzingTimer()` 防堆叠;第 2 层:回调内部 `if (currentStep.value !== 'analyzing') return` 防止 stale;第 3 层:`onUnmounted` 兜底 `clearTimeout` 防内存泄漏;沿用 NewTripPage §5.6 stale setTimeout guard 模式 + 加 30s 定时器专属场景 |
| `services/photos.js` 独立 `mapUploadSuccess` 而非 import | `services/photos.js:78-105` | 原因:uni.uploadFile 回调 `res.data` 是 `string`(JSON 需 `JSON.parse`),与 uni.request 回调 `res.data: any` 不同,不能直接 import `services/preferences.js:52` mapSuccess;spec §7.3 显式要求独立实现;mapUploadError 同理(reject + isNetworkError=true) |
| `services/photos.js` 入参 4 字段校验 | `services/photos.js:140-180` | 提前校验 `req.image` / `req.trip_id` / `req.style` 避免 uni.uploadFile 起飞后才报错(节省 30s 浪费);`style` 严格 3 枚举白名单;`trip_id` MVP 允许 =0(无 trip 上下文);`ApiError` class 跨域复用(services/preferences.js:33) |
| SpotCard 复用只展示不响应点击 → state='expired' 弱化路径 | `pages/photo-guide/index.vue` `_FromSpotBanner` + `fromSpotState` computed | 复用 `components/SpotCard.vue` 但**不**接 `onTap`;**不**自造 click handler;**不**废弃组件;3 路径(接受点击 + toast / state='expired' 弱化 / 不用)中选择路径②(SpotCard 自带 `expired` 态:opacity 0.5 + `pointer-events: none`);`fromSpotState` 派生:`status='done'→done` / `'changed'→changed` / 其他→'upcoming' 默认;**0 额外代码**,语义对齐,视觉一致 |
| `_ClearChatConfirmDialog` 私有 2 按钮 modal | `pages/photo-guide/components/_ClearChatConfirmDialog.vue` | 2 按钮(取消 / 清空);**清空按钮红色 Danger 配色**(`linear-gradient(135deg, #C44A3A, #E87D5A)`)因操作不可逆(spec §8.1 备注);5 props(visible / title / message / btnConfirmLabel / btnCancelLabel)+ 2 emits(confirm / cancel);蒙层点击 = cancel;`fadeIn 0.2s + slideUp 0.3s ease-spring` 动效;与 `pages/edit-trip/components/_DraftConfirmDialog.vue` 形态独立(3 按钮草稿 vs 2 按钮清空 + 红色),MVP 唯一调用方不抽公共(spec §10 R-4) |
| 6 视图态 vs EditTripPage 6 视图态差异 | `pages/photo-guide/index.vue` vs `pages/edit-trip/index.vue` | EditTripPage = `loading \| editing \| saving \| success \| notfound \| error`(linear flow);PhotoGuidePage = `idle \| preview \| analyzing \| result \| chatting \| error`(chatting 是循环入口,**可**从 result 重新进入 chatting);**共同点**:`error` 终态 + analyzing 飞行中,spec-auditor 严格核对 6 枚举 |
| H5 ≥1024px sticky chat input bar 全宽保留 | `pages/photo-guide/index.vue` `@media (min-width: 1024px)` L2018-2026 | `.body-inner { max-width: 640rpx; margin: 0 auto; }` 标准模式(沿用 §8.1);但 sticky bottom 的 `.chat-input-bar-wrap` 不能被 max-width 截断(否则大屏下右半屏空),用 `margin-left/right: calc(50% - 320rpx)` 反向抵消保持全宽;**未来页面遇到"sticky 元素 + H5 居中"冲突时,沿用此解法** |
| Verifier flag 提前对齐 2 处 spec ↔ mock 不一致 | `outputs/<page>-dev/deliverable.md §3` | spec §6.1 示例 `image_path: 'uploads/images/yurenmatou.jpg'` vs `api/mock/photos.ts:20` `'uploads/images/demo.jpg'` — **统一选 'yurenmatou.jpg'**(per task 建议,与 spec 示例一致);spec §5.3.B 文案"重新选图" vs `NewTripStrings.errorBadRequest` "参数不合法,请检查后重试" — **统一选"重新选图"** 给用户清晰操作提示;dev 阶段在 deliverable §3 主动登记 task 决定,不阻塞 dev |

## 8.4 Established conventions (from GuideResultPage, 2026-06-03)

| Convention | Where | Notes |
|---|---|---|
| 5 视图态只读展示页 | `pages/guide-result/index.vue` | `viewMode: 'loading' \| 'loaded' \| 'chatting' \| 'notfound' \| 'error'`(5 枚举);**少** PhotoGuidePage 的 `idle` / `preview` / `analyzing` 3 态(本页面**只读**,不需选模式 / 选图 / 等待 AI 响应);**有** `notfound` 独立兜底态(避免误用 `error` 表达"资源不存在"——区别于 NewTripPage 6 视图态用 `error` 表达提交失败,本页面 5 态语义完全独立);spec-auditor 严格核对 5 枚举,不许第 6 个 |
| 5 视图态 vs 4/5/6 视图态差异决策矩阵 | 扩 memory §10.3 | HomePage 5 / SpotDetailSheet 4 / TripDetailPage 4 / EditTripPage 6 / NewTripPage 6 / PhotoGuidePage 6 / **GuideResultPage 5**——各页面按 UX 需求决定 enum 数量(spec-auditor 核对时**不**要求统一,只核对 enum 互斥 v-if 链无歧义 + 错误态由独立字段表达);`chatting` 是 `loaded` 衍生态(UI 复用 `_LoadedPanel` + 末尾追加 typing,沿用 PhotoGuidePage 模式) |
| GET 单条接口不存在 → 本地缓存 + notfound 兜底(per §6.4.1 PD-001) | `services/photos.js` `getGuideResult(photoId)` + `saveGuideResult(data)` + `loadGuideResults()` + `clearGuideResult(photoId)` | 任何"展示某条 AI 响应数据"的页面,如果后端**未**提供 GET 单条接口,按"本地缓存 + `uni.setStorageSync` + key = `{[id]: Data}` + miss 走 notfound"路径;**写入方**必须在读取方首次访问前存在(参见 C-7 1 行配套);cache structure: `guide_results: Record<photo_id, PhotoExplainData>`(覆盖式,异常静默降级 + `logger.warn`,不抛错阻塞 UI);6 字段形状校验避免 storage 损坏 → 当 cache miss 处理;MVP 不实现 LRU,>20 条由 uni-app GC 兜底;**未来如需"切风格重新讲解"或"push 通知 / 外部 H5 直达"**,IssueManager 提议后端扩 `GET /api/photos/{photoId}` 单条接口 |
| PATCH 字段不存在 → 纯前端视觉态(per §6.4.2 PD-001) | `pages/guide-result/index.vue` `onStyleChange` | 任何"展示型"页面遇到"用户切换偏好 / 风格 / 模式"操作,默认**纯前端视觉态更新**,**不**调偏好 API;偏好持久化由专门的"设置页"(StyleSettingPage / NotificationSettingPage / PersonalProfilePage)接管;风格 chip 切换只更新 `currentStyle` + 风格徽章文案占位符 `[style]` 替换,**不**触发 `explanation` 重生成(AI 已生成整段文本无法局部重生成);grep 验证 `uni.request` / `uni.uploadFile` 0 命中 |
| 追问循环 image 冲突 → page-local mock(per §6.4.5 PD-001) | `pages/guide-result/index.vue` `doMockChatReply` + `_ChatInputBar` | 任何"展示型只读 + 追问 / 多轮"页面,如果复用既有 `uni.uploadFile` 接口但**没有本地文件**可传(image 是 server 路径),按"page-local mock + IssueManager 留 hook 给后端扩接口"路径,避免 MVP 阶段调通失败 / 假数据;模拟响应:固定话术(本页面 `chatMockReply`)+ `setTimeout(500-1000ms)` 随机延迟;stale guard `if (viewMode.value !== 'chatting') return` + onUnmounted 兜底 `clearTimeout`;**未来如需真追问**,IssueManager 提议后端扩 `GET /api/photos/{photoId}/follow-up?question=xxx` 返回 `{ assistant_reply: string }`(GET 无 body,前端调 `uni.request` 即可) |
| 收藏 / 分享后端无域 → 不实现(per §6.4.3 / §6.4.4 PD-001) | `pages/guide-result/index.vue` template | 任何"展示型"页面遇到"用户想收藏 / 点赞 / 置顶"等**纯本地交互**但**后端无对应域**的能力,按"**不**实现 + **不**留 hook"路径,避免 spec 污染与 i18n 占位文案;**不**预声明 `btnFavorite` / `btnShare` 等常量;MVP YAGNI 收藏讲解没有跨页价值,IssueManager 后续扩展 hook |
| C-7 PhotoGuidePage 1 行写入配套(跨页 read/write 配对的最小入侵) | `pages/photo-guide/index.vue` `doExplainAnalyze` + `pages/guide-result/index.vue` `onLoadPage` 读取 | 当**本页面**(`guide-result`)需要从**上游页面**(`photo-guide`)拿数据但后端无 GET 单条接口时,**不修改既有 `specs/PhotoGuidePage.md`**(spec-writer 越权边界),改在**上游页面 doAnalyzeOk 成功分支**加 1 行 `await saveGuideResult(data)` 落本地 cache;读取方在 `onLoadPage` 调 `getGuideResult(photoId)` 同步读 cache;写入方 best-effort 语义:`await saveGuideResult(data)` 包 try-catch,失败仅 `logger.warn` 不抛错,不阻塞 `currentStep='result'` 切换;**在 `outputs/<page>-dev/deliverable.md §3` 显式登记此 1 行代码改动 + 1 元决策**,供 orchestrator 决策是否走上游 spec 修订流程(spec-writer 越权边界 + orchestrator 跨工种协调成本) |
| 反向 import 跨页私有组件(脆弱但可接受) | `pages/guide-result/index.vue` `import _ClearChatConfirmDialog from '../photo-guide/components/_ClearChatConfirmDialog.vue'` | 沿用 `pages/edit-trip/components/_DraftConfirmDialog.vue` §8.2 + PhotoGuidePage §8.3 双决策:同形态跨页组件**不**抽公共(MVP YAGNI),直接 import 上游页面私有路径;**反向依赖**:`guide-result → photo-guide`(脆弱但可接受,因为同形态 2 按钮 Danger 配色 + 同操作语义 — 都是「清空对话,不可恢复」);未来多页统一(更细粒度抽公共)由 IssueManager 提议扩展;spec §10 R-2 "不复制" 决策 |
| 5 类 8 元素 44pt 触达 88rpx(per AC-11) | `pages/guide-result/index.vue` `<style scoped>` | Header back / 3 风格 chip / 4 块追问 chip / 「发送」/ 「🗑」/ 「重试」/ 「返回首页」7 类共 8 元素**全部** `min-height: 88rpx`(44pt,见 UI §九 拍照讲解特殊规范);input field `height: 80rpx` 保留(input 是 focusable 非 clickable,iOS HIG 不强制 44pt,沿用 PhotoGuidePage 软观察 #1) |
| onBack 4 路径 + 1 兜底(沿用 §8.2 NewTripPage + TripDetailPage 模式) | `pages/guide-result/index.vue` `onBack` | Header「←」/ 系统返回手势 / `_NotFoundOverlay`「返回首页」按钮 / `_ErrorOverlay`「重试」按钮 → 走 `onBack` + `getCurrentPages().length > 1` 判定 stack + `uni.navigateBack({delta:1, fail: reLaunch Home})` / 兜底 `uni.reLaunch({url: AppRoutes.Home})`;`onUnmounted` 兜底 `clearDialogVisible=false` + `clearTimeout(mockChatTimerId)`;viewMode='loading' 期间用户点「←」→ 立即返回(不等待缓存读取;`uni.getStorageSync` 同步无中断必要) |
| H5 ≥1024px sticky chat input bar 全宽保留(沿用 §8.3 模式) | `pages/guide-result/index.vue` `@media (min-width: 1024px)` | `.body-inner { max-width: 640rpx; margin: 0 auto; }` 标准模式 + sticky bottom 的 `.chat-input-bar-wrap` 用 `margin-left/right: calc(50% - 320rpx)` 反向抵消保持全宽;沿用 PhotoGuidePage §8.3 + EditTripPage §3.8 + HomePage §10 NFR 兼容性硬要求 |
| 5 个 Resolved 子节 + 6 软观察全部按 spec 字面落地 | `outputs/grp-dev/deliverable.md §3.13-§3.15` | spec §6.4.1~§6.4.5 PD-001 Resolved 5 处 + arch §3 软观察 6 处全部按 spec 字面实现,显式登记决策路径;**新页面遇到 PD-001 触发**(API 缺 / 字段缺 / 域缺 / 协议冲突)按"§6.4 5 Resolved 路径"扩展:本地缓存 / 纯前端 / 不实现 / page-local mock / 1 行配套 |
| 14+ logger 关键事件 0 console.\*(per AC-14) | `pages/guide-result/index.vue` `<script setup>` | onLoad / style switched / cache hit/miss/fail / chat sent (mock) / chat reply ok (mock) / chat cleared / chat retry / retry load / notfound / back / onUnmounted / fetchPreferences failed / trip not found / fetchTrips failed / image load error / follow-up chip tapped / chat retry 17+ 关键事件**全部** `logger.info / warn / error`;`utils/logger.js` 引用,无 console 调用 |

## 9. Changelog

See `changelogs/` for per-page changelogs. New pages must add an entry on completion.

## 8.5 Established conventions (from StyleSettingPage, 2026-06-04)

| Convention | Where | Notes |
|---|---|---|
| 5 视图态简单 form page | `pages/style-setting/index.vue` | `viewMode: 'loading' \| 'loaded' \| 'saving' \| 'saved' \| 'error'`(5 枚举);**沿用** PersonalProfilePage 5 视图态模式(loading/editing/saving/saved/error 简化为 loading/loaded/saving/saved/error,`loaded` 替代 `editing` 表"已拉取 + 可交互");saved 末值是**瞬时态**(≤200ms 后 navigateBack,沿 PersonalProfilePage §3.7);saved 与 completed 末态不同(`completed` = 不可逆终态,`saved` = 过渡态可继续 reuse) |
| MVP 简化 `selectedStyle` 永有值 + `isDirty` fallback | `pages/style-setting/index.vue` `selectedStyle` ref + `isDirty` computed | `selectedStyle` 永有值(MVP 简化,`null` 不可达 → fallback `'professional'`,per §5.3 J);`isDirty = (selectedStyle !== (currentStyle \|\| FALLBACK_STYLE))` 2 行派生算法,避免新用户首登 `currentStyle=null` 时误判 dirty;`canSave = !isSaving && isDirty`(per §3.6) |
| 200ms saved 瞬时态时序 | `pages/style-setting/index.vue` `handleSaveResult` success 分支 | PUT 成功 → `viewMode='saved'` + `uni.showToast(已保存)` 提前 + `setTimeout(200ms)` → `uni.navigateBack()`;saved 视图**复用** success view(✓ 大对勾 + strings.savedText 提示),**不**用 completed 终态;200ms buffer 避免黑屏闪跳(沿 PersonalProfilePage §10.1 + EditTripPage §3 备注 2) |
| 私有子组件按 spec §8.3 唯一例外提取 | `pages/style-setting/components/_StyleOptionCard.vue` | task 显式要求 + spec §8.3 唯一例外 = 创建私有 5 props + 1 函数 prop;**不**抽到 `components/` 公共目录(per C-9 严禁);**不**用 `slot`(本规格 slot-free);项目惯例 5 个 page 私有子组件先例:PhotoGuidePage `_ClearChatConfirmDialog` / EditTripPage `_DraftConfirmDialog` / NewTripPage `_DraftConfirmDialog` / TripDetailPage `_DeleteConfirmDialog` / MyPage `_LogoutConfirmDialog` / PersonalProfilePage `_GenderChipGroup` + `_AgeChipGroup` |
| PUT 1 字段纪律 | `pages/style-setting/index.vue` `doSave` | `userStore.updateProfile({ explanation_style: selectedStyle.value })` → 内部 routing `services/preferences.updatePreferences` → body `{ user_id: 1, preferences: { explanation_style } }`;**不**发 travel_pace / interests / special_needs 3 字段(per §6.4.2 PUT partial-update 纪律);**不**调用 `services/preferences.updateUserInfo`(PersonalProfilePage 专用 `{ interests }` 薄包装,语义混淆,per C-6 严禁) |
| `MyPageExplanationLabel` 复用为 _FormHeader 短标签展示 | `pages/style-setting/index.vue` `currentStyleLabel` computed | 复用 MyPageExplanationLabel 3 短标签(「专业讲解 / 通俗讲解 / 亲子讲解」)作为 _FormHeader 当前风格展示;**字面不同**但语义 1:1 对齐 — 本规格 `StyleSettingStrings.styleTitleXxx` 无「讲解」后缀,行内空间更紧凑(per §3.5 + §4.4 备注) |
| `onBack` 简化路径(不弹草稿弹窗) | `pages/style-setting/index.vue` `onBack` | Header「←」/ 系统返回手势 → `uni.navigateBack()`(**不**弹 _DraftConfirmDialog + **不**写本地草稿 + **不**调任何 API);per §5.4 MVP 简化决策(单选 + 1 字段无草稿价值,沿 PersonalProfilePage §5.4);`navigateBack` 失败兜底 logger.error,**不**reLaunch MyPage(避免影响 stack 状态) |
| **pages.json 多 session 并发覆盖防御 SOP**(NEW 实战) | code-writer session 生命周期 | 任何编辑 `pages.json` 的 code-writer session **必须** session 开始 + session 结束前各 grep 一次状态:`python3 -c "import json; d=json.load(open('pages.json')); [print(p['path']) for p in d['pages']]"`;若中途被其他 session(trash-spec / future page dev)并发覆盖,**手动 re-Edit** 加回被覆盖的 entry;不依赖 file mtime / git status(项目无 git 或未 commit);**根因实证**:ssp-dev cycle 4 retry (2026-06-04 09:25-09:30) trash-spec session 并发编辑 pages.json 覆盖 ssp-dev attempt 1 09:20 entry → verifier auto-reject → cycle 4 minimal fix 加回 entry + 移除 pre-existing 重复 my/index |
| cycle 4 minimal fix 协议(verifier FAIL + plan owner "do NOT rewrite" SOP) | code-writer 任何 retry 场景 | plan owner 显式说 "do NOT rewrite" + "minimal" + "Exit fast after Edit" → **严格**只 Edit 不 Write;不动 spec / ssp-arch / StyleSettingStrings content(对象本身)/ _StyleOptionCard.vue structure;不重读 spec 全文 / 不重读 deliverable 全文 / 不重建文件;重点:只更新"事实错误"(count / line numbers / 错位 entry)+ 0 改动 实质逻辑;**实证**:ssp-dev cycle 4 3 处 Edit 3min 完成(per memory §19);反模式:verifier FAIL 触发 panic 重写全部 6 文件 → 浪费 30min + 触发 race condition 二次覆盖风险 |
| count claim 验证 SOP(per AC-12) | code-writer deliverable.md / changelog / PageStatus 注释 | 任何 "N 键" / "N 行" 声明 → 必须 **同步** 落 `grep -c` / `wc -l` 验证;推荐 grep 命令:`awk '/^export const X = {/,/^}/' file.js | grep -cE "^  [a-z][a-zA-Z]+:"` → Object key count / `wc -l file.vue` → line count / `grep -c "viewMode ===" file.vue` → enum count;**实证**:ssp-dev deliverable 写 17 键,实际 18 键 → cycle 4 fix 同步纠正 3 处(deliverable + changelog L21 + changelog L721 + PageStatus 注释) |

## 8.6 Established conventions (from LoginPage + TripPreparePage + AboutPage + PersonalProfilePage retro fix, 2026-06-04)

| Convention | Where | Notes |
|---|---|---|
| 3 视图态 MVP 占位 page(setTimeout 模拟 + 0 API + 0 store) | `pages/login/index.vue` + `pages/trip-prepare/index.vue` | `viewMode: 'loading' \| 'loaded' \| 'error'`(3 枚举)互斥 v-if 链;**MVP 占位简化路径**:`onLoad` → `viewMode='loading'` → `setTimeout(200ms / 500ms)` → `viewMode='loaded'`(纯 UI 切换,无任何 API);沿用 NewTripPage §5.6 + PhotoGuidePage §5.6 2 层 stale setTimeout guard 模式(`clearSimulateTimer / clearPrepareTimer` 防堆叠 + 回调内 `if (viewMode !== 'loading' \|\| hasInitialized) return` 防 stale + `onUnmounted` 兜底 `clearTimeout`);spec-auditor 严格核对 3 枚举,不许第 4 个 |
| 2 视图态纯静态展示页(0 异步,无 loading 第 3 枚举) | `pages/about/index.vue` | `viewMode: 'loaded' \| 'error'`(**2 枚举,无 `loading` 第 3 个**);MVP 纯静态占位 → `onLoad` 直接 `setViewMode('loaded')`(0 异步,无 setTimeout 等待);error 态 MVP 实际不可达(0 API / 0 异步触发),仅作未来扩展钩子(spec-writer-patterns §6 状态机选型);与 MyPage 3 视图态(loading/loaded/error)和 NotificationSettingPage 5 视图态对比,本页面 enum 数 = 2 是 MVP 简化的极值 |
| MVP 占位 emoji 圆形 icon + 主副消息 + 主 CTA「返回」按钮 | `pages/login/index.vue` `_Icon` + `_MainMessage` + `_SubMessage` + `_ActionButton` | 顶部 120rpx × 120rpx 圆形 `AppColors.surfaceWarm` 背景 + emoji(🔒 80rpx / ⛰️ 72rpx / 🧳 80rpx)+ 中间 `Noto Serif SC 20px 600` 主消息 + 下方 `Noto Sans SC 14px` 副消息(max-width 480rpx 居中)+ 底部 Primary 渐变主 CTA `min-height: 88rpx` 44pt 触达;视觉风格 100% 与既有 7 详情页(HomePage / NewTripPage / EditTripPage / TripDetailPage / PhotoGuidePage / GuideResultPage / PersonalProfilePage)Header 形态一致;**不**抽 `_LoadedPanel` / `_LoadedBlock` 公共子组件(MVP YAGNI,inline 渲染) |
| 4 路径 onBack + 1 兜底(跨页标准化模式,3 视图态 + 2 视图态占位页通用) | `pages/login/index.vue` + `pages/trip-prepare/index.vue` + `pages/about/index.vue` `onBack` 函数 | Header「←」/ 系统返回手势 / 主 CTA「返回」按钮 / 兜底 reLaunch 全部走 `onBack` + `getCurrentPages().length > 1` 判定 stack + `uni.navigateBack({delta: 1, fail: () => uni.reLaunch({url: AppRoutes.Home})})` / 兜底 `uni.reLaunch({url: AppRoutes.Home})`;`onUnmounted` 兜底 `clearPrepareTimer / clearSimulateTimer` 防内存泄漏;沿用 `TripDetailPage` §5.4 + `NewTripPage` §5.4 + `PhotoGuidePage` §5.4 + `GuideResultPage` §5.4 4 路径 + 1 兜底实证(13+ 页跨页标准化) |
| error 态保留逃生口(占位 page 防御性兜底) | `pages/login/index.vue` error 分支 + `_LoadedBlockFallback` | 占位 page error 态**不**只显示 _ErrorBanner,额外**保留**主 CTA「返回首页」按钮,与 loaded 态行为一致;确保用户**始终**有逃生路径(避免被困);spec §3.4 备注 + spec-auditor 严格核对"error 态保留「返回首页」逃生口" |
| 4 卡片 `pointer-events: none` 显式禁用 tap(纯展示页) | `pages/about/index.vue` `.info-card` 样式 | 任何"展示型 4 信息卡片"页面,卡片**不**可点击 → `<view class="info-card">` 而非 `<button>` + `pointer-events: none` 显式禁用 tap;用户点卡片任何区域无响应(无 toast / 无 navigateTo);spec AC-08 严格核对"4 卡片不可点击" + spec §1 「不抽 `_InfoCard`」 决策 |
| `AboutInfoCards` Object.freeze 4 键(信息卡片元数据集中登记) | `constants/strings.js` `AboutInfoCards` 段 + `pages/about/index.vue` v-for | `Object.freeze([{key, icon, label, value} × 4])` 1:1 对齐 spec §4.4 4 键;`label` 走 `AboutStrings.cardLabelXxx` 4 键引用(**不**重复字面值),`value` 字面硬编码(per `package.json:2-3` name/version + `README.md:5-12` 技术栈段 + 项目级占位版权);与 `StyleSettingOptions` / `OnboardingInterestOptions` / `notificationSwitchConfigs` 形态独立 — 本段无 `defaultOn` / `value-enum` 等运行时约束(纯展示) |
| retro fix 协议 — 1 line 路由注册 + 1 line PageStatus 注释 + 0 line 代码改动 | `pages.json` 第 13 个 entry + `workflow/PageStatus.yaml` PersonalProfilePage.Spec 块注释 | 任何"原 `pages.json` 路由缺失导致上游 navigateTo 走 404 兜底"场景 → **不**改既有 `.vue` 文件 + **不**触发 review 重审(per ssp-arch §6 forward-looking comment 反模式)+ **不**重置 `Review.{ui,spec,test}` 字段 + 仅加 1 line `pages.json` entry + 1 line PageStatus Spec 块注释(说明 retro fix 日期 + 不动其它字段理由);reviewer「抽样审计 + 自报已知妥协」原则下无新失败项 = 不重审 = 不增加 reviewer 负担;**反模式**:"为安全起见重置 Pending 让 reviewer 重审" → 触发 auto-re-dispatch 竞态 + 浪费 3 reviewer 工作量 |
| spec 笔误登记 — page count 偏差(spec 字面 vs 实际演进) | `outputs/<page>-dev/deliverable.md §3.5` + changelog 段注释 | 任何"spec 字面写'第 N 个 page' vs 实际 pages.json 已 N+M 个"场景(因 spec 写时只看到 N 个,后续 page dev 增量 N+M);**不动 spec**(spec-writer 越权边界)+ **不动既有 page entry**;在 changelog 详细段 + deliverable §3.5 显式登记"1 元 spec 笔误(spec 写 12 个,实际 15 个)",与 NotificationSettingPage §10.8 C-4 同类(NotificationSettingPage changelog L1065 已登记) |
| `pages.json` 第 13~16 个 page 注册(本任务一次性 + 4 entry) | `pages.json` 第 13th = personal-profile(retro fix)/ 14th = login / 15th = trip-prepare / 16th = about | 沿 onboarding/home/my/notification-setting 模板:`navigationStyle: 'custom'` + `navigationBarBackgroundColor: '#FDFBF7'` + `backgroundColor: '#F7F3EC'`;`navigationBarTitleText` 与对应 `*Strings.title` 1:1 对齐;**不**改 `globalStyle` / `easycom` / `tabBar.list` / 既有 12 page entry |
| 0 新建 store / service / 子组件 — 完全复用既有 13 页面公共资源 | 3 page 全部 0 净增 | 反向 grep 4 项 0 命中(uni.request / uni.uploadFile / use*Store / import.*services/)+ 0 console.* + 0 私有子组件;完全复用 `AppColors` / `AppRoutes.Home` / `OnboardingStrings.errorNetwork/errorFallback/retry` / `NewTripStrings.errorFallback` / `components/_ErrorBanner.vue` ⭐ / `utils/logger` 7 类公共资源(per 13 页面惯例);spec §7.2 + C-8 + C-9 严禁 0 净增 |
| MVP 占位 page logger 关键事件 0 console.\*(3 page 实证 5-10 关键事件) | `pages/login/index.vue` 10 关键事件 + `pages/trip-prepare/index.vue` 7 关键事件 + `pages/about/index.vue` 5 关键事件 | onLoad / setTimeout 切换 / onBack / 重试 / onUnmounted 全部 `logger.info / warn / error / debug`;**不**写 `console.*`;`utils/logger.js` 引用,0 console 调用;spec §10 NFR logger 硬要求 + 0 console.* 验证 `grep -c console\\.` 0 命中(注释内"0 console.*" 文档说明不计) |
| H5 ≥1024px `.body-inner { max-width: 640rpx; margin: 0 auto; }` 3 page 各自 1 处 | `pages/login/index.vue` + `pages/trip-prepare/index.vue` + `pages/about/index.vue` `<style scoped>` | 沿用 `EditTripPage` §3.8 / `HomePage` §10 / `MyPage` §3.8 / `StyleSettingPage` §3.7 / `NotificationSettingPage` §10 11 连实证;仅作用于内容容器,Header / 浮动按钮不受限;移动端(<1024px)零变化 |

## 8.7 Established conventions — 跨页 onRetry 节流 SOP(2026-06-04 issue-mgr-throttle-scan 立项,Throttle-001)

> **触发原因**:`test-agent` 在 4 page(TripDetailPage / TripPreparePage / SpotDetailSheet / PhotoGuidePage)retry 路径软观察累积:
> 用户在弱网下点 retry → 等 1~3s 没响应 → 重复点击 = 多次 store action + 多次 API 飞行中 + 多次 toast 打断。
> 根因不在各 page 业务逻辑,而在 **共享组件层** `_ErrorBanner.vue` retry emit 缺节流 + 4 page retry 回调无 `isRetrying` 互斥锁。
> 修 1 处共享 + 3 page 钩子(PhotoGuidePage 由后续 plan 推进) = 跨页 SOP,见 `issues/Cross-Page/Throttle-001.md` 完整契约。

| Convention | Where | Notes |
|---|---|---|
| 共享 `_ErrorBanner` retry emit 节流协议 | `components/_ErrorBanner.vue` L19-27 / L34-49 / L120-126 | 加 `loading: Boolean` prop(default `false`)+ 内部 `throttled` ref(300ms `setTimeout` 兜底)+ `isLocked = computed(loading \|\| throttled)` 视觉 + 节流双重门;button class `:class="{ 'error-retry-disabled': isLocked }"` + `pointer-events: none`;**0 业务逻辑泄漏**给 page 层 |
| 私有 `_ErrorOverlay` 同形态改造(per Throttle-001 §4.1 备注 — 项目内**无**全局共享 `_ErrorOverlay`,仅 spot-detail-sheet 私有) | `pages/spot-detail-sheet/components/_ErrorOverlay.vue` L29-38 / L43-100 / L167-170 | 同上节流协议 + `loading` prop + `error-overlay-button-disabled` 视觉态;其他 page 若新建私有 overlay 沿用同样 prop 模式 |
| page 层 onRetry 加 `isRetrying` 互斥锁 + try/finally 兜底 | `pages/spot-detail-sheet/index.vue:onErrorAction` + `pages/trip-detail/index.vue:onRetry` + `pages/trip-prepare/index.vue:onRetry` | `const isRetrying = ref(false)` + onRetry 入口 `if (isRetrying.value) return` 守卫 + `isRetrying.value = true` + `try { await ... } finally { isRetrying.value = false }` 防网络异常永远卡 loading;`onUnmounted` 兜底 `isRetrying.value = false` 防内存泄漏 |
| page 共享组件 binding `:loading="isRetrying"` | 3 page 的 `_ErrorBanner` / `_ErrorOverlay` 用法 | 父 `isRetrying` 状态作为外部注入通道透传,0 业务逻辑硬编码在组件内 |
| 视觉态:`opacity: 0.5; pointer-events: none;` | `.error-retry-disabled` / `.error-overlay-button-disabled` CSS | 沿 13 页面惯例(spec §10 NFR 兼容性 + UI §六 按钮态),同时双保险(即使 v-if 漏判也不响应 tap)|
| 跨页 fix 协议:`Review.{ui,spec,test}` 保持 + 不重审 + 0 改动 5/5 满足状态 | `workflow/PageStatus.yaml` 3 page 块 Development 注释追加 1 行 | per ssp-arch §6 forward-looking comment 反模式 + reviewer「抽样审计 + 自报已知妥协」原则;纯 UX 改进 + 0 spec 字段变更 + 0 API 契约变更,reviewer 重审无新失败项 |
| 跨页 Issue 入口:`issues/Cross-Page/<XXX>-<seq>.md` | `issues/Cross-Page/Throttle-001.md` 373 行契约 | per issue-mgr §9.3 SOP 扩展:后续 issue-manager session 启动时**必须**也扫 `issues/Cross-Page/`(与 `issues/{UI,Spec,Arch,Test}/` 并列),未来跨页级 Issue 统一归 `Cross-Page/`,命名 `<Topic>-<seq>.md` 沿 CrossPage-001 / Throttle-001 模式 |
| Issue 关闭权归属 review 复审 | Throttle-001 §10 留 review 复审记录位 | per `AGENT_CONTRACTS.md §2.4`:code-writer 只 `Open → InProgress`,**不**关闭 Issue;**不**触发 code-writer / spec-writer(per task「让 orchestrator 决策下一步派 code-writer」),由 parent 派工 |
| `loading` 外部注入 + `throttled` 内部兜底 = 视觉 + 节流双重门 | 共享组件 / 私有 overlay 内部 | `isLocked = computed(loading \|\| throttled)`;if locked → return 守卫;外部 loading 态(父 isRetrying)+ 内部 throttled 态(emit 内部 300ms)互不依赖,任一为 true 即 disable;0 双击堆叠可能 |

## 8.8 Established conventions — Bug 2 修复(组件命名去 `_` 前缀,2026-06-05)

> **触发原因**:Vue 3 编译器**不**识别下划线开头的 tag 为 component,会降级处理为文本节点 escape,
> 导致 `<_ErrorBanner v-if="...">` 整段源码以字面字符串形式塞进 DOM,污染 UI。
> 全项目 12 page × 25 处私有组件全部命中。修法:把 `_Xxx.vue` 重命名为 `Xxx.vue`,import name + template tag 同步去下划线。

| Convention | Where | Notes |
|---|---|---|
| 私有组件命名 = **PascalCase 无前缀**(`DraftConfirmDialog` / `ErrorBanner` / `ClearChatConfirmDialog`),**不**用 `_` 前缀 | 12 page × 15 文件 + 31 import + 29 template | Vue 3 compiler 把 PascalCase + kebab-case 识别为 component;`_Xxx` 不识别,escape 成 text |
| 私有组件路径 = `pages/<page>/components/<Name>.vue`(`<Name>` 不带 `_` 前缀) | 8 page 私有子组件 | per Vue 3 命名规则 + Code Style §3.4 |
| 历史 `§8.x` 章节保留旧 `_Xxx` 引用(只读 snapshot) | AGENTS.md §8.1-§8.7 | 历史 changelog 记录当时实现,不修写;新 §8.8 记录修复事件 |
| Bug 2 修复脚本可复用 | `/tmp/fix-bug2.py`(在 ROOT 跑) | 15 文件 rename + 31 import + 29 template;python re 模块精确改,0 误伤 |
| 共享 `ErrorBanner` 跨 13 page | `src/components/ErrorBanner.vue`(原 `_ErrorBanner.vue`) | 不放 `pages/` 任何子目录,公共目录里 |
| 私有 `ErrorOverlay` 跨 1 page | `src/pages/spot-detail-sheet/components/ErrorOverlay.vue`(原 `_ErrorOverlay.vue`) | spot-detail-sheet 唯一调用方 |
| 5 类 7 弹窗组件去 `_` 改名 | `DraftConfirmDialog` / `ClearChatConfirmDialog` / `DeleteConfirmDialog` / `LogoutConfirmDialog` / `PermanentDeleteConfirmDialog` / `StyleOptionCard` / `GenderChipGroup` / `AgeChipGroup` / `NotificationSwitchRow` / `QuietHoursRow` / `TrashItemRow` / `UnreadBadge` | 全部去 `_` 前缀,PascalCase |
| 反向 import 跨页私有组件 1 路径 | `pages/guide-result/index.vue` `import ClearChatConfirmDialog from '../photo-guide/components/ClearChatConfirmDialog.vue'`(原 `_ClearChatConfirmDialog`) | 沿用 §8.4 反向依赖语义,只是改 import name + 路径去 `_` |

---

## 8.9 Established conventions — `sectionVisibility` 4 字段并存重构(2026-06-05 code-implementation 实证,HomePage v0.2.0)

> **触发原因**:HomePage v0.1.0 把 `viewMode` 5 枚举(loading/diary/trips/empty/error)设计为 v-if 互斥,导致 Section 1(今日行程)与 Section 2(行程列表)**不能同时渲染**。这与 user 实际期望不符(per user 体验反馈问题 1 严重,首页被拆问题)。
> v0.2.0 修法:**`viewMode` 5 枚举保留为底层语义标记(日志/埋点/调试用),**不**直接驱动 v-if**;**新增 `sectionVisibility` 计算属性 4 字段 `{ showError, showDiary, showTrips, showEmpty }` 实际决定 v-if**;两段可同时渲染,empty 仅在两段都不可见时兜底。

| Convention | Where | Notes |
|---|---|---|
| **`sectionVisibility` 计算属性 4 字段** 实际 v-if 决定源 | `pages/home/index.vue` L232-256 + `vue-page-empirics.md` §8 完整算法 | `error !== null` → `{ showError: true, ...全 false }`(整页错误占位);`isFetching && !hasFetchedOnce` → 全 false(顶层 loading);正常态 → 各段独立决定(可并存);`showEmpty = !showDiary && !showTrips`(双空兜底) |
| **`viewMode` 5 枚举保留为底层语义标记** | `pages/home/index.vue` L199 + L266-287 | `decideViewMode()` 函数返回 viewMode 5 枚举(供内部用 + 日志/埋点),**不**直接驱动 v-if;`logger.info('home viewMode', { viewMode })` 仍走 viewMode 语义 |
| **`grep "v-if=\"viewMode" pages/<page>/index.vue` 应 0 命中** | `pages/home/index.vue` 全文 + spec §10 R-10 spec-auditor 验证目标 | 所有 v-if 改走 `sectionVisibility.showXxx` 4 字段(per spec §10 R-10);spec-auditor 严格核对,0 命中即 PASS |
| **顶层 loading 态派生**:`isInitialLoading = !hasFetchedOnce && !sectionVisibility.showError` | `pages/home/index.vue` L258-260 | 顶层 loading 渲染 + FAB 隐藏,顶层 v-if 用 `v-if="isInitialLoading"`(派生自 sectionVisibility) |
| **error 优先 + 整页替换** | `pages/home/index.vue` L98-105 + `vue-page-empirics.md` §8 error 优先 | 任一 fetch 失败 → `sectionVisibility.showError = true` → 整页 `HomeErrorOverlay` 替换 MainContent(Section 1/2/Empty 全部不渲染,FAB 也不渲染) |
| **两段并存 + empty 仅在双空时触发** | `pages/home/index.vue` L80-115 + spec §3.7.3 决策表 | today != null + trips.length > 0 → **两段同时渲染**;today == null + trips.length === 0 → empty 兜底(任一非空都进 Section 1 或 Section 2,**不**降级为"半截数据") |
| **Section 2 标题 inline 渲染** | `pages/home/index.vue` L94-100 + `vue-page-empirics.md` §8 段标题 | 每段标题(`SectionTitle` Noto Serif SC 18px 600)在每段内 inline 渲染(本页面 Section 2 加 `section-trips-title-wrap` 包裹 + `section-trips-title` 样式),**不**抽公共 `_SectionTitle` 组件(MVP YAGNI,inline 渲染) |
| **FAB 浮动按钮三态显示** | `pages/home/index.vue` L124-135 | `v-if="!sectionVisibility.showError && !isInitialLoading"`(Section 1 / Section 2 / Empty 兜底都显示,error + loading 态不显示 — 避免误导) |
| **多段页面 enum set 决策口诀** | `vue-page-empirics.md` §8 判定口诀扩 5 类 | 单段 + loading/error/empty → 5 视图态互斥(沿 §1 模式);**多段 + 可能并存/可能各自为空 → `sectionVisibility` 计算属性 4 字段并存结构(本模式)**;浮层 4 视图态(沿 §2 模式);表单 6 视图态(沿 §3 模式) |
| **sectionVisibility spec 字面沿用** | `specs/HomePage.md` §3.7.2 + §6.4.4 Resolved 决策路径 | spec 字面 1:1 对齐:`error !== null` 整页 / `isFetching && !hasFetchedOnce` 全空白 / `showDiary = today !== null && today.today_items.length > 0` / `showTrips = trips.length > 0` / `showEmpty = !showDiary && !showTrips`;spec-auditor 5 项核对 enum set 时,**不**直接驱动 v-if(per spec §10 R-10) |
| **段标题 inline + strings 段增量** | `constants/strings.js` L113 `sectionTripsTitle: '行程列表'` | 新增 1 键 `HomeStrings.sectionTripsTitle` 给 Section 2 标题;**不**复用既有 5 字符串段(per Code Style §10 + 13 页面惯例);spec 字面 1:1 引用 |
| **H5 ≥1024px 4 section 容器居中** | `pages/home/index.vue` L568-575 @media | `.section-diary / .section-trips / .section-empty / .state-error { max-width: 640rpx; margin: 0 auto; }`(per 13 页面惯例 + spec §10 NFR 兼容性);**仅**作用于内容容器,Header / 浮动按钮不受限;移动端(< 1024px)零变化 |
| **跨页 refactor retro fix 协议** | `workflow/PageStatus.yaml` HomePage.Development 注释追加 1 行 v0.2.0 | per memory §4 + ssp-arch §6 forward-looking comment 反模式:`Review.{ui,spec,test}` 全部保持(0 改动)+ `FinalStatus` 保持(0 改动,本任务 HomePage 是 Done,跨页 refactor 不影响)+ PageStatus 注释追加 1 行 v0.X.Y retro fix 说明 |
| **sectionVisibility 模式后续扩展(3+ 段页面)** | `vue-page-empirics.md` §8 适用先例 | 后续页面若扩到 3+ 段(如 Section 1 / 2 / 3 + Empty),可类比扩 `sectionVisibility` 5 字段(`showSection1` / `showSection2` / `showSection3` / `showEmpty` / `showError`),`viewMode` 6 枚举保留(语义标记,**不**直接驱动 v-if) |
| **MVP 简化 BottomTabBar + 1x1 transparent PNG 占位** | `pages.json` tabBar 段 + `static/tabbar/*.png` 6 个文件 | uni-app `tabBar.iconPath` 必填但 MVP 无 UI 设计师 → python3 + base64 64-char PNG(1x1 transparent,68 bytes)批量创建 6 个 + `static/tabbar/` 目录放项目根级(per uni-app vue-cli 约定,`static/` 在 `src/` 外);后续 UI 设计师补真实 icon |
| **spec-writer 越权边界** + **不触动既有 Review 状态** | code-writer 硬规则 + memory §4 字段状态规则 | 0 修改 specs/(spec-writer 越权);0 创建 issues/(refactor + 集成,无失败项);0 触动既有 16 page entry / globalStyle / easycom;0 触动既有 9 components / 2 stores / 3 services;0 触动既有 Review.{ui,spec,test}(per ssp-arch §6 forward-looking comment 反模式) |

## 8.10 Established conventions — fix-personal-profile-not-found 子组件 import 深度 N+1(2026-06-05 实证)

> **触发原因**:PersonalProfilePage 子组件 (`GenderChipGroup.vue` + `AgeChipGroup.vue`) 的 `constants/strings.js` import 路径少写 1 层 `..`,Vite 5 报 "Failed to resolve import" + 屏幕显示源码 + 红色 error overlay。父 page (`pages/personal-profile/index.vue`) 路径正确(2 层 `..` 回到 `src/`),但子组件在 `pages/<page>/components/`(3 层深)必须用 3 层 `..` 回到 `src/`。**根因**:code-writer 复制父 page import 模板时**未察觉**子组件多 1 层深度。

| Convention | Where | Notes |
|---|---|---|
| **页面私有子组件 import 路径深度 = 父 page + 1 层** | `pages/personal-profile/components/GenderChipGroup.vue` L59 + `AgeChipGroup.vue` L56 | 父 page 在 `pages/<page>/index.vue`(2 层)用 `../../<shared>.js` 回到 `src/`;**子组件**在 `pages/<page>/components/X.vue`(3 层)必须用 `../../../<shared>.js` 回到 `src/`;**反向**:`components/`(`src/components/`) 公共子组件 1 层用 `../<shared>.js`;**未来 code-writer 写新页面私有子组件时**:在 AGENTS.md 自查「文件在 `pages/<page>/components/` 时所有 import 路径必须比父 page 多 1 个 `..`」 |
| **curl 5 URL 一次性定位 404/500**(per vue-core-patterns.md) | `bash curl -sS -o /dev/null -w "%{http_code}\n" <url>` | 比浏览器 Network 面板更直接(deprecated 5xx 在 Vite 不会被 Network 面板标注为「明确错误」,但 curl `%{http_code}` 立即返回 500/200);**实战**:`/src/pages/personal-profile/index.vue` 200 + `/src/components/InterestGrid.vue` 200 + 2 子组件 500 → 0.5min 锁定根因;Vite 5 import-analysis 失败 500 响应 body 包含完整 source frame(line:column) + stack,**curl 1 次 = 完整 1 字段精准定位**,无需打开浏览器 |
| **0 改动既有 5/5 状态 + PersonalProfilePage PageStatus 新块** | `workflow/PageStatus.yaml` PersonalProfilePage 块(新加) | PersonalProfilePage 是新加进 PageStatus.yaml 的块(原文件无此 page,因 page 是后期独立开发的,未走标准 pipeline);Dev=Completed(页面已落地工作)+ Review.{ui,spec,test}=Pending(代码变更触发 3 reviewer 重新核对,per AGENT_CONTRACTS §4.3 invariant 2)+ FinalStatus=NeedReview;**前例**:`TripDetailPage` `FinalStatus: NotStarted` 语义不一致登记,跨页 fix 协议(per ssp-arch §6 + CrossPage-001 §8.4);**反模式**:"为安全起见把 Review 重置为 Pending" → 触发 auto-re-dispatch 竞态(per memory §4) |
| **Vite HMR error overlay 在 import 修复后会**卡住** 显示旧错误** | `mavis mcp call playwright browser_press_key '{"key":"Escape"}'` 或 `?t=2` cache-bust query | 即使磁盘上 import 已修对 + curl 200,浏览器仍可能显示 fix 前的红色 Vite error overlay(HMR 没自动清 overlay);**强制重载**:改 URL 加 `?t=<n>` query 参数 + `browser_press_key Escape` dismiss overlay;**实战**:fix 后 1 次截图仍是 Vite overlay,加 `?t=2` + Escape 后第 2 次截图正常 |
| **修 UI 严重 bug 不动 spec / 不动既有 page 块** | per hard rule「**不**改其他 page」+「严禁改 spec」 | 修复范围**仅** 2 子组件 import 路径修正 + 1 PageStatus.yaml 块新增;0 改 `specs/PersonalProfilePage.md`(spec v0.1.1 0 改动)+ 0 改 `pages/personal-profile/index.vue` 1019 行(import 路径本来就对)+ 0 改既有 9 page PageStatus 块(LoginPage / OnboardingPage / HomePage / SpotDetailSheet / NewTripPage / TripDetailPage / EditTripPage / MyPage / BottomTabBar);**根因**:本 bug 源是子组件 import 路径,父 page 完全正常,5 视图态 / 3 段 / 字段 / 接口契约全部 0 触动 |
| **Curl-fetch 500 响应是 HTML 包裹 ErrorOverlay 字符串**(per vue-core-patterns.md) | `curl /src/.../X.vue` 500 响应 | Vite 5 import 解析失败时,500 响应 body = `<html><script>document.body.appendChild(new ErrorOverlay({message, stack, id, frame, plugin, pluginCode, loc}))</script></html>`;**实战价值**:`grep "Failed to resolve\|Does the file exist" <response>` 1 命中即根因;`frame` 字段含 `line:column` 精准定位;**反信号**:看到 500 以为是 dev-server crash → 实际是文件级 import 错误,Vite 自动恢复设计 |
| **playwright 端到端验证 4 步(per memory §0 新 SOP)** | `mavis mcp call playwright browser_navigate` → `browser_console_messages` → `browser_evaluate click()` → `browser_take_screenshot` | 本 fix 验收 4 步(均实测,0 推理):① navigate `?entry=personal-profile` → Page Title 切 `个人资料` ✓ ② console_messages 0 errors(unrelated favicon.ico 忽略) ✓ ③ evaluate `document.querySelector('.user-info-card').click()` → URL 跳 `#/pages/personal-profile/index` ✓ ④ take_screenshot 视觉证据(74KB 656×863 PNG 显示 5 视图态 editing 视图);**反模式**:`lsof + curl HTTP 200 + 推理 ✅` 是不充分的(per memory §0 ssp-fix-r1 retry 教训) |

## 8.11 Established conventions — fix-notification-click-inverse H5 double-fire + v-if 抖动(2026-06-05 实证)

> **触发原因**:NotificationSettingPage user 实测 2 bug:(A) 类别块点击行为反转(点 switch 块不变 / 点其他区域切);(B) 静默时段开关切换 picker「刷新」抖动。根因:(A) H5 端 `<switch>` 是 `<input type="checkbox">`,外层 view `@click` 先于 switch `@change` 触发 → 翻 2 次 = 不变;(B) `v-if="enabled"` + `animation: qhFadeIn 0.2s` 在 enabled 切换时卸载/重挂载 picker + 动画重新播放 → 抖动。修复:(A) 移除 outer view `@click` + `onRowTap` 函数;`<switch>` `@change` 成为唯一触发区;(B) `v-if` 改 always-render + `:disabled="!enabled"` + `.qh-pickers-disabled` 视觉弱化(opacity 0.5 + pointer-events: none) + `transition: opacity 0.2s`。

| Convention | Where | Notes |
|---|---|---|
| **H5 `<switch>` 嵌可点击 view = double-fire 反转 bug** | `pages/notification-setting/components/NotificationSwitchRow.vue` L28-33 + L79-83 | 根因:uni-app H5 `<switch>` 实际 = `<input type="checkbox">`;外层 view `@click` 先于 switch `@change` 触发 → 状态翻 2 次净效果 = 不变;点非 switch 区域反而切(单触发正常);**修复**:移除外层 view `@click` + `onRowTap` 函数,`<switch>` `@change` 成为唯一触发区;hover-class 保留(纯视觉反馈);**推广**:任何「外层 view `@click` + 内嵌 switch/checkbox/radio/slider」 模式在 H5 端都**疑似有 bug**,新 code-writer 写设置行组件时**默认 switch 自身是唯一触发区**(沿 iOS / Android 行业共识);**排查命令**:`grep -nE "@click.*onRowTap\|@change.*onSwitch" pages/<page>/components/*.vue` |
| **`v-if` + `animation:` = 切换时「刷新」抖动** | `pages/notification-setting/components/QuietHoursRow.vue` L59-107 | 根因:`v-if` 卸载/重挂载组件,CSS `@keyframes animation` 在 mount 时**默认重新播放** → 0.2s 内布局变化 = 抖动;**修复模式 3 选 1**:A) always-render + `:disabled` + 视觉 disabled class(保留值是硬要求 → 选 A,本任务实证);B) `v-show` + `display: none`(不重挂载但完全隐藏,适合作动画可牺牲场景);C) `v-if` 不可行(挂载/卸载无法阻止);**决策矩阵**:`<picker mode="time" :disabled="!enabled">` + 外层 `.qh-pickers-disabled { opacity: 0.5; pointer-events: none; }` + `transition: opacity 0.2s` = 双保险 + smooth 视觉;**推广**:`grep -nE "v-if.*\)\|animation:"` 全仓扫脆弱点 |
| **aria-* 属性跟随实际触发元素迁移** | `NotificationSwitchRow.vue` L28-49 | 移除 outer view `@click` 后,`role="button"` / `aria-pressed` 跟着移除(outer view 已不再是 button);`role="button"` + `aria-pressed` 移到 `<switch>` 自身(因为它现在是实际 button);`:aria-label="title"` 保留(描述性 label,不是 button 语义);**决策树**:view 是 button(可点击)→ `role="button"` + `aria-pressed` + `@click` 必须同时存在;view 是 wrapper(不可点击)→ 仅 `:aria-label` 可选,无 role / aria-pressed / @click |
| **task 显式 scope vs spec 字面冲突 → task 优先 + spec 偏差显式登记**(per memory §2) | `outputs/fix-notification-click-inverse/deliverable.md §3.1` | 2 处 spec 字面冲突:(1) `specs/NotificationSettingPage.md` §3.4「整行可点」vs impl「switch 唯一触发」;(2) §3.6「QHPickers 用 v-if enabled」+ §8.4「动效 fadeIn 0.2s」vs impl「always-render + :disabled」;**处理**:**不**改 spec(spec-writer 越权边界)+ **不**在 deliverable 写「已知妥协」美化(per memory §2)+ **不**静默修 + 主动在 deliverable §3.1 列出"spec 字面 / 实际 impl / 决策路径"3 列表;**后续动作**:spec-writer 决策是否修订 spec(本 session 越权边界);**反模式**:task 显式改 spec 描述行为但 reviewer 按 spec 字面 re-audit FAIL → 必须在 deliverable §3.1 主动透明 |
| **task 显式 scope 外的同模式 bug = 软观察登记不静默修** | `outputs/fix-notification-click-inverse/deliverable.md §3.2` | 本任务 Fix A 显式列 4 通知类别(`NotificationSwitchRow` 实例);`QuietHoursRow` QHHeader `onHeaderTap` 也有同模式 double-fire 风险(`@click="onHeaderTap"` + `@change="onToggleChange"`),但 task 未要求;**处理**:**不**主动修(per memory §2 「任务没提 → 自决」 + 「严禁静默扩 scope」)+ 在 deliverable §3.2 软观察登记 + 列出后续 action 建议(spec-writer 决策统一 / user 实测报 issue);**反模式**:task scope 外主动修同模式 bug → 任务越权 + spec-audit 不通过 + verifier 退回 |
| **Fix-only 任务 PageStatus 不重置**(per ssp-arch §6 + memory §4) | `workflow/PageStatus.yaml` NotificationSettingPage 块 0 改动 | 本任务是 fix-only,非 review 复审触发;`Review.{ui,spec,test}=Pass` 保持 + `FinalStatus=Done` 保持 + Spec / Arch / Development 全部不变;**反模式**:"为安全起见把 Review 重置 Pending" → 触发 auto-re-dispatch 竞态(per memory §4) + 增加 reviewer 负担;**正确做法**:deliverable §3 多子节主动透明登记(spec 偏差 + 软观察 + 副作用 + 验收表 + 实测路径),reviewer 走「抽样审计 + 自报已知妥协」原则,无新失败项 = 不重审 |

## 8.12 Established conventions — fix-newtrip-title-no-append 派生函数严格返回字段值(2026-06-26 实证)

> **触发原因**:user 2026-06-26 19:46 报 bug:成功创建行程时 trip.title 错误显示「行程 {start_date} - {end_date} {days}天」拼接字符串,而**应该**严格用 `fd.title.trim()`(user 字面期望「行程名称应该为行程标题字段名称」)。根因 = `deriveTitle` 函数在 fd.title 为空时 fallback 到日期拼接兜底(即使 `hasRequiredFields` 在 form 校验阶段已拦截,边界场景仍可能触发)。

| Convention | Where | Notes |
|---|---|---|
| **派生函数删除兜底拼接 = 严格 return fd.x.trim()** + **onSubmit 拦截走 formSubmitError banner 而非切 error 态** | `pages/new-trip/index.vue` `deriveTitle` L391-407 + `onSubmit` L778-787 | user 报「字段 X 被隐式拼接兜底覆盖」类 bug 的标准修法 3 步:① `deriveTitle(fd) = (fd.title \|\| '').trim()`(严格返回字段值,删除所有 fallback 拼接逻辑);② `onSubmit` 在 `!title` 分支改设 `formSubmitError = NewTripStrings.errorRequired` + `logger.warn` + return,**不**切 `currentStep='error'`(避免引入新 enum 状态,保持 6 视图态严格 enum set 不变);③ JSDoc 注释保留**旧 buggy 行为**作为「v0.6.0 修订」决策路径说明,方便 future reader + verifier 理解;**推广**:任何「派生字段 / 隐式字段」函数(deriveTitle / deriveCity / deriveStartDate 等)遇到「拼接兜底覆盖真实值」user 报 bug,**不**保留任何拼接 fallback,**不**引入新 enum 态,统一走 banner 提示路径 |
| **派生函数删除拼接兜底 ≠ 删除拼接用的辅助函数(dayDiff 等)** | `pages/new-trip/index.vue` `dayDiff` L383-389 保留 | 即使 `deriveTitle` 不再调用 `dayDiff`,`dayDiff` 仍被 `submitTripRequest` L789 调用算 `days` 给 `logger.info('submit start', { days, ... })`;**反模式**:派生函数简化时**不**连带删 helper 函数 — 必须先 grep `grep -n "dayDiff" src/pages/<page>/index.vue` 验证仅派生函数调用,**再**决定是否删 helper;沿 AGENTS.md §0 「禁止新增未定义功能」反向 — 「禁止删除仍在使用的功能」 |
| **stale spec section 不在 task scope = register in deliverable §3 不静默修** | `specs/NewTripPage.md` §6.4.4 v0.3.0 旧决策代码示例 vs v0.4.0 实际代码 + §6.4.5b v0.6.0 段尾登记 | `specs/NewTripPage.md §6.4.4` 写于 v0.3.0 时代,代码示例 `${city} {start_date} - {end_date} {dayCount}天游` 假设 UI 无 title 输入框;v0.4.0 已加显式 title 字段 + `NewTripFormData.title`,但 §6.4.4 未同步更新(笔误);本 task scope 限定**不**改 §6.4.4(避免 5+ 行代码示例连带改),仅在 §6.4.5b 段尾**显式登记** MVP 简化决策,留给 spec-writer 后续 session 合并时整体修订;**推广**:任何 task 触发「相关 spec 段与实际代码不一致」,**不**改(spec-writer 越权边界)+ **不**在 deliverable 写「已知妥协」美化 + **不**静默修 + 主动在 deliverable §3 列「stale spec section / 实际代码 / 决策路径 / 后续 action」4 列表;per AGENTS.md §8.11 「task 显式 scope vs spec 字面冲突 → task 优先 + spec 偏差显式登记」同模式 |
| **PageStatus.yaml `FinalStatus: Done` (scalar) + indented `note:` 模式 = pre-existing 全文件 precedent,strict YAML parser 拒绝但 orchestrator 接受,append 时沿用** | `workflow/PageStatus.yaml` 13+ Cross-Page 块都用此模式 | 实证:`python3 yaml.safe_load('...')` 对单 Cross-Page 块解析报 `mapping values are not allowed here`,**但**所有 13+ 既有 Cross-Page 块(disabled-mock-default / bug-bundle-2026-06-24-small-fixes / TripCreateEditFix-001-* / UserRound2-001-* / UserRound2-002-* / location-real-fix-v2-2026-06-25 / newtrip-draft-push / edittrip-draft-days-plus-dates / trip-effective-status-client / fix-newtrip-draft-require-dates)都用此模式;orchestrator 实际解析工具接受 strict YAML 之外的 yaml-like;**append 决策**:**不**修复 pre-existing 模式(per AGENTS.md §0 「禁止新增未定义功能」反向 — 「禁止破坏既有约定」)+ **不**尝试 YAML lint 整个文件(会因 pre-existing 错误失败)+ append 时**只**验证**新追加块**单独解析(yaml.safe_load 截取从 `# Cross-Page:` divider 到文件末尾 = 单块解析 OK 即 PASS);**反模式**:看到 strict YAML 报错就 panic 改写所有块 → 浪费 30min + 触发 sibling session race condition |
| **删除 fallback ≠ 删除 JSDoc 描述该 fallback 的注释** | `pages/new-trip/index.vue` deriveTitle JSDoc L391-401 | JSDoc 注释保留「`行程 {start_date} - {end_date} {days}天` 拼接字符串」描述作为 v0.6.0 修订决策路径文档;**反模式**:删代码时**不**连 JSDoc 一起删 — JSDoc 是「why this fix」决策路径,future reader + verifier 都需要;**推广**:grep `行程.*days.*天` 1 命中仅在 JSDoc,符合期望(任务原文 grep 命令「应 0 命中(拼接兜底已删)」实际是验证代码路径 0 命中,JSDoc 注释路径 1 命中可接受) |

