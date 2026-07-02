// frontend/constants/strings.js
// UI 文字常量 —— 参见 docs/Frontend Code Style Guide.md §10
//
// 规则:所有用户可见文案**必须**走本文件,template 不允许硬编码中文字符串。
// 后续接入 i18n 时,把本文件改造成按 key 取值即可,无需改组件。

import { AppRoutes } from './routes.js'

export const OnboardingStrings = {
  // 顶栏
  skipButton: '跳过',

  // 欢迎区
  welcomeTitle: '欢迎来到导友',
  welcomeSubtitle: '告诉我们你的兴趣,导友会为你推荐更对味的旅行内容',

  // 步骤
  stepTitle: '选择感兴趣的领域',
  stepHint: '可多选,至少 1 项',

  // 主按钮
  completeButton: '完成设置',

  // 成功 Toast
  successToast: '设置成功',

  // 错误提示(spec §6.1 Error 表)
  errorNetwork: '网络异常,请稍后重试',
  errorBadRequest: '参数不合法,请刷新后重试',
  errorServer: '服务器开小差,请稍后再试',

  // 重试
  retry: '重试',
}

/**
 * InterestGrid 默认选项(spec §8.1)
 * 1:1 对齐 api/types.ts Interest 5 枚举,顺序为设计稿推荐阅读顺序。
 * @type {ReadonlyArray<{ value: import('../api/types').Interest, label: string, emoji: string }>}
 */
export const OnboardingInterestOptions = Object.freeze([
  { value: 'history', label: '历史古迹', emoji: '🏯' },
  { value: 'food',    label: '美食探店', emoji: '🍜' },
  { value: 'nature',  label: '自然风光', emoji: '🏔️' },
  { value: 'photo',   label: '拍照打卡', emoji: '📸' },
  { value: 'family',  label: '亲子乐园', emoji: '👶' },
])

/**
 * HomePage 专用文案(specs/HomePage.md §3 §5 §9)
 *
 * - 顶栏:Tab「主页」入口;有 diary 时显示「探险日记」,否则显示「我的行程」
 * - Diary 视图:问候语 + 标题(今天是「X」第 N 天)
 * - TripList 视图:无独立标题,沿用 Header
 * - EmptyState:插画 + 标题 + 副标题 + CTA
 * - 状态徽章
 * - 收藏 Toast
 * - 错误提示(由 ErrorType → 友好文案)
 *
 * 备注(specs/SpotDetailSheet.md §10 R-1):
 *   原 `浮层(SpotDetailSheet)` 段 7 个 key(sheetCloseLabel / sheetTrafficTitle /
 *   sheetNoteTitle / actionNavigate / actionGuide / actionFavorite / actionUnfavorite)
 *   已抽到 `SpotDetailSheetStrings` 段,实现跨页复用。`typeEmojiDefault` 兜底
 *   emoji 同步并入 `ItemTypeEmoji.default` 键,SpotCard / SpotDetailSheet 均
 *   通过 `ItemTypeEmoji[item_type] || ItemTypeEmoji.default` 拿到 fallback,
 *   不再 import 任何 `HomeStrings.*` 兜底字段。
 */
export const HomeStrings = {
  // Header
  pageTitleDiary: '探险日记',
  pageTitleTrips: '我的行程',

  // DiaryHeader
  greetingMorning: '早上好,继续昨天的精彩吧',
  greetingNoon: '下午好,今天慢慢走',
  greetingEvening: '晚上好,明天再出发',
  greetingEmojiMorning: '☀️',
  greetingEmojiNoon: '⛅',
  greetingEmojiEvening: '🌙',
  diaryTitlePrefix: '今天是「',
  diaryTitleSuffix: '」第 ',
  diaryDaySuffix: ' 天',

  // SpotTimeAxis & SpotCard
  statusNow: '现在',
  statusDone: '已完成',
  statusUpcoming: '即将到来',
  statusExpired: '已过期',
  statusChanged: '有调整',
  timeRangeSeparator: ' - ',

  // Toast
  toastFavorited: '已收藏',
  toastUnfavorited: '已取消收藏',
  toastMapFail: '地图唤起失败,请稍后重试',
  toastPageJumpFail: '页面跳转失败,请稍后重试',

  // Diary footer
  viewFullTrip: '查看完整行程',
  viewFullTripAria: '查看完整行程',

  // 浮动按钮
  addTripAria: '新建行程',

  // EmptyState
  emptyTitle: '还没有行程,创建一个吧',
  emptySubtitle: 'AI 帮您规划第一次旅行',
  emptyCta: '立即新建',
  emptyIllustration: '📖🌏',

  // Section 2 — 行程列表(per v0.2.0 spec §3 UI Structure)
  sectionTripsTitle: '行程列表',

  // 5 态提示
  loadingText: '正在准备今天的行程...',
  errorTitle: '首页数据加载失败',
  errorRetry: '重试',

  // 错误映射(spec §6.1 Error 表 + 任务 §1 友好提示)
  errorNetwork: '网络异常,请稍后重试',
  errorBadRequest: '参数不合法,请刷新后重试',
  errorServer: '服务器开小差,请稍后再试',
  errorNotFound: '行程不存在',

  // 排序
  tripStatusActive: '进行中',
  tripStatusDraft: '草稿',
  tripStatusFinished: '已结束',
  tripDateFormat: '{start} ~ {end}',

  // 行程列表 chat 入口(2026-06-24 新增,per task「每个行程有独立 chatSession」)
  // 沿 AGENTS.md §8.6 13 页面惯例:每个 user-facing 文案键必带 aria 标签
  // button label 用 emoji 💬(icon 简写,沿 follow-up chip 模式)
  // aria 模板带 {title} 占位(运行时插值,无障碍读屏更准)
  btnChatTrip: '💬',
  btnChatTripAria: '打开「{title}」的智能对话',

  // Section 1 今日无行程占位(2026-06-24 Fix A 新增,per user 报「再次进入时 Section 1 消失」)
  // Section 1 永远保留:有 today_items 渲染 <HomeDiary>;无 today_items 渲染 <EmptyTodayState>
  emptyTodayTitle: '今日无行程',
  emptyTodaySubtitle: '休息一下,或者点右下角 + 新建一个',
  emptyTodayEmoji: '🌙',

  // 行程卡片删除入口(2026-06-24 UserRound2-001 §3 Bug C 新增)
  // 沿 AGENTS.md §8.6 13 页面惯例:每个 user-facing 文案键必带 aria 标签
  // 状态门控:仅 draft / finished trip 显示删除按钮(active 引导走回收站,见 deleteActiveTripToast)
  btnDeleteTrip: '删除',
  btnDeleteTripAria: '删除「{title}」',
  deleteConfirmTitle: '删除行程?',
  deleteConfirmMessage: '删除后可在「我的-回收站」中恢复',
  deleteConfirmConfirm: '删除',
  deleteConfirmCancel: '取消',
  deleteSuccessToast: '已移入回收站',
  deleteFailToast: '删除失败',
  deleteActiveTripToast: '进行中的行程请走「我的-回收站」',
}

/**
 * SpotDetailSheet 专用文案(specs/SpotDetailSheet.md §10 R-1)
 *
 * 由原 `HomeStrings` 浮层段抽出,实现跨页面复用(components/SpotDetailSheet.vue
 * 现 import 段不再依赖 `HomeStrings`,被 pages/home/index.vue 浮层调用点 +
 * pages/spot-detail-sheet/index.vue 独立 route 调用点共享)。
 *
 * 字段分类:
 *   浮层标题 / 按钮文案(7) + emoji 兜底(1) + 错误兜底文案(6) + 加载文案(1)
 */
export const SpotDetailSheetStrings = {
  // 浮层(SpotDetailSheet)—— 原 HomeStrings 浮层段
  sheetCloseLabel: '关闭',
  sheetTrafficTitle: '交通指引',
  sheetNoteTitle: '小贴士',
  actionNavigate: '导航去这里',
  actionGuide: '拍照讲解',
  actionFavorite: '收藏',
  actionUnfavorite: '已收藏',
  // 时间范围分隔符(原 HomeStrings.timeRangeSeparator),浮层时间行用
  timeRangeSeparator: ' - ',

  // 错误兜底(_ErrorOverlay,spec §3.2 + §8.2)
  errorNotFoundTitle: '该景点不可用',
  errorNotFoundMessage: '抱歉,无法显示这个景点详情',
  errorNotFoundButton: '返回首页',
  errorLoadTitle: '加载失败',
  errorLoadMessage: '景点详情加载失败,请稍后重试',
  errorLoadButton: '重试',

  // loading 态文案(spec §3.4)
  loadingText: '正在加载景点详情...',
}

/**
 * item_type → emoji 映射(spec §3.1 TypeEmoji)
 * 1:1 对齐 api/types.ts ItemType 4 枚举 + 兜底 default 键
 *
 * 字段名调整(原 HomeItemTypeEmoji,spec §10 R-2/R-3):
 *   - 由 `HomeItemTypeEmoji` 重命名为 `ItemTypeEmoji`(通用名,非 Home 专属)
 *   - 加 `default` 兜底键(原 HomeStrings.typeEmojiDefault),5 键;调用方
 *     `ItemTypeEmoji[item_type] || ItemTypeEmoji.default` 即可拿到 fallback,
 *     无需跨页 import `SpotDetailSheetStrings.typeEmojiDefault`
 *
 * @type {Readonly<Record<import('../api/types').ItemType | 'default', string>>}
 */
export const ItemTypeEmoji = Object.freeze({
  attraction: '🏛️',
  food: '🍜',
  traffic: '🚶',
  rest: '😴',
  default: '📍',
})

/**
 * ItemStatus → 中文徽章文案(spec §3.1 StatusBadge)
 * 1:1 对齐 api/types.ts ItemStatus 4 枚举
 * @type {Readonly<Record<import('../api/types').ItemStatus, string>>}
 */
export const HomeItemStatusLabel = Object.freeze({
  planned: HomeStrings.statusUpcoming,
  done: HomeStrings.statusDone,
  skipped: HomeStrings.statusExpired,
  changed: HomeStrings.statusChanged,
})

/**
 * TripStatus → 中文徽章文案(spec §3.7 列表展示)
 * v0.2.0 修订(per TrashPage spec §6.4.4 Resolved):
 *   - TripStatus 3 枚举(draft / active / finished),'deleted' 不再是 enum value
 *   - 但 `deleted` 键**仍保留**作为显示别名:TrashPage 列表徽章固定展示「已结束」文案
 *     (由 TrashPageStrings.statusLabel 显式传 HomeTripStatusLabel.deleted,语义稳定)
 *   - 实际 TripStatus 走 'finished' 枚举 + deleted_at 字段表达删除状态
 * v0.6.1.1 修订(per fix-trip-status-machine v0.6.1 状态机重写 + verifier feedback):
 *   - 新增 `inProgress` 键:对应 `utils/tripStatus.js:computeEffectiveStatus` v0.6.1
 *     返回值 'inProgress' 字段(完整行程 + today <= end_date)
 *   - **核心 bug 修复 2**(per user 19:46 期望「草稿能转进行中」):
 *     DB `status='draft'` 但 4 字段全有(itinerary_count >= 1)的 trip,v0.6.1 helper
 *     返回 'inProgress';旧 v0.5.0 fallback chain `HomeTripStatusLabel[effectiveStatus]
 *     || HomeTripStatusLabel[trip.status]` 会回退到 'draft' = 「草稿」,导致核心
 *     bug 修复 2 名存实亡。加 `inProgress` 键后,label 走「进行中」,语义正确
 *   - 复用 `HomeStrings.tripStatusActive`(= '进行中')作为 inProgress 文案,
 *     与 `TripDetailStatusLabel.inProgress` 文案 1:1 对齐(避免新增 i18n 字符串)
 *   - 不删 `active` 键:作为 `trip.status='active'` 字面值的后备显示(虽然
 *     v0.6.1 helper 已不再返回 'active',但旧 mock 数据 + 边界场景仍可能)
 * @type {Readonly<Record<import('../api/types').TripStatus | 'inProgress' | 'deleted', string>>}
 */
export const HomeTripStatusLabel = Object.freeze({
  draft: HomeStrings.tripStatusDraft,
  active: HomeStrings.tripStatusActive,
  finished: HomeStrings.tripStatusFinished,
  // v0.6.1.1 新增:helper 派生 'inProgress' 时的徽章文案(完整行程 + today <= end_date)
  inProgress: HomeStrings.tripStatusActive,
  // 显示别名(TrashPage 复用,非 TripStatus enum value)
  deleted: HomeStrings.tripStatusFinished,
})

/**
 * NewTripPage 专用文案(specs/NewTripPage.md §10 C-1 强约束,~44 键)
 *
 * 字段分类:
 *   顶栏(1) + 输入区(2) + 文件(1) + 分析态(2) + 表单(3)
 *   + 7 字段 label(7) + 3 placeholder(3)
 *   + 交通偏好 4 chips(4) + 特殊需求 4 chips(4)
 *   + 提交(3) + 提交态(1) + 完成态(1) + 错误兜底(6) + 草稿弹窗(6)
 *   + H5 aria(1)
 */
export const NewTripStrings = {
  // 顶栏
  pageTitle: '新建行程',

  // 输入区
  greetingTitle: '说说你的旅行计划',
  greetingHint: 'AI 帮你自动填写目的地 / 日期等',

  // 文件
  btnAttachFile: '添加文件',
  btnAttachFileEmoji: '📎',

  // 分析态
  analyzingTitle: 'AI 正在分析你的行程内容...',
  analyzingHint: '通常需要 1-3 秒',

  // 表单头
  formTitle: '确认行程信息',
  formHint: '红色 * 为必填项,可在 AI 填写基础上修改',
  // UI-024:复制模式顶部 hint(prefix + suffix 包裹 originalTripTitle,见 NewTripPage.onConfirm title 派生)
  formHintCopyPrefix: '复制自「',
  formHintCopySuffix: '」,可修改字段后保存为新行程',

  // 4 字段 label(spec §3.5,v0.4.0 TripCreateEditFix-001 移除 3 字段:
  //   city / companions / budget / transport / needs;保留 title + start_date + end_date)
  fieldTitle: '行程标题', // spec EditTripPage §10 C-3 触发新增
  fieldStartDate: '出发日期',
  fieldEndDate: '返回日期',
  fieldItineraryDate: '日期',  // v0.4.0 行程安排字段内 date picker label(复用)

  // 字段 placeholder
  placeholderStartDate: '请选择出发日期',
  placeholderEndDate: '请选择返回日期',

  // 提交按钮
  btnCancel: '取消',
  btnSubmit: '确定',
  btnConfirm: '确认',
  // UI-024:复制模式 form 态主 CTA 文案(替代默认「确认」)
  btnSaveNew: '保存新行程',

  // 提交态
  submittingText: '正在创建行程...',

  // 完成态
  completedText: '创建成功!',

  // 错误兜底(spec §6.1 Error 表)
  errorRequired: '请填写完整',
  errorNoContent: '请输入行程内容或上传文件',
  errorNetwork: '网络异常,请稍后重试',
  errorBadRequest: '参数不合法,请检查后重试',
  errorServer: '服务器开小差,请稍后再试',
  errorRetry: '重试',
  errorFallback: '系统错误,请稍后重试',

  // 草稿弹窗
  draftDialogTitle: '保存草稿?',
  draftDialogMessage: '已输入的内容将保存到草稿箱,可在「我的 → 回收站」查看',
  draftDontSave: '不保存',
  draftContinue: '继续编辑',
  draftSave: '保存草稿',
  draftSavedToast: '已保存到草稿箱',
  draftSaveFailedToast: '草稿保存失败,内容已保留在页面',
  draftNoDatesToast: '未选择日期,无法保存为草稿', // v0.5.1(per user 19:37 bug)无日期守卫

  // H5 aria(spec §10 可访问性)
  textareaAria: '行程内容输入框',
}

/**
 * v0.4.0(2026-06-23 per TripCreateEditFix-001):NewTripTransportOptions + NewTripNeedsOptions
 * 整段删除。原因:user 2026-06-19 自报「service 和 store 只是调用 API,具体操作仅由后端执行」,
 * 4 选填 client-only 字段(transport / needs)UI 字段一起移除(spec §6.4.2 PD-001 决策);
 * 4 选填枚举沿用 post-mortem 不需单独保留,改由 user 后端业务侧管。
 */

/**
 * TripDetailPage 专用文案(specs/TripDetailPage.md §10 C-1 强约束,~36 键)
 *
 * 字段分类:
 *   顶栏(2) + 加载(1) + 5 子态徽章(5) + 倒计时(5) + 操作按钮(4)
 *   + 删除弹窗(5) + 删除 Toast(2) + 空 day(2) + 不可用占位(3) + 错误兜底(4) + H5 aria(1)
 *   + 时间格式(2,新增,与 NewTripPage 区分)
 */
export const TripDetailStrings = {
  // 顶栏
  backAria: '返回',
  title: '行程详情',

  // 加载(spec §3.4 loading 态)
  loadingText: '正在加载行程详情...',

  // 5 子态徽章(spec §3.4 状态判定矩阵)
  statusInProgress: '进行中',
  statusUpcoming: '未开始',
  statusExpired: '已过期',
  statusFinished: '已结束',
  statusDraft: '草稿',

  // 倒计时
  countdownUpcomingPrefix: '还有',
  countdownUpcomingSuffix: '天出发',
  countdownInProgressPrefix: '距离结束还有',
  countdownInProgressSuffix: '天',
  countdownDayUnit: '天',

  // 操作按钮(主 CTA / 次 CTA)
  btnModify: '修改行程',
  btnModifyDisabledToast: '该行程已结束,无法修改',
  btnCopy: '复制行程', // UI-024:finished 行程底栏主 CTA 变「复制行程」,跳 NewTripPage 第二步
  btnDelete: '删除行程',
  btnDeleteDisabledToast: '该行程已结束,无法删除',

  // 删除弹窗(_DeleteConfirmDialog 5 键)
  deleteDialogTitle: '确定删除该行程?',
  deleteDialogMessage: '删除后可从回收站恢复,30 天后自动清除',
  deleteDialogCancel: '取消',
  deleteDialogConfirm: '确定删除',
  deleteDialogConfirming: '删除中...',

  // 删除 Toast(spec §3.3 + §5.3.G/H)
  deleteSuccessToast: '已放入回收站,30 天内可恢复',
  deleteFailToast: '删除失败,请稍后重试',

  // 空 day(_EmptyDaysPlaceholder,spec §3 UI Structure)
  emptyDayEmoji: '📅',
  emptyDayText: '还没有安排,点修改行程添加吧',

  // 不可用占位(_NotFoundOverlay,spec §3.8)
  errorNotFoundEmoji: '📭',
  errorNotFoundMessage: '该行程不可用,可能已被删除',
  errorNotFoundButton: '返回首页',

  // 错误兜底(spec §6.1 Error 表,viewMode='error' + _ErrorBanner)
  errorNetwork: '网络异常,请稍后重试',
  errorBadRequest: '参数不合法,请刷新后重试',
  errorServer: '服务器开小差,请稍后再试',
  errorNotFound: '行程不存在',

  // H5 aria(spec §10 可访问性)
  pageAria: '行程详情页',

  // 时间格式(spec §3.2 _TripHeader 表格)
  // 派生 `MM月DD日` 用法:`${month}月${day}日`;月日文本(沿用口语化表达)
  monthDay: '月',
  dayUnit: '日',
}

/**
 * 周几派生(spec §3.5 + §4.5,7 元素 0=周日 ~ 6=周六)
 * 对应 `new Date(trip_date).getDay()`,1:1 对齐 Date.getDay() 枚举
 * @type {ReadonlyArray<string>}
 */
export const TripDetailWeekdays = Object.freeze([
  '周日', // 0
  '周一', // 1
  '周二', // 2
  '周三', // 3
  '周四', // 4
  '周五', // 5
  '周六', // 6
])

/**
 * 5 子态徽章文案(spec §3.4 + §4.6,1:1 对齐 currentSubStatus 5 枚举)
 * 5 键值引用 `TripDetailStrings.statusXxx`,避免重复字面值
 * @type {Readonly<Record<'inProgress' | 'upcoming' | 'expired' | 'finished' | 'draft', string>>}
 */
export const TripDetailStatusLabel = Object.freeze({
  inProgress: TripDetailStrings.statusInProgress, // '进行中'
  upcoming:   TripDetailStrings.statusUpcoming,   // '未开始'
  expired:    TripDetailStrings.statusExpired,    // '已过期'
  finished:   TripDetailStrings.statusFinished,   // '已结束'
  draft:      TripDetailStrings.statusDraft,      // '草稿'
})

/**
 * EditTripPage 专用文案(specs/EditTripPage.md §10 C-1 强约束,~25 键)
 *
 * 字段分类:
 *   顶栏(2) + 加载(1) + 表单头(2)
 *   + 字段 8 状态 label(1) + 3 statusLabel(3)
 *   + 提交按钮(2) + 提交态(1) + 完成态(1) + Toast(3)
 *   + 草稿恢复(1) + 不可用占位(3) + 错误兜底(4) + H5 aria(1)
 *
 * 复用约定(spec §3.6 + §10 R-2):
 *   - 7 字段 label / placeholder **完全复用** `NewTripStrings.fieldXxx` / `placeholderXxx`
 *   - 草稿弹窗文案 **完全复用** `NewTripStrings.draftDialogXxx` / `draftSave` / `draftSavedToast` / `draftSaveFailedToast`
 *   - 错误兜底 **完全复用** `NewTripStrings.errorXxx`(已读 strings.js:294-300 验证)
 *   - 「重试」按钮文案走 `OnboardingStrings.retry`(已读 strings.js:31 验证)
 *   - **不**在本段重复定义字面值(避免双源真相)
 */
export const EditTripStrings = {
  // 顶栏(spec §3.2 + §4.5)
  closeAria: '关闭',                       // Header 「✕」aria-label
  title: '编辑行程',                       // 顶栏标题(与 pages.json navigationBarTitleText 对齐)

  // 加载(spec §3.4 + §4.5)
  loadingText: '正在加载行程详情...',      // currentStep='loading' 提示语

  // 表单头(spec §3.5 + §4.5)
  formTitle: '编辑行程信息',               // _FormHeader 标题
  // v0.4.0(2026-06-23 per TripCreateEditFix-001):简化 formHint
  //   原:「点击底部「保存」即可生效;城市/日期暂不支持修改」(city/dates 后端不支持,UI 字段移除后不再需要此说明)
  //   改为:「点击底部「保存」即可生效;仅支持修改标题与行程安排」
  formHint: '点击底部「保存」即可生效;仅支持修改标题与行程安排', // 副提示

  // 提交按钮(spec §3.3 + §4.5)
  btnSave: '保存',                         // 主 CTA
  btnCancel: '取消',                       // 次 CTA

  // 提交态(spec §3.4 + §4.5)
  savingText: '正在保存修改...',           // currentStep='saving' 提示语

  // 完成态(spec §3.4 + §4.5)
  successText: '修改成功!',                // currentStep='success' 提示语

  // Toast(spec §4.5)
  saveSuccessToast: '修改成功',            // PUT 成功后短暂 Toast(短版)
  saveFailToast: '修改失败,请稍后重试',

  // v0.5.0(2026-06-25 per UserRound2-001 Bug A):行程 item CRUD Toast 6 键
  //   - 由 EditTripPage.onAddItem / onUpdateItem / onRemoveItem 触发
  //   - 6 字面值简短一致(「已 X」+「X 失败」),与既有 saveSuccessToast / saveFailToast 对齐
  itemAddedToast: '已新增行程项',
  itemAddFailToast: '新增失败,请重试',
  itemUpdatedToast: '已更新',
  itemUpdateFailToast: '更新失败,请重试',
  itemDeletedToast: '已删除',
  itemDeleteFailToast: '删除失败,请重试',

  // 草稿恢复(spec §4.5 + §5.3.H)
  draftRestoredToast: '已恢复上次编辑的草稿', // 短暂 Toast 提示

  // v0.4.0(2026-06-23 per TripCreateEditFix-001):移除 status / formHintDraftXxx / cityOrDateNotModifiableToast
  //   - status 字段 UI 移除(spec §3.4 Field 8 删除,后端 status 不在前端编辑范围)
  //   - formHintDraftXxx 草稿模式文案(spec §3.4 移除 draft mode entry,本页面统一走 edit mode)
  //   - cityOrDateNotModifiableToast UI 字段已移除,toast 不再触发

  // 不可用占位(_NotFoundOverlay,spec §3.7 + §4.5)
  // 复用 TripDetailStrings.errorNotFoundXxx 即可;本段为安全兜底,如 TripDetailStrings 改 key 名可独立
  errorNotFoundEmoji: '📭',
  errorNotFoundMessage: '该行程不可用,可能已被删除',
  errorNotFoundButton: '返回首页',

  // 错误兜底(spec §6.1 Error 表)
  // 与 NewTripStrings.errorXxx 同字面(同先例,无需新建);如 NewTripStrings 改 key,本页面同步即可
  errorNetwork: NewTripStrings.errorNetwork,             // '网络异常,请稍后重试'
  errorBadRequest: NewTripStrings.errorBadRequest,       // '参数不合法,请检查后重试'
  errorServer: NewTripStrings.errorServer,               // '服务器开小差,请稍后再试'
  errorFallback: NewTripStrings.errorFallback,           // '系统错误,请稍后重试'
  errorRequired: NewTripStrings.errorRequired,           // '请填写完整'(AC-06)

  // H5 aria(spec §10 可访问性)
  pageAria: '编辑行程页',
}

/**
 * v0.4.0(2026-06-23 per TripCreateEditFix-001):EditTripStatusOptions 整段删除
 * 原因:status 字段 UI 移除,EditTripStatusOptions 3 chips 不再被引用,保留会成 dead code。
 * 状态徽章仍由 `tripStatusBadge` + `tripStatusBadgeClass` computed 派生 trip.status 显示在
 * _FormHeader(只读展示),走 TripDetailStatusLabel 复用,**不**通过 EditTripStatusOptions。
 */

/**
 * PhotoGuidePage 专用文案(specs/PhotoGuidePage.md §10 C-1 强约束,~45 键)
 *
 * 字段分类:
 *   顶栏(2) + 副标题(2) + 模式(2) + 风格(4) + 预览(4)
 *   + Idle(3) + Analyzing(2) + 4 块讲解(8) + 追问循环(6) + 清空弹窗(4)
 *   + 错误兜底(7) + H5 aria(1)
 *
 * 复用约定(spec §4.4 备注):
 *   - 错误兜底**复用** `NewTripStrings.errorNetwork` / `errorBadRequest` /
 *     `errorServer` / `errorFallback` 同字面,**不**重复定义
 *   - 「重试」按钮文案走 `OnboardingStrings.retry`(已读 strings.js:31 验证)
 *   - **只**新增 2 个本页面专属错误:`errorUploadTimeout` + `errorLLM`
 *   - 4 块标题用 emoji 前缀(沿用 `OnboardingStrings.greetingEmojiXxx` /
 *     `HomeItemTypeEmoji` emoji 命名规范)
 */
export const PhotoGuideStrings = {
  // 顶栏(spec §3 UI Structure + §4.4 顶栏)
  backAria: '返回',
  title: '拍照讲解',

  // 顶栏副标题(spec §3.3 备注 + §4.4 顶栏副标题,占位符)
  fromSpotBannerTitle: '正在为 [spotTitle] 讲解',
  fromTripBannerTitle: '正在为 [tripTitle] 讲解',

  // 模式(spec §3.2 _ModeToggle)
  modeCamera: '拍照',
  modeAlbum: '相册',

  // 风格(spec §3.3 _StyleSelector + §4.4 风格)
  styleLabelProfessional: '专业',
  styleLabelCasual: '通俗',
  styleLabelKid: '亲子',
  styleBadge: '按 [style] 讲解', // 占位符,运行时替换为对应 label

  // 预览(spec §3.3 _PreviewPanel)
  imageLoadFailed: '图片加载失败',
  imageMetaFallback: '已选图片',
  btnRetake: '重选',
  btnConfirm: '开始讲解',

  // Idle(spec §3.7 idle 态)
  idleHint: '拍一张照片,让 AI 为你讲解',
  idleHint2: '或从相册选择',
  idleIcon: '📷',

  // Analyzing(spec §3.7 analyzing 态)
  analyzingText: 'AI 正在解读这张照片...',
  analyzingSubtext: '最长约 30 秒',

  // 4 块讲解(spec §3.4 _ContentCard 表格)
  block1Title: '📍 景点识别',
  block1Empty: 'AI 暂未识别出景点',
  block2Title: '📖 详细讲解',
  block2Empty: 'AI 暂未生成讲解',
  block3Title: '🕒 实用信息(开放时间 / 门票价格 / 最佳游览时长 / 拍照点推荐)',
  block3Empty: '实用信息将随 AI 升级逐步完善',
  block4Title: '💬 相关问答',
  block4Empty: '暂无追问建议',

  // 追问循环(spec §3.5 _ChatInputBar)
  chatInputPlaceholder: '继续问点什么...',
  btnSend: '发送',
  chatTyping: 'AI 正在思考...',
  chatRoleUser: '你',
  chatRoleAssistant: 'AI',
  chatUserAvatar: '👤',
  chatAssistantAvatar: '🤖',

  // 2026-06-24 Fix D 移除:btnClearChat + clearDialogTitle/Message/Cancel/Confirm 5 键
  // (per user 报「清空回话记录后端无接口,该逻辑需清除」;整段清空弹窗触发链移除,
  //  strings key 同步清理,避免无用代码)

  // 错误兜底(spec §6.1 Error 表 + §4.4 错误兜底)
  // 4 个复用 NewTripStrings 同字面(spec §10 R-2);2 个本页面专属;1 个 trip 关联弱化提示
  errorNetwork:        NewTripStrings.errorNetwork,         // '网络异常,请稍后重试'
  errorBadRequest:     NewTripStrings.errorBadRequest,      // '参数不合法,请检查后重试'
  errorServer:         NewTripStrings.errorServer,          // '服务器开小差,请稍后再试'
  errorFallback:       NewTripStrings.errorFallback,        // '系统错误,请稍后重试'
  errorUploadTimeout:  '上传超时,请检查网络后重试',          // 本页面专属(uni.uploadFile 30s)
  errorLLM:            'AI 暂不可用,请稍后重试',              // 本页面专属(5001 LLM 错误)
  errorNoTrip:         '无法关联到 trip,讲解功能将受限',      // ?tripId 解析失败时 _ErrorBanner 提示

  // H5 aria(spec §10 可访问性)
  pageAria: '拍照讲解页',
}

/**
 * PhotoGuideStyleOptions 3 风格选项(spec §3.3 _StyleSelector + §4.5)
 *
 * 1:1 对齐 `api/types.ts:144` PhotoStyle 3 枚举
 * ('professional' | 'casual' | 'kid')
 *
 * label 引用 `PhotoGuideStrings.styleLabelXxx`,避免重复字面值
 *
 * @type {ReadonlyArray<{ value: import('../api/types').PhotoStyle, label: string }>}
 */
export const PhotoGuideStyleOptions = Object.freeze([
  { value: 'professional', label: PhotoGuideStrings.styleLabelProfessional }, // '专业'
  { value: 'casual',       label: PhotoGuideStrings.styleLabelCasual },        // '通俗'
  { value: 'kid',          label: PhotoGuideStrings.styleLabelKid },           // '亲子'
])

/**
 * PhotoGuideStyleFromPrefMap 风格映射(spec §1 决策 + §4.2 备注 + §4.6)
 *
 * `Preferences.explanation_style` 3 枚举(professional / fun / children)
 * → `PhotoStyle` 3 枚举(professional / casual / kid)1:1 语义对齐
 *
 * 不在 `OnboardingStrings` 等既有段中复用(语义不同,沿用 spec §4.6 决策)
 *
 * @type {Readonly<Record<import('../api/types').ExplanationStyle, import('../api/types').PhotoStyle>>}
 */
export const PhotoGuideStyleFromPrefMap = Object.freeze({
  professional: 'professional',  // 专业 → 专业
  fun:          'casual',       // 通俗 → 通俗(API 用 casual,UI 用 通俗)
  children:     'kid',          // 亲子 → 亲子(API 用 kid,UI 用 亲子)
})

/**
 * GuideResultPage 专用文案(specs/GuideResultPage.md §4.4 + §10 C-1,~7 键独有)
 *
 * 字段分类:
 *   顶栏(1) + Loading(1) + NotFound(3) + 风格切换反馈(1) + 追问循环(1)
 *
 * 复用约定(spec §4.4):
 *   - 顶栏 `backAria` 复用 `PhotoGuideStrings.backAria`(同字面)
 *   - 4 块标题 / 空态 / 风格 3 label / 追问循环 / 清空弹窗 / 错误兜底 / H5 aria
 *     全部复用 `PhotoGuideStrings.*`(共 25+ 键,**不**在本段重复字面值,避免双源真相)
 *   - 仅新增 7 键本页面独有(title 与 PhotoGuideStrings.title 语义不同)
 */
export const GuideResultStrings = {
  // 顶栏(spec §3 UI Structure + §4.4 顶栏)
  title: '讲解结果',             // 与 PhotoGuideStrings.title='拍照讲解' 语义不同,**不**复用

  // Loading(spec §3.7 loading 态)
  loadingText: '正在加载讲解结果...', // _LoadingPanel 提示

  // NotFound(spec §3.7 notfound 态)
  notFoundEmoji: '📭',           // _NotFoundOverlay emoji
  notFoundMessage: '该讲解不存在或已失效,请返回首页',
  notFoundButton: '返回首页',     // 主按钮(走 uni.reLaunch({url: AppRoutes.Home}))

  // 风格切换反馈(spec §5.2 Step 2 + §5.3.D,MVP 可选 Toast)
  // 占位符 [style] 运行时替换为对应 label
  styleChangedToast: '已切换为 [style] 风格',

  // 追问循环 page-local mock(spec §6.4.5 + §5.3.L 决定本页面**不**真发追问)
  // MVP 模拟响应固定话术
  chatMockReply: '此功能正在升级中,敬请期待更智能的追问体验。',
}

/**
 * PersonalProfilePage 专用文案(specs/PersonalProfilePage.md §4.5,~32 键)
 *
 * 字段分类:
 *   顶栏(2) + 加载(1) + 表单头(2)
 *   + 段 1 性别(3) + 段 2 年龄段(3) + 段 3 必填标红(1)
 *   + 段 4 旅行节奏(2) + 段 5 特殊需求(2) 🆕 v0.2.0
 *   + _FormHeader 辅助(9) 🆕 v0.2.0 新增 3 键
 *   + 提交按钮(1) + 提交态(1) + 完成态(1) + Toast(1) + 草稿恢复(1) + H5 aria(1)
 *
 * 复用约定(spec §3.6 + §4.5 备注):
 *   - 错误兜底**复用** `OnboardingStrings.errorNetwork` / `errorBadRequest` / `errorServer`
 *   - 「重试」按钮文案走 `OnboardingStrings.retry`
 *   - 段 3 标题 / 提示 复用 `OnboardingStrings.stepTitle` / `stepHint`(OnboardingPage 5 选 N 文案)
 *   - chip label 走 `PersonalProfileGenderOptions` / `PersonalProfileAgeOptions`(本规格 §4.6 / §4.7)
 *     + `PersonalProfileTravelPaceOptions` / `PersonalProfileSpecialNeedOptions`(v0.2.0 §4.8 / §4.9)
 *   - InterestGrid label 走 `OnboardingInterestOptions`(`constants/strings.js:39-45` 5 键,1:1 对齐后端 Interest)
 *
 * v0.2.0(2026-06-28)修订:
 *   - 段数扩 3 → 5:新增段 4 旅行节奏 + 段 5 特殊需求(per §6.4.6 Resolved「5 段 vs 3 段」决策)
 *   - `formHint` 修订:`'3 段必填,缺一不可;保存后立即生效'` → `'5 段可填,前 3 段必填;保存后立即生效'`
 *     (明确后 2 段可选,避免歧义)
 *   - `draftRestoredToast` 修订:`'已恢复上次编辑的草稿'` → `'已恢复本地编辑草稿'`(明确本地数据源)
 *   - 新增 7 键:`sectionTitleTravelPace` / `sectionHintTravelPace` / `sectionTitleSpecialNeeds` /
 *     `sectionHintSpecialNeeds` / `formHeaderTravelPaceEmpty` / `formHeaderSpecialNeedsEmpty` /
 *     `formHeaderSpecialNeedsUnit`
 */
export const PersonalProfileStrings = {
  // 顶栏(spec §3.2 + §4.5)
  backAria: '返回',                       // Header 「←」aria-label
  title: '编辑个人信息',                   // 顶栏标题(与 pages.json navigationBarTitleText 对齐)

  // 加载(spec §3.4 + §4.5)
  loadingText: '正在加载个人信息...',      // currentStep='loading' 提示语

  // 表单头(spec §3.5 + §4.5)
  formTitle: '设置你的偏好',               // _FormHeader 标题
  // v0.2.0 修订:'3 段必填,缺一不可;保存后立即生效' → '5 段可填,前 3 段必填;保存后立即生效'
  formHint: '5 段可填,前 3 段必填;保存后立即生效', // 副提示

  // 段 1 性别(spec §3.3 段 1 + §4.5)
  sectionTitleGender: '性别',              // 段 1 标题
  sectionHintGender: '3 选 1',             // 段 1 提示
  genderRequiredMark: '请选择性别',        // 段 1 必填标红(性别 === null 时)

  // 段 2 年龄段(spec §3.3 段 2 + §4.5)
  sectionTitleAge: '年龄段',               // 段 2 标题
  sectionHintAge: '5 选 1',                // 段 2 提示
  ageRequiredMark: '请选择年龄段',         // 段 2 必填标红(ageRange === null 时)

  // 段 3 必填标红(spec §3.3 段 3 + §4.5)
  interestsRequiredMark: '请至少选择 1 项感兴趣领域', // interests.length === 0 时 InterestGrid 下方红字

  // 段 4 旅行节奏 🆕 v0.2.0(spec §3.3 段 4 + §4.5)
  sectionTitleTravelPace: '旅行节奏',       // 段 4 标题
  sectionHintTravelPace: '3 选 1(可选)',    // 段 4 提示(明确可选,与段 1/2 必填形成对比)

  // 段 5 特殊需求 🆕 v0.2.0(spec §3.3 段 5 + §4.5)
  sectionTitleSpecialNeeds: '特殊需求',     // 段 5 标题
  sectionHintSpecialNeeds: '可多选(可选)', // 段 5 提示(明确可选)

  // _FormHeader 辅助(spec §3.5 + §4.5)
  formHeaderIdPrefix: '账号: ',            // 「账号: 1」前缀
  formHeaderGenderEmpty: '未选',           // 性别未选时的占位
  formHeaderAgeEmpty: '未选',              // 年龄段未选时的占位
  formHeaderInterestsEmpty: '0 项',        // interests 为空时的占位
  formHeaderInterestsUnit: '项',           // interests count 单位
  // 🆕 v0.2.0:旅行节奏 / 特殊需求 摘要占位(沿 StyleSettingPage §3.5 字面)
  formHeaderTravelPaceEmpty: '默认',        // 旅行节奏 null 时的占位
  formHeaderSpecialNeedsEmpty: '0 项',     // 特殊需求空数组时的占位
  formHeaderSpecialNeedsUnit: '项',        // 特殊需求 count 单位
  formHeaderSeparator: ' | ',              // _FormHeader 五段之间的分隔符

  // 提交按钮(spec §3.4 + §4.5)
  btnSave: '保存',                         // _ActionBar 单 CTA

  // 提交态(spec §3.7 + §4.5)
  savingText: '正在保存修改...',           // currentStep='saving' 提示语

  // 完成态(spec §3.7 + §4.5)
  savedText: '修改成功!',                  // currentStep='saved' 提示语

  // Toast(spec §4.5)
  saveSuccessToast: '修改成功',            // PUT 成功后短暂 Toast(短版,沿用 successText)

  // 草稿恢复(spec §4.5 + §5.3.E)
  // v0.2.0 修订:'已恢复上次编辑的草稿' → '已恢复本地编辑草稿'(明确本地数据源,避免歧义)
  draftRestoredToast: '已恢复本地编辑草稿', // 进入页面时若 userId 有草稿,自动恢复后短暂 Toast

  // H5 aria(spec §10 可访问性)
  pageAria: '编辑个人信息页',              // page root aria-label
}

/**
 * PersonalProfileGenderOptions 3 性别选项(spec §3.3 段 1 + §4.6)
 *
 * 1:1 对齐 `docs/交互设计.md §4.1`「男 / 女 / 保密」,3 键数组
 * value 字符串沿用 UI 语义(后端无字段,client-only localStorage,per §6.4.1 PD-001)
 *
 * @type {ReadonlyArray<{ value: 'male' | 'female' | 'other', label: string }>}
 */
export const PersonalProfileGenderOptions = Object.freeze([
  { value: 'male',   label: '男' },
  { value: 'female', label: '女' },
  { value: 'other',  label: '保密' },
])

/**
 * PersonalProfileAgeOptions 5 年龄段选项(spec §3.3 段 2 + §4.7)
 *
 * 1:1 对齐 `docs/交互设计.md §4.1`「18岁以下 / 18-25岁 / 26-35岁 / 36-50岁 / 50岁以上」
 * 5 键数组,value 用 snake_case 风格(对齐后端枚举命名规范,后端无字段,client-only localStorage)
 *
 * 备注:UI 提示「5 选 1」,label 严格按 spec §4.7 字面(18-24 / 25-34 / 35-44 / 45 岁以上),
 * 与 `docs/交互设计.md §4.1` 字面有 1 岁差异(spec 4.7 表格注释已说明 UI 用 18-24/25-34 而非
 * 18-25/26-35 的取舍,见 spec §4.7 备注)
 *
 * @type {ReadonlyArray<{ value: 'under_18' | '18_24' | '25_34' | '35_44' | '45_plus', label: string }>}
 */
export const PersonalProfileAgeOptions = Object.freeze([
  { value: 'under_18', label: '18 岁以下' },
  { value: '18_24',    label: '18-24 岁' },
  { value: '25_34',    label: '25-34 岁' },
  { value: '35_44',    label: '35-44 岁' },
  { value: '45_plus',  label: '45 岁以上' },
])

/**
 * PersonalProfileTravelPaceOptions 3 旅行节奏选项 🆕 v0.2.0(spec §3.3 段 4 + §4.8)
 *
 * 1:1 对齐 `api/types.ts:149` `TravelPace` 3 枚举(`compact` / `normal` / `slow`)
 * label 沿用 `specs/StyleSettingPage.md §3.5` mode 命名:紧凑型 / 舒适型 / 悠闲型
 * (与 `StyleSettingStrings.styleTitleXxx` 短标签语义对齐;StyleSettingPage 是讲解风格,
 *  本页面是旅行节奏,字段不同但字面命名复用)
 *
 * @type {ReadonlyArray<{ value: 'compact' | 'normal' | 'slow', label: string }>}
 */
export const PersonalProfileTravelPaceOptions = Object.freeze([
  { value: 'compact', label: '紧凑型' },
  { value: 'normal',  label: '舒适型' },
  { value: 'slow',    label: '悠闲型' },
])

/**
 * PersonalProfileSpecialNeedOptions 3 特殊需求选项 🆕 v0.2.0(spec §3.3 段 5 + §4.9)
 *
 * 1:1 对齐 `api/types.ts:151` `SpecialNeed` 3 枚举(`less_walking` / `less_queue` / `accessible`)
 *
 * 备注:本字段后端有对应列(per `api/types.ts:157` Preferences.special_needs: SpecialNeed[]),
 * 与 `gender` / `age_range` 字段(后端无,client-only)不同,PUT body 携带(per spec AC-17)
 *
 * @type {ReadonlyArray<{ value: 'less_walking' | 'less_queue' | 'accessible', label: string }>}
 */
export const PersonalProfileSpecialNeedOptions = Object.freeze([
  { value: 'less_walking', label: '少步行' },
  { value: 'less_queue',   label: '少排队' },
  { value: 'accessible',   label: '无障碍' },
])

/**
 * MyPage 专用文案(specs/MyPage.md §4.6,25 键)
 *
 * 字段分类:
 *   顶栏(1) + Loading(1) + 用户信息(4) + 偏好摘要(3)
 *   + 菜单列表(7) + 退出登录(1) + 二次确认弹窗(4)
 *   + 错误兜底(3) + H5 aria(1) = 25 键
 *
 * 复用约定(spec §3.7 + §4.6 备注):
 *   - 错误兜底 3 键**引用**既有 `OnboardingStrings.errorXxx` / `NewTripStrings.errorXxx`
 *     **不**重复定义字面值(per spec-writer-patterns §13「Trigger upstream constants」决策)
 *   - 「重试」按钮文案走 `OnboardingStrings.retry`(已读 strings.js:31 验证)
 *   - 6 菜单项文案**不**复用任何既有段(任务原文"个人信息编辑 / 回收站 / 讲解风格
 *     / 通知设置 / 帮助 / 关于"独立 key)
 *   - 头像 / 昵称 / 兴趣 / 风格 派生字段走 `OnboardingInterestOptions` 既有 emoji 命名
 *
 * 字段名规范(spec §4.6 表格):完全 1:1 对齐;future i18n 时改本段即可,
 * 组件 / 页面**不**硬编码中文字符串
 */
export const MyPageStrings = {
  // 顶栏(spec §4.6 顶栏)
  title: '我的',                  // 顶栏标题(与 pages.json navigationBarTitleText 对齐)

  // Loading(spec §4.6 Loading)
  loadingText: '正在加载…',        // _LoadingBlock 提示

  // 用户信息区(spec §4.6 用户信息)
  avatarDefault: '👤',            // MVP 无 avatar_url API → emoji 默认占位
  nicknameDefault: '旅行者',       // MVP 无 nickname API → 中文默认占位
  editHint: '编辑 ›',              // 整行右侧「编辑 ›」提示
  userInfoAria: '编辑个人信息',     // 整行 aria-label(无障碍)

  // 偏好摘要(spec §4.6 偏好摘要)
  preferenceTitle: '我的偏好',     // 标题(Noto Serif SC 16px 600)
  interestEmpty: '暂未选择感兴趣领域',   // interests 为空 / null 时占位
  explanationEmpty: '暂未设置默认讲解风格', // explanation_style 为空 / null 时占位

  // 菜单列表(spec §4.6 菜单列表)
  menuPersonalProfile: '个人信息编辑',   // 菜单项 1 标签
  menuTrash: '回收站',                    // 菜单项 2 标签
  menuStyleSetting: '讲解风格',            // 菜单项 3 标签
  menuNotificationSetting: '通知设置',
  menuHelp: '帮助',                        // 菜单项 5 标签
  menuAbout: '关于',                       // 菜单项 6 标签
  toastHelpComing: '功能即将上线,敬请期待', // 帮助菜单点击弹 Toast(per §3.4)

  // 退出登录(spec §4.6 退出登录)
  btnLogout: '退出登录',            // 底部退出登录主按钮文案

  // 二次确认弹窗(spec §4.6 二次确认弹窗)
  logoutDialogTitle: '退出登录?',               // _LogoutConfirmDialog 标题
  logoutDialogMessage: '将清除本机偏好并返回首页。', // 弹窗正文
  logoutDialogCancel: '取消',                    // 取消按钮文案
  logoutDialogConfirm: '退出登录',                // 确认按钮文案(红色 Danger 配色)

  // 错误兜底(spec §4.6 错误兜底 + §3.7 复用纪律)
  // 3 键**引用**既有段字面值,**不**重复定义(per spec §13 决策)
  errorNetwork:  OnboardingStrings.errorNetwork,  // '网络异常,请稍后重试'
  errorServer:   OnboardingStrings.errorServer,   // '服务器开小差,请稍后再试'
  errorFallback: NewTripStrings.errorFallback,    // '系统错误,请稍后重试'

  // H5 aria(spec §4.6 H5 aria)
  pageAria: '我的主页',             // page root aria-label
}

/**
 * MyPageMenuOptions 6 菜单项(spec §4.4 + §3.4 表格 1:1)
 *
 * 6 键数组,顺序为设计稿推荐阅读顺序(任务原文顺序):
 *   个人信息编辑 / 回收站 / 讲解风格 / 通知设置 / 帮助 / 关于
 *
 * 字段:
 *   id        : string                  唯一 key(v-for :key 用)
 *   icon      : string                  emoji 图标,左侧 32rpx
 *   label     : string                  中文文案(MyPageStrings.menuXxxXxx)
 *   route     : string | null           AppRoutes.<X> 或 null(null = MVP 未开放)
 *   behavior  : 'navigate' | 'coming-soon'  点击行为(per §3 备注 7)
 *
 * 复用 `AppRoutes.PersonalProfile` / `Trash` / `StyleSetting`
 * / `About` 4 个**已预声明**的子路由(per `constants/routes.js:16-20`),
 * 复用 `MyPageStrings.menuXxxXxx` 6 键 label,**不**重复定义字面值
 *
 * @type {ReadonlyArray<{ id: string, icon: string, label: string, route: string | null, behavior: 'navigate' | 'coming-soon' }>}
 */
export const MyPageMenuOptions = Object.freeze([
  { id: 'personal-profile',    icon: '👤',  label: MyPageStrings.menuPersonalProfile,    route: AppRoutes.PersonalProfile,    behavior: 'navigate' },
  { id: 'trash',                icon: '🗑️', label: MyPageStrings.menuTrash,                route: AppRoutes.Trash,               behavior: 'navigate' },
  { id: 'style-setting',        icon: '🎙️', label: MyPageStrings.menuStyleSetting,        route: AppRoutes.StyleSetting,        behavior: 'navigate' },
  { id: 'notification-setting', icon: '🔔', label: MyPageStrings.menuNotificationSetting, route: AppRoutes.NotificationSetting, behavior: 'navigate' },
  { id: 'help',                 icon: '❓', label: MyPageStrings.menuHelp,                 route: null,                          behavior: 'coming-soon' },
  { id: 'about',                icon: 'ℹ️', label: MyPageStrings.menuAbout,                route: AppRoutes.About,               behavior: 'navigate' },
])

/**
 * MyPageExplanationLabel 3 短标签(spec §4.5 + §3.3 _PreferenceSummary 配套)
 *
 * 1:1 对齐 `api/types.ts:94` `ExplanationStyle` 3 枚举
 * ('professional' | 'fun' | 'children')
 *
 * 短标签用于「我的偏好」section 风格 chip 展示(per §3.3)
 *
 * 复用约定(spec §3.7 + §4.5 备注):
 *   - **不**复用 `PhotoGuideStyleFromPrefMap`(strings.js:643-647,PhotoGuidePage 专用)
 *     本标签用于**展示**偏好,**不**用于请求 API 风格
 *   - 短标签文案「专业讲解 / 通俗讲解 / 亲子讲解」**不**复用
 *     `OnboardingInterestOptions`(label 不同维度:兴趣 = 领域 / 风格 = 讲解语调)
 *
 * @type {Readonly<Record<import('../api/types').ExplanationStyle, string>>}
 */
export const MyPageExplanationLabel = Object.freeze({
  professional: '专业讲解',
  fun:          '通俗讲解',
  children:     '亲子讲解',
})

/**
 * TrashPage 专用文案(specs/TrashPage.md §4.4 + §10 C-1,~20 键)
 *
 * 字段分类:
 *   顶栏(2) + Loading(1) + 提示条(1) + 列表项(5) + 永久删除弹窗(5) + 空态(2)
 *   + 错误兜底(3)+ H5 aria(1) = 20 键
 *
 * 复用约定(spec §3.7 + §4.4 备注):
 *   - 错误兜底 3 键**引用**既有 `OnboardingStrings.errorXxx` 字面值,**不**重复定义
 *   - 「重试」按钮文案走 `OnboardingStrings.retry`(已读 strings.js:31 验证)
 *   - 状态徽章文案走 `HomeTripStatusLabel.deleted`(`HomeStrings.tripStatusFinished` 「已结束」)
 *     **不**在 TrashPageStrings 重复定义
 *   - 永久删除 Toast「30 天后自动清理」是本页面独有文案(per §6.4.2 PD-001 决策)
 */
export const TrashPageStrings = {
  // 顶栏(spec §4.4 顶栏)
  title: '回收站',                  // 顶栏标题(与 pages.json navigationBarTitleText 对齐)
  backAria: '返回',                 // Header 「←」aria-label(H5 无障碍)

  // Loading(spec §4.4 Loading)
  loadingText: '正在加载…',         // _LoadingBlock 提示(短版,沿用 MyPage 节奏)

  // 提示条(spec §4.4 提示条)
  hintText: '30 天内可恢复;过期后自动清除', // _Hint 顶部小提示条(per docs/交互设计.md §7.4)

  // 列表项(spec §4.4 列表项)
  btnRestore: '恢复',               // _TrashItemRow 主按钮文案
  btnPermanentDelete: '永久删除',   // _TrashItemRow 次按钮文案
  itemAriaLabelTemplate: '{title},{city},{dateRange}', // _TrashItemRow 整行 aria-label 模板
  restoreSuccessToast: '已恢复',    // 恢复成功后短暂 Toast
  restoreFailToast: '恢复失败,请稍后重试', // 恢复失败 Toast(兜底文案,per §6.2 错误表)

  // 永久删除弹窗(spec §4.4 + §9 AC-09 永久删除弹窗)
  // v0.2.0 修订:弹窗正文 + Toast 文案随后端补 DELETE 端点同步改(per spec §6.4.2 Resolved)
  permanentDeleteDialogTitle: '永久删除?',              // _PermanentDeleteConfirmDialog 标题
  permanentDeleteDialogMessage: '此操作不可恢复',       // 弹窗正文(v0.2.0 改,原 30 天后将自动清理)
  permanentDeleteDialogCancel: '取消',                   // 取消按钮文案
  permanentDeleteDialogConfirm: '永久删除',              // 确认按钮文案(红色 Danger 配色)
  permanentDeleteToast: '已永久删除',                    // 确认后 Toast(v0.2.0 改,后端真删已支持)

  // 空态(spec §4.4 空态)
  emptyTitle: '回收站空空如也',                          // EmptyState 主标题
  emptySubtitle: '删除的行程会出现在这里,30 天内可恢复', // EmptyState 副标题

  // 错误兜底(spec §4.4 错误兜底)—— 3 键**引用**既有段字面值,**不**重复定义
  // 注:spec §4.4 字面写 `OnboardingStrings.errorFallback`,但 OnboardingStrings 实际**无** errorFallback 键
  // 沿用项目惯例(per MyPage / PhotoGuidePage / EditTripPage / NewTripPage / PersonalProfilePage 6 段)
  // 引用 `NewTripStrings.errorFallback`(`'系统错误,请稍后重试'`);此为 spec-writer 笔误,沿用既定 6 段
  // 先例(spec-writer-patterns §13「Trigger upstream constants」决策)
  errorNetwork:  OnboardingStrings.errorNetwork,         // '网络异常,请稍后重试'
  errorServer:   OnboardingStrings.errorServer,          // '服务器开小差,请稍后再试'
  errorFallback: NewTripStrings.errorFallback,           // '系统错误,请稍后重试'

  // H5 aria(spec §4.4 H5 aria)
  pageAria: '回收站页',             // page root aria-label

  // ───────── v0.3.0 emptyTrash 增量(spec §11.4.4 8 键,per docs/API-前端一致性审计-v2.md §2.3 + §7.10.4)─────────
  // 顶栏入口按钮(_EmptyTrashButton,per spec §11.3 视觉决策:左对齐 + 撑满容器 + Danger 描边 1.5px)
  btnEmptyTrash: '清空回收站',                 // _EmptyTrashButton 主文案
  btnEmptyTrashAria: '清空回收站,共 N 条已删行程',  // 按钮 aria-label(动态 N 值由 page 端 template 渲染,per §11.10.2 可访问性)
  btnEmptyTrashLoading: '清空中…',              // clearingAll=true 时按钮文案(替代 btnEmptyTrash)

  // 清空弹窗(_EmptyTrashConfirmDialog,沿 §8.2 _PermanentDeleteConfirmDialog 形态)
  emptyTrashDialogTitle: '清空回收站?',         // 弹窗标题
  emptyTrashDialogMessage: '将永久删除全部 {N} 条已删行程,此操作不可恢复',  // 弹窗正文 template(N = trashedTrips.length)
  emptyTrashDialogCancel: '取消',               // 取消按钮文案
  emptyTrashDialogConfirm: '清空回收站',        // 确认按钮文案(红色 Danger 配色,操作不可逆)

  // 清空成功(per §11.5.2 Step 8 success 分支)
  emptyTrashSuccessToast: '已清空回收站',       // 成功后 Toast(icon: 'success', duration: 1500)

  // 错误兜底(errorNetwork / errorServer / errorFallback)沿用 §4.4 既有 3 键引用,不在本节重复定义
}

/**
 * StyleSettingPage 专用文案(specs/StyleSettingPage.md §4.5,~17 键)
 *
 * 字段分类:
 *   顶栏(2) + 加载(1) + 表单头(4) + 3 选项标题(3) + 3 选项描述(3)
 *   + 提交按钮(1) + 提交态(1) + 完成态(1) + Toast(1) + H5 aria(1)
 *   错误兜底与「重试」按钮文案**复用** `OnboardingStrings.errorXxx` / `retry`,**不**在本段重复
 *
 * 复用约定(spec §3.7 + §4.5 备注 + §10.4 i18n 纪律):
 *   - 顶栏 `backAria: '返回'` 与 PersonalProfileStrings.backAria / TripDetailStrings.backAria
 *     / PhotoGuideStrings.backAria **字面相同但本页面**不**复用既有段**——保持各 page 字符串
 *     段独立(per spec-writer-patterns §13「各 page 独立 strings 段」决策),避免跨 page 字符串耦合
 *   - 错误兜底 4 键**引用** `OnboardingStrings.errorXxx` 既有段字面值,**不**重复定义
 *   - 「重试」按钮文案走 `OnboardingStrings.retry`,**不**在本段重复
 *   - 3 选项 title / desc 6 键独立国际化(便于未来 i18n 化,与 MyPageExplanationLabel
 *     短标签「专业讲解 / 通俗讲解 / 亲子讲解」**字面不同**——本规格 title 无「讲解」后缀,
 *     desc 是行内长描述,沿用 docs/交互设计.md §7.6 字面)
 */
export const StyleSettingStrings = {
  // 顶栏(spec §3.2 + §4.5)
  backAria: '返回',                       // Header 「←」aria-label
  title: '讲解风格',                       // 顶栏标题(与 pages.json navigationBarTitleText 对齐)

  // 加载(spec §3.7 + §4.5)
  loadingText: '正在加载风格...',          // viewMode='loading' 提示语

  // 表单头(spec §3.5 + §4.5)
  formTitle: '选择讲解风格',               // _FormHeader 标题
  formHint: '默认风格将应用于所有拍照讲解;3 选 1,保存后立即生效', // 副提示
  // formHeaderIdPrefix / formHeaderCurrentPrefix:UI-016 移除,3 风格卡 ✓ 视觉已表达选中态;
  // formHeaderIdPrefix 仍由 PersonalProfileStrings 持有(per spec §3.5 §4.5 共享前缀习惯)

  // 3 选项标题(spec §3.4 表格 + §4.5)
  styleTitleProfessional: '专业',
  styleTitleFun: '通俗',
  styleTitleChildren: '亲子',

  // 3 选项描述(spec §3.4 表格 + §4.5,沿 docs/交互设计.md §7.6 字面)
  styleDescProfessional: '严谨、详细、历史数据丰富',
  styleDescFun: '口语化、讲故事、轻松有趣',
  styleDescChildren: '适合儿童的理解方式、互动性强',

  // 提交按钮(spec §3.6 + §4.5)
  btnSave: '保存',                         // _ActionBar 单 CTA

  // 提交态(spec §3.7 + §4.5)
  savingText: '正在保存风格...',           // viewMode='saving' 提示语

  // 完成态(spec §3.7 + §4.5)
  savedText: '已保存!',                    // viewMode='saved' 提示语

  // Toast(spec §4.5)
  saveSuccessToast: '已保存',              // PUT 成功后短暂 Toast(短版,沿用 successText)

  // H5 aria(spec §10 可访问性)
  pageAria: '讲解风格设置页',              // page root aria-label
}

/**
 * StyleSettingOptions 3 风格选项(spec §3.4 表格 + §4.4)
 *
 * 1:1 对齐 `api/types.ts:94` `ExplanationStyle` 3 枚举
 * ('professional' | 'fun' | 'children')
 *
 * 数据形状(spec §4.4):
 *   value  : ExplanationStyle   严格等于后端枚举字面
 *   icon   : string             emoji 字符串,64rpx 左侧
 *   title  : string             短标签(走 StyleSettingStrings.styleTitleXxx)
 *   desc   : string             长描述(走 StyleSettingStrings.styleDescXxx)
 *
 * 复用 `StyleSettingStrings.styleTitleXxx` / `styleDescXxx` 6 键,**不**重复字面值
 * 与 `MyPageExplanationLabel`(短标签「专业讲解 / 通俗讲解 / 亲子讲解」,MyPage 展示用)
 * **字面不同但语义 1:1 对齐**——本规格 title 无「讲解」后缀,行内空间更紧凑
 *
 * @type {ReadonlyArray<{ value: import('../api/types').ExplanationStyle, icon: string, title: string, desc: string }>}
 */
export const StyleSettingOptions = Object.freeze([
  { value: 'professional', icon: '🎓',  title: StyleSettingStrings.styleTitleProfessional, desc: StyleSettingStrings.styleDescProfessional },
  { value: 'fun',          icon: '💬',  title: StyleSettingStrings.styleTitleFun,          desc: StyleSettingStrings.styleDescFun },
  { value: 'children',     icon: '👨‍👩‍👧', title: StyleSettingStrings.styleTitleChildren,     desc: StyleSettingStrings.styleDescChildren },
])

/**
 * LoginPage 专用文案(specs/LoginPage.md v0.1.0 §4.4,~7 键)
 *
 * 字段分类:
 *   顶栏(1) + Loading(1) + 主体(3) + 主 CTA(1) + H5 aria(1) = 7 键
 *
 * 复用约定(spec §1 + §3.4 + §4.4 备注 + §10.4 i18n 纪律):
 *   - 错误兜底 0 键(不重复定义):error 态文案**复用** `OnboardingStrings.errorNetwork`,
 *     走 `_ErrorBanner` Props `message` 透传,沿 MyPage §4.6 / PersonalProfilePage §4.5 13 页面惯例
 *   - 「重试」按钮文案 0 键:走 `_ErrorBanner` 内部固定 `OnboardingStrings.retry`(`strings.js:33`),
 *     **不**在本段重复(per §3.5 复用决策)
 *   - 顶栏 `title: '登录'` 与 pages.json `navigationBarTitleText: '登录'` 1:1 对齐
 *   - 字段名规范:完全 1:1 对齐;future i18n 时改本段即可,组件 / 页面**不**硬编码中文字符串
 *
 * MVP 简化决策(spec §1 + §6.4.1 PD-001 Resolved):
 *   - 0 API / 0 store / 0 service(占位页 MVP 不接登录流)
 *   - 0 真实登录流(无手机号+验证码 / 无密码 / 无第三方登录按钮)
 *   - 0 子组件新建(`_LoginForm` / `_LoginButton` / `_OAuthButton` / `_PhoneInput` / `_CodeInput` 等)
 */
export const LoginPageStrings = {
  // 顶栏(spec §3 + §4.4)
  title: '登录',                                // 顶栏标题(与 pages.json navigationBarTitleText 对齐)

  // Loading(spec §3.4 + §4.4 + §5.1)
  loadingText: '正在准备页面…',                // _LoadingBlock 提示(占位页无 API 等待,文案弱化"准备"语义)

  // 主体(spec §3 _LoadedBlock)
  mainMessage: '登录功能暂未开放',            // _LoadedBlock 主标题(Noto Serif SC 20px 600)
  subMessage: '当前为 MVP 占位页;真实登录流将在后续版本上线',  // _LoadedBlock 副标题(Noto Sans SC 14px)
  iconEmoji: '🔒',                              // _Icon emoji 字符(120rpx 圆形,沿字符串硬字面,无映射需求)

  // 主 CTA(spec §3.3 _ActionButton)
  btnBackHome: '返回首页',                     // _ActionButton 主按钮文案(Primary 渐变,88rpx 触达)

  // H5 aria(spec §10 可访问性)
  pageAria: '登录页',                          // page root aria-label
}

/**
 * TripPreparePage 专用文案(specs/TripPreparePage.md v0.1.0 §4.4,~8 键)
 *
 * 字段分类:
 *   顶栏(2) + Loading(1) + 插画(1) + 主标题(1) + 副标题(1) + 返回按钮(1) + H5 aria(1) = 8 键
 *
 * 复用约定(spec §3.6 + §4.4 备注 + §10.4 i18n 纪律):
 *   - 错误兜底 0 键(不重复定义):error 态文案**复用** `OnboardingStrings.errorFallback`,
 *     走 `_ErrorBanner` Props `message` 透传(per 13 页面惯例)
 *   - 「重试」按钮文案 0 键:走 `_ErrorBanner` 内部固定 `OnboardingStrings.retry`
 *   - 顶栏 `title: '行程准备'` 与 pages.json `navigationBarTitleText: '行程准备'` 1:1 对齐
 *   - 字段名规范:完全 1:1 对齐;future i18n 时改本段即可
 *
 * MVP 简化决策(spec §1 + §6.2.1 + §6.2.2 PD-001 Resolved):
 *   - 0 API / 0 store / 0 service(占位 page,无「行程准备」实质业务,纯占位)
 *   - 0 子组件新建(`_LoadingPanel` / `_LoadedPanel` / `_ErrorPanel` / `_BackButton` / `_Illustration` 等)
 *   - 500ms setTimeout 模拟"准备中"动效(无任何 API 调用,沿 TripDetailPage / NewTripPage 模式)
 *   - 0 草稿 / 0 modal(占位 page 无未保存内容,onBack 不弹任何 dialog)
 */
export const TripPrepareStrings = {
  // 顶栏(spec §3.2 + §4.4)
  title: '行程准备',                          // 顶栏标题(与 pages.json navigationBarTitleText 对齐)
  backAria: '返回上一页',                     // Header「←」aria-label(spec §3.2 H5 可访问性)

  // Loading(spec §3 + §4.4 + §5.1)
  loadingText: '正在准备行程...',             // viewMode='loading' _LoadingPanel 提示语

  // 插画(spec §3.3 _Illustration 常量)
  illustrationEmoji: '🧳',                   // LoadedPanel 顶部插画 emoji(120rpx,AppColors.primarySoft 软背景圆)

  // 主标题(spec §3.3 _Title)
  mainTitle: '行程准备中',                    // LoadedPanel 主标题(Noto Serif SC 36px 600,AppColors.ink,center)

  // 副标题(spec §3.3 _Subtitle)
  subtitle: '即将推出,目前请返回查看您的行程',  // LoadedPanel 副标题(Noto Sans SC 14px,AppColors.inkLight,center)

  // 返回按钮(spec §3.4 _ActionBar 单 CTA)
  backLabel: '返回上一页',                    // _ActionBar 单按钮文案(Primary 渐变,88rpx 触达)

  // H5 aria(spec §10 可访问性)
  pageAria: '行程准备中页',                  // page root aria-label
}

/**
 * AboutPage 专用文案(specs/AboutPage.md v0.1.0 §4.4,~10 键)
 *
 * 字段分类:
 *   顶栏(2) + 错误态(1) + 主体(2) + 4 卡片标签(4) + H5 aria(1) = 10 键
 *
 * 复用约定(spec §1 + §3.4 + §4.4 备注 + §10.4 i18n 纪律):
 *   - 顶栏 `backAria: '返回'` 与 StyleSettingStrings.backAria / PersonalProfileStrings.backAria /
 *     TripDetailStrings.backAria / PhotoGuideStrings.backAria **字面相同但本页面**不**复用既有段** —
 *     保持各 page 字符串段独立(per spec-writer-patterns §13「各 page 独立 strings 段」决策),
 *     避免跨 page 字符串耦合
 *   - 错误兜底 1 键 `errorTitle` 独立;`errorFallback` **引用** `NewTripStrings.errorFallback`
 *     既有段字面值(per spec §1 复用决策 + 13 页面惯例)
 *   - 「重试」按钮文案走 `OnboardingStrings.retry`,**不**在本段重复
 *   - 4 卡片 label 4 键独立国际化(便于未来 i18n 化);value 4 键**走 `AboutInfoCards`** 而非 strings 段
 *
 * MVP 简化决策(spec §1 + §1 MVP carve-out):
 *   - 0 API / 0 store / 0 service / 0 storage / 0 URL params / 0 私有子组件(纯静态展示)
 *   - 字面来源:`package.json:2 name="daoyou-frontend"` + `README.md:1-12`(项目元信息硬编码引用)
 *   - 4 信息卡片(v-for 渲染,引用 AboutInfoCards 4 键 Object.freeze)
 */
export const AboutStrings = {
  // 顶栏(spec §3 + §4.4)
  backAria: '返回',                          // Header「←」aria-label(H5 可访问性)
  title: '关于导友',                          // 顶栏标题(与 pages.json navigationBarTitleText 对齐)

  // 错误态(spec §3 + §4.4)
  errorTitle: '加载失败',                    // viewMode='error' _ErrorPanel 主标题(Noto Serif SC 16px 600)
  // errorFallback **复用** NewTripStrings.errorFallback(per spec §1 复用决策 + 13 页面惯例)
  // retry **复用** OnboardingStrings.retry(per spec §1 复用决策 + 13 页面惯例)

  // 主体区(spec §3 _LoadedPanel)
  projectName: '导友',                        // ProjectLogo 项目名大字(per package.json name + README L1)
  projectSubtitle: '你的个人旅游搭子',        // ProjectLogo 副标(per README L1「——你的个人旅游搭子」)

  // 4 信息卡片标签(spec §3 InfoCards)
  cardLabelProjectName: '项目名称',          // 卡片 1 label
  cardLabelVersion: '当前版本',              // 卡片 2 label
  cardLabelTechStack: '技术栈',              // 卡片 3 label
  cardLabelCopyright: '开发团队',            // 卡片 4 label

  // H5 aria(spec §10 可访问性)
  pageAria: '关于导友页',                    // page root aria-label
}

/**
 * AboutInfoCards 4 信息卡片元数据(specs/AboutPage.md §4.4)
 *
 * 4 键 Object.freeze 数组,顺序为"项目元信息从上到下"阅读顺序
 * (项目名 → 版本 → 技术栈 → 版权)
 *
 * 数据形状(spec §4.4):
 *   key    : string      唯一 key(v-for :key 用)
 *   icon   : string      emoji 图标,左侧 64rpx
 *   label  : string      中文短标签(由 AboutStrings.cardLabelXxx 引用)
 *   value  : string      卡片 value 字面(MVP 字面硬编码,per package.json + README.md 字面来源)
 *
 * 字面来源(spec §4.4 备注):
 *   projectName.value ← package.json:2 name="daoyou-frontend" + README.md:1「导友」
 *   version.value    ← package.json:3 version="0.1.0" (加 'v' 前缀)
 *   techStack.value  ← README.md:5-12 技术栈段(取前 3 项,精简展示)
 *   copyright.value  ← 项目级占位字面(MVP 阶段团队尚未正式命名,占位文案)
 *
 * 复用 `AboutStrings.cardLabelXxx` 4 键,**不**重复字面值
 * 与 `StyleSettingOptions` / `OnboardingInterestOptions`
 * **形态独立** — 本段无 `defaultOn` / `value-enum` 等运行时约束(纯展示,无业务逻辑)
 *
 * @type {ReadonlyArray<{ key: string, icon: string, label: string, value: string }>}
 */
export const AboutInfoCards = Object.freeze([
  {
    key: 'projectName',
    icon: '⛰️',
    label: AboutStrings.cardLabelProjectName,
    value: AboutStrings.projectName,           // '导友'
  },
  {
    key: 'version',
    icon: '🏷️',
    label: AboutStrings.cardLabelVersion,
    value: 'v0.1.0',                            // 字面硬编码 per package.json:3
  },
  {
    key: 'techStack',
    icon: '🛠️',
    label: AboutStrings.cardLabelTechStack,
    value: 'UniApp + Vue3 + FastAPI',          // 字面硬编码 per README.md:5-12
  },
  {
    key: 'copyright',
    icon: '©️',
    label: AboutStrings.cardLabelCopyright,
    value: 'DaoYou Team · 2026',               // 项目级占位
  },
])

/**
 * ItineraryArrangeStrings 行程安排字段文案(per UI-025 + spec §3.5 Field 6)
 *
 * 字段分类(共 12 键):
 *   字段 label/hint(2) + 5 类型短标签(5) + 默认时间(2) + 添加行程(2) + 提示(1)
 *
 * 复用约定(per spec §3.6 + §10.4 i18n 纪律):
 *   - 行程安排字段 label 与 NewTripStrings/EditTripStrings **字面不同** 但语义 1:1 对齐
 *     (NewTripStrings 已有 fieldXxx 7 键是 form 字段,本段是 ItineraryArrangeField 子字段)
 *   - 5 类型短标签 1:1 对齐 api/types.ts:37 ItemType 5 枚举(新增 'other')
 *   - emoji 走 `ItemTypeEmoji[xxx]` 既有 4 键 + `default` 兜底(不重复定义)
 *
 * MVP 简化决策(per UI-025 §硬规则 + §3.6):
 *   - 0 API / 0 新建 store(行程安排是 form 内字段,沿用 formData 状态)
 *   - 0 抽公共 components/(沿项目惯例 _DraftConfirmDialog 私有)
 *   - 跨页反向 import pages/edit-trip → pages/new-trip/components/ItineraryArrangeField.vue
 *     (沿 §8.4 guide-result → photo-guide 私有 dialog 反向 import 模式)
 */
export const ItineraryArrangeStrings = {
  // 字段 label/hint(spec §3.5 Field 6 + §4.4)
  fieldLabel: '行程安排',         // form 字段 label(Noto Sans SC 14px 500)
  // v0.4.0(2026-06-23 per TripCreateEditFix-001):fieldHint 改写提及日期选择
  //   原:「长按卡片可拖动调整顺序;可点击右上角 ✕ 删除或 + 添加」
  //   改为:「选日期 + 时间,长按卡片拖动排序;点右上角 ✕ 删除或 + 添加」
  // v0.6.0(2026-06-26 per user-round4-2026-06-26):删掉「长按卡片拖动排序」提示
  //   原:「选日期 + 时间,长按卡片拖动排序;点右上角 ✕ 删除或 + 添加」
  //   改为:「选日期 + 时间,点右上角 ✕ 删除或 + 添加」
  //   原因:user 报「不支持拖动卡片排序」,MVP 不实现拖动 UI
  fieldHint: '选日期 + 时间,点右上角 ✕ 删除或 + 添加', // form 字段 hint

  // 5 类型短标签(per ui/types.ts:37 ItemType 5 枚举,1:1 对齐)
  typeLabelAttraction: '景点',   // 'attraction'
  typeLabelFood: '美食',         // 'food'
  typeLabelTraffic: '交通',      // 'traffic'
  typeLabelRest: '休息',         // 'rest'
  typeLabelOther: '其他',        // 'other'(UI-025 新增)

  // 时间输入 placeholder
  // v0.4.0:新增 placeholderDate(在 date picker 上方)
  placeholderDate: '请选择日期',
  placeholderStartTime: '开始时间',
  placeholderEndTime: '结束时间',
  placeholderCity: '城市',
  placeholderTitle: '请输入地点名称',

  // 添加行程按钮
  btnAdd: '+ 添加行程',
  btnAddAria: '添加行程安排项',

  // 删除按钮
  btnRemoveAria: '删除该行程项',

  // v0.6.0(2026-06-26 per user-round4-2026-06-26):删掉 dragHint
  //   原:「拖动调整顺序」已无对应 UI(MVP 不实现拖动)
  //   引用方 0 命中(grep 验证:仅 ItineraryArrangeField.vue L133 一处,同步删除)
  //   整段删除字段(沿 §6.4.5b 决策树)
}

/**
 * ItineraryArrangeItemTypeOptions 5 类型选项(per UI-025)
 *
 * 1:1 对齐 api/types.ts:37 ItemType 5 枚举
 * ('attraction' | 'food' | 'traffic' | 'rest' | 'other')
 *
 * 复用 ItineraryArrangeStrings.typeLabelXxx 5 键,**不**重复字面值
 * 复用 ItemTypeEmoji 5 键(4 枚举 + default 兜底,这里用 ItemType 5 枚举 1:1,无 default)
 *
 * 数据形状:
 *   value : ItemType   严格等于后端枚举字面
 *   label : string     中文短标签(走 ItineraryArrangeStrings.typeLabelXxx)
 *   emoji : string     emoji 字符串(走 ItemTypeEmoji 既有 4 + '📍' 兜底)
 *
 * @type {ReadonlyArray<{ value: import('../api/types').ItemType, label: string, emoji: string }>}
 */
export const ItineraryArrangeItemTypeOptions = Object.freeze([
  { value: 'attraction', label: ItineraryArrangeStrings.typeLabelAttraction, emoji: '🏛️' },
  { value: 'food',       label: ItineraryArrangeStrings.typeLabelFood,       emoji: '🍜' },
  { value: 'traffic',    label: ItineraryArrangeStrings.typeLabelTraffic,    emoji: '🚶' },
  { value: 'rest',       label: ItineraryArrangeStrings.typeLabelRest,       emoji: '😴' },
  { value: 'other',      label: ItineraryArrangeStrings.typeLabelOther,      emoji: '📍' },
])

/**
 * ChatPage 专用文案(specs/ChatPage.md §4.4,~25 键)
 *
 * 字段分类:
 *   顶栏(2) + 加载(1) + Idle(3) + Sending(1) + Chatting(4) + 3 modal(13) + 错误兜底(3) + H5 aria(1)
 *
 * 复用约定(spec §3.7 + §4.4 备注 + §10.4 i18n 纪律):
 *   - 顶栏 `backAria: '返回'` 与 StyleSettingStrings.backAria / PersonalProfileStrings.backAria
 *     / TripDetailStrings.backAria / PhotoGuideStrings.backAria **字面相同但本页面**不**复用既有段** —
 *     保持各 page 字符串段独立(per spec-writer-patterns §13「各 page 独立 strings 段」决策)
 *   - 错误兜底 3 键(`errorBadRequest` / `errorLLM` / `errorTripNotFound`)是**本页面独有**(per spec §4.4 备注,
 *     字面与 `OnboardingStrings.errorXxx` / `EditTripStrings.errorXxx` / `NewTripStrings.errorXxx` **不**完全一致)
 *   - 通用错误兜底 3 键(`errorNetwork` / `errorServer` / `errorFallback`)**复用**既有段字面值
 *   - 「重试」按钮文案走 `OnboardingStrings.retry`,**不**在本段重复
 *   - 「🗑」清空按钮 + dialog 已于 2026-06-24 Fix D 移除(后端无对应端点)
 */
export const ChatPageStrings = {
  // 顶栏(spec §3.2 + §4.4)
  backAria: '返回',                       // Header「←」aria-label(H5 可访问性)
  title: '智能对话',                       // 顶栏标题(与 pages.json navigationBarTitleText 对齐)

  // 加载(spec §3.3 _LoadingPanel + §4.4)
  loadingText: '正在加载对话...',          // viewMode='loading' 提示语

  // Idle(spec §3.3 _IdlePanel + §4.4)
  idleIcon: '💬',                         // _IdlePanel 装饰 emoji
  idleHint: '开始与 AI 导游对话',          // _IdlePanel 主提示语
  idleHintSub: '支持行程规划 / 改线 / 实时问答', // _IdlePanel 副提示语

  // Sending(spec §3.3 _SendingPanel + §4.4)
  typingIndicator: 'AI 正在思考...',      // _TypingIndicator 占位文字

  // Chatting(spec §3.4 _MessageList + §3.5 _InputBar + §4.4)
  inputPlaceholder: '说点什么...',         // _InputBar text-input placeholder
  btnSend: '发送',                        // _InputBar 主按钮文案
  roleUser: '你',                         // chat bubble 角色名(无障碍可读)
  roleAssistant: 'AI',                    // chat bubble 角色名(无障碍可读)

  // 改线弹窗(spec §3.9 ActionOptionsModal + §4.4)
  actionOptionsTitle: '为你推荐以下改线方案',
  actionOptionsCancel: '取消',
  actionOptionsConfirm: '应用此方案',
  actionOptionsComingSoon: '该功能即将上线',
  actionOptionsApplied: '行程已更新',
  actionOptionsApplyFailed: '应用失败,请稍后重试',
  actionOptionsInvalid: '方案已失效,请重新获取',
  deleteActionTitle: '永久删除该行程项?',
  deleteActionMessage: '删除后无法恢复,请确认是否继续。',
  deleteActionConfirm: '确认删除',
  deleteActionCancel: '返回',

  // ApplyPlan 弹窗(spec §3.10 ApplyPlanConfirmDialog + §4.4)
  applyPlanTitle: '确认应用改线方案?',
  applyPlanMessage: '将应用 AI 推荐的改线方案,可能影响当前行程安排。',
  applyPlanCancel: '取消',
  applyPlanConfirm: '确认',
  applyPlanComingSoon: '改线应用功能即将上线',

  // 改线(replan)v0.3.0 真接 PUT /api/trip-items/{item_id} 提示文案(spec §3.9 step 4-6 + AC-22/23/24)
  replanSuccess: '改线已应用',                    // 二次确认 PUT 成功 Toast
  replanError: '改线失败',                        // 二次确认 PUT 失败 Toast(不弹 _ErrorOverlay)
  replanInvalid: '改线选项无效,请重新选择',      // ActionOptionsModal 顶部 banner(校验前置失败时)

  // 错误兜底(spec §3.7 Error 表 + §4.4)
  // 3 键本页面独有(spec §4.4 备注:与 OnboardingStrings.errorXxx / NewTripStrings.errorXxx 字面**不**完全一致)
  errorBadRequest: '消息内容不合法,请重新输入',
  errorLLM: 'AI 暂不可用,请稍后重试',
  errorTripNotFound: '行程不存在,改线失败',
  // 「重试」按钮文案走 OnboardingStrings.retry,**不**在本段重复(per §10.4 i18n 纪律)

  // 拍照按钮(ChatPage v0.2.0 §3.5 _InputBar 扩 + §3.10 PhotoActionSheet)
  btnPhotoAria: '拍照或选择图片',          // _PhotoActionButton aria-label
  actionSheetTitle: '选择图片来源',         // _PhotoActionSheet 标题
  actionSheetCamera: '拍照',               // 拍照选项文案
  actionSheetAlbum: '从相册选择',          // 相册选项文案
  actionSheetCancel: '取消',               // 取消按钮文案

  // 图片消息(ChatPage v0.2.0 §3.4 _MessageImage)
  imageMessageTag: '[图片]',               // user msg content 占位(纯文本展示时使用)

  // 错误兜底(ChatPage v0.2.0 §5.3 photo state machine failure)
  errorPhotoSend: '图片发送失败,请重试',   // photo 飞行失败 toast
  errorPhotoChoose: '图片选择失败',        // uni.chooseImage fail toast
  errorImageLoad: '图片加载失败',           // MessageImage src 加载失败占位

  // H5 aria(spec §10 可访问性)
  pageAria: '智能对话页',                 // page root aria-label
}
