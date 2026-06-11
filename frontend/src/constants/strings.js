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
  successToast: '设置成功,期待你的第一次旅行!',

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
  unreadBadgeAria: '未读提醒',

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

  // ReminderChip(MVP 本页面未挂载数据源,仅供 TripDetailPage 等复用,见 spec §3.2)
  reminderWeather: '天气',
  reminderDeparture: '出发',
  reminderConflict: '冲突',
  reminderRest: '休息',
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
 * @type {Readonly<Record<import('../api/types').TripStatus | 'deleted', string>>}
 */
export const HomeTripStatusLabel = Object.freeze({
  draft: HomeStrings.tripStatusDraft,
  active: HomeStrings.tripStatusActive,
  finished: HomeStrings.tripStatusFinished,
  // 显示别名(TrashPage 复用,非 TripStatus enum value)
  deleted: HomeStrings.tripStatusFinished,
})

/**
 * ReminderType → 中文短标签(spec §3.2 ReminderChip 副文案)
 * 1:1 对齐 api/types.ts ReminderType 4 枚举
 * @type {Readonly<Record<import('../api/types').ReminderType, string>>}
 */
export const HomeReminderTypeLabel = Object.freeze({
  weather: HomeStrings.reminderWeather,
  departure: HomeStrings.reminderDeparture,
  conflict: HomeStrings.reminderConflict,
  rest: HomeStrings.reminderRest,
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

  // 7 字段 label(spec §3.5)
  fieldTitle: '行程标题', // spec EditTripPage §10 C-3 触发新增
  fieldCity: '目的地',
  fieldStartDate: '出发日期',
  fieldEndDate: '返回日期',
  fieldCompanions: '同行成员',
  fieldBudget: '预算范围',
  fieldTransport: '交通偏好',
  fieldNeeds: '特殊需求',

  // 字段 placeholder
  placeholderCity: '例如:大连',
  placeholderStartDate: '请选择出发日期',
  placeholderEndDate: '请选择返回日期',
  placeholderCompanions: '逗号分隔,如 老婆,孩子',
  placeholderBudget: '例如:3000-5000',

  // 交通偏好 4 chips(spec §4.1 transport_preference 4 枚举)
  transportFlight: '飞机',
  transportTrain: '火车',
  transportCar: '自驾',
  transportWalk: '步行',

  // 特殊需求 4 chips(spec §4.1 special_needs 4 枚举,本页面自定义)
  needLessWalking: '少步行',
  needWithChildren: '带儿童',
  needWithElderly: '带老人',
  needAccessible: '无障碍',

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

  // H5 aria(spec §10 可访问性)
  textareaAria: '行程内容输入框',
}

/**
 * 交通偏好 4 选项(spec §3.5 Field 6 + §4.1 transport_preference 4 枚举)
 * 与 `api/types.ts` 的 SpecialNeed 不同(本页面自定义枚举,client-only)
 * @type {ReadonlyArray<{ value: 'flight' | 'train' | 'car' | 'walk', label: string }>}
 */
export const NewTripTransportOptions = Object.freeze([
  { value: 'flight', label: NewTripStrings.transportFlight },
  { value: 'train',  label: NewTripStrings.transportTrain },
  { value: 'car',    label: NewTripStrings.transportCar },
  { value: 'walk',   label: NewTripStrings.transportWalk },
])

/**
 * 特殊需求 4 选项(spec §3.5 Field 7 + §4.1 special_needs 4 枚举)
 * UI 标签"少步行 / 带儿童 / 带老人 / 无障碍"与 api/types.ts SpecialNeed
 * 3 枚举(less_walking / less_queue / accessible)不 1:1,按 PD-001 走
 * "客户端 UI 简化"路径(spec §6.4.2),仅作 UI 展示,POST 不传后端
 * @type {ReadonlyArray<{ value: 'less_walking' | 'with_children' | 'with_elderly' | 'accessible', label: string }>}
 */
export const NewTripNeedsOptions = Object.freeze([
  { value: 'less_walking',  label: NewTripStrings.needLessWalking },
  { value: 'with_children', label: NewTripStrings.needWithChildren },
  { value: 'with_elderly',  label: NewTripStrings.needWithElderly },
  { value: 'accessible',    label: NewTripStrings.needAccessible },
])

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
  formHint: '点击底部「保存」即可生效;城市/日期暂不支持修改', // 副提示

  // 字段 8 状态(spec §3.4 Field 8 + §4.5)
  fieldStatus: '状态',                     // 状态字段 label
  statusLabelDraft: '草稿',                // 3 chips 之一
  statusLabelActive: '进行中',
  statusLabelFinished: '已结束',

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
  cityOrDateNotModifiableToast: '暂不支持修改城市/日期,请创建新行程', // AC-07

  // 草稿恢复(spec §4.5 + §5.3.H)
  draftRestoredToast: '已恢复上次编辑的草稿', // 短暂 Toast 提示

  // 草稿模式(per issues/UI/UI-023-draft-page-prefill.md §4)—— mode='draft' 入口
  // formHintDraftPrefix: 草稿行程标题前缀
  // formHintDraftSuffix: 草稿行程标题后缀 + 「首次创建于 Y」副提示
  // 整体形态:「继续编辑草稿「X」 · 首次创建于 Y」
  formHintDraftPrefix: '继续编辑草稿「', // 「继续编辑草稿「X」」前半段
  formHintDraftMiddle: '」 · 首次创建于 ', // 中间连接段(中间用 · separator,UI 友好)
  formHintDraftSuffix: '', // 末尾空字符串(避免半截文案)

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
 * EditTripStatusOptions 3 状态选项(spec §3.4 Field 8 + §4.6 + §10 C-2)
 *
 * 1:1 对齐 `api/types.ts` TripStatus 4 枚举(`draft` / `active` / `finished` / `deleted`)
 * 减去 `deleted`(`deleted` 由软删除触发,不开放编辑页改)
 *
 * 复用 `EditTripStrings.statusLabelXxx`,不重复定义字面值
 *
 * @type {ReadonlyArray<{ value: 'draft' | 'active' | 'finished', label: string }>}
 */
export const EditTripStatusOptions = Object.freeze([
  { value: 'draft',    label: EditTripStrings.statusLabelDraft },     // '草稿'
  { value: 'active',   label: EditTripStrings.statusLabelActive },    // '进行中'
  { value: 'finished', label: EditTripStrings.statusLabelFinished }, // '已结束'
])

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
  btnClearChat: '清空对话',
  chatTyping: 'AI 正在思考...',
  chatRoleUser: '你',
  chatRoleAssistant: 'AI',
  chatUserAvatar: '👤',
  chatAssistantAvatar: '🤖',

  // 清空弹窗(spec §3.6 _ClearChatConfirmDialog)
  clearDialogTitle: '清空对话?',
  clearDialogMessage: '将清除当前讲解卡 + 所有追问记录,且不可恢复。',
  clearDialogCancel: '取消',
  clearDialogConfirm: '清空',

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
 * PersonalProfilePage 专用文案(specs/PersonalProfilePage.md §4.5,~23 键)
 *
 * 字段分类:
 *   顶栏(2) + 加载(1) + 表单头(2)
 *   + 段 1 性别(3) + 段 2 年龄段(3) + 段 3 必填标红(1)
 *   + _FormHeader 辅助(6)
 *   + 提交按钮(1) + 提交态(1) + 完成态(1) + Toast(1) + 草稿恢复(1) + H5 aria(1)
 *
 * 复用约定(spec §3.6 + §4.5 备注):
 *   - 错误兜底**复用** `OnboardingStrings.errorNetwork` / `errorBadRequest` / `errorServer`
 *   - 「重试」按钮文案走 `OnboardingStrings.retry`
 *   - 段 3 标题 / 提示 复用 `OnboardingStrings.stepTitle` / `stepHint`(OnboardingPage 5 选 N 文案)
 *   - chip label 走 `PersonalProfileGenderOptions` / `PersonalProfileAgeOptions`(本规格 §4.6 / §4.7)
 *   - InterestGrid label 走 `OnboardingInterestOptions`(`constants/strings.js:39-45` 5 键,1:1 对齐后端 Interest)
 */
export const PersonalProfileStrings = {
  // 顶栏(spec §3.2 + §4.5)
  backAria: '返回',                       // Header 「←」aria-label
  title: '编辑个人信息',                   // 顶栏标题(与 pages.json navigationBarTitleText 对齐)

  // 加载(spec §3.4 + §4.5)
  loadingText: '正在加载个人信息...',      // currentStep='loading' 提示语

  // 表单头(spec §3.5 + §4.5)
  formTitle: '设置你的偏好',               // _FormHeader 标题
  formHint: '3 段必填,缺一不可;保存后立即生效', // 副提示

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

  // _FormHeader 辅助(spec §3.5 + §4.5)
  formHeaderIdPrefix: '账号: ',            // 「账号: 1」前缀
  formHeaderGenderEmpty: '未选',           // 性别未选时的占位
  formHeaderAgeEmpty: '未选',              // 年龄段未选时的占位
  formHeaderInterestsEmpty: '0 项',        // interests 为空时的占位
  formHeaderInterestsUnit: '项',           // interests count 单位
  formHeaderSeparator: ' | ',              // _FormHeader 三段之间的分隔符

  // 提交按钮(spec §3.4 + §4.5)
  btnSave: '保存',                         // _ActionBar 单 CTA

  // 提交态(spec §3.7 + §4.5)
  savingText: '正在保存修改...',           // currentStep='saving' 提示语

  // 完成态(spec §3.7 + §4.5)
  savedText: '修改成功!',                  // currentStep='saved' 提示语

  // Toast(spec §4.5)
  saveSuccessToast: '修改成功',            // PUT 成功后短暂 Toast(短版,沿用 successText)

  // 草稿恢复(spec §4.5 + §5.3.E)
  draftRestoredToast: '已恢复上次编辑的草稿', // 进入页面时若 userId 有草稿,自动恢复后短暂 Toast

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
  menuNotificationSetting: '通知设置',     // 菜单项 4 标签
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
 * 复用 `AppRoutes.PersonalProfile` / `Trash` / `StyleSetting` / `NotificationSetting`
 * / `About` 5 个**已预声明**的子路由(per `constants/routes.js:16-20`),
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
 * NotificationSettingPage 专用文案(specs/NotificationSettingPage.md §4.5 + §10.8 C-1,实际 26 键)
 *
 * spec 字面写"~17 键"和"~22 键"两处与 C-1 详细 list(2+1+2+2+4+4+2+4+1+1+2+1=26)不一致;
 * 此处按 C-1 list 实际定义 26 键(spec 笔误,deliverable §3.4 显式登记)
 *
 * 字段分类:
 *   顶栏(2) + 加载(1) + 表单头(2) + 段标题(2) + 4 开关标题(4) + 4 开关描述(4)
 *   + 静默时段(2) + picker 标签 + placeholder(4) + 提交按钮(1) + 提交态(1)
 *   + 完成态 + Toast(2) + H5 aria(1) = 26 键
 *   错误兜底与「重试」按钮文案**复用** `OnboardingStrings.errorFallback` / `OnboardingStrings.retry`,
 *   **不**在本段重复(spec §10.4 i18n 纪律 + §10.8 C-11 强约束)
 *
 * 复用约定(spec §3.8 + §4.5 备注 + §10.4 i18n 纪律):
 *   - 顶栏 `backAria: '返回'` 与 StyleSettingStrings.backAria / PersonalProfileStrings.backAria
 *     / TripDetailStrings.backAria / PhotoGuideStrings.backAria **字面相同但本页面**不**复用既有段**——
 *     保持各 page 字符串段独立(per spec-writer-patterns §13「各 page 独立 strings 段」决策),
 *     避免跨 page 字符串耦合
 *   - 错误兜底 1 键 `errorFallback` **引用** `OnboardingStrings.errorFallback` 既有段字面值
 *     (MVP 简化,storage 异常罕见,统一走 errorFallback 兜底,**不**细分 errorNetwork/Server/BadRequest)
 *   - 「重试」按钮文案走 `OnboardingStrings.retry`,**不**在本段重复
 *   - 4 开关 title / desc 8 键独立国际化(便于未来 i18n 化)
 *   - emoji 图标 🧭 / 👥 / 📢 / 🎁 跨语言通用,无需翻译,直接 inline 在 notificationSwitchConfigs
 */
export const NotificationSettingStrings = {
  // 顶栏(spec §3.2 + §4.5)
  backAria: '返回',                                   // Header「←」aria-label
  title: '通知设置',                                   // 顶栏标题(与 pages.json navigationBarTitleText 对齐)

  // 加载(spec §3.7 + §4.5)
  loadingText: '正在加载设置...',                      // viewMode='loading' 提示语

  // 表单头(spec §3.3 + §4.5)
  formTitle: '通知偏好',                              // _FormHeader 标题
  formHint: '选择要接收的通知类别;静默时段内不发送任何通知', // _FormHeader 提示

  // 段标题(spec §3 + §4.5)
  sectionNotificationLabel: '通知类别',                // 4 开关 Section 标题
  sectionQuietHoursLabel: '静默时段',                  // 静默时段 Section 标题

  // 4 开关标题(spec §3.4 表格 + §4.5)
  titleTripReminder: '行程提醒',
  titleBuddyActivity: '同伴动态',
  titleSystemMessage: '系统消息',
  titleMarketing: '营销推广',

  // 4 开关描述(spec §3.4 表格 + §4.5)
  descTripReminder: '出发前、行程中关键节点自动提醒',
  descBuddyActivity: '同伴创建 / 修改 / 删除行程时通知',
  descSystemMessage: '系统升级、维护和故障通知',
  descMarketing: '活动优惠、推广信息和问卷调研',

  // 静默时段(spec §3.6 + §4.5)
  quietHoursTitle: '静默时段',                         // _QuietHoursRow QHHeader 标题
  quietHoursDesc: '该时段内不发送任何通知',            // QHHeader 描述

  // picker 标签(spec §3.6 + §4.5)
  pickerStartLabel: '开始时间',
  pickerEndLabel: '结束时间',
  pickerStartPlaceholder: '请选择开始时间',
  pickerEndPlaceholder: '请选择结束时间',

  // 提交按钮(spec §3.5 + §4.5)
  btnSave: '保存',                                    // _ActionBar 单 CTA

  // 提交态(spec §3.7 + §4.5)
  savingText: '正在保存设置...',                      // viewMode='saving' 提示语

  // 完成态(spec §3.7 + §4.5)
  savedText: '已保存!',                               // viewMode='saved' 提示语

  // Toast(spec §4.5)
  saveSuccessToast: '已保存',                         // 保存成功后短暂 Toast(短版,沿用 successText)

  // H5 aria(spec §10 可访问性)
  pageAria: '通知设置页',                             // page root aria-label
}

/**
 * NotificationSettingDefaults 7 字段默认偏好(spec §4.4 + §4.1 NotificationPrefs 形状)
 *
 * 7 键对象,1:1 对齐 `NotificationPrefs` 形状(7 字段):
 *   4 开关(trip_reminder / buddy_activity / system_message / marketing)
 *   + 3 静默时段(quiet_hours_enabled / quiet_hours_start / quiet_hours_end)
 *
 * MVP 简化决策:
 *   - 4 开关:trip_reminder / buddy_activity / system_message 默认开(用户主观意愿倾向接收),
 *     marketing 默认关(减少打扰,符合业界惯例)
 *   - 静默时段:默认开 + 22:00-08:00(夜间不打扰 + 早晨及时接收,允许跨午夜 per §5.3 H)
 *
 * MVP 简化:不与 userId 关联(per spec §6.4.3 决策,MVP 单用户 '1' 隐含)
 * 持久化由 `uni.setStorageSync('notification_prefs', payload)` 触发(per spec §5.2 Step 6)
 *
 * @type {Readonly<{
 *   trip_reminder: boolean,
 *   buddy_activity: boolean,
 *   system_message: boolean,
 *   marketing: boolean,
 *   quiet_hours_enabled: boolean,
 *   quiet_hours_start: string,
 *   quiet_hours_end: string,
 * }>}
 */
export const NotificationSettingDefaults = Object.freeze({
  trip_reminder: true,         // 行程提醒(默认开)
  buddy_activity: true,        // 同伴动态(默认开)
  system_message: true,        // 系统消息(默认开)
  marketing: false,            // 营销推广(默认关)
  quiet_hours_enabled: true,   // 静默时段 toggle(默认开)
  quiet_hours_start: '22:00',  // 静默时段开始时间('HH:mm' 格式)
  quiet_hours_end: '08:00',    // 静默时段结束时间('HH:mm' 格式)
})

/**
 * notificationSwitchConfigs 4 通知开关元数据(spec §3.4 表格 + §4.4)
 *
 * 4 键数组,顺序为"通知功能价值由高到低":
 *   行程提醒 > 同伴动态 > 系统消息 > 营销
 *
 * 数据形状(spec §4.4):
 *   key       : string       唯一 key(v-for :key 用;1:1 对齐 NotificationSettingDefaults 4 开关)
 *   icon      : string       emoji 图标,左侧 64rpx
 *   title     : string       中文短标签(由 NotificationSettingStrings.titleXxx 引用)
 *   desc      : string       中文长描述(由 NotificationSettingStrings.descXxx 引用)
 *   defaultOn : boolean      默认开关值,新用户 fallback(per §5.1 onLoad miss 分支)
 *
 * `defaultOn` 1:1 对齐 `NotificationSettingDefaults` 4 开关
 * 复用 `NotificationSettingStrings.titleXxx` / `descXxx` 8 键,**不**重复字面值
 * 与 `OnboardingInterestOptions` / `StyleSettingOptions` **语义独立**(通知类别 vs 兴趣 vs 讲解风格)
 *
 * @type {ReadonlyArray<{ key: string, icon: string, title: string, desc: string, defaultOn: boolean }>}
 */
export const notificationSwitchConfigs = Object.freeze([
  { key: 'trip_reminder',  icon: '🧭', title: NotificationSettingStrings.titleTripReminder,  desc: NotificationSettingStrings.descTripReminder,  defaultOn: true  },
  { key: 'buddy_activity', icon: '👥', title: NotificationSettingStrings.titleBuddyActivity, desc: NotificationSettingStrings.descBuddyActivity, defaultOn: true  },
  { key: 'system_message', icon: '📢', title: NotificationSettingStrings.titleSystemMessage, desc: NotificationSettingStrings.descSystemMessage, defaultOn: true  },
  { key: 'marketing',      icon: '🎁', title: NotificationSettingStrings.titleMarketing,      desc: NotificationSettingStrings.descMarketing,      defaultOn: false },
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
 * 与 `StyleSettingOptions` / `OnboardingInterestOptions` / `notificationSwitchConfigs`
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
 *     (沿 §8.4 guide-result → photo-guide _ClearChatConfirmDialog 反向 import 模式)
 */
export const ItineraryArrangeStrings = {
  // 字段 label/hint(spec §3.5 Field 6 + §4.4)
  fieldLabel: '行程安排',         // form 字段 label(Noto Sans SC 14px 500)
  fieldHint: '长按卡片可拖动调整顺序;可点击右上角 ✕ 删除或 + 添加', // form 字段 hint(Noto Sans SC 12px,inkMuted)

  // 5 类型短标签(per ui/types.ts:37 ItemType 5 枚举,1:1 对齐)
  typeLabelAttraction: '景点',   // 'attraction'
  typeLabelFood: '美食',         // 'food'
  typeLabelTraffic: '交通',      // 'traffic'
  typeLabelRest: '休息',         // 'rest'
  typeLabelOther: '其他',        // 'other'(UI-025 新增)

  // 时间输入 placeholder
  placeholderStartTime: '开始时间',
  placeholderEndTime: '结束时间',
  placeholderTitle: '请输入地点名称',

  // 添加行程按钮
  btnAdd: '+ 添加行程',
  btnAddAria: '添加行程安排项',

  // 删除按钮
  btnRemoveAria: '删除该行程项',

  // 拖动状态提示
  dragHint: '拖动调整顺序',
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
