# Changelog — DaoYou Frontend

> Per-page changelog. New entries appended at the bottom by `code-writer` on completion.
> Format: `<PageName> | <date> | <version> | <one-line summary>`

## Index
| Page | Date | Version | Summary |
|---|---|---|---|
| [OnboardingPage](#onboardingpage) | 2026-06-02 | v0.1.0 | First implementation; single-step interest 5-of-1 (PD-001 方案 A); 4-state submit flow |
| [HomePage](#homepage) | 2026-06-02 | v0.1.0 | First implementation; 5-state (loading/diary/trips/empty/error) + 浮层 3 按钮 + 本地收藏持久化 |
| [HomePage](#homepage) | 2026-06-05 | v0.2.0 | 视图态从 5 视图态互斥 v-if 链改为 `sectionVisibility` 4 字段(showError/showDiary/showTrips/showEmpty)+ diary/trips/empty section **并存**结构(per user 体验反馈问题 1 严重);`viewMode` 5 枚举保留为底层语义标记(**不**直接驱动 v-if,per spec §3.7.1 R-10);Header「←」按钮移除(uni-app tabBar page)+ onBack 4 路径逻辑删除;HomeDiary 行程卡片 SpotCard Title 字号 28rpx → 27rpx(per spec §4.4 v0.2.0 修订:32rpx → 27rpx,user 体验反馈问题 3 轻微 -5px);**0 改动** Review.{ui,spec,test} 状态(per ssp-arch §6 forward-looking comment 反模式 + 跨页 refactor 不触发 review 重审) |
| [SpotDetailSheet](#spotdetailsheet) | 2026-06-02 | v0.1.0 | 独立 route 浮层详情页(深链 ?spotId=xxx);4 视图态(loading/sheet/notfound/error);复用 components/SpotDetailSheet.vue(refactor 后)+ 私有 _ErrorOverlay |
| [NewTripPage](#newtrippage) | 2026-06-03 | v0.1.0 | 独立 route 新建行程页(无 URL param);6 视图态(input/analyzing/form/submitting/completed/error);7 字段表单(3 必填 + 4 选填 client-only);前端 setTimeout 模拟 AI + 极简正则提取;草稿存 `trip_drafts` 本地 storage;3 按钮 _DraftConfirmDialog |
| [NewTripPage](#newtrippage) | 2026-06-06 | v0.2.0 | UI-025 修复 — form 视图新增「行程安排」(itineraryArrange)字段(per issues/UI/UI-025-itinerary-arrange-drag.md):横向 scroll-view 渲染 item 卡(280rpx × 220rpx) + 长按 200ms 进入拖动模式(自写 @touchstart + @touchmove + @touchend 跨 H5 + Android 兼容,**不**用 HTML5 drag-and-drop) + 滑动跨 50% 阈值自动交换顺序 + 「+ 添加行程」inline 表单(地点名/起止时间/item_type 5 选 1) + 每项右上角 ✕ 删除;新增 1 私有子组件 `pages/new-trip/components/ItineraryArrangeField.vue`(沿 _DraftConfirmDialog 模式 **不**抽公共 components/);formData 8 字段(原 7 + itineraryArrange 沿 spec §3.5 字段顺序,在 `budget_range` 之后 `transport_preference` 之前);`api/types.ts` 扩展:`ItineraryItem` interface(5 字段 id/title/start_time/end_time/item_type)+ `ItemType` 加 'other' 5 枚举 + `CreateTripRequest` + `UpdateTripRequest` 扩展 `itineraryArrange?: ItineraryItem[]`;`constants/strings.js` 增量 `ItineraryArrangeStrings` 12 键(fieldLabel/fieldHint/5 typeLabel/3 placeholder/2 btn add+remove/dragHint)+ `ItineraryArrangeItemTypeOptions` 5 键 Object.freeze(沿 HomeItemTypeEmoji ItemTypeEmoji 4 枚举 + 'other' 5 键);`services/trips.js` 增量 `createTrip` 接受 itineraryArrange 字段(POST body 自动携带);`MOCK_TRIP_FOR_COPY` 扩展 itineraryArrange 4 项预填(任务 4 复制模式 UI-025 联动:兵马俑 / 午餐 / 古城墙骑行 / 回民街夜市);`MOCK_TRIP_FOR_COPY` 改用 `Trip & { itineraryArrange? }` intersection 类型(per spec §硬规则 "不**改**既有 trips shape",TypeScript 兼容);7 关键事件 logger 完整覆盖(0 console.*);onUnmounted 兜底 `clearLongPressTimer`;EditTripPage 跨页反向 import NewTripPage 私有子组件(沿 §8.4 guide-result → photo-guide _ClearChatConfirmDialog 模式,**不**抽公共 components/);Review.{ui,spec,test}=Pending + FinalStatus=ReadyForReview 等待 3 reviewer 复审 |
| [NewTripPage](#newtrippage) | 2026-06-28 | v0.7.0 | 实施 — 同步 specs/NewTripPage.md v0.7.0 简化到 code(6 视图态 → 4 视图态);删除 input/analyzing 视图态 + extractFormDataFromText AI 模拟函数 + form 顶部 inputText 折叠预览 + _InputPanel/_AnalyzingPanel template 节点 + inputText/attachedFiles/hasShownAnalyzingDelay/isAnalyzing 4 ref + analyzingTimerId/clearAnalyzingTimer/onSubmit(进 analyzing)/onAttachFile/onRemoveFile 函数;currentStep 默认 'input' → 'form';hasContent 派生从 3 字段收敛为 1 字段(formData);TripDraft 5 → 3 字段(删 inputText + attachedFiles);onDialogSave 失败回退路径 + onDialogContinue 'input' → 'form';沿 retro fix 协议 0 改动 Review.{ui,spec,test}=Pass + FinalStatus: Done(spec-writer 越权边界 + 跨页 refactor 不触发 review 重审);0 触动 constants/strings.js(字符串零改,obsolete 字符串保留)+ 0 触动其他 13 page + 0 触动 mock + 0 触动 api/types.ts;详见 outputs/ntp-code-v0-7-impl/deliverable.md |
| [EditTripPage](#edittrippage) | 2026-06-06 | v0.2.0 | UI-025 修复 — form 视图新增「行程安排」(itineraryArrange)字段(per issues/UI/UI-025-itinerary-arrange-drag.md):跨页反向 import `pages/new-trip/components/ItineraryArrangeField.vue`(沿 §8.4 guide-result → photo-guide _ClearChatConfirmDialog 模式,spec §10 R-2 不抽公共 components/);formData 9 字段(原 8 + itineraryArrange,沿 spec §3.5 字段顺序,在 `budget_range` 之后 `transport_preference` 之前);`buildUpdateRequest` 扩展 itineraryArrange partial-update 携带(ID 序列浅比较 `currentIds !== originalIds` 触发,仅当与 originalData 不同时携带);`hasChanged` 派生 + itineraryCount ID 序列比较;`formDataFromTrip` 后端无 itineraryArrange 回显时 = 空数组(`Trip & { itineraryArrange? }` intersection 类型);saveEditDraft 沿用 `{ ...formData.value }` 自动持久化 itineraryArrange 字段;saveEditDraft 写入 `edit_trip_drafts` keyed by tripId(loadEditDraft 反序列化时自动恢复,沿 §3.6 复用);**0 触动** spec(spec-writer 越权边界)+ 0 触动 mock _seed.ts 既有 trips shape(spec §硬规则)+ 0 触动 6 视图态(loading/editing/saving/success/notfound/error)+ 0 触动 status 3 chips 必填 + 0 触动 2 必填(title/status)校验;3 关键事件 logger 完整覆盖(save start 增量 itineraryCount / onLoad / onRetry 等 0 触动,0 console.*);Review.{ui,spec,test}=Pending + FinalStatus=ReadyForReview 等待 3 reviewer 复审 |
| [TripDetailPage](#tripdetailpage) | 2026-06-03 | v0.1.0 | 独立 route 行程详情页(深链 ?tripId=xxx);4 视图态(loading/detail/notfound/error)+ 5 子态矩阵(inProgress/upcoming/expired/finished/draft);复用 SpotCard/SpotDetailSheet/_ErrorBanner;软删除 → 跳 TrashPage;_DeleteConfirmDialog 2 按钮 modal |
| [EditTripPage](#edittrippage) | 2026-06-03 | v0.1.0 | 独立 route 编辑行程页(深链 ?tripId=xxx);6 视图态(loading/editing/saving/success/notfound/error);8 字段表单(title 必填 + city/dates 灰色 disabled + 4 选填 client-only + status 3 chips 必填);触发 PD-001(UpdateTripRequest 2 字段 vs 8 字段表单 — UI 全展示但 PUT 仅发 title/status);草稿存 `edit_trip_drafts` 本地 storage keyed by tripId;3 按钮 _DraftConfirmDialog |
| [PhotoGuidePage](#photoguidepage) | 2026-06-03 | v0.1.0 | 独立 route 拍照讲解页(深链 ?fromSpot=spotId&tripId=tripId);6 视图态(idle/preview/analyzing/result/chatting/error);4 块讲解(块 3 复用 explanation 同字段,触发 PD-001);3 风格映射(PhotoGuideStyleFromPrefMap);追问循环复用 POST /api/photos/explain 不传 history;30s 上传超时 setTimeout;_ClearChatConfirmDialog 2 按钮 Danger 配色 |
| [PhotoGuidePage](#photoguidepage) | 2026-06-03 | v0.1.1 | UI 001 修复 — `.btn-send` L1972 `height: 80rpx` → `min-height: 88rpx`(44pt 触达对齐 9 处项目标准 + spec AC-20 + §10 NFR 可访问性);同行 `.chat-input-field` L1952 `height: 80rpx` 保留(UI 软观察 #1,input 是 focusable 非 clickable,iOS HIG 不强制 44pt);不动 PageStatus.yaml(Review.ui=Fail / FinalStatus=NeedFix 保持,等 ui-r2 改 Pass);不动 9 处 88rpx 触达样式;chat-input-bar-wrap sticky bar 大屏补偿 + shanshui 配色 + 0 console.* + 5 复用项零修改 全部保持 |
| [GuideResultPage](#guideresultpage) | 2026-06-03 | v0.1.0 | 独立 route 讲解结果页(深链 `?photoId=xxx` 必填,可选 `?fromSpot=yyy&tripId=zzz`);5 视图态(loading/loaded/chatting/notfound/error),chatting 是 loaded 衍生态;主路径**不调 HTTP**,本地缓存 `guide_results` keyed by `photo_id`;3 风格 chip 纯前端视觉切换(per §6.4.2);追问 page-local mock `setTimeout(500-1000ms)`(per §6.4.5);4 块讲解 inline 渲染;复用 PhotoGuideStrings 25+ 键 + PhotoGuideStyleFromPrefMap + _ErrorBanner + SpotCard 只展示 + PhotoGuidePage _ClearChatConfirmDialog 反向 import |
| [MyPage](#mypage) | 2026-06-04 | v0.1.0 | 独立 route 我的主页(tabBar page,无 URL params,tabBar.list 项目级缺口由 orchestrator 协调下一次 patch 补);3 视图态(loading/loaded/error)互斥 v-if;触发 PD-001 3 处(无 User 类型 / 无 GET /api/users/me / 无 DELETE /api/auth/session,均按 spec §6.4.1/§6.4.2/§6.4.3 默认路径 UI 简化);6 菜单项 inline 渲染(v-for MyPageMenuOptions,5 navigate 接受目标 page 404 兜底 + 1 coming-soon toast);退出登录走本地 userStore.clearProfile() + uni.reLaunch(Home) 0 API 调用;复用 OnboardingInterestOptions 5 键 emoji + _ErrorBanner + _LogoutConfirmDialog 私有 2 按钮 Danger 配色 |
| [MyPage](#mypage) | 2026-06-05 | v0.1.1 | BottomTabBar 集成适配 — 移除 Header 块(uni-app tabBar page 默认无 navigationBar,per spec §3.9 + §10 R-15)+ 移除 .header / .header-spacer / .header-title-wrap / .header-title 4 个 CSS 规则;body-inner 顶层 padding 24rpx 保留(用户信息卡距屏幕顶端 24rpx 视觉留白);**0 改动** 3 视图态 / 6 菜单项 / 退出登录 / _LogoutConfirmDialog / 6 关键事件 logger / `useUserStore.fetchPreferences()` / `clearProfile()` / `OnboardingInterestOptions` / `MyPageStrings` / `MyPageMenuOptions` / `MyPageExplanationLabel` / `AppRoutes.*` / `AppColors` / pages/my/components/LogoutConfirmDialog.vue / pages.json tabBar 集成(由 HomePage v0.2.0 任务同步落地);**0 改动** Review 状态(per ssp-arch §6 forward-looking comment 反模式) |
| [PersonalProfilePage](#personalprofilepage) | 2026-06-03 | v0.1.0 | 独立 route 编辑个人信息页(无 URL param,MyPage「编辑」拉起);5 视图态(loading/editing/saving/saved/error);3 段表单(性别 3 选 1 / 年龄段 5 选 1 / 感兴趣领域 5 选 N);触发 PD-001 4 处(端点 /api/users/me 不存在→/api/preferences / gender+ageRange 后端无字段走 client-only / 5 vs 8 兴趣 / 取消无 _DraftConfirmDialog);草稿 `user_profile_drafts` keyed by `userId='1'`;2 私有 _GenderChipGroup / _AgeChipGroup(MVP YAGNI 不抽公共);复用 InterestGrid / userStore.fetchPreferences+updateProfile / services/preferences.ApiError;userStore.updateProfile 调 PUT /api/preferences 仅传 interests |
| [TrashPage](#trashpage) | 2026-06-04 | v0.1.0 | 独立 route 回收站页(无 URL param,MyPage 菜单项 2「回收站」navigateTo 拉起);4 视图态(loading/loaded/empty/error)互斥 v-if 切换;2 PD-001 决策(§6.4.1 GET 全量+JS filter 兜底 / §6.4.2 永久删除 UI 简化 0 API);2 私有子组件(_TrashItemRow 3 段+2 按钮 / _PermanentDeleteConfirmDialog 2 按钮 Danger 配色);乐观更新 + 回滚协议(per §7.3)+ 404 静默路径(per §5.3.H);onUnmounted 兜底 clearTrash(避免下次进入页面看到上次残留);复用 EmptyState / _ErrorBanner / HomeTripStatusLabel.deleted = '已结束' / OnboardingStrings.retry+errorXxx / services.preferences.ApiError;**不**调 homeStore.fetchTrips(恢复后由 HomePage onShow 自动重拉);**不**抽 _TrashItemRow 公共(MVP YAGNI);api/mock/_seed.ts 增量 seedTrip4/5(2 条 status='deleted' 演示数据,per §6.4.4) |
| [StyleSettingPage](#stylesettingpage) | 2026-06-04 | v0.1.0 | 独立 route 讲解风格设置页(无 URL param,MyPage 第 3 项菜单「讲解风格」拉起);5 视图态(loading/loaded/saving/saved/error)互斥 v-if;3 选项 v-for 渲染 1:1 对齐 `ExplanationStyle` 3 枚举(无 PD-001 触发);PUT partial-update 1 字段纪律(仅发 `explanation_style`,不碰 travel_pace/interests/special_needs);走 `userStore.updateProfile` → `services/preferences.updatePreferences`,**不**调用 `updateUserInfo`(语义混淆);**不**存草稿 + **不**弹 _DraftConfirmDialog(per §4.6 + §5.4 MVP 简化决策);复用 AppColors / OnboardingStrings.retry+errorXxx / MyPageExplanationLabel / _ErrorBanner 整页形态;新建 pages/style-setting/components/_StyleOptionCard.vue 私有 + StyleSettingStrings 18 键 + StyleSettingOptions 3 键 Object.freeze;pages.json 第 10 个 page 注册 |
| [NotificationSettingPage](#notificationsettingpage) | 2026-06-04 | v0.1.0 | 独立 route 通知设置页(无 URL param,MyPage 第 4 项菜单「通知设置」navigateTo 拉起);5 视图态(loading/loaded/saving/saved/error)互斥 v-if;7 字段 100% client-only + 本地 `uni.setStorageSync('notification_prefs', ...)` 持久化(per §6.4.1 PD-001 决策 — UI 7 字段 vs `Preferences` 4 字段 0 匹配);**不**调任何 API / **不**调 `userStore` / **不**调 `services.preferences` / **不**新建 store;4 开关 `notificationSwitchConfigs` v-for 渲染 + 1 静默时段 `_QuietHoursRow`(toggle + 2 个 `uni-picker mode="time"`)+ 「保存」单 CTA;`isDirty` 派生 `!isPrefsEqual(notificationPrefs, originalPrefs)`;saved 200ms 瞬时态后 `uni.navigateBack()`(保留 stack);`onBack` 走 §5.4 简化(直接 navigateBack **不**弹草稿弹窗);不检测 `uni.authorize` / `getSetting` / `openSetting`(per §6.4.2 MVP 简化);storage key 固定 `'notification_prefs'`(per §6.4.3 MVP 单用户);复用 `AppColors` / `AppRoutes.NotificationSetting`(已预声明 routes.js:18)/ `OnboardingStrings.retry`+`errorFallback` / `components/_ErrorBanner` 整页形态;新建 `pages/notification-setting/components/_NotificationSwitchRow.vue`(4 props + 1 emit)+ `_QuietHoursRow.vue`(5 props + 3 emits)页私有子组件 + `NotificationSettingStrings` 26 键(顶栏 2 / 加载 1 / 表单头 2 / 段标题 2 / 4 开关标题 4 / 4 开关描述 4 / 静默时段 2 / picker 标签 + placeholder 4 / 提交按钮 1 / 提交态 1 / 完成态 + Toast 2 / H5 aria 1,spec 字面 "~17 键 / ~22 键" 与 C-1 详细 list 26 不一致,deliverable §3.4 显式登记)+ `NotificationSettingDefaults` 7 键 `Object.freeze` + `notificationSwitchConfigs` 4 键 `Object.freeze`;pages.json 第 12 个 page 注册(spec §10.8 C-4 字面写「第 11 个」,实际当前 pages.json 已 11 个 page 含 TrashPage,本任务落地为第 12 个 — 1 元 spec 笔误登记,deliverable §3.4 显式登记) |
| [LoginPage](#loginpage) | 2026-06-04 | v0.1.0 | 独立 route 登录占位页(无 URL param,无上游调用入口,MVP 占位兜底);3 视图态(loading/loaded/error)互斥 v-if;触发 PD-001 §6.4.1 决策(无 auth 模块 / 无 User 类型 / 无 Session 端点,后端 0 命中 `interface User/Session/LoginRequest/AuthToken`,MVP 0 API 0 store 0 service 0 子组件);200ms `setTimeout` 模拟初始化(纯 UI 切换,无任何 API)+ 2 层 stale guard(`clearSimulateTimer` 防堆叠 + 回调内 `if (viewMode !== 'loading' || hasInitialized) return` 防 stale + `onUnmounted` 兜底 clearTimeout,沿 NewTripPage §5.6 + PhotoGuidePage §5.6 模式);4 路径 onBack + 1 兜底(Header「←」/ 系统返回手势 / 「返回首页」按钮 / error 态保留「返回首页」逃生口 + `getCurrentPages().length > 1` 判定 + `uni.navigateBack({delta:1, fail: reLaunch Home})` / 兜底 `uni.reLaunch(AppRoutes.Home)`);复用 `AppColors` / `AppRoutes.Home` / `OnboardingStrings.errorNetwork`+`retry` / `components/_ErrorBanner` ⭐ 整页 error 态 / `utils/logger`(10 关键事件 0 console.*);新建 `LoginPageStrings` 7 键(顶栏 1 / Loading 1 / 主体 3 / 主 CTA 1 / H5 aria 1) + pages.json 第 14 个 page 注册 |
| [TripPreparePage](#trippreparepage) | 2026-06-04 | v0.1.0 | 独立 route 行程准备中占位页(无 URL param,无上游调用入口,MVP 占位兜底);3 视图态(loading/loaded/error)互斥 v-if;触发 PD-001 §6.2.1 + §6.2.2 决策(无「行程准备」实质业务 / 后端无 `/api/trips/prepare` 端点 / 0 store 调用,纯静态占位 + 500ms `setTimeout` 模拟"准备中"动效,无任何 API);2 层 stale guard(`clearPrepareTimer` 防堆叠 + 回调内 `if (viewMode !== 'loading') return` 防 stale + `onUnmounted` 兜底,沿 NewTripPage §5.6 + PhotoGuidePage §5.6 模式);4 路径 onBack + 1 兜底(Header「←」/ 系统返回手势 / 「返回上一页」按钮 + `getCurrentPages().length > 1` 判定 + `uni.navigateBack({delta:1, fail: reLaunch Home})` / 兜底 `uni.reLaunch(AppRoutes.Home)`,沿 TripDetailPage §5.4 模式);复用 `AppColors` / `AppRoutes.TripPrepare`(已预声明 `constants/routes.js:26`)/ `AppRoutes.Home` / `OnboardingStrings.errorFallback`+`retry` / `components/_ErrorBanner` ⭐ 整页 error 态 / `utils/logger`(7 关键事件 0 console.*);新建 `TripPrepareStrings` 8 键(顶栏 2 / Loading 1 / 插画 1 / 主标题 1 / 副标题 1 / 返回按钮 1 / H5 aria 1) + pages.json 第 15 个 page 注册 |
| [AboutPage](#aboutpage) | 2026-06-04 | v0.1.0 | 独立 route 关于导友页(无 URL param,MyPage 第 6 项菜单「关于」navigateTo 拉起);2 视图态(loaded/error)互斥 v-if(无 `loading` 第 3 枚举,因 0 异步);4 信息卡片 v-for `AboutInfoCards` 4 键 `Object.freeze` 集中登记(inline 渲染,**不**抽 `_InfoCard.vue` 私有,沿 MyPage `_MenuItem` / StyleSettingPage `_StyleOptionCard` YAGNI 决策);MVP 纯静态占位(0 API / 0 store / 0 service / 0 storage / 0 URL params,per §1 项目级 carve-out);4 卡片字面硬编码引用 `package.json:2-3` name/version + `README.md:1-12` 技术栈段 + 项目级占位版权;4 路径 onBack + 1 兜底(Header「←」/ 系统返回手势 + `getCurrentPages().length > 1` 判定 + `uni.navigateBack({delta:1, fail: reLaunch Home})` / 兜底 `uni.reLaunch(AppRoutes.Home)`,沿 GuideResultPage §5.4 模式);4 卡片 `pointer-events: none` 显式禁用 tap(per AC-08 不可点击);复用 `AppColors` / `AppRoutes.About`(已预声明 `constants/routes.js:20`)/ `AppRoutes.Home` / `OnboardingStrings.retry` / `NewTripStrings.errorFallback`(per §1 复用决策 + 13 页面惯例)/ `components/_ErrorBanner` ⭐ 整页 error 态 / `utils/logger`(5 关键事件 0 console.*);新建 `AboutStrings` 10 键(顶栏 2 / 错误态 1 / 主体 2 / 4 卡片标签 4 / H5 aria 1) + `AboutInfoCards` `Object.freeze` 4 键(项目元信息从上到下:项目名 → 版本 → 技术栈 → 版权,4 emoji icon + label + value)+ pages.json 第 16 个 page 注册 |
| [PersonalProfilePage](#personalprofilepage) | 2026-06-04 | v0.1.1 | **retro fix** — `pages.json` 第 13 个 page 注册补漏(原 11 个 page 块未含 `pages/personal-profile/index`,MyPage `onUserInfoTap` → `uni.navigateTo(AppRoutes.PersonalProfile)` 跳转因未注册走 404 兜底);**0 改动** `pages/personal-profile/index.vue` 1019 行原状 + `AppRoutes.PersonalProfile`(已预声明 `constants/routes.js:16`)+ `PersonalProfilePage.Spec` 块加 1 行 retro fix 注释(spec 字面 + 实际状态 NotStarted 保持,`Development.status: NotStarted` / `FinalStatus: NotStarted` **不动**,**不**触发 review 重审 per ssp-arch §6 forward-looking comment 反模式 + reviewer「抽样审计 + 自报已知妥协」原则);**0 改动**既有 14 page 块任何代码;**0 改动** `tabBar.list` / `AppRoutes.*` / `constants/routes.js` / `constants/colors.js` / `constants/strings.js` 既有字段 |
| [BottomTabBar](#bottomtabbar) | 2026-06-05 | v0.1.0 | MVP 简化路径 — pages.json tabBar 段新增(uni-app 原生 tabBar 3 项 + 6 占位 iconPath,1x1 transparent PNG 68 bytes each);**不**实现 `custom: true` / **不**创建 `components/tab-bar/BottomTabBar.vue` / **不**新增 `BottomTabBarStrings` 段(per task 显式「MVP 简化:先用 uni-app 原生 tabBar, **不实现**圆形凸出, 后续可升级 custom tabBar」);**任务 vs spec 偏差登记** 3 处:无 custom tabBar / 无 BottomTabBar.vue / 无 BottomTabBarStrings 段(per memory §2 + orchestrator override spec §8.1 + §10 R-1 + §10 R-6,deliverable §3 显式登记);颜色字段按 spec 字面落地(`color: '#9A9A9A'` spec AC-09 vs task '#5A5A5A' / `borderStyle: 'black'` spec vs task 'white',per memory §2 「行为类 → spec 永远赢」);既有 16 page entry / globalStyle / easycom 0 改动;Review 待 3 reviewer 并行,Architecture 待 architecture-reviewer 派工 |
| [TripDetailPage](#tripdetailpage) | 2026-06-06 | v0.1.1 | **UI-026 retro fix** — `pages/trip-detail/index.vue` `.day-block` 视觉边界优化(per issues/UI/UI-026-day-block-border-optimize.md):bg `#FDFBF7 → #FFFFFF` 纯白(与 page `#F7F3EC` 暖米色形成 3.1% 亮度差 + border + shadow 双层边界),新增 `border: 1.5rpx solid rgba(45, 106, 94, 0.12)`,`box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04) → 0.06` 微提升;**0 改动** 4 视图态 / 5 子态矩阵 / viewMode 决策 / spec / AppColors / `_TripHeader` background(spec 边界,trip-header 留 `#FDFBF7` 与 day-block 微差异信息层 1);retro fix 协议保持 `Spec.status: NotStarted` + `Architecture.status: NotStarted` + `Development.status: NotStarted` + `FinalStatus: NotStarted` + `Review.{ui,spec,test}: Pass`(0 触动,纯 UX 视觉调整 0 业务逻辑变更 0 spec 字段变更 0 API 契约变更,reviewer 重审无新失败项);Playwright 实测 5173 tripId=1:3 day-block `rgb(255,255,255)` + `border 0.12` + `shadow 0.06` + page bg `rgb(247,243,236)` 边界清晰 + 0 console error;Vite 编译产物 curl 验证 `border: 0.04688rem solid rgba(45, 106, 94, 0.12)` 跨 H5/Android 兼容 |
| [HomePage](#homepage) | 2026-06-06 | v0.2.1 | **UI-026 retro fix 跨页影响** — `components/SpotCard.vue` + `components/SpotTimeAxis.vue` 视觉边界优化(per issues/UI/UI-026-day-block-border-optimize.md):`.spot-card` border `0.06 → 0.10` + 新增 `box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.06)` + 新增 `.spot-card-done { background: #FFFFFF }` 显式规则(UI-021 移除绿底后 0 CSS 占位,接 task 6 协调 race);`.spot-time-axis-divider` `width: 1rpx → 4rpx` + `background: 0.10 → 0.15`(横向 scroll-view 卡片间分隔清晰);**0 改动** 4 状态视觉(active / upcoming / expired / changed)+ AppColors + computeState + spec + 5 视图态 + sectionVisibility 4 字段 + viewMode 5 枚举 + decideViewMode() + pages.json + store + service;retro fix 协议保持 `FinalStatus: Done` + `Review.{ui,spec,test}: Pass` 0 触动;Playwright 视觉验证受限 — seed trip 1 start_date `2026-07-01` 不匹配 today `2026-06-06`,`store.today = null`,`showDiary = false`,SpotTimeAxis 不渲染(代码 + Vite 编译产物已验证 `width: 0.125rem` + `background: rgba(45, 106, 94, 0.15)`,实际渲染需 user 真实 trip 触发) |
| [ChatPage](#chatpage) | 2026-06-28 | v0.2.1 | **silent drop retro fix** — 修 `data.action_options` 字段前端 silent drop(spec §9 AC-05 violation,per issues/Spec/ChatPage-action-options-silent-drop-001.md):`stores/chatStore.js` 加 1 字段 `currentActionOptions`(state docstring L11 扩 1 行 + state ref L69 + `sendMessage` success 写入 L210 + `fetchHistory` 入口重置 L107 + `sendPhotoMessage` 入口防御性重置 L301 + return 暴露 L368;既有 sendMessage success logger payload 加 `action_options_count` 字段 L217);`pages/chat/index.vue` 加 `import { storeToRefs } from 'pinia'` L308 + 删 page-local `const actionOptions = ref([])` L509 改走 `const { currentActionOptions: actionOptions } = storeToRefs(chatStore)` L560(响应式 1:1 对齐,`actionOptions.value = []` 重置仍可直接写,storeToRefs 解构出的 ref 双向绑定);**0 改动** 5 视图态 enum(loading/idle/sending/chatting/error 全部保留)+ 3 intent 路由 + modal 形态 + `onActionOptionConfirm` 占位 Toast(spec §3.9 字面允许,bug 2 留 follow-up)+ `services/chat.js`(已透传整段 data)+ `api/types.ts` / `api/mock/*` / `services/photos.js`(READ-ONLY)+ 既有 Review.{ui,spec,test}=Pass 状态 + FinalStatus=Done;retro fix 协议(per AGENTS.md §8.11 fix-notification-click-inverse precedent + ssp-arch §6 forward-looking comment 反模式);PageStatus.yaml ChatPage.Development 注释追 1 行 v0.2.1 retro fix 沿革;bug 2 留作 follow-up(spec §3.9 + §6.4 #6 + §9 AC-06 当前 MVP 占位 Toast「即将上线」,若业务决定升级 spec v0.3.0 真接 `PUT /api/trip-items/{item_id}` 走完整 spec → arch → dev → 3 review 流程);详见 outputs/fix-chat-action-options-silent-drop/deliverable.md |
| [ChatPage](#chatpage) | 2026-07-03 | v0.4.0 | **markdown 渲染 retro fix** — 修 chat bubble 裸 markdown 文本(per user 2026-07-03 21:18「聊天框中显示的回复是裸 markdown 格式」):① `src/utils/markdown-lite.js` 新建纯函数 `parseMdLite(input)` 45 行 + 完整 JSDoc(返回 `Array<{ type: 'text' \| 'bold', text: string }>` token 数组;正则 `\*\*(.+?)\*\*\|__(.+?)__` 切 ** + __ 2 变体;空 / 非 string / null 0 命中输入返回 `[]`;**不**解析 *italic* / [link](url) / 标题 / 列表 / 代码块 / 图片,0 XSS 风险,跨 H5(`<text>` 嵌套编译多 `<span>`)+ Android(`<text>` 嵌套编译成 SpannableString 段)双端稳,0 依赖,0 bundle 增长);② `tests/markdown-lite.test.mjs` 新建 11 个 test case(空 / 非 string / 普通文本 / 单段 / 多段 / __ 变体 / 单 *italic* 不渲染 / 链接保留字面 / 未闭合 ** 兜底 / 相邻 bold / 数字 bold / 换行保留)11/11 PASS + 全量 56/56 PASS 0 regression;③ `src/pages/chat/index.vue` L134-137 模板 `{{ truncateContent(msg.content) }}` → 嵌套 `<text>` + `<block v-for>` + `:selectable="true"` 长按选中 + `space="emsp"` 换行兜底(per user 拍板:仅 `**bold**` + `__bold__` 加粗,跨 H5 + Android,链接不跳转,单 `*` 斜体不实现);**保留** `truncateContent` 函数 5000 字符截断语义(per spec §4.1),仅在 template 里 inline 调用 `parseMdLite(truncateContent(msg.content))` 套外面 token 化,2 函数职责分离;**0 触动** 5 视图态 enum(loading/idle/sending/chatting/error 全部保留)+ 3 intent 路由(chat/apply-plan/replan)+ `onActionOptionConfirm` 6 步骤行为规约 + `onApplyPlanConfirm` 占位 Toast + 5 私有子组件(ActionOptionsModal / ApplyPlanConfirmDialog / PhotoActionButton / PhotoActionSheet / MessageImage / ImagePreviewModal)+ 1 共享 ErrorBanner / store / services / `api/types.ts` / `api/mock/*`;**0 触动** PhotoGuidePage / GuideResultPage 0 行(task 显式 scope,user 2026-07-03 21:30 明确「photo-guide 已经被弃用」,沿用 2026-06-25 软删决策,后续 photo-guide-deprecation / guide-result-deprecation task 单独改 FinalStatus);8 项 grep 自检全过(0 console.* 实际调用 + 56/56 全量测试 PASS + curl chat 200 + curl markdown-lite 200 + photo-guide / guide-result parseMdLite 引用 0 命中 + 0 触动既有 17 page PageStatus 块 + 0 触动既有 8 services + 0 触动既有 4 stores);**0 触动** Review.{ui,spec,test} + FinalStatus + Spec + Arch + Dev.status 全部保持(沿 retro fix 协议:0 spec 字段变更 + 0 API 契约变更 + 0 新功能 + 0 硬 FAIL 触发;reviewer「抽样审计 + 自报已知妥协」原则下 0 新失败项 = 不重审);playwright H5 e2e 实测:1) navigate `#/pages/chat/index?tripId=1` 触发 chat history 拉取 OK;2) 临时改 mock reply 含 3 处 `**bold**` → 发送 user msg → assistant reply 渲染拆成 7 segments(3 bold + 4 text,DOM snapshot 验证);3) 验证完 mock 改回 + USE_MOCK_FALLBACK=true 改回 false + dev server kill;详见 outputs/fix-chat-bubble-md-render/deliverable.md |
| [ChatPage](#chatpage) | 2026-07-03 | v0.4.1 | **markdown 列表渲染追加** — 扩 v0.4.0 加粗支持,追加 `- ` 列表渲染(per user 2026-07-03 21:59「再增加一个渲染列表格式( - )的」):① `src/utils/markdown-lite.js` 67 → 112 行(+45):顶层 list 块识别(按行 split + 检测 `^- (.+)$`,连续 `- ` 行合并为 1 个 list 段;空行作为段落分隔独立 push text `\n`;list-item 内部复用 `parseInlineMd` 解析 bold);抽取 `parseInlineMd` 内部 helper(inline 行为 0 改动,11 老 case 全部保留);新 token 形状 `Array<{ type: 'text' \| 'bold' \| 'list', ... }>` + list 嵌套 `Array<InlineSegment>`;**不**支持嵌套列表(`  - ` 当 text)/ **不**支持 ordered list(1. 2. 3.)/ **不**支持空 list-item `- `(MVP 简化);② `tests/markdown-lite.test.mjs` 73 → 195 行(+122):新增 10 个 list case(单 list / list-item 内含 bold / text+list+text 混排 / list 中断再起 / text 内含 bold + list / 空 list-item 降级 / 无空格 dash 降级 / leading-space 嵌套降级 / 列表+bold 完整链路 / 空行段落分隔)21/21 PASS + 全量 68/68 PASS 0 regression;③ `src/pages/chat/index.vue` L134-168 模板从单层 `<text>` 改 `<view>` 容器(list 段是 block 级元素,uni-app `<text>` 只能含 inline 元素,需 view + view 嵌套);新增 `v-if="seg.type === 'list'"` 分支,渲染 `<view class="md-list">` + `<view class="md-list-item">` + `<text class="md-list-bullet" aria-hidden="true">•</text>`(unicode U+2022 字符,跨端稳)+ 内部 text 含 inline bold tokens;`<template v-for>` 替代 `<block v-for>`(view+text 混合);④ `src/pages/chat/index.vue` L1620-1668 CSS 改 `.message-text`(外层 view 仅保留 font-family / font-size / line-height,white-space 移走)+ 新增 `.message-text-line`(子 text: white-space: pre-wrap + word-break: break-word)+ `.md-list` (display: block; margin: 4rpx 0)+ `.md-list-item` (display: flex; flex-direction: row; align-items: flex-start)+ `.md-list-bullet` (flex-shrink: 0; width: 28rpx 等于 font-size,1 字符宽度对齐)+ `.md-list-item-content` (flex: 1; min-width: 0 兜底 word-break);**0 触动** truncateContent / store / services / spec / api/types.ts / api/mock/*(验证临时改动已全回滚)/ 5 视图态 enum / 3 intent 路由 / onApplyPlanConfirm / onActionOptionConfirm / onMessageImageTap / 5 私有子组件 / 1 共享 ErrorBanner / PhotoGuidePage / GuideResultPage;**0 触动** Review.{ui,spec,test} + FinalStatus + Spec + Arch + Dev.status 全部保持(沿 v0.4.0 retro fix 协议);playwright H5 e2e 实测:1) navigate chat 页 + 临时改 mock reply 含 3 项列表(bold "第 1/2/3 天" + 文字)→ 发送 user msg → assistant reply 渲染拆成 1 text + 1 list(3 items,每个含 bullet • + bold 段 + text 段)+ 1 text 的 5 segment 树(per msg DOM snapshot 实测);2) 验证完 mock 改回 + USE_MOCK_FALLBACK=true 改回 false + dev server kill(grep 验证 0 命中 + lsof 5173/5174 全空);详见 outputs/fix-chat-bubble-md-render/deliverable.md v0.4.1 段 |

---

<a id="onboardingpage"></a>

## OnboardingPage — 2026-06-02 — v0.1.0

### Implemented
- `pages/onboarding/index.vue` — single-step form (welcome + 5-option grid + skip + 完成设置 + error banner + 4-state)
- `components/InterestGrid.vue` — reusable multi-select grid (v-model, `min: 1` / `max: 5`)
- `components/NextButton.vue` — reusable primary button (label / loading / disabled)
- `components/_ErrorBanner.vue` — page-private error banner with retry
- `stores/userStore.js` — Pinia store: `preferences`, `isFetchingPreferences`, `isUpdatingProfile`, `hasPreferences`, `fetchPreferences`, `updateProfile`, `clearProfile`
- `services/preferences.js` — PUT/GET /api/preferences wrapper with `ApiError` typed errors

### Supporting infrastructure (Code Style §10/§11/§13 + spec §10)
- `constants/strings.js` — `OnboardingStrings` + `OnboardingInterestOptions` (Object.freeze, 5 entries 1:1 with `api/types.ts:96`)
- `constants/colors.js` — `AppColors` Shanshui Diary palette (22 entries)
- `constants/routes.js` — `AppRoutes` (13 entries; full app surface)
- `utils/logger.js` — `logger.{info,warn,error,debug}` replacement for `console.*`

### State composition (4-state)
- `currentStep: 'interests' | 'submitting' | 'completed'` (spec §4.1, exactly 3 enum values)
- `submitError: string | null` (drives `_ErrorBanner` rendering via v-if)
- No 4th enum value added.

### Key contracts
- Field-level PUT: page sends `{ interests: [...] }` only; service wraps `user_id + preferences`; backend merges.
- 5-option enum 1:1 mapping: `'history' | 'food' | 'nature' | 'photo' | 'family'` from `api/types.ts:96`.
- Error mapping: `4000||400 → 参数不合法`; `5000||5xx → 服务器开小差`; `isNetworkError||else → 网络异常`.

### PageStatus
- `Architecture.status`: Pass
- `Development.status`: NotStarted → Completed
- `FinalStatus`: InProgress → ReadyForReview
- `Review.{ui,spec,test}`: Pending (awaiting 3 reviewers)

### Reviewer checklist anchors
- AC-01..AC-10 → spec §9
- 8 test scenarios → spec §5
- Component props/emits/slots → spec §8.1-§8.3
- Color/typography references → docs/UI风格定义.md §二/§三

---

<a id="homepage"></a>

## HomePage — 2026-06-02 — v0.1.0

### Implemented
- `pages/home/index.vue` — main tabBar page; 5 视图态(loading/diary/trips/empty/error)+ 浮层 3 按钮 + 浮动新建按钮 + 本地收藏持久化
- `components/HomeDiary.vue` — 探险日记主视图(GreetingLine + TitleLine + SpotTimeAxis + FooterBlock)
- `components/SpotTimeAxis.vue` — 横向 scroll-view 卡片列表,active 卡片 scroll-into-view 居中
- `components/SpotCard.vue` — 景点卡片 4 态(done/active/upcoming/expired)+ 改动态 changed(spec §3.1)
- `components/SpotDetailSheet.vue` — 底部浮层(slideUp 0.4s spring / slideDown 0.3s);3 按钮(导航/拍照讲解/收藏)
- `components/TripList.vue` — 行程列表容器(委托给 TripCard)
- `components/TripCard.vue` — 单条行程卡片(标题 / 城市 / 日期 / 状态徽章)
- `components/EmptyState.vue` — 空状态(插画 emoji + 标题 + 副标题 + CTA)
- `components/ReminderChip.vue` — 旅行小贴士 4 类型(weather/departure/conflict/rest)通用胶囊
- `components/_UnreadBadge.vue` — 页面私有未读数角标(count=0 不渲染)
- `stores/homeStore.js` — Pinia store: `today` / `trips` / `error` / `lastFetchedAt` + `isFetchingToday` / `isFetchingTrips`;actions: `fetchTrips` / `fetchToday` / `refreshAll` / `markSpotVisited` / `clearHome`;getters: `hasActiveOrUpcomingTrip` / `unreadCount`
- `services/home.js` — `getToday(tripId)` / `listTrips()` / `listReminders(tripId, status)` + `loadFavorites` / `saveFavorites`(task §12 本地持久化)

### Supporting infrastructure (Code Style §10 + spec §10)
- `constants/strings.js` — 新增 `HomeStrings` + `HomeItemTypeEmoji` + `HomeItemStatusLabel` + `HomeTripStatusLabel` + `HomeReminderTypeLabel`(4 个 Object.freeze 映射,1:1 对齐 `api/types.ts` 4 个枚举)

### State composition (5 态)
- `viewMode: 'loading' | 'diary' | 'trips' | 'empty' | 'error'`(spec §3.7 严格 5 枚举)
- `selectedSpot: TripItem | null` + `sheetVisible: boolean` — 浮层显隐双控
- `favoriteIds: number[]` — 本地 ref,从 `uni.storage` 读取 / 写回(`loadFavorites` / `saveFavorites`)
- `hasFetchedOnce: boolean` — 控制 viewMode 不会在 fetch 完成前跳到 error 之外的态

### Key contracts
- **trip_id 注入**(spec §6.4.3):`fetchToday` 内部先确保 trips 已加载,再从 active 中选 `start_date` 最靠近今天的 trip_id,若 trips 为空 / 无 active → short-circuit,`today = null`
- **乐观更新**(spec §7.5):`markSpotVisited` 仅改本地 store,不发起 PUT;下次 `fetchToday` 由服务端覆盖
- **错误映射**(spec §6.1 Error 表):`network→网络异常` / `4000||400→参数不合法` / `4001||404→行程不存在` / `5000||5xx→服务器开小差`
- **收藏本地持久化**(task §12):`uni.setStorageSync('favorites', [...])`,静默降级,异常时仅 logger.warn
- **状态并行**:`refreshAll` 用 `Promise.allSettled` 包裹,任一 reject 不阻塞另一 promise;任一失败 → `error` 字段写入,viewMode='error'
- **onShow 强制重拉**(spec §5.1 + §9 AC-11):tabBar 切回 / uni.reLaunch → refreshAll(无缓存命中)
- **trip_id 不在请求中**:`fetchTrips` 走 `?user_id=1` 单参,无 status(见 task 注释;spec §6.2 标注"不传 status = 返回所有")

### AC anchors (spec §9)
- AC-01 (loading + parallel fetch) → `pages/home/index.vue` L189-201 onMounted + L218-228 onShow
- AC-02 (diary + sorted cards + active center) → `components/HomeDiary.vue` L60-69 sortedItems + `components/SpotTimeAxis.vue` L101-118 scrollIntoId
- AC-03 (sheet slideUp) → `components/SpotDetailSheet.vue` L325-329 sheetSlideUp keyframes
- AC-04 (3 buttons) → `pages/home/index.vue` L327-373 (onNavigate/onGuide/onToggleFavorite)
- AC-05 (trips + start_date asc) → `pages/home/index.vue` L186-196 sortedTrips
- AC-06 (empty + CTA) → `pages/home/index.vue` L102-114
- AC-07 (error + retry) → `pages/home/index.vue` L116-123 + L255-260 onRetry
- AC-08 (mark visited optimistic) → `stores/homeStore.js` L228-247 markSpotVisited
- AC-09 (Shanshui palette) → 全局 `AppColors` 引用
- AC-10 (44pt tap area) → 各按钮 `min-height: 88rpx` (88rpx = 44pt)
- AC-11 (tabBar re-fetch) → `pages/home/index.vue` L218-228 onShow
- AC-12 (no leak + logger) → `pages/home/index.vue` L231-237 onUnmounted

### PageStatus
- `Architecture.status`: Pass
- `Development.status`: NotStarted → Completed
- `FinalStatus`: InProgress → ReadyForReview
- `Review.{ui,spec,test}`: Pending (awaiting 3 reviewers)

### Reviewer checklist anchors
- AC-01..AC-12 → spec §9
- 8 test scenarios → spec §5
- Component props/emits/slots → spec §8.1-§8.10
- Color/typography references → docs/UI风格定义.md §二/§三/§七/§八
- NFR (44pt / 4-state / 5 视图态) → spec §10 + §3.7
- tap area 88rpx = 44pt:OnboardingPage ui-reviewer 经验复用

---

<a id="spotdetailsheet"></a>

## SpotDetailSheet — 2026-06-02 — v0.1.0

### Implemented
- `pages/spot-detail-sheet/index.vue` — 独立 route 浮层详情页(uni.navigateTo 拉起,支持深链 `?spotId=xxx`);4 视图态(loading/sheet/notfound/error);3 按钮 emit 接 `onNavigate` / `onGuide` / `onToggleFavorite`;`onSheetClose` 走 `uni.navigateBack({delta:1, fail: reLaunch Home})`;`_ErrorOverlay` 兜底
- `pages/spot-detail-sheet/components/_ErrorOverlay.vue` — 页面私有错误兜底;3 prop(`type` 驱动 icon/title / `message` / `buttonLabel`)+ 1 emit(`action`);type 映射:`notfound → ⚠️` / `error → 📡` / `empty → 📭`(预留扩展)

### 复用决策:先 refactor 再复用(spec §10 R-1~R-9 强制清单)
- `constants/strings.js` — 新增 `SpotDetailSheetStrings`(13 键:7 浮层文案 + 1 时间分隔符 + 6 错误兜底 + 1 loading)+ 重命名 `HomeItemTypeEmoji` → `ItemTypeEmoji`(5 键:4 ItemType + 1 `default` 兜底,合并原 `HomeStrings.typeEmojiDefault` 进 `ItemTypeEmoji.default`,对齐 spec R-2 "5 个映射" 字面;调用方 `ItemTypeEmoji[item_type] || ItemTypeEmoji.default` 即拿 fallback)
- `components/SpotDetailSheet.vue` — imports 改 `SpotDetailSheetStrings, ItemTypeEmoji`(per R-4);computed 7 处 string + 1 处 emoji(`ItemTypeEmoji.default` 兜底)+ 1 处 timeRangeSeparator 同步更新(per R-5/R-6);**视觉/动效/Props/Emits 完全不变**,HomePage 浮层调用点无回归
- `components/SpotCard.vue` — imports 改 `ItemTypeEmoji`(1 处)+ computed 1 处(per R-3 "全项目 grep 替换" 路径,行为不变;`ItemTypeEmoji.default` 替代原 `HomeStrings.typeEmojiDefault` 兜底)

### 未触动(spec §7.1 / §10 不变量)
- `stores/homeStore.js` — **不修改**;**不新增** `getSpotById(spotId)` 派生 getter(per §7.1 YAGNI);页面用 `today.today_items.find()` 自取
- `services/home.js` — 复用既有 `loadFavorites` / `saveFavorites`,不改
- `constants/routes.js` — `AppRoutes.SpotDetailSheet` 已预声明,不改
- 14 个 Other Page 块(Login / Onboarding / Home / NewTrip / TripDetail / EditTrip / PhotoGuide / GuideResult / My / PersonalProfile / StyleSetting / NotificationSetting / Trash / TripPrepare / About)— 全部未动
- `pages.json` — **未创建**(项目约定不创,见 decision-revise-cycle-3.json "pages.json 留后续";`AppRoutes` 已有路径但 uni-app manifest 需 AppShell 落地,在 deliverable §3 显式登记)

### State composition (4 视图态)
- `viewMode: 'loading' | 'sheet' | 'notfound' | 'error'`(spec §3.4 严格 4 枚举,与 spec §10 4 态语义一致)
- `spotId: number | null` — 解析自 URL `?spotId=xxx`,`Number.isFinite(n) && n > 0` 判定为有效,否则 null
- `selectedSpot: TripItem | null` — 从 `homeStore.today.today_items.find()` 派生
- `favoriteIds: number[]` — 本地 ref,从 `uni.storage 'favorites'` 同步
- `watch(() => store.today)` + `watch(() => store.error)` — 双 watcher 触发 viewMode 重新决策(fetchAndDecide 完成时)

### 视图决策算法(spec §5.4 伪代码)
```
if (!Number.isFinite(spotId) || spotId <= 0) → 'notfound'
if (store.today) { target = today_items.find(...); if (target) → 'sheet' else → 'notfound' }
if (store.isFetchingToday) → 'loading'
if (store.error) → 'error'
else → 'loading' (cold-start deep-link → refreshAll)
```

### Key contracts
- **复用 + Refactor**(spec §10 R-1~R-9):components/SpotDetailSheet.vue 原 imports 硬编码 `HomeStrings, HomeItemTypeEmoji` → 改为 `SpotDetailSheetStrings, ItemTypeEmoji`;HomePage 浮层调用点(`pages/home/index.vue:118-125`)`@close/@navigate/@guide/@toggle-favorite` 全部沿用
- **onLoad 兼容**:本工程未在 package.json 显式列 `@dcloudio/uni-app`,`onLoad` 钩子改用 `onMounted` + `getCurrentPages()` 末项 `options` 兜底读 query(spec §4.3 解析规则不变)
- **收藏本地持久化**:复用 HomePage 同款逻辑(`services/home.js:loadFavorites/saveFavorites` + `uni.setStorageSync`),跨页共享 storage
- **错误兜底分支**:`notfound` 触发 `uni.reLaunch({url: AppRoutes.Home})`;`error` 触发 `viewMode='loading'` + 再调 `store.refreshAll()`
- **关闭路径**:组件内部 4 关闭路径(蒙层 / 拖动 / ✕ / 系统返回)→ emit close → 父页面 `onSheetClose` → `uni.navigateBack({delta:1, fail: reLaunch Home})`;`onUnmounted` 兜底重置 selectedSpot / viewMode / favoriteIds
- **缓存策略**(spec §5.1 备注):常规入口(从 HomePage / TripDetailPage 跳来)由上游 `onShow` / `onLoad` 已触发 refreshAll,本页面挂载时缓存命中,几乎不进入 loading;冷启动深链(push 通知 / 外部链接)→ store.today 为 null → 本页面主动 fetch

### AC anchors (spec §9)
- AC-01 (slideUp + 完整浮层) → `pages/spot-detail-sheet/index.vue` sheet 分支 + `components/SpotDetailSheet.vue` slideUp keyframes
- AC-02 (3 按钮) → `pages/spot-detail-sheet/index.vue` onNavigate / onGuide / onToggleFavorite
- AC-03 (4 关闭路径) → `components/SpotDetailSheet.vue` onClose 内部 + DragHandle click + CloseButton + mask + 父 onSheetClose → uni.navigateBack
- AC-04 (URL 缺参/非数字 → notfound) → parseQuery + decideViewMode
- AC-05 (URL 有 spotId 但找不到 → notfound) → decideViewMode
- AC-06 (冷启动 fetch) → fetchAndDecide + initialize
- AC-07 (收藏激活态 + 跨页同步) → isCurrentSpotFavorited + onToggleFavorite
- AC-08 (today cleared mid-flight 保持 sheet) → selectedSpot 固定不动(无 watch clear 逻辑)
- AC-09 (Shanshui 调色板) → 全局 `AppColors` 引用(经由 _ErrorOverlay + SpotDetailSheet)
- AC-10 (4 端兼容 + Esc 关闭) → `components/SpotDetailSheet.vue` 已设 `aria-modal="true"`
- AC-11 (onUnmounted 重置) → onUnmounted
- AC-12 (logger 6 关键事件) → navigate / guide / toggleFavorite / close / errorAction / refreshAll 全部 logger.info/warn

### PageStatus
- `Architecture.status`: Pass
- `Development.status`: NotStarted → Completed
- `FinalStatus`: NotStarted → ReadyForReview
- `Review.{ui,spec,test}`: Pending (awaiting 3 reviewers)
- **2026-06-04 retro fix** — 跨页节流 (per `CrossPage/Throttle-001.md`): `onErrorAction` 加 `isRetrying` 互斥锁 + 私有 `_ErrorOverlay` retry emit 节流 300ms;0 改动既有 Review 状态,符合 retro fix 协议(0 触发 reviewer 重审 + 0 关闭 Issue + 0 改动 spec)

---

<a id="newtrippage"></a>

## NewTripPage — 2026-06-03 — v0.1.0

### Implemented
- `pages/new-trip/index.vue` — 独立 route 化表单页(非 TabBar);6 视图态(input/analyzing/form/submitting/completed/error)互斥 v-if 切换;7 字段表单(city / start_date / end_date / companions / budget_range / transport_preference / special_needs),3 必填 + 4 选填;草稿 `_DraftConfirmDialog` 3 按钮弹窗
- `pages/new-trip/components/_DraftConfirmDialog.vue` — 页面私有 3 按钮 modal(不保存 / 继续编辑 / 保存草稿);`fadeIn 0.2s + slideUp 0.3s ease-spring` 动效;3 emit + 蒙层点击 = 不保存
- `services/trips.js` — 新建(项目首个 trips service);`createTrip(req)` POST `/api/trips`(内部注入 `user_id=1`,5 字段 1:1 对齐 `api/types.ts:CreateTripRequest`)+ `loadDrafts()` / `saveDraft(draft)` 本地 storage 草稿持久化(沿用 `services/home.js:loadFavorites/saveFavorites` 模式);复用 `services/preferences.js:ApiError` class + `mapSuccess/mapFail` helper
- `pages.json` — 新增 `pages/new-trip/index` 路由注册(项目第 4 个 page);style 沿用 onboarding/home 的 custom + `#FDFBF7/#F7F3EC`
- `constants/strings.js` — 新增 `NewTripStrings` 段(48 键:7 字段 label + 3 placeholder + 4 transport chips + 4 needs chips + 6 错误兜底 + 6 草稿弹窗文案 + 顶栏/分析态/表单头/提交文案 16 键);新增 `NewTripTransportOptions` / `NewTripNeedsOptions` 2 份 Object.freeze 映射(spec §10 C-1 强约束)

### 复用决策(spec §3.6 + §10 R-1~R-9 模式)
- **复用**:AppColors / AppRoutes.NewTrip(已预声明 L24)/ NewTripStrings / useHomeStore.fetchTrips()(POST 成功后刷新列表,本页面不直接调 services/home.listTrips)/ _ErrorBanner(3 必填校验失败提示,retryable=false)/ ApiError(从 services/preferences.js import)
- **新建**:pages/new-trip/index.vue + 1 私有组件 _DraftConfirmDialog.vue
- **不复制**:NextButton / SpotDetailSheet(本页面双按钮,非单一 CTA)/ EmptyState / TripCard
- **不修改**:stores/homeStore.js / services/home.js / services/preferences.js / constants/colors.js / components/_ErrorBanner.vue(per §3.6 强约束)

### State composition (6 视图态)
- `currentStep: 'input' | 'analyzing' | 'form' | 'submitting' | 'completed' | 'error'`(spec §3.7 严格 6 枚举)
- `inputText: string` + `attachedFiles: Array<{name, size, path}>` — input 态原始输入
- `formData: NewTripFormData` — 7 字段表单(analyzing 完成后从正则填充,用户可改)
- `submitError: string | null` — POST 失败的友好提示,驱动 error 态
- `formSubmitError: string | null` — form 内部 3 必填校验失败提示,驱动 _ErrorBanner(retryable=false)
- `dialogVisible: boolean` — 草稿弹窗显隐
- `hasContent: computed` — 是否有内容(inputText + files + formData 任一非空),驱动取消时弹窗决策
- `hasRequiredFields: computed` — 3 必填是否都已填(form 态点「确认」前校验)

### 视图决策算法(spec §5.5 + §5.2)
```
input 态:onLoad 初始化;点「确定」+ 有内容 → analyzing(1.5-2.5s setTimeout)
analyzing 态:setTimeout 回调 + guard `if (currentStep !== 'analyzing') return` 防止 spec §5.3.L 描述的"快速来回切"竞态;正则提取 city / YYYY-MM-DD / M月D日 → formData;切 form
form 态:7 字段 + 缺失标红 *;点「确认」+ 3 必填校验通过 → submitting;否则 formSubmitError + 保持 form
submitting 态:createTrip() 飞行中;无「取消」按钮;成功 → completed 瞬时 200ms → reLaunch TripDetail?tripId=xxx
completed 态:✓ + "创建成功!";200ms 后 setTimeout → homeStore.fetchTrips() 刷新 + uni.reLaunch
error 态:⚠ + submitError 友好提示 + 「重试」按钮;点 retry → 重新 submit(formData 保留)
```

### Key contracts
- **AI 模拟前端 setTimeout**(spec §6.4.1 + §5.5):`setTimeout(1500 + Math.random() * 1000)` 1.5-2.5s 随机延迟;极简正则(去|飞|玩|在 + 1-3 中文字符 / YYYY-MM-DD / M月D日)提取 city + dates;提取不到 → 字段留空 + 标红;**不**调任何 API;**不**提议扩 API 文档
- **4 选填字段 client-only**(spec §6.4.2):UI 保留 7 字段展示;POST 只传后端支持的 5 字段(`title` 派生 + `city` + `start_date` + `end_date`,`user_id=1` 由 service 注入);`companions / budget_range / transport_preference / special_needs` **不**入参,随 currentStep='completed' 销毁
- **草稿本地 storage**(spec §6.4.3):key = `trip_drafts`,value = `TripDraft[]`;取消时 `_DraftConfirmDialog` 选「保存草稿」→ `saveDraft({id: Date.now(), created_at: ISO, inputText, attachedFiles, formData})` → Toast + reLaunch Home;选「不保存」→ reLaunch Home;选「继续编辑」→ 关闭弹窗 + currentStep='input';**不**调后端 API
- **title 派生**(spec §6.4.4):`${city} ${start_date} - ${end_date} ${dayCount}天游`(如 `大连 2026-07-01 - 2026-07-03 3天游`);city 缺失但有日期 → `Trip ${start_date} - ${end_date}` 兜底;两者都缺失 → 派生失败,POST 不会发起(3 必填校验已拦)
- **错误归一**(spec §5.3 D-G):`mapErrorToMessage(err)` → 4000||400→参数不合法 / 5000||5xx→服务器开小差 / 4001||404→系统错误 / 其它(含 isNetworkError)→网络异常;**不**暴露后端 stack
- **复用 homeStore.fetchTrips()**(spec §7.3):POST 成功后 `await homeStore.fetchTrips()` 刷新首页列表;失败仅 logger.warn 不阻塞 reLaunch
- **onUnmounted**:clearAnalyzingTimer + logger.debug;不重置 formData(由 Vue 自动 GC)

### AC anchors (spec §9)
- AC-01 (input 态进场 + fadeSlideUp 0.45s) → `pages/new-trip/index.vue` `.newtrip-page` animation
- AC-02 (空 inputText + 空 files → Toast 不切 analyzing) → `onSubmit` early-return + uni.showToast
- AC-03 (analyzing 1.5-2.5s + 正则提取 city/dates + logger.info) → `onSubmit` setTimeout + `extractFormDataFromText`
- AC-04 (form 7 字段 + 缺失标红 + transport radio 4 选 1 + needs checkbox 多选) → template `v-if="currentStep === 'form'"` 分支
- AC-05 (3 必填实时标红) → `v-if="!formData.city"` + 类似 start_date / end_date
- AC-06 (3 必填校验失败 → formSubmitError + _ErrorBanner + 保持 form) → `onConfirm` early-return + `<_ErrorBanner v-if="formSubmitError" :retryable="false" />`
- AC-07 (form 确认 → submitting + 无取消) → `currentStep = 'submitting'` + template 隐藏 btn-cancel
- AC-08 (POST 成功 → completed 200ms + fetchTrips + reLaunch TripDetail) → `submitTripRequest` setTimeout 200ms
- AC-09 (POST 失败 → error 态 + 重试) → catch `submitError` + `onRetry` 重新 submitTripRequest
- AC-10 (取消 → 草稿弹窗 3 选项) → `onCancel` hasContent 分支 + `onDialogSave/DontSave/Continue`
- AC-11 (「2026-08-15 到 2026-08-20 去青岛」 → 提取 city=青岛 + dates + POST 5 字段) → `extractFormDataFromText` 优先 YYYY-MM-DD 分支
- AC-12 (Shanshui 调色板) → 全局 AppColors 引用
- AC-13 (4 端兼容 + 44pt 触达 88rpx) → 全按钮 min-height: 88rpx
- AC-14 (logger 6 关键事件 + 无 console.*) → utils/logger.js 引用,无 console 调用

### PageStatus
- `Architecture.status`: Pass(2026-06-03 01:55,orchestrator override)
- `Development.status`: NotStarted → Completed
- `FinalStatus`: NotStarted → ReadyForReview
- `Review.{ui,spec,test}`: Pending (awaiting 3 reviewers)

### Reviewer checklist anchors
- AC-01..AC-14 → spec §9
- 6 视图态决策 / 视图决策算法 → spec §3.7 + §5.2 + §5.5
- 6 条软观察(arch 留档)→ issues/Arch/NewTripPage-001.md 末尾
  - OBS-1: 4 选填字段草稿恢复一致性 — 按 spec §4.3 全文持久化 formData(含 4 选填),完成后 currentStep='completed' 时销毁草稿
  - OBS-2: AI 模拟 setTimeout 体感 — spec 不强制,不实现
  - OBS-3: _DraftConfirmDialog 后续抽 components/ — MVP YAGNI,保持 pages/new-trip/components/ 私有
  - OBS-4: 草稿 LRU — TrashPage 接管,本页面不实现
  - OBS-5: POST retry 节流 — MVP 简化,3 秒防抖未实现(spec 不强制)
  - OBS-6: HomePage 「+」按钮 cross-page 契约 — 复用 `AppRoutes.NewTrip`,HomePage §3.4 已对齐

---

<a id="tripdetailpage"></a>

## TripDetailPage — 2026-06-03 — v0.1.0

### Implemented
- `pages/trip-detail/index.vue` — 独立 route 化详情页(uni.navigateTo 拉起,支持深链 `?tripId=xxx`);4 视图态(`loading` / `detail` / `notfound` / `error`)互斥 v-if 切换;`detail` 内嵌套 5 子态矩阵(`inProgress` / `upcoming` / `expired` / `finished` / `draft`);_TripHeader 信息卡块 + _DayList 行程日块列表 + Sticky _ActionBar(修改/删除);reLaunch TrashPage 软删除
- `pages/trip-detail/components/_DeleteConfirmDialog.vue` — 页面私有 2 按钮删除确认弹窗(`visible` / `title` / `message` / `btnCancelLabel` / `btnConfirmLabel` / `confirming` 6 props;`cancel` / `confirm` 2 emits);`fadeIn 0.2s + slideUp 0.3s ease-spring` 动效;`confirming=true` 时按钮置灰 + 文案改为「删除中...」;蒙层点击 = 取消
- `services/trips.js` — 增量 `getTripDetail(tripId)` + `deleteTrip(tripId)`(项目已落地 createTrip / loadDrafts / saveDraft 之上,2 函数;复用 `ApiError` class + `mapSuccess/mapFail` helper,**不**复制代码)
- `pages.json` — 新增 `pages/trip-detail/index` 路由注册(项目第 5 个 page);style 沿用 onboarding/home/new-trip 的 custom + `#FDFBF7/#F7F3EC`,`navigationBarTitleText: '行程详情'`
- `constants/strings.js` — 新增 `TripDetailStrings` 段(38 键:顶栏 2 / 加载 1 / 5 子态徽章 5 / 倒计时 5 / 操作按钮 4 / 删除弹窗 5 / 删除 Toast 2 / 空 day 2 / 不可用占位 3 / 错误兜底 4 / H5 aria 1 / 时间格式 2)+ `TripDetailWeekdays`(`Object.freeze` 7 键,0=周日 ~ 6=周六)+ `TripDetailStatusLabel`(`Object.freeze` 5 键,1:1 对齐 currentSubStatus 5 枚举)

### 复用决策(spec §3.6 + §10 R-1~R-3 强制清单)
- **复用 ⭐ 零修改**:components/SpotCard.vue(单 item 卡片 4 态视觉,emit tap)/ components/SpotDetailSheet.vue(景点详情浮层 4 emit)/ components/_ErrorBanner.vue(viewMode='error' 兜底,沿用 OnboardingStrings.retry)/ stores/homeStore.fetchTrips()(deleteTrip 成功后刷新列表)/ services/preferences.ApiError(import 到 services/trips.js)/ AppColors / AppRoutes
- **新建 🟦**:pages/trip-detail/index.vue + pages/trip-detail/components/_DeleteConfirmDialog.vue
- **不复制**:components/EmptyState.vue(本页面用 inline _NotFoundOverlay,沿用 _ErrorOverlay 形态)/ components/SpotTimeAxis.vue(横向 scroll-view 容器,本页面 day 列表纵向排列,语义不同)/ components/TripCard.vue(单 trip 列表卡片,本页面展示详情)/ components/TripList.vue(列表容器)/ components/HomeDiary.vue(探险日记专用)/ components/NextButton.vue(单 CTA 场景)/ components/_UnreadBadge.vue(HomePage 私有)
- **MVP 不渲染**:_ReminderStrip(spec §3.7 决策,**不**调 GET /api/reminders,避免幽灵组件 + 假数据)
- **不修改**:stores/homeStore.js(本页面只读 + 调 fetchTrips)/ services/home.js / services/preferences.js / constants/colors.js / constants/routes.js(spec §3.6 强约束)

### State composition (5 视图态 = 4 主态 × 3 子态)
- `viewMode: 'loading' | 'detail' | 'notfound' | 'error'`(spec §3.9 严格 4 枚举)
- `currentSubStatus: 'inProgress' | 'upcoming' | 'expired' | 'finished' | 'draft'`(spec §3.4 5 枚举,detail 内派生)
- `tripId: number | null` — 解析自 URL `?tripId=xxx`,`Number.isFinite(n) && n > 0` 判定为有效,否则 null
- `trip: Trip | null` — 拉取成功后的全量(含 days[].items[])
- `days: TripDay[]` — 冗余于 trip.days,方便 v-for(避免 trip=null 时报错)
- `selectedSpot: TripItem | null` — 浮层选中项
- `dialogVisible: boolean` — 删除确认弹窗显隐
- `isDeleting: boolean` — deleteTrip 飞行中(给 uni.showLoading + 按钮置灰用)
- `error: ErrorInfo | null` — 拉取/删除失败的友好提示(`type` / `message` / `cause` / `occurredAt`)

### 视图决策算法(spec §5.4)
```
URL 校验第一:!Number.isFinite(tripId) || tripId <= 0 → 'notfound'
拉取成功: trip.status === 'deleted' → 'notfound';否则 → 'detail'
error.type === 'notfound' → 'notfound';其他 error → 'error'
其他情况 → 'loading'

子态派生:finished(后端 status) > draft > active × 日期交叉
  status='active' + now < start_date → 'upcoming'
  status='active' + now > end_date → 'expired'
  status='active' + start ≤ now ≤ end → 'inProgress'

item 5 态映射:finished sub → 全 expired;item.status='done'→done;'changed'→changed;'skipped'→expired;
  按时间交叉:active / upcoming / expired
```

### Key contracts
- **复用 services/trips.getTripDetail(tripId) + deleteTrip(tripId)**(spec §7.2):GET/DELETE `/api/trips/{trip_id}?user_id=1`;内部注入 `user_id=1`,页面不感知;复用 `ApiError` class + `mapSuccess/mapFail` helper
- **修改入口跳 EditTripPage**(spec §6.4.3):BtnModify → `uni.navigateTo({url: AppRoutes.EditTrip + '?tripId=' + tripId})`,**不**调 PUT
- **删除后跳 TrashPage**(spec §3.3 + §5.3.G):`uni.reLaunch({url: AppRoutes.Trash})` 而**非**回 HomePage — 让用户**直接看到**它已被移入回收站;`await homeStore.fetchTrips()` 在 reLaunch 之前完成(失败仅 warn,不阻塞,见 §5.3.I)
- **删除失败 ≠ 详情拉取失败**(spec §5.3.H):deleteTrip 错误走 Toast,viewMode 保持 'detail'(详情仍可看),**不**切 error 态
- **onShow 重新拉取**(spec §5.3.C):从 EditTripPage 返回时刷新最新数据(避免修改后看到陈旧内容)
- **onLoad 兼容**(沿用 SpotDetailSheet 模式):`onMounted` + `getCurrentPages()` 末项 `options` 兜底读 query(本工程未在 package.json 显式列 @dcloudio/uni-app)
- **onUnmounted 兜底**(spec §5.5):selectedSpot=null / dialogVisible=false / isDeleting=false;不重置 trip(由 Vue 自动 GC)
- **H5 ≥1024px 居中**(spec §10 NFR):`@media (min-width: 1024px) { .trip-header / .day-list / .state-error / .state-notfound { max-width: 640rpx; margin: 0 auto; } }`;移动端零变化
- **44pt 触达 88rpx**(spec §10 NFR):Header back 88rpx / ActionBar modify 88rpx / ActionBar delete 88rpx / NotFound button 88rpx / _DeleteConfirmDialog 2 按钮 88rpx
- **finished 子态置灰 50%**(spec §3.4 + §5.3.L + §9 AC-10):`isActionsDisabled` 控制 modify / delete 按钮 `.action-bar-btn-disabled { opacity: 0.5; pointer-events: none; }`;`logger.info` 记录

### AC anchors (spec §9)
- AC-01 (loading + GET 飞行中) → `pages/trip-detail/index.vue` state-loading 分支 + `fetchTripDetail` async
- AC-02 (detail + _TripHeader + _DayList + 进度条 + 倒计时) → `pages/trip-detail/index.vue` detail 分支 + `formatMonthDay` + `dateRangeText` computed
- AC-03 (SpotCard + 4 态 + 浮层) → `pages/trip-detail/index.vue` day-item-list v-for + `onSpotTap` + SpotDetailSheet 浮层
- AC-04 (修改入口) → `pages/trip-detail/index.vue` `onModifyClick` + `uni.navigateTo(EditTrip)`
- AC-05 (删除确认弹窗) → `pages/trip-detail/index.vue` `onDeleteClick` + `_DeleteConfirmDialog` 弹窗
- AC-06 (deleteTrip 飞行中 + Success/Failure) → `pages/trip-detail/index.vue` `onDialogConfirm` async + `uni.showLoading` / `uni.hideLoading` / `uni.showToast` / `uni.reLaunch(Trash)`
- AC-07 (URL 缺参/非数字 → notfound) → `parseQuery` 校验 + `decideViewMode` 第一行
- AC-08 (URL 有 tripId 但 trip 404 / status='deleted' → notfound) → `fetchTripDetail` res.data.status === 'deleted' 分支 + buildErrorInfo notfound type
- AC-09 (5xx / 4xx / network → error + 重试) → `fetchTripDetail` catch + `onRetry` 重调
- AC-10 (finished 子态按钮置灰 50%) → `isActionsDisabled` computed + `.action-bar-btn-disabled` 样式
- AC-11 (inProgress 进度条 + 倒计时) → `progressPercent` computed + `countdownText` computed
- AC-12 (Shanshui 调色板) → 全局 AppColors 引用 + Noto Serif SC / Noto Sans SC
- AC-13 (4 端兼容 + 44pt 触达) → 全按钮 min-height: 88rpx
- AC-14 (logger 关键事件 + 无 console.*) → utils/logger.js 引用,无 console 调用

### PageStatus
- `Architecture.status`: Pass(2026-06-03 09:35)
- `Development.status`: NotStarted → Completed
- `FinalStatus`: NotStarted → ReadyForReview
- `Review.{ui,spec,test}`: Pending (awaiting 3 reviewers)
- **2026-06-04 retro fix** — 跨页节流 (per `CrossPage/Throttle-001.md`): `onRetry` 加 `isRetrying` 互斥锁 + 共享 `_ErrorBanner` retry emit 节流 300ms;0 改动既有 Review 状态,符合 retro fix 协议(任务原文"5/5 满足状态"隐含假设与实际 NotStarted 状态偏差已登记 deliverable §3)

### Reviewer checklist anchors
- AC-01..AC-14 → spec §9
- 4 视图态 + 5 子态矩阵 → spec §3.4 + §3.9 + §5.1 + §5.3 + §5.4
- 13 个异常流程(URL 解析 / 资源不存在 / onShow 重拉 / deleteTrip Success/Failure/二次失败 / 蒙层关闭 / 系统返回手势 / finished 灰色 / draft 视觉 / 空 day 兜底)→ spec §5.3
- 3 决策算法(decideViewMode / decideSubStatus / mapItemState)→ spec §5.4
- 复用决策矩阵 → spec §3.6
- NFR (44pt / 4 视图态 / H5 ≥1024px) → spec §10
- 6 条 arch 软观察 → issues/Arch/TripDetailPage-001.md 末尾

---

<a id="edittrippage"></a>

## EditTripPage — 2026-06-03 — v0.1.0

### Implemented
- `pages/edit-trip/index.vue` — 独立 route 化编辑页(uni.navigateTo 拉起,深链 `?tripId=xxx`);6 视图态(`loading` / `editing` / `saving` / `success` / `notfound` / `error`)互斥 v-if 切换;8 字段表单(title 可改 + city/dates 灰色 disabled + 4 选填 client-only + status 3 chips 必填)+ 取消/保存 双按钮 + 草稿弹窗;PUT 成功后 navigateBack(保留 stack)→ TripDetailPage.onShow 自动 re-fetch
- `pages/edit-trip/components/_DraftConfirmDialog.vue` — 页面私有 3 按钮草稿弹窗(`visible` / `title` / `message` / `btnSaveLabel` / `btnDontSaveLabel` / `btnContinueLabel` 6 props;`save` / `dontSave` / `continue` 3 emits);与 NewTripPage 形态完全一致(spec §10 R-3 不抽公共,MVP YAGNI)
- `services/trips.js` — 增量 `updateTrip(tripId, req)`(PUT /api/trips/{id},严格 2 字段约束,内部 `data: { user_id: MVP_USER_ID, ...req }` 注入 user_id)+ `loadEditDraft(tripId)` / `saveEditDraft(draft)` / `clearEditDraft(tripId)` 3 个编辑草稿函数(独立 storage key `edit_trip_drafts` keyed by tripId,与 NewTripPage `trip_drafts` 列表结构隔离);复用 `ApiError` class + `mapSuccess/mapFail` helper,**不**复制代码
- `pages.json` — 新增 `pages/edit-trip/index` 路由注册(项目第 6 个 page);style 沿用 onboarding/home/new-trip/trip-detail 的 custom + `#FDFBF7/#F7F3EC`,`navigationBarTitleText: '编辑行程'`(与 `EditTripStrings.title` 对齐)
- `constants/strings.js` — 新增 `EditTripStrings` 段(25 键:顶栏 2 / 加载 1 / 表单头 2 / 字段 8 状态 1 + 3 chips label 3 / 提交按钮 2 / 提交态 1 / 完成态 1 / Toast 3 / 草稿恢复 1 / 不可用占位 3 / 错误兜底 5 / H5 aria 1)+ `EditTripStatusOptions`(`Object.freeze` 3 键数组,1:1 对齐 `api/types.ts:57` TripStatus 4 枚举 - 1(`deleted` 不开放编辑))+ `NewTripStrings` 段**新增** `fieldTitle: '行程标题'` 1 个 key(本规格 §10 C-3 触发)

### 复用决策(spec §3.6 + §10 R-1~R-3 强制清单)
- **复用 ⭐ 零修改**:`AppColors` / `AppRoutes.EditTrip`(已预声明 `constants/routes.js:25`)/ `AppRoutes.Home` / `useHomeStore.fetchTrips()`(PUT 成功后刷新列表)/ `services/preferences.ApiError`(services/trips.js import)/ `_ErrorBanner`(form 内部 2 必填校验失败提示,`retryable=false`)/ `OnboardingStrings.retry`(「重试」按钮文案)/ `TripDetailStatusLabel`(_FormHeader 状态徽章,沿用 TripDetailPage 配色矩阵)/ `NewTripStrings.fieldCity` / `fieldStartDate` / `fieldEndDate` / `fieldCompanions` / `fieldBudget` / `fieldTransport` / `fieldNeeds` / `placeholderCity` / `placeholderCompanions` / `placeholderBudget` / `draftDialogXxx` / `draftSave` / `draftSavedToast` / `draftSaveFailedToast` / `errorXxx` / `errorRequired`(**完全复用 24 个 key,字面值 0 重复定义,沿用 NewTripPage §10 R-2 强约束**)/ `NewTripTransportOptions`(4 选 1 radio chips)/ `NewTripNeedsOptions`(本页面 type 留位,template 不渲染 8 字段表内只放 Field 7=transport_preference,见 §3.4 表格权威源)
- **新建 🟦**:`pages/edit-trip/index.vue` + `pages/edit-trip/components/_DraftConfirmDialog.vue`
- **不复制**:`components/EmptyState.vue`(本页面用 inline _NotFoundOverlay)/ `components/NextButton.vue`(单 CTA 场景,本页面双按钮)/ `components/SpotDetailSheet.vue`(浮层专用)/ `components/SpotCard.vue`(无景点列表)
- **MVP 不渲染**:`special_needs` 字段(spec §3.4 8 字段表内不占位,仅在 `EditTripFormData` type 留位 — 8 字段表权威源 §3.4 L191-199 显式列 8 字段;spec §4.1 type 同时列 8 字段 + `special_needs` 但 UI 不渲染;后续若扩,issue-manager 提议加 Field 9 chips)
- **不修改**:`stores/homeStore.js`(本页面只读 + 调 `fetchTrips`)/ `services/home.js` / `services/preferences.js` / `constants/colors.js` / `constants/routes.js`(spec §3.6 强约束)

### State composition (6 视图态)
- `currentStep: 'loading' | 'editing' | 'saving' | 'success' | 'notfound' | 'error'`(spec §3.7 + §4.1 严格 6 枚举)
- `tripId: number | null` — 解析自 URL `?tripId=xxx`,`Number.isFinite(n) && n > 0` 判定为有效,否则 `currentStep='notfound'`
- `trip: Trip | null` — GET 响应的原始数据(用于 _FormHeader 状态徽章派生)
- `formData: EditTripFormData` — 8 字段表单(GET 拉取后从 trip 派生预填,用户可改)
- `originalData: EditTripFormData` — 预填 snapshot,用于 diff 判定(hasChanged / isCityOrDateChanged)
- `submitError: string | null` — GET / PUT 失败的友好提示,驱动 _ErrorOverlay 整页面板
- `formError: string | null` — form 内部 2 必填校验失败提示,驱动 _ErrorBanner(沿用 NewTripPage `formSubmitError` 双错误字段语义分离)
- `dialogVisible: boolean` — 草稿弹窗显隐
- `draftRestored: boolean` — 是否已自动恢复过该 trip 的本地草稿(避免 GET 响应覆盖)
- `hasChanged: computed` — formData 与 originalData 任一字段不同(取消时弹草稿判定)
- `isCityOrDateChanged: computed` — city / start_date / end_date 任一不同(per §6.4.1 PD-001)
- `hasRequiredFields: computed` — title.trim() !== '' && status !== null
- `canSave: computed` — `currentStep='editing' && hasRequiredFields && !isCityOrDateChanged`

### 视图决策算法(spec §5.5 + §5.1 + §5.2)
```
onMounted:
  → getCurrentPageOptions() → 解析 ?tripId
  → 若 bad tripId(非数字 / <=0): currentStep='notfound',不发起任何 fetch
  → 否则: 检查 edit_trip_drafts[tripId] 草稿
     - 若有: formData = draft.formData + originalData = draft.formData + draftRestored=true + Toast「已恢复」
     - 若无: 准备 GET 飞行中再预填
  → currentStep='loading'
  → 调 getTripDetail(tripId):
     - Success (code: 0 + data 形如 Trip):
         trip = data
         若 !draftRestored: formData = fromTrip(trip) + originalData = fromTrip(trip)
         currentStep='editing'
     - 404/4001/trip.status='deleted': currentStep='notfound'
     - 5xx/5000/4000/network: submitError = mapError(err) + currentStep='error'
editing 态:
  → 字段 2-4 (city / start_date / end_date) disabled 灰色不可改
  → 字段 5-7 (companions / budget_range / transport_preference) client-only 可改
  → 字段 1 (title) / 字段 8 (status) 必填,缺失标红
  → hasChanged / isCityOrDateChanged / hasRequiredFields 自动派生
  → canSave = editing 态 + 2 必填 + city/dates 未变
  → 用户点「保存」:
     校验 1: title/status 必填? 失败 → formError + 保持 editing(AC-06)
     校验 2: isCityOrDateChanged? 失败 → Toast「暂不支持修改城市/日期」+ 保持 editing(AC-07)
     校验通过 → currentStep='saving' + formError=null + submitError=null
     buildUpdateRequest() 仅发 changed 字段(title / status 至少 1)
saving 态:
  → 调 updateTrip(tripId, req)
     - Success (code: 0 + data.updated=true):
         currentStep='success' + submitError=null
         200ms 后: clearEditDraft(tripId) + homeStore.fetchTrips() + uni.navigateBack()(AC-05)
         TripDetailPage.onShow 自动 re-fetch
     - Failure: submitError = mapError(err) + currentStep='error'(AC-08)
success 态: 瞬时态,setTimeout(200ms) 后触发 navigateBack
notfound 态: _NotFoundOverlay + 「返回首页」按钮 → uni.reLaunch AppRoutes.Home(AC-09)
error 态: _ErrorOverlay + 「重试」按钮 → 重新发起对应操作(AC-11)
取消(Header「✕」/ 底部「取消」/ 系统返回手势):
  → if !hasChanged: 直接 navigateBack
  → else: 弹 _DraftConfirmDialog(3 按钮:不保存 / 继续编辑 / 保存草稿)
     - 不保存: clearEditDraft + navigateBack
     - 继续编辑: 关闭弹窗,currentStep 保持 editing
     - 保存草稿: saveEditDraft({tripId, savedAt, formData}) → uni.setStorageSync('edit_trip_drafts', {[tripId]: draft}) + Toast + navigateBack
onUnmounted: logger.debug 兜底
```

### Key contracts
- **UpdateTripRequest 2 字段约束(触发 PD-001,spec §6.4.1)**:PUT 仅发 `{ user_id, title?, status? }` 2 字段可选;`city` / `start_date` / `end_date` / 4 选填字段 **不**在 UpdateTripRequest 中;UI 8 字段全展示但 city/dates 灰色 disabled + 选填 client-only;`buildUpdateRequest` 仅发 changed 字段,避免不必要写入
- **PUT partial-update 语义**(沿用 `services/preferences.js: §4` 模式):title 与 originalData 不同时携带;status 与 originalData 不同时携带;二者都未变时(req 为 `{}`)后端容忍空 PUT(no-op)
- **city/dates 改动兜底(双层保护,AC-07)**:UI 层 `<input :disabled="true">` + `<picker :disabled="true">` 阻止常规用户;`canSave` computed 含 `!isCityOrDateChanged` 兜底;onSave 内 `isCityOrDateChanged` 二次校验触发 Toast
- **草稿本地 storage keyed by tripId**(spec §4.3 + §6.4.3):`uni.setStorageSync('edit_trip_drafts', Record<tripId, EditTripDraft>)`;与 NewTripPage `trip_drafts: TripDraft[]` 列表结构隔离;`loadAllEditDrafts` / `saveAllEditDrafts` 内部 helper 复用(不调 `uni.removeStorageSync` 整 key,避免误删其他 trip 草稿);静默降级 + logger.warn
- **草稿恢复优先于 GET 响应**(spec §5.1 备注 + §5.3.H):`onMounted` 时先 `loadEditDraft(tripId)` 同步恢复 formData + originalData + `draftRestored=true`;GET 响应到达时若 `draftRestored=true` 则 **不** 覆盖 formData(避免覆盖用户已恢复的草稿)
- **错误归一**(spec §6.1 Error 表 + §5.3):`mapErrorToMessage(err)` → 4000||400→errorBadRequest / 5000||5xx→errorServer / 4001||404→errorFallback(GET → 应已切 notfound;PUT 错误兜底)/ 其它(含 isNetworkError)→errorNetwork;**不**暴露后端 stack
- **复用 homeStore.fetchTrips()**(spec §7.3):PUT 成功后 `await homeStore.fetchTrips()` 触发列表刷新;失败仅 logger.warn 不阻塞 navigateBack
- **navigateBack vs reLaunch**(spec §1 决策):PUT 成功后 `uni.navigateBack()`(保留 stack,TripDetailPage 在 stack 里由其 onShow re-fetch);非 reLaunch(区别于 NewTripPage POST 成功后 reLaunch TripDetail)
- **onMounted 替代 onLoad**(沿用 TripDetailPage / SpotDetailSheet 模式):本工程未显式列 `@dcloudio/uni-app` 依赖,fallback 用 `getCurrentPages()` 末项 options 读 URL query
- **草稿弹窗 3 按钮 + 蒙层点击 = 不保存**:沿用 NewTripPage 形态(MVP YAGNI 不抽公共);`fadeIn 0.2s + slideUp 0.3s ease-spring` 动效;所有按钮 ≥ 88rpx = 44pt 触达

### AC anchors (spec §9)
- AC-01 (loading 态进场 + fadeSlideUp 0.45s) → `.edittrip-page` animation
- AC-02 (editing 态 + 8 字段预填 + _FormHeader 状态徽章) → `formDataFromTrip` + template `v-else-if="currentStep === 'editing'"`
- AC-03 (hasChanged / isCityOrDateChanged / hasRequiredFields 派生) → 3 computed
- AC-04 (点保存 → saving + PUT body 仅 title) → `onSave` + `buildUpdateRequest`
- AC-05 (PUT 成功 → success 200ms + fetchTrips + navigateBack) → `doUpdate` setTimeout(200) + clearEditDraft + homeStore.fetchTrips + uni.navigateBack
- AC-06 (必填校验失败 → formError + _ErrorBanner + 保持 editing) → `onSave` early-return + `<_ErrorBanner v-if="formError" :retryable="false" />`
- AC-07 (city/dates 改动 → Toast「暂不支持」+ 不发 PUT) → `onSave` 二次校验 + `uni.showToast`
- AC-08 (PUT 失败 → error 态 + 重试) → `doUpdate` catch + `onRetry` 按 trip 状态重试 GET / PUT
- AC-09 (URL 缺参/非数字/<=0 → notfound) → `onLoadPage` 第一行 `Number.isFinite(parsed) && parsed > 0` 校验
- AC-10 (GET 404 / trip.status='deleted' → notfound) → `decideAfterFetch` + `handleFetchResult` 分支
- AC-11 (GET 失败 → error 态 + 重试) → `fetchTripDetail` catch + `onRetry`
- AC-12 (取消 → 草稿弹窗 3 选项) → `onClose` hasChanged 分支 + 3 emit handler
- AC-13 (草稿恢复优先于 GET) → `onLoadPage` 同步 loadEditDraft + `draftRestored` flag + `handleFetchResult` 不覆盖
- AC-14 (Shanshui 调色板) → 全局 AppColors 引用 + Noto Serif SC / Noto Sans SC
- AC-15 (4 端兼容 + 44pt 触达 88rpx) → 全按钮 min-height: 88rpx
- AC-16 (logger 关键事件 + 无 console.*) → utils/logger.js 引用,无 console 调用

### PageStatus
- `Architecture.status`: Pass(2026-06-03 11:50,9 项审核项全过,arch 留 6 条软观察)
- `Development.status`: NotStarted → Completed
- `FinalStatus`: NotStarted → ReadyForReview
- `Review.{ui,spec,test}`: Pending (awaiting 3 reviewers)

### Reviewer checklist anchors
- AC-01..AC-16 → spec §9
- 6 视图态决策 / 视图决策算法 → spec §3.7 + §4.1 + §5.1 + §5.2 + §5.5
- 12 异常流程 A-L(URL 缺参 / 404 / save 必填 / city 改动 / saving 失败 / 草稿恢复 / 重试 / 系统返回手势 / navigateBack 失败 / 草稿写失败 / 并发删除)→ spec §5.3
- 草稿弹窗 3 按钮流程 → spec §5.4
- 复用决策矩阵(R-1~R-3 强制清单)→ spec §3.6 + §10
- 6 条 arch 软观察(§6.4.1 PD-001 落实深度 / 禁用 vs 弹窗取舍 / 7 字段表抽组件 / 草稿清理 / 重试节流 / onShow 协议)→ issues/Arch/EditTripPage-001.md 末尾
- NFR (44pt / 4 视图态 / H5 ≥1024px / Shanshui 调色板 / logger / i18n 钩子)→ spec §10
- code-writer 强约束 C-1~C-6 全部落地 → spec §10 末段

---

<a id="guideresultpage"></a>

## GuideResultPage — 2026-06-03 — v0.1.0

### Implemented
- `pages/guide-result/index.vue` — 独立 route 化讲解结果展示页(uni.navigateTo 拉起,深链 `?photoId=xxx` 必填,可选 `?fromSpot=yyy&tripId=zzz`);5 视图态(`loading` / `loaded` / `chatting` / `notfound` / `error`)互斥 v-if 切换;`chatting` 是 `loaded` 衍生态(复用 `_LoadedPanel` + 末尾追加 `_ChatTyping`);4 块讲解 inline 渲染 + 3 风格 chip 纯前端 + 追问 page-local mock 循环 + Header「←」返回
- `services/photos.js` — 增量 4 函数:`getGuideResult(photoId)`(本地缓存读取,返回 `PhotoExplainData | null`)+ `saveGuideResult(data)`(覆盖式写 storage,key = `'guide_results'`,value = `{ [photo_id]: data }`)+ `loadGuideResults()`(批量读 storage)+ `clearGuideResult(photoId)`(MVP 可选);复用 `ApiError` class(从 `services/preferences.js` import,跨域复用),**不**复制代码
- `pages.json` — 新增 `pages/guide-result/index` 路由注册(项目第 8 个 page);style 沿用 onboarding/home/photo-guide 的 custom + `#FDFBF7/#F7F3EC`,`navigationBarTitleText: '讲解结果'`(与 `GuideResultStrings.title` 对齐)
- `pages/photo-guide/index.vue` — 配套 1 行 `await saveGuideResult(data)` 在 `doExplainAnalyze` 成功分支(per spec §5.5 + C-7 元决策登记);best-effort 语义:失败仅 `logger.warn` 不抛错,不阻塞 `currentStep='result'` 切换;`saveGuideResult` 已在 import 行追加
- `constants/strings.js` — 新增 `GuideResultStrings` 段(7 键独有:title / loadingText / notFoundEmoji / notFoundMessage / notFoundButton / styleChangedToast / chatMockReply);**完全复用** `PhotoGuideStrings` 25+ 键(顶栏 backAria / 4 块标题空态 / 风格 3 label / 追问循环 / 清空弹窗 / 错误兜底 / H5 aria),**不**重复定义字面值(per spec-writer-patterns §13「Trigger upstream constants」决策)
- `constants/routes.js` — **不修改**(`AppRoutes.GuideResult` 已在 L31 预声明,沿用 spec §3.9)

### 复用决策(spec §3.9 + §8.3 + §10 R-1~R-9 强制清单)
- **复用 ⭐ 零修改**:`AppColors` / `AppRoutes.GuideResult`(已预声明 L31)/ `AppRoutes.Home` / `PhotoGuideStrings` 25+ 键 / `PhotoGuideStyleOptions` / `PhotoGuideStyleFromPrefMap` / `OnboardingStrings.retry` / `useUserStore.fetchPreferences()`(默认风格派生)/ `useHomeStore.fetchTrips()` + `useHomeStore.today.today_items`(?tripId / ?fromSpot 携带时派生)/ `ApiError`(从 `services/photos.js` re-export,跨域复用)/ `components/_ErrorBanner.vue`(trip 解析失败内联 + 追问失败内联错误隔离)/ `components/SpotCard.vue`(?fromSpot 携带时只展示,沿用 PhotoGuidePage §3.9 决策,**不**接 `@tap`)/ `pages/photo-guide/components/_ClearChatConfirmDialog.vue`(**反向 import**,沿用 PhotoGuidePage 私有 2 按钮清空弹窗,**不**复制)
- **新建 🟦**:`pages/guide-result/index.vue`(1 个 SFC,~1100 行,inline 渲染 5 视图态 + 4 块 + 3 风格 + 追问)
- **不复制**:`components/EmptyState` / `NextButton` / `TripCard` / `SpotTimeAxis` / `SpotDetailSheet`(本页面无对应场景);`pages/edit-trip/components/_DraftConfirmDialog.vue`(3 按钮草稿 vs 2 按钮清空,语义不同,沿用 PhotoGuidePage 形态)
- **不抽私有子组件**:`_ContentCard` / `_ChatBubble` / `_LoadedPanel` / `_NotFoundOverlay` / `_ErrorOverlay`(MVP YAGNI,inline 渲染,沿用 PhotoGuidePage §3 决策)
- **不新建 store**:`guideResultStore` / `chatStore` / `favoritesStore` / `shareStore`(per spec §7.3 客户端 local 状态路径,缓存 + 追问 history 走 page-local + `uni.setStorageSync`)
- **不修改**:`stores/userStore.js` / `stores/homeStore.js` / `services/preferences.js` / `services/photos.js:152-203` `explainPhoto`(仅增量新函数)/ `constants/colors.js` / `constants/routes.js`(spec §10 C-8 强约束)

### State composition (5 视图态)
- `viewMode: 'loading' | 'loaded' | 'chatting' | 'notfound' | 'error'`(spec §3.7 严格 5 枚举)
- `photoId: number | null` — 解析自 URL `?photoId=xxx`,`Number.isFinite(n) && n > 0` 判定为有效;**缺参/非数字/<=0 → 立即判 notfound(per §5.1 Step A,沿用 SpotDetailSheet / TripDetailPage 冷启动深链算法)**
- `fromSpotId: number | null` + `fromTripId: number | null` — 解析自 URL 可选参数;`Number.isFinite(n) && n > 0` 判定为有效,否则 `null`
- `currentTrip: { tripId, title } | null` — `?tripId=xxx` 携带时,从 `homeStore.trips.find(t => t.id === fromTripId)` 派生;找不到 → `_ErrorBanner` 弱化提示(per §3.3 + AC-04),**不**切 notfound
- `fromSpot: TripItem | null` — `?fromSpot=xxx` 携带时,从 `homeStore.today?.today_items.find(...)` 派生;找不到 → `_FromSpotBanner` 隐藏
- `currentStyle: PhotoStyle` — 初始从 `userStore.preferences?.explanation_style`(走 `PhotoGuideStyleFromPrefMap`)派生,无则 fallback `'professional'`(per §4.2 + `PhotoGuideStyleFromPrefMap`)
- `explainResult: PhotoExplainData | null` — 缓存读取结果;`null` = 未就绪 / 缓存 miss / 失败
- `chatHistory: ChatMessage[]`(page-local 简化版,`role: 'user' | 'assistant'` + `content`)**不**持久化(MVP YAGNI)
- `loadError: string | null` — `getGuideResult(photoId)` 失败的友好提示,驱动 `_ErrorOverlay` 整页面板
- `chatError: string | null` — 追问失败的友好提示(MVP mock 阶段不触发),驱动 `_ErrorBanner` 内联;**不**切 viewMode='error'(per §5.3.K 错误隔离)
- `clearDialogVisible: boolean` — `_ClearChatConfirmDialog` 显示标记
- `imageLoadFailed: boolean` — image 加载失败占位标记
- `chatInputDraft: string` — input v-model 草稿
- `mockChatTimerId: number | null` — page-local 追问模拟 setTimeout id(stale guard + onUnmounted 兜底)

### 视图决策算法(spec §5.1)
```
onMounted:
  → getCurrentPageOptions() → 解析 ?photoId / ?fromSpot / ?tripId
  → 若 bad photoId(非数字 / <=0 / 缺参): viewMode='notfound',**不**发起任何 fetch
  → 否则:
     viewMode='loading'(初始,瞬时)
     异步触发(无 await,渲染 loading 态先):
       - deriveDefaultStyle()(per §4.2 + §5.1 Step 1,失败 fallback 'professional')
       - deriveContext()(per §5.1 Step 2 + 3,?tripId → 找 trip / ?fromSpot → 找 spot)
       - loadGuideResultFromCache()(per §6.0 + §5.1 Step 4)
          - 缓存命中 → explainResult=data + viewMode='loaded'
          - 缓存 miss → viewMode='notfound'
          - ApiError → viewMode='error' + loadError=mapLoadError(err)
  → logger.info onLoad 落地
```

### Key contracts
- **5 视图态严格 5 枚举**:`viewMode` 仅 5 个值(`loading` / `loaded` / `chatting` / `notfound` / `error`),**不**新增第 6 个(per spec §3.7 + spec-auditor 校验规则)
- **chatting 是 loaded 衍生态**(per §3.7 + §4.1):UI 复用 `_LoadedPanel`(template `v-else-if="viewMode === 'loaded' || viewMode === 'chatting'"`)+ 末尾追加 `_ChatTyping`,**不**切独立 7 态;`viewMode === 'chatting'` 期间 `disabled` 判定(input / send 按钮 / 追问 chip)走 `isChatting` computed
- **GET /api/photos/{photoId} 不存在 → 本地缓存(per §6.4.1)**:MVP 阶段**不**实现该 GET 接口,改走 `services/photos.getGuideResult(photoId)` 同步读 `uni.getStorageSync('guide_results')`;**不**调任何 HTTP
- **缓存写入方(PhotoGuidePage 1 行配套)**:在 `doExplainAnalyze` 成功分支调 `await saveGuideResult(data)`(per spec §5.5 + C-7 元决策登记);best-effort 语义,失败仅 `logger.warn` 不抛错
- **PATCH /api/users/me 字段 `explanation_style` 不存在 → 纯前端(per §6.4.2)**:风格 chip 切换只更新 `currentStyle` + 风格徽章文案,**不**发任何 API(grep 验证 `uni.request` / `uni.uploadFile` 在本页面 0 命中);后端偏好由 `StyleSettingPage` 接管
- **追问循环 page-local mock(per §6.4.5)**:MVP 阶段**不**真发追问(`explainPhoto` 走 `uni.uploadFile` 要求 `filePath` 本地路径,本页面读 server 缓存 `image_path` 冲突);改走 `setTimeout(500 + random*500)` 模拟 AI 响应,固定话术 `GuideResultStrings.chatMockReply`;`onSendChat` 改 `doMockChatReply`(无 `explainPhoto` 调用)
- **保存讲解到收藏 / 分享不实现(per §6.4.3 / §6.4.4)**:MVP 后端无 favorites / share 域,本页面**不**渲染收藏/分享按钮;IssueManager 后续扩展 hook
- **错误归一(per §6.3)**:`mapLoadError(err)` → `isNetworkError`→`errorNetwork` / `4000||400`→`errorBadRequest` / `5000||5xx`→`errorServer` / 其它→`errorFallback`;`_ErrorOverlay` 文案走 `PhotoGuideStrings.errorXxx` 复用
- **chatting 失败错误隔离(per §5.3.K)**:MVP mock 阶段不触发 chatError;若未来真追问扩展,`onRetryChat` 接 `_ErrorBanner @retry`,**不**切 viewMode='error'
- **onBack 4 路径 + 1 兜底(per §5.4)**:Header「←」/ 系统返回手势 / `_NotFoundOverlay` 「返回首页」按钮 / `_ErrorOverlay` 「重试」按钮 → 走 `onBack` + `getCurrentPages().length > 1` 判定 + `uni.navigateBack({delta:1, fail: reLaunch Home})` / 兜底 `uni.reLaunch({url: AppRoutes.Home})`;`onUnmounted` 兜底 `clearDialogVisible=false` + `clearTimeout(mockChatTimerId)`
- **stale setTimeout guard(per §5.6 + PhotoGuidePage / NewTripPage 模式)**:`mockChatTimerId` 在 `onSendChat` 开头 `clearMockChatTimer()` 防堆叠 + 回调内 `if (viewMode.value !== 'chatting') return` 防止 stale + `onUnmounted` 兜底清
- **SpotCard 只展示不响应点击(per §3.9 + §10 R-3 + PhotoGuidePage §3.9 决策)**:复用 `components/SpotCard.vue` 但**不**接 `@tap`,沿用 PhotoGuidePage `_FromSpotBanner` 模式;`fromSpotState` 派生(`done`→`done` / `changed`→`changed` / 其他→`upcoming`)
- **`_ClearChatConfirmDialog` 反向 import(per §3.9 + §10 R-2)**:直接 `import` PhotoGuidePage 私有组件,**不**复制,沿用 2 按钮 Danger 配色形态
- **H5 ≥1024px 居中(per §3.8 + §10 NFR)**:沿用 PhotoGuidePage §8.3 / EditTripPage §3.8 / HomePage §10 / TripDetailPage §3.8 模式;`@media (min-width: 1024px) { .body-inner { max-width: 640rpx; margin: 0 auto; } }` + sticky chat-input-bar-wrap 大屏反向 margin 补偿
- **44pt 触达 88rpx(per AC-11 + §10 NFR)**:Header back 88rpx / 3 风格 chip 88rpx / 4 块追问 chip 88rpx / 「发送」88rpx / 「🗑」88rpx / 「重试」88rpx / 「返回首页」88rpx = 7 类 8 元素全达
- **logger 关键事件 0 console.\***:onLoad / style switched / cache hit / cache miss / cache load failed / chat sent (mock) / chat reply ok (mock) / chat cleared / chat retry / retry load / notfound / notfound back to home / back / onUnmounted 共 14+ 关键事件全部 `logger.info / warn / error`;`utils/logger.js` 引用,无 console 调用

### AC anchors (spec §9)
- AC-01 (loaded 缓存命中 + 4 块 + 风格 + 追问 + 返回) → `pages/guide-result/index.vue` loaded 分支 + onLoadPage Step 4
- AC-02 (URL 缺参/非数字/<=0 → notfound) → parseQuery + onLoadPage Step A 立即判
- AC-03 (缓存 miss → notfound + 返回首页) → loadGuideResultFromCache + onNotFoundHome
- AC-04 (?photoId + ?fromSpot + ?tripId 三参 + trip 找不到走 ErrorBanner) → deriveContext + onLoadPage
- AC-05 (3 风格切换纯前端 + 风格徽章 + 0 HTTP) → onStyleChange + styleBadgeText + AC-13 grep 验证
- AC-06 (追问 chip → 自动填入 + 发送) → onChipTap + onSendChat
- AC-07 (清空对话弹窗 + 确认后 chatHistory=[] + viewMode 保持 loaded) → onClearChatTap + onDialogConfirm
- AC-08 (Header「←」+ 系统返回手势 + stack 兜底 reLaunch) → onBack + getCurrentPages.length 判定
- AC-09 (onUnmounted + clearDialogVisible + clearTimeout) → onUnmounted
- AC-10 (chatting 失败 chatError 内联 + 不切 error + chatHistory 保留) → mapChatError + chatError 内联 _ErrorBanner(预留,MVP mock 阶段不触发)
- AC-11 (8 元素 ≥ 88rpx) → 全按钮 min-height: 88rpx
- AC-12 (H5 ≥1024px 居中) → @media .body-inner max-width: 640rpx + chat-input-bar-wrap 反向 margin
- AC-13 (反向 grep `uni.request` 0 命中 + `console.*` 0 命中 + `getGuideResult` 1 次 + `explainPhoto` 0 次) → code-writer 强约束 C-9
- AC-14 (logger 关键事件 0 console.\*) → 14+ 关键事件 logger.info/warn/error
- AC-15 (userStore.preferences null → fetchPreferences + currentStyle 派生 + 失败 fallback professional) → deriveDefaultStyle + decideStyleFromPrefs

### PageStatus
- `Architecture.status`: Pass(2026-06-03 23:13,9 项审核项全过,arch 留 6 条软观察,见 issues/Arch/GuideResultPage-001.md)
- `Development.status`: NotStarted → Completed
- `FinalStatus`: NotStarted → ReadyForReview
- `Review.{ui,spec,test}`: Pending (awaiting 3 reviewers)

### Reviewer checklist anchors
- AC-01..AC-15 → spec §9
- 5 视图态决策 / 视图决策算法 → spec §3.7 + §4.1 + §5.1
- 14 异常流程 A-N(URL 缺参 / 缓存 miss / storage 损坏 / 风格切换 / 追问 chip / input 空 / 连续发送防抖 / 清空 + 已读 / 取消 + 蒙层 / 401 / 内存溢出 / 4 块超长 / onBack 4 路径)→ spec §5.3 + §5.4
- 复用决策矩阵(R-1~R-9 强制清单)→ spec §3.9 + §10
- 6 条 arch 软观察(风格切换纯前端 / GET 失败走缓存 / ?photoId 缺失兜底 / 风格实时渲染 / 关闭按钮 Header / _ContentCard 后续抽公共)→ issues/Arch/GuideResultPage-001.md 末尾
- 5 个 Resolved 子节(§6.4.1 GET 不存在 / §6.4.2 PATCH 不存在 / §6.4.3 收藏无域 / §6.4.4 分享无域 / §6.4.5 追问 image 冲突)→ spec §6.4
- NFR (44pt / 5 视图态 / H5 ≥1024px / Shanshui 调色板 / logger / i18n 钩子 / 性能 < 1s 首屏)→ spec §10
- code-writer 强约束 C-1~C-9 全部落地 → spec §10 末段
- 1 元决策:PhotoGuidePage `doExplainAnalyze` 1 行 `await saveGuideResult(data)`(per §5.5 + C-7,在 deliverable §3 显式登记,供 orchestrator 决策是否走 PhotoGuidePage spec 修订流程)



---

<a id="mypage"></a>

## MyPage — 2026-06-04 — v0.1.0

### Implemented
- `pages/my/index.vue` — 独立 route 我的主页(tabBar page,uni.switchTab / uni.navigateTo 拉起,无 URL params);3 视图态(`loading` / `loaded` / `error`)互斥 v-if 切换;Header「我的」+ 3 视图态 v-if 链 + `_UserInfoCard` 整行可点 → `AppRoutes.PersonalProfile` + `_PreferenceSummary` 5 interests chips + 1 explanation chip + `_MenuList` 6 项 v-for 渲染 + `_LogoutButton` Danger 渐变 + `_ErrorBlock` 整页 `_ErrorBanner` 整页 + H5 ≥1024px 居中
- `pages/my/components/_LogoutConfirmDialog.vue` — 私有 2 按钮 Danger 配色 modal(fadeIn 0.2s + slideUp 0.3s ease-spring,沿用 PhotoGuidePage `_ClearChatConfirmDialog` 形态);5 props(visible / title / message / btnConfirmLabel / btnCancelLabel)+ 2 emits(confirm / cancel);z-index: 1100 高于一般浮层;所有按钮 ≥ 88rpx = 44pt 触达
- `constants/strings.js` — 新增 `MyPageStrings` 段(25 键:顶栏 1 / Loading 1 / 用户信息 4 / 偏好摘要 3 / 菜单列表 7 / 退出登录 1 / 二次确认弹窗 4 / 错误兜底 3 / H5 aria 1)+ `MyPageMenuOptions` 段(`Object.freeze` 6 键数组,id / icon / label / route / behavior 5 字段)+ `MyPageExplanationLabel` 段(`Object.freeze` 3 键 map,1:1 对齐 `api/types.ts:94` `ExplanationStyle` 3 枚举);**完全复用** `OnboardingStrings.errorNetwork` / `errorServer` / `retry` + `NewTripStrings.errorFallback`(per spec §3.7 R + §13 「Trigger upstream constants」决策);**新增** `import { AppRoutes } from './routes.js'` 给 `MyPageMenuOptions` 用(无 circular import,routes.js 不 import strings)
- `pages.json` — 新增 `pages/my/index` 路由注册(项目第 9 个 page);style 沿用 onboarding/home/photo-guide 的 custom + `#FDFBF7/#F7F3EC`,`navigationBarTitleText: '我的'`(与 `MyPageStrings.title` 对齐);**不**修改 `tabBar.list`(per spec §1 + AC-18 C-7,tabBar 项目级缺口由 orchestrator 协调下次 patch 补)
- `changelogs/index.md` — 索引表格 1 行 + 详细 v0.1.0 段
- `workflow/PageStatus.yaml` — MyPage.Development NotStarted → Completed + FinalStatus NotStarted → ReadyForReview + Review.{ui,spec,test} → Pending
- `outputs/myp-dev/deliverable.md` — 8 节完整 deliverable(Summary / Changed files / Key decisions / State composition / code-writer 强约束清单 / logger 关键事件 / PageStatus update / Notes for verifier)

### 复用决策(spec §3.7 + §10 R-1~R-9 强制清单)
- **复用 ⭐ 零修改**:`AppColors`(山水日志配色)/ `AppRoutes.My`(已预声明 routes.js:13)+ 5 子路由(`PersonalProfile` / `Trash` / `StyleSetting` / `NotificationSetting` / `About`)/ `OnboardingInterestOptions` 5 键 emoji + label(strings.js:39-45)/ `OnboardingStrings.retry`(`_ErrorBanner` 内部用)/ `useUserStore.fetchPreferences()`(拿 `interests` + `explanation_style` 派生)/ `useUserStore.clearProfile()`(登出走)/ `components/_ErrorBanner.vue`(error 态整页)/ `utils/logger.js`
- **新建 🟦**:`pages/my/index.vue`(1 个 SFC, 22.8KB / ~580 行,3 视图态 + 6 菜单项 + 用户信息区 + 偏好摘要 + 退出登录 + dialog 集成)+ `pages/my/components/_LogoutConfirmDialog.vue`(270 行,2 按钮 Danger 私有)
- **不复制**:`pages/photo-guide/components/_ClearChatConfirmDialog.vue`(2 按钮清空)/ `pages/edit-trip/components/_DraftConfirmDialog.vue`(3 按钮草稿)/ `pages/trip-detail/components/_DeleteConfirmDialog.vue`(2 按钮删除)— 形态虽相似但语义不同,**新建**本页面私有版本(per spec §3 备注 6 + §8.3 + §10 C-6 + code-writer 硬规则「禁止跨目录 import 私有组件」)
- **不抽私有子组件**:`_MenuItem` / `_UserInfoCard` / `_PreferenceSummary` / `_LogoutButton` / `_ConfirmDialog`(MVP YAGNI,inline 渲染,per spec §3 备注 5 + §8.3 + §10 C-10)
- **不新建 store**:`userInfoStore` / `myStore` / `authStore` / `favoritesStore` / `shareStore`(per spec §7.2 + C-8 严禁)
- **不新建 service**:`services/users.js` / `services/auth.js`(per spec §6.4.1/§6.4.2 + C-8/C-9 严禁)
- **不修改**:`stores/userStore.js` / `services/preferences.js` / `services/home.js` / `services/trips.js` / `services/photos.js` / `constants/routes.js`(已预声明)/ `constants/colors.js` / `docs/*` / `api/*` / `mock/*` / `specs/MyPage.md` / `issues/*` / `PRODUCT_DECISIONS.md`(per spec §7.1 + C-9 严禁)

### State composition (3 视图态 + 3 local state + 0 store 新增)
- `viewMode: 'loading' | 'loaded' | 'error'`(spec §3.6 严格 3 枚举)
- `hasFetchedOnce: boolean` — 首次拉取完成门控,避免 fetch 完成前跳到 error 之外(per HomePage §4.1 模式)
- `logoutDialogVisible: boolean` — `_LogoutConfirmDialog` 显示标记(v-if 绑定)
- `interestsChips: { value, emoji, label }[]`(computed) — 从 `userStore.preferences?.interests` 派生 5 emoji chips(复用 `OnboardingInterestOptions.find`)
- `explanationLabel: string | null`(computed) — 从 `userStore.preferences?.explanation_style` 派生 1 短标签(inline `labelMap` 引用 `MyPageExplanationLabel` 3 短标签 key)
- `errorMessage: string`(computed) — `userStore.error` 经 `mapErrorToMessage` 6 类错误映射驱动 `_ErrorBanner`

### 视图决策算法(spec §3.6 + §5.1)
```
onMounted:
  → hasFetchedOnce = false
  → viewMode = 'loading' (立即生效,渲染 _LoadingBlock)
  → 异步触发 fetchAndDecide():
      if (userStore.preferences === null):
          await userStore.fetchPreferences()
      else:
          // 缓存命中,跳过 fetch (per spec §5.1 + AC-10)
      → 成功: hasFetchedOnce = true; viewMode = 'loaded'
      → 失败: hasFetchedOnce = true; viewMode = 'error'
  → logger.info('[MyPage] onLoad ok', { interestsCount, hasStyle })

onShow:
  → if (viewMode === 'loading') return (避免 onMounted 飞行中重复)
  → hasFetchedOnce = false
  → fetchAndDecide() (tabBar page 强制重拉,per HomePage §5.1)
  → logger.info('[MyPage] onShow loaded', { interestsCount, hasStyle })
```

### Key contracts
- **3 视图态严格 3 枚举**:`viewMode` 仅 3 个值(`loading` / `loaded` / `error`),**不**新增第 4 个(per spec §3.6 + spec-auditor 校验规则);**注意**:任务原文用 `idle/loaded/error`,spec 表格用 `loading/loaded/error`,按 spec 走(per code-writer hard rule spec wins)
- **登出走本地清空 + reLaunch(per §6.4.2 PD-001)**: `_LogoutConfirmDialog` confirm → `userStore.clearProfile()` + `uni.reLaunch({url: AppRoutes.Home})` + logger.info;**不**调任何 API(grep `uni.request` / `uni.uploadFile` 0 命中,per AC-16)
- **6 菜单项 2 类行为(per §3.4 + AC-04)**:`'navigate'`(5 项)→ `uni.navigateTo({url: item.route})` 接受目标 page 404 兜底(本页面**不**检测目标 page 是否实现,避免跨页耦合);`'coming-soon'`(1 项帮助)→ `uni.showToast` + return
- **H5 ≥1024px 居中(per §3.8 + AC-14)**:沿用 `GuideResultPage` §13.7 / `PhotoGuidePage` §8.3 / `EditTripPage` §3.8 / `HomePage` §10 NFR 模式;`@media (min-width: 1024px) { .body-inner { max-width: 640rpx; margin: 0 auto; } }`(本页面无 sticky bar,无需大屏反向 margin 补偿)
- **44pt 触达 88rpx(per AC-13 + §10 NFR)**:`_UserInfoCard` 整行 / `_MenuList` 6 项 / `_LogoutButton` / `_LogoutConfirmDialog` 2 按钮 = 4 类共 10 元素全达
- **onBack 4 路径**:tabBar page 默认无 Header「←」按钮,沿用 tabBar 行为(切其他 Tab);登出走 `uni.reLaunch(Home)` 清空 stack;无 `_NotFoundOverlay` / `_ErrorOverlay` 路径(本页面 error 态用 `_ErrorBanner` 内联)
- **stale guard 模式**:无 setTimeout / 无 30s 上传超时,本页面无此需求
- **缓存策略(per §5.1 + AC-10)**:`onMounted` / `onShow` 触发时若 `userStore.preferences === null` → 调 `fetchPreferences`,缓存命中跳过;`preferences !== null` 永不重拉(MVP 简化路径,无 30s TTL)
- **PD-001 3 类触发全部按 spec 默认路径**: §6.4.1 (无 User 类型) UI 占位 + emoji + 中文默认值;§6.4.2 (无 DELETE /api/auth/session) 本地清空 + reLaunch 0 API;§6.4.3 (6 子页路由 5 未实现 + 1 未预声明) 6 菜单项全展示 + 接受 404 兜底 + coming-soon toast
- **logger 关键事件 0 console.***:onMounted / onLoad ok / onLoad failed / onShow loaded / navigate to personal profile / navigate failed / menu click navigate / menu click coming soon / menu navigate failed / logout button clicked / logout confirmed / logout cancelled / retry fetch / retry ok / retry failed 16 关键事件全部 `logger.info / warn / error`(per AC-11)
- **不抽公共子组件(MVP YAGNI)**:6 菜单项 inline 渲染在 `pages/my/index.vue` 的 `<template>` 用 `v-for="(item, idx) in MyPageMenuOptions" :key="item.id"`;`_UserInfoCard` / `_PreferenceSummary` / `_LogoutButton` 全部 inline 渲染;`MyPageMenuOptions` 集中登记 icon / label / route / behavior 4 字段(per spec §3 备注 5 + §4.4)

### AC anchors (spec §9)
- AC-01 (onLoad / onShow 3 视图态切换) → onMounted + onShow + fetchAndDecide + decideViewMode
- AC-02 (loaded 态完整渲染 _LoadedBlock) → panel-loaded v-else-if 分支
- AC-03 (_UserInfoCard 整行可点 → PersonalProfile) → onUserInfoTap + uni.navigateTo + 失败 toast
- AC-04 (菜单项 6 项 navigate/coming-soon 分发) → onMenuTap + switch item.behavior
- AC-05 (退出登录按钮 → 弹 _LogoutConfirmDialog) → onLogoutTap + logoutDialogVisible = true
- AC-06 (取消/蒙层 → 关闭弹窗) → onLogoutCancel + dialog emit('cancel')
- AC-07 (确认登出 → clearProfile + reLaunch,0 API) → onLogoutConfirm (per §6.4.2 严禁调 API)
- AC-08 (error 态 _ErrorBanner + 6 类错误映射 + 重试) → panel-error + mapErrorToMessage + onRetry
- AC-09 (401 全局拦截器兜底) → 本页面不感知,per 项目级 401 carve-out (5+ 页 6 连实证)
- AC-10 (onShow 强制重拉) → onShow + 缓存策略 preferences !== null 跳过 fetch
- AC-11 (logger 关键事件 0 console.*) → 16 关键事件全部 logger.info / warn / error
- AC-12 (菜单项不检测目标 page 是否实现) → onMenuTap 只 navigate,不检查 page 存在
- AC-13 (44pt 触达 88rpx 4 类元素) → _UserInfoCard 整行 / 6 菜单项 / _LogoutButton / _LogoutConfirmDialog 2 按钮 全 88rpx
- AC-14 (H5 ≥1024px .myp-page { max-width: 640rpx; margin: 0 auto }) → @media (min-width: 1024px) 块
- AC-15 (PD-001 §6.4.1 承诺) → 不渲染 userInfo.avatar_url <image>;emoji + 中文默认占位;不显示 id/gender/age_range
- AC-16 (PD-001 §6.4.2 承诺) → grep uni.request / uni.uploadFile 在 index.vue 0 命中;登出走本地操作
- AC-17 (PD-001 §6.4.3 承诺) → 6 菜单项全展示;5 navigate 接受 404 兜底;1 coming-soon toast
- AC-18 (pages.json 9th page 注册) → 完成,不修改 tabBar.list (per spec §1 + AC-18 + 任务原文 "由 orchestrator 协调下一次 patch 补")
- AC-19 (MyPageStrings 25 键 + 复用纪律) → 3 错误键引用既有段,不重复字面;「重试」走 OnboardingStrings.retry;MyPageMenuOptions 6 键 + MyPageExplanationLabel 3 键 2 段新增
- AC-20 (MVP YAGNI 决策) → 5 公共子组件不新建;6 菜单项 inline 渲染 in template v-for

### PageStatus
- `Architecture.status`: Pass (2026-06-03 23:42, 9 项审核项全过, arch 留 6 条软观察 + 1 条项目级 tabBar.list 缺口给 orchestrator, 见 issues/Arch/MyPage-001.md)
- `Development.status`: NotStarted → Completed (2026-06-04 07:43 attempt 2 完成, attempt 1 2026-06-04 00:13 engine kill 后 manual retry)
- `FinalStatus`: NotStarted → ReadyForReview (2026-06-04 07:43)
- `Review.{ui,spec,test}`: Pending (awaiting 3 reviewers)

### Reviewer checklist anchors
- AC-01..AC-20 → spec §9 (20 AC 全部按 spec 字面实现)
- 3 视图态决策 / 视图决策算法 → spec §3.6 + §4.1 + §5.1
- 7 异常路径 A-G(网络断开 / 5xx / 4xx / 401 全局拦截 / 取消 / 确认 / 登出后循环)→ spec §5.3
- 复用决策矩阵(R-1~R-9 强制清单)→ spec §3.7 + §10
- 6 条 arch 软观察(头像/昵称 placeholder / 退出登录 2 步确认 / 菜单项 lazy load / onLoad vs onShow / _MenuItem 私有 vs 抽公共 / 网络断开时菜单禁用)→ issues/Arch/MyPage-001.md 末尾(全部按 spec 字面实现)
- 3 个 Resolved 子节(§6.4.1 无 User 类型 / §6.4.2 无 DELETE /api/auth/session / §6.4.3 6 子页路由 5 未实现)→ spec §6.4
- NFR(44pt 触达 / 3 视图态 / H5 ≥1024px / Shanshui 调色板 / logger / i18n 钩子 / 性能 < 200ms 缓存命中)→ spec §10
- code-writer 强约束 C-1~C-14 全部落地 → spec §10 末段
- 1 个软观察(tabBar.list 项目级缺口)→ spec §6.4.3 第 4 段 + AC-18 C-7 + 任务原文 "由 orchestrator 协调下一次 patch 补"
- 3 task vs spec 冲突决策(file 路径 / route / services/users.js)→ outputs/myp-dev/deliverable.md §3.2
- **0 净新增 store / service / 路由 / 公共子组件**(per spec §7.2 + C-8 + C-9 + C-10 严禁)

---

<a id="stylesettingpage"></a>

## StyleSettingPage — 2026-06-04 — v0.1.0

### Implemented
- `pages/style-setting/index.vue` — 独立 route 化讲解风格设置页(uni.navigateTo 拉起,无 URL param);5 视图态(`loading` / `loaded` / `saving` / `saved` / `error`)互斥 v-if 切换;3 选项 v-for 渲染 + 「保存」单 CTA + _ErrorPanel 整页兜底;PUT 成功后 `uni.navigateBack()`(保留 stack)→ MyPage.onShow 自动 re-fetch
- `pages/style-setting/components/_StyleOptionCard.vue` — 页面私有讲解风格卡(沿用 spec §8.3 「code-writer 可选提取 _OptionRow 私有」决策;任务原文 §3 显式要求新建);5 props(`style` / `title` / `desc` / `icon` / `isSelected`)+ 1 函数 prop(`onTap(style: string) => void`)+ slot-free;选中态 `primarySoft` 背景 + 1.5px `primary` 描边 + 右侧 36rpx ✓ 实心圆
- `pages.json` — 新增 `pages/style-setting/index` 路由注册(项目第 10 个 page,含 Login 占位;实际业务 page 第 9 个);style 沿用 onboarding/home/my 的 custom + `#FDFBF7/#F7F3EC`,`navigationBarTitleText: '讲解风格'`(与 `StyleSettingStrings.title` 对齐)
- `constants/strings.js` — 新增 `StyleSettingStrings` 段(18 键:顶栏 2 / 加载 1 / 表单头 4 / 3 选项标题 3 / 3 选项描述 3 / 提交按钮 1 / 提交态 1 / 完成态 1 / Toast 1 / H5 aria 1);新增 `StyleSettingOptions`(`Object.freeze` 3 键数组,1:1 对齐 `api/types.ts:94` `ExplanationStyle` 3 枚举,`value/icon/title/desc` 4 字段,引用 `StyleSettingStrings` 6 键字面,**不**重复定义)
- `constants/routes.js` — **不修改**(`AppRoutes.StyleSetting: '/pages/style-setting/index'` 已在 L17 预声明,沿用 spec §3.8 复用决策)
- `stores/userStore.js` — **不修改**(spec §7.2 + C-7 严禁修改)
- `services/preferences.js` — **不修改**(spec §7.3 + C-8 严禁修改;复用既有 `updatePreferences` / `getPreferences` / `ApiError` class)
- `MyPageExplanationLabel`(3 短标签)→ 复用作为 `_FormHeader` 当前风格展示(per §3.5;**字面不同但语义 1:1 对齐** — 本规格 `StyleSettingStrings.styleTitleXxx` 无「讲解」后缀,行内空间更紧凑)

### 复用决策(spec §3.6 + §3.8 + §10 R-1~R-9 强制清单)
- **复用 ⭐ 零修改**:`AppColors`(山水日志配色)/ `AppRoutes.StyleSetting`(`constants/routes.js:17` 已预声明)/ `OnboardingStrings.retry`(「重试」按钮文案)/ `OnboardingStrings.errorNetwork` / `errorBadRequest` / `errorServer`(错误兜底 3 键,4 键全引用,**不**在 `StyleSettingStrings` 重复)/ `MyPageExplanationLabel`(3 短标签 _FormHeader 展示)/ `useUserStore.fetchPreferences()`(onLoad 拉取)/ `useUserStore.updateProfile()`(saving 态保存)/ `ApiError`(import 自 `services/preferences.js`,跨 service 复用)
- **新建 🟦**:`pages/style-setting/index.vue` + `pages/style-setting/components/_StyleOptionCard.vue`(页面私有 5 props + 1 函数 prop)
- **不复制**:`components/_ErrorBanner.vue`(横向 banner 形态;本页面 error 是顶层整页 5 选 1,沿 PersonalProfilePage §3 `_ErrorPanel` 全屏形态独立 inline 渲染 icon + message + btn-retry 三段)
- **MVP 不调**:`services/preferences.updateUserInfo`(PersonalProfilePage 专用 `{ interests }` 薄包装,语义混淆,**不**沿用 — spec §10.8 C-6 严禁)
- **MVP 不存**:**不**写草稿 / **不**弹 `_DraftConfirmDialog`(per §4.6 + §5.4 MVP 简化决策,单选 + 1 字段无草稿价值)
- **不修改**:`stores/userStore.js` / `services/preferences.js` / `services/home.js` / `services/trips.js` / `services/photos.js` / `components/_ErrorBanner.vue` / `pages.json` `tabBar.list` / `constants/colors.js` / `constants/routes.js`(spec §1 复用决策 + C-7/C-8 强约束)

### State composition (5 视图态)
- `viewMode: 'loading' | 'loaded' | 'saving' | 'saved' | 'error'`(spec §3.7 + §4.1 严格 5 枚举,spec-auditor 严格核对 5 枚举,不许第 6 个)
- `userId: string` — MVP 固定 `'1'`(per docs/API接口文档.md §1.3)
- `currentStyle: ExplanationStyle | null` — onLoad 拉取后的服务器原始值(可能 null,新用户首登)
- `selectedStyle: ExplanationStyle` — 用户当前选中,永远有值(MVP 简化 `null` → fallback `'professional'`,per §5.3 J)
- `saveError: string | null` — GET / PUT 失败的友好提示,驱动 `_ErrorPanel` 渲染
- `hasFetchedOnce: boolean` — 首次拉取完成标记(沿 `HomePage §4.1` `hasFetchedOnce` 模式)
- `lastErrorSource: 'get' | 'put' | null` — 上一次失败来源,决定重试方向(per §5.2 Step 6)
- `isDirty: computed` — `selectedStyle !== (currentStyle || FALLBACK_STYLE)`,MVP 简化将 null 视为 fallback(per §5.3 J)
- `isSaving: computed` — `viewMode === 'saving'`
- `canSave: computed` — `!isSaving && isDirty`(per §3.6)
- `currentStyleLabel: computed` — 从 `MyPageExplanationLabel[currentStyle || FALLBACK_STYLE]` 派生 3 短标签

### 视图决策算法(spec §5.1 + §5.2 + §5.5)
```
onMounted:
  → 初始化 local state:userId='1' / viewMode='loading' / currentStyle=null /
    selectedStyle='professional'(MVP fallback) / saveError=null / hasFetchedOnce=false
  → 调 userStore.fetchPreferences():
    - Success (code: 0 + data.preferences.explanation_style):
        currentStyle = prefs.explanation_style(可能 null)
        selectedStyle = currentStyle || 'professional'(MVP fallback 1 行派生)
        hasFetchedOnce = true
        viewMode = 'loaded'
        logger.info('[StyleSettingPage] fetch ok', { currentStyle, selectedStyle })
        若 currentStyle === null → logger.info('[StyleSettingPage] new user fallback', ...)
    - Failure (5xx / 4xx / network):
        hasFetchedOnce = true
        viewMode = 'error'
        saveError = mapSaveError(err)(4000||400→errorBadRequest / 5000||5xx→errorServer / 其它→errorNetwork)
        logger.error('[StyleSettingPage] fetch failed', err)
loaded 态:
  → 渲染 _FormHeader + _OptionList(v-for 3 项 StyleSettingOptions)+ _ActionBar「保存」
  → 按钮 disabled 判定:isDirty=false → 灰 50% + pointer-events: none
  → 用户点某行 → selectedStyle 更新 + logger.info('style switched', { from, to })
  → 按钮 enabled:isDirty=true → primary 渐变可点
saving 态(viewMode='saving',并行 PUT,本页面**不**写本地 storage):
  → 调 userStore.updateProfile({ explanation_style: selectedStyle })
    - internal: PUT /api/preferences body { user_id: 1, preferences: { explanation_style } }
    - Success: currentStyle = selectedStyle(本地同步)+ viewMode = 'saved'
      Toast「已保存」+ setTimeout(200ms) → uni.navigateBack() 回 MyPage
      MyPage.onShow 自动 re-fetch(per MyPage §5.1)
    - Failure: saveError = mapSaveError(err) + viewMode = 'error' + lastErrorSource = 'put'
saved 态(瞬时态,≤ 200ms): ✓ 大对勾 + strings.savedText + setTimeout(200ms) 后 navigateBack
error 态: _ErrorPanel + 「重试」按钮 → 根据 lastErrorSource 决定重试方向
  → GET 失败 → 重新调 userStore.fetchPreferences()(loading 态)
  → PUT 失败 → 重新调 doSave(selectedStyle 保留,saving 态)
onBack(Header「←」/ 系统返回手势):走 §5.4 简化决策
  → 直接 uni.navigateBack()(不弹草稿弹窗,不调任何 API,不写本地 storage)
  → logger.info('back, no changes saved', { currentStyle, selectedStyle, isDirty })
onUnmounted: logger.debug 兜底,不重置 formData(由 Vue 自动 GC)
```

### Key contracts
- **3 选项 1:1 对齐 ExplanationStyle**(per §6.4.1):`StyleSettingOptions[].value` 严格等于 `'professional' | 'fun' | 'children'` 3 枚举字面;**不**做"按名字猜映射";UI 3 选项**不**改 API、**不**扩 mock、**不**新增字段
- **PUT partial-update 1 字段纪律**(per §6.4.2 + §10.8 C-6):`userStore.updateProfile({ explanation_style })` → `services/preferences.updatePreferences({ explanation_style })` → body `{ user_id: 1, preferences: { explanation_style } }`;`travel_pace` / `interests` / `special_needs` 3 字段**不**发(避免误覆盖其他用户设置);**不**调用 `services/preferences.updateUserInfo`(PersonalProfilePage 专用 `{ interests }` 薄包装,语义混淆)
- **navigateBack vs reLaunch**:PUT 成功后 `uni.navigateBack()`(保留 stack,因 MyPage 在 stack 里由其 `onShow` re-fetch);**不**用 `uni.reLaunch`(区别于 MyPage 退出登录)
- **onMounted 替代 onLoad**(沿 PersonalProfilePage / TripDetailPage / SpotDetailSheet / PhotoGuidePage 模式):本工程未显式列 `@dcloudio/uni-app` 依赖,fallback 用 `getCurrentPages()` 末项 options 读 URL query
- **MVP 简化决策**:`selectedStyle` 永远有值(`null` → fallback `'professional'`,per §5.3 J);`isDirty` 派生时 `currentStyle || FALLBACK_STYLE`(per §5.5 isDirty 算法);`canSave` = `!isSaving && isDirty`(per §3.6)
- **不**写草稿 / **不**弹 `_DraftConfirmDialog`(per §4.6 + §5.4 MVP 简化决策):单选 + 1 字段无草稿价值,用户切错再切回即可
- **错误归一**(spec §5.5 + §6.1 Error 表):`mapSaveError(err)` → 4000||400→errorBadRequest / 5000||5xx→errorServer / 其它(含 isNetworkError)→errorNetwork;**不**暴露后端 stack / SQL,只显示 `saveError` 友好提示
- **`_ErrorPanel` 形态独立**(per §3 备注 3 + §8.2):本页面 error 态用全屏 icon + message + btn-retry 三段,**不**复用 `_ErrorBanner` 横向 banner;**不**自造 `_ErrorPanel.vue` 私有组件(沿 PersonalProfilePage `_ErrorPanel` inline 渲染惯例,各 page 独立 inline)

### AC anchors (spec §9)
- AC-01 (loading 态进场 + fadeSlideUp 0.45s + fetchPreferences) → onMounted → onLoadPage → fetchPreferences
- AC-02 (loaded 态 + 3 行 v-for + 「保存」disabled + _FormHeader userId + 当前风格短标签) → template `v-else-if="viewMode === 'loaded'"` 分支
- AC-03 (用户点第 3 行「亲子」→ selectedStyle 更新 + 重新渲染 + 「保存」enabled) → onSelectOption
- AC-04 (用户点「保存」→ saving + PUT body `{ user_id, preferences: { explanation_style } }`) → onSave → doSave
- AC-05 (PUT 成功 → currentStyle 同步 + saved 200ms + Toast + navigateBack) → handleSaveResult success 分支 + setTimeout(200)
- AC-06 (PUT 失败 → error 态 + 「重试」按钮 + selectedStyle 保留) → handleSaveResult failure 分支
- AC-07 (GET 失败 → error → 「重试」→ loading + 重新 fetch) → onRetry lastErrorSource==='get' 分支
- AC-08 (新用户首登 currentStyle=null → fallback 'professional' + 「保存」disabled) → pickCurrentStyle null 分支 + isDirty 算法
- AC-09 (切了风格未保存 → onBack → navigateBack 不调 API) → onBack 简化路径
- AC-10 (Shanshui 调色板 + Noto 字体 + 选中态描边 + 主按钮渐变) → 全局 AppColors 引用 + 0 console.*
- AC-11 (44pt 触达 4 类元素:Header「←」 / 3 选项 row 112rpx / 「保存」88rpx / _ErrorPanel「重试」88rpx) → 各按钮 min-height: 88rpx
- AC-12 (12+ 关键事件 logger.info / warn / error,0 console.*) → utils/logger.js 引用

### PageStatus
- `Architecture.status`: Pass (2026-06-04 09:00, 9 项审核项全过, arch 留 6 条软观察, 见 issues/Arch/StyleSettingPage-001.md)
- `Development.status`: NotStarted → Completed (2026-06-04, 6 核心文件落盘)
- `FinalStatus`: NotStarted → ReadyForReview
- `Review.{ui,spec,test}`: Pending (awaiting 3 reviewers)

### Reviewer checklist anchors
- AC-01..AC-12 → spec §9 (12 AC 全部按 spec 字面实现)
- 5 视图态决策 / 视图决策算法 → spec §3.7 + §4.1 + §5.1 + §5.2 + §5.5
- 10 异常路径 A-J(网络断开 / 5xx / 4xx / 401 全局拦截 / saving 失败 / navigateBack 失败 / 新用户首登 / 二次保存 / 重试方向 / 切错不保存)→ spec §5.3
- 复用决策矩阵(R-1~R-9 + 6 条 arch 软观察)→ spec §3.8 + §10 + issues/Arch/StyleSettingPage-001.md
- 2 PD-001 Resolved 子节(§6.4.1 3 选项 1:1 语义对齐 + §6.4.2 PUT partial-update 1 字段纪律)→ spec §6.4
- NFR(44pt 触达 / 5 视图态 / H5 ≥1024px / Shanshui 调色板 / logger / i18n 钩子 / 性能 < 200ms 缓存命中 / saved 200ms)→ spec §10
- code-writer 强约束 C-1~C-10 全部落地 → spec §10.8 末段
- 1 task vs spec 冲突决策(私有 `_StyleOptionCard.vue` 创建 vs spec §8.3 「可任选」决策)— task 显式要求新建,spec §8.3 允许私有提取(MVP YAGNI,**不**抽公共);沿用项目惯例(PhotoGuidePage 私有 `_ClearChatConfirmDialog` / EditTripPage 私有 `_DraftConfirmDialog` / TripDetailPage 私有 `_DeleteConfirmDialog` / MyPage 私有 `_LogoutConfirmDialog` / NewTripPage 私有 `_DraftConfirmDialog` / PersonalProfilePage 私有 `_GenderChipGroup` + `_AgeChipGroup`),详见 outputs/ssp-dev/deliverable.md §3
- **0 净新增 store / service / 公共子组件 / 路由** — AppRoutes.StyleSetting 已预声明;styleSettingStore/styleStore/preferencesStore **不**新建(spec §7.2 + C-7 严禁);services/style.js **不**新建(spec §10.8 C-8 严禁)

---

<a id="trashpage"></a>

## TrashPage — 2026-06-04 — v0.1.0

### Implemented
- `pages/trash/index.vue` — 独立 route 化回收站页(uni.navigateTo from MyPage 菜单项 2 拉起,无 URL params);4 视图态(`loading` / `loaded` / `empty` / `error`)互斥 v-if 切换;`_Hint` 顶部小提示条 + `_TrashList` 多条 `_TrashItemRow` + `_PermanentDeleteConfirmDialog` 2 按钮 Danger 配色 modal;Header「←」返回走 4 路径 + 1 兜底(uni.navigateBack + reLaunch My)
- `pages/trash/components/_TrashItemRow.vue` — 页面私有 1 行已删行程卡片;3 props(`trip` / `isRestoring` / `statusLabel`)+ 2 emits(`restore` / `permanent-delete`);3 段布局(`_ItemHeader` 标题 + 状态徽章 / `_ItemMeta` 城市 + 日期范围 / `_ItemActions` 「恢复」+「永久删除」2 按钮 flex 1 各);底部 2 按钮 `min-height: 88rpx = 44pt` 触达;`isRestoring=true` 时 2 按钮 opacity 0.5 + pointer-events none + 恢复按钮左侧小转圈
- `pages/trash/components/_PermanentDeleteConfirmDialog.vue` — 页面私有 2 按钮 modal;5 props(`visible` / `title` / `message` / `btnConfirmLabel` / `btnCancelLabel`)+ 2 emits(`confirm` / `cancel`);沿用 MyPage `_LogoutConfirmDialog` 形态:Danger 渐变主按钮 + surfaceWarm 次按钮 + 蒙层 rgba(0,0,0,0.4) + fadeIn 0.2s + slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)
- `stores/trashStore.js` — Pinia setup-store 形式;4 state(`trashedTrips: TripSummary[]` / `error: ApiError | null` / `isFetching: boolean` / `restoringId: number | null` 单值防并发)+ 3 action(`fetchTrash` 调 `services/trips.listDeletedTrips` / `restoreTrashById` 乐观更新 + 回滚 + 404 静默 / `clearTrash` onUnmounted 兜底)+ 1 helper(`clearLoadError` 重试前清空 error)
- `services/trips.js` — 增量 `listDeletedTrips()`(GET `/api/trips?user_id=1` + success 内 `body.data.trips.filter(t => t.status === 'deleted').sort((a, b) => b.id - a.id)` + resolve,失败走既有 `mapSuccess` / `mapFail` helper;**不**传 `data: { status: 'deleted' }`,因后端不支持);复用 `ApiError` class + `mapSuccess/mapFail` helper
- `api/mock/_seed.ts` — 增量 `seedTrip4` + `seedTrip5`(2 条 `status='deleted'` 演示数据,per spec §6.4.4 + §10 C-3);`seedTrips` 数组 push 2 条
- `pages.json` — 新增 `pages/trash/index` 路由注册(项目第 10 个 page);style 沿用 my / home / new-trip / trip-detail / edit-trip / photo-guide / guide-result / personal-profile / style-setting 的 custom + `#FDFBF7/#F7F3EC`,`navigationBarTitleText: '回收站'`(与 `TrashPageStrings.title` 对齐)
- `constants/strings.js` — 新增 `TrashPageStrings` 段(20 键:顶栏 2 / Loading 1 / 提示条 1 / 列表项 5 / 永久删除弹窗 5 / 空态 2 / 错误兜底 3 / H5 aria 1);错误兜底 3 键**引用**既有 `OnboardingStrings.errorXxx` + `NewTripStrings.errorFallback` 字面值(per spec-writer-patterns §13「Trigger upstream constants」决策,沿用 MyPage / PhotoGuidePage / EditTripPage / NewTripPage / PersonalProfilePage 6 段先例)

### 复用决策(spec §3.5 + §3.6 + §10 R-1~R-3 强制清单)
- **复用 ⭐ 零修改**:`AppColors` / `AppRoutes.Trash`(已预声明 `constants/routes.js:19`)/ `AppRoutes.My` / `AppRoutes.Home` / `useUserStore` / `useHomeStore`(只 import 不调 `fetchTrips`)/ `HomeTripStatusLabel.deleted = '已结束'`(状态徽章,沿用 `HomeStrings.tripStatusFinished` 字面)/ `OnboardingStrings.retry`(_ErrorBanner 内部已绑)/ `OnboardingStrings.errorNetwork` / `errorServer` + `NewTripStrings.errorFallback`(3 键错误兜底引用,per §10 C-1 强约束)/ `services/preferences.ApiError`(services/trips.js + stores/trashStore.js 跨域复用)/ `services/trips.updateTrip`(恢复操作复用,EditTripPage 已用)/ `components/EmptyState.vue`(整页 empty 态,per R-1)/ `components/_ErrorBanner.vue`(整页 error 态,per R-2)/ `utils/logger`(16+ 关键事件 0 console.*)
- **新建 🟦**:`pages/trash/index.vue` + `pages/trash/components/_TrashItemRow.vue` + `pages/trash/components/_PermanentDeleteConfirmDialog.vue` + `stores/trashStore.js`
- **不复制**:`components/TripCard.vue`(HomePage 活跃 trip 卡片含 tap 跳详情,本页面无跳详情需求)/ `components/NextButton.vue`(单 CTA 场景)/ `pages/my/components/_LogoutConfirmDialog.vue`(形态同 2 按钮 + Danger 配色但 props / emits 微调,沿用 _ 前缀私有惯例)
- **MVP 不复用**:`components/SpotCard.vue` / `components/SpotDetailSheet.vue` / `pages/photo-guide/components/_ClearChatConfirmDialog.vue` / `pages/edit-trip/components/_DraftConfirmDialog.vue` / `pages/new-trip/components/_DraftConfirmDialog.vue` / `pages/trip-detail/components/_DeleteConfirmDialog.vue`(语义不匹配,各 page 独立)
- **不修改**:`stores/homeStore.js`(本页面只读 + 不调 `fetchTrips`,语义不同不污染)/ `stores/userStore.js` / `services/home.js` / `services/preferences.js` / `components/_ErrorBanner.vue` / `components/EmptyState.vue` / `components/TripCard.vue` / `constants/colors.js` / `constants/routes.js`(spec §3.6 强约束)

### State composition (4 视图态)
- `viewMode: 'loading' | 'loaded' | 'empty' | 'error'`(spec §3.4 严格 4 枚举)
- `permanentDeleteDialogTripId: number | null` — 当前弹出永久删除确认弹窗的 trip id(`null` = 弹窗关闭)
- `permanentDeleteDialogVisible: boolean` — 永久删除确认弹窗显示标记(冗余于 tripId !== null,便于 template 简化)
- 4 个 store state:trashedTrips / error / isFetching / restoringId(单值 number | null,非 boolean 数组,防双击 + 防并发,沿用 EditTripPage §3.3 Stale setTimeout guard 模式)
- **不**有 `hasFetchedOnce` 局部 ref(本页面无此 gate 需求,onShow 强制重拉,per §4.3 决策)

### 视图决策算法(spec §5.1 + §5.4)
```
onMounted / onShow → fetchAndDecide:
  → viewMode='loading' + clearLoadError() + await fetchTrash()
  → 成功:decideViewMode() → trashedTrips.length > 0 → 'loaded',否则 → 'empty'
  → 失败:decideViewMode() → 'error'(store.error 已被 fetchTrash 内部消化)
```

### Key contracts
- **listDeletedTrips 前端 GET 全量 + JS filter**(per spec §6.4.1 PD-001 + orchestrator 2026-06-04 09:15 steer):`uni.request({ url: BASE_URL + '/api/trips', method: 'GET', data: { user_id: MVP_USER_ID } })` → success 内 `body.data.trips.filter(t => t.status === 'deleted').sort((a, b) => b.id - a.id)` → resolve;**不**传 `data: { status: 'deleted' }`(后端会忽略);未来若后端补 `?status=deleted` 支持,filter 退化走 `||`(零成本切换);复用既有 `mapSuccess/mapFail` helper(per spec §7.2)
- **乐观更新 + 回滚协议**(per spec §7.3 + AC-03/04/05):`restoreTrashById(tripId)` 内部 `findIndex 提前取 idx` → 乐观更新 `trashedTrips.filter(t => t.id !== tripId)` + `restoringId = tripId` + `error = null` → `await servicesUpdateTrip(tripId, { status: 'active' })`;成功 → `restoringId = null` + Toast「已恢复」+ viewMode 重新决策(可能切 empty);失败(非 404)→ `splice(idx, 0, trip)` 回滚 + `restoringId = null` + `error = err` + `throw`;**404/4001 静默路径**(per spec §5.3.H + AC-06):不回滚不切 error,trip 已被自动清理
- **永久删除 UI 简化路径**(per spec §6.4.2 PD-001 + AC-09):点击「永久删除」→ 弹 `_PermanentDeleteConfirmDialog`(2 按钮 + Danger 配色)→ 确认 → `dialogVisible = false` + `uni.showToast({ title: '30 天后将自动清理,暂不支持手动永久删除', icon: 'none', duration: 2500 })` + return;**不**调任何 API / store / service;**不**修改 `trashedTrips`;**不**写 storage
- **onUnmounted 兜底**(per spec §3 备注 7 + §5.1 + AC-15):`trashStore.clearTrash()` 清空 trashedTrips / error / isFetching / restoringId;避免下次进入页面看到上次残留(数据是删除行,变化频繁)
- **onShow 强制重拉**(per spec §4.3 决策):trashedTrips 是删除行语义,数据可能频繁变化(用户从 TripDetailPage soft-delete 后返回);onShow → fetchAndDecide(无缓存命中);onMounted 飞行中跳过避免并发
- **onBack 4 路径 + 1 兜底**(per spec §5.5 + AC-15):Header「←」/ 系统返回手势 → `uni.navigateBack({delta:1, fail: () => uni.reLaunch({url: AppRoutes.My})})` → 兜底 reLaunch(My) 清空 stack(MyPage 是 tabBar);onUnmounted 兜底 + logger.debug
- **不调 homeStore.fetchTrips()**(per spec §1 + §7.1):恢复后由 HomePage onShow 自动重拉,避免本页面主动触发 homeStore 刷新造成耦合;trashStore 内 **0** 调 `useHomeStore`(grep 验证 0 命中)
- **状态徽章文案复用**(per spec §3.5 复用性约束):`status='deleted'` 复用同 `finished` 短标签「已结束」(`HomeTripStatusLabel.deleted` 已配置,per `constants/strings.js:211`);**不**在 TrashPageStrings 重复定义
- **错误归一**(spec §5.4 伪代码 + §6.1 Error 表):`mapErrorToMessage(err)` → 4000||400→errorFallback / 5000||5xx→errorServer / 其它(含 isNetworkError)→errorNetwork;**不**暴露后端 stack / SQL
- **H5 ≥1024px 居中**(per spec §3.7 + AC-12):`@media (min-width: 1024px) { .body-inner { max-width: 640rpx; margin: 0 auto; } }`,仅作用于内容容器,Header 不受限;移动端零变化;沿用 HomePage / MyPage / TripDetailPage / EditTripPage / PhotoGuidePage / GuideResultPage / PersonalProfilePage 8 连实证
- **44pt 触达 5 类元素**(per spec §10 NFR + AC-13):Header back 88rpx / 「恢复」+「永久删除」_TrashItemRow 2 按钮 88rpx / _PermanentDeleteConfirmDialog 2 按钮 88rpx / _ErrorBanner retry 88rpx
- **状态徽章视觉**:`AppColors.divider` 背景 + `AppColors.inkMuted` 文字 11px,沿用 TripDetailPage 状态徽章视觉(灰色弱化,符合"已删"语义)

### AC anchors (spec §9)
- AC-01 (loading 态进场 + fadeSlideUp + 转圈 + loadingText) → `pages/trash/index.vue` onMounted + `.panel-loading` 分支
- AC-02 (loaded 态 + 2 条 seedTrip4/5 + 4 视图元素) → `_LoadedBlock` + `_Hint` + `_TrashList` 多条 `_TrashItemRow` 完整渲染
- AC-03 (用户点「恢复」→ 乐观更新 + 切 empty 若 length=0) → onRestoreTap + trashStore.restoreTrashById 内部
- AC-04 (PUT 成功 → restoringId=null + Toast「已恢复」) → trashStore.restoreTrashById 成功分支 + page 端 uni.showToast
- AC-05 (PUT 失败 → 回滚 + error 态 + 重试拉全量) → trashStore.restoreTrashById catch 非 404 分支 + page onRetry
- AC-06 (PUT 404 静默 → 不回滚不切 error 态) → trashStore.restoreTrashById 404 分支
- AC-07 (用户点「永久删除」→ 弹 _PermanentDeleteConfirmDialog) → onPermanentDeleteTap
- AC-08 (取消 / 蒙层点击 → dialogVisible=false + 不调 API) → onPermanentDeleteCancel
- AC-09 (确认 → Toast「30 天后自动清理」+ 0 API + 不改 trashedTrips) → onPermanentDeleteConfirm
- AC-10 (empty 态 + EmptyState + 📦 + 「回收站空空如也」+ 无 CTA) → `_EmptyBlock` 整页用 EmptyState
- AC-11 (error 态 + _ErrorBanner + 重试按钮) → `_ErrorBlock` 整页 + mapErrorToMessage
- AC-12 (Shanshui 调色板 + 山水日志视觉) → 全局 AppColors 引用 + Noto 字体
- AC-13 (4 端兼容 + 44pt 触达 5 类元素) → 全按钮 min-height: 88rpx
- AC-14 (logger 14+ 关键事件 + 0 console.*) → utils/logger.js 引用,无 console 调用
- AC-15 (onBack 4 路径 + 1 兜底 + onUnmounted clearTrash) → onBack + onUnmounted

### PageStatus
- `Architecture.status`: Pass (2026-06-04 09:03, 9 项审核项全过, arch 留 6 条软观察, 见 issues/Arch/TrashPage-001.md)
- `Development.status`: NotStarted → Completed (2026-06-04 09:25, 5 核心文件落盘 + pages.json 第 10 个 page 注册 + mock seedTrip4/5 增量)
- `FinalStatus`: NotStarted → ReadyForReview
- `Review.{ui,spec,test}`: Pending (awaiting 3 reviewers)

### Reviewer checklist anchors
- AC-01..AC-15 → spec §9 (15 AC 全部按 spec 字面实现)
- 4 视图态决策 / 视图决策算法 → spec §3.4 + §4.1 + §5.1 + §5.4
- 12 异常流程 A-L(网络断开 / 5xx / 4xx / 401 全局拦截 / 恢复中网络断开 / 5xx / 4xx / 404 静默 / 连续点防抖 / 蒙层 / 反复点回收站 / 中途返回)→ spec §5.3
- 乐观更新 + 回滚协议(per §7.3)+ 404 静默路径(per §5.3.H + AC-06)→ trashStore.restoreTrashById
- 永久删除 UI 简化(per §6.4.2 + AC-09)→ _PermanentDeleteConfirmDialog 2 次确认 + Toast「30 天后自动清理」+ 0 API
- 复用决策矩阵(R-1~R-3 强制清单 + 6 条 arch 软观察)→ spec §3.5 + §10 + issues/Arch/TrashPage-001.md
- 2 PD-001 Resolved 子节(§6.4.1 GET 全量+JS filter / §6.4.2 永久删除 UI 简化)+ 2 bonus Resolved(§6.4.3 deleted_at sort / §6.4.4 mock 增量)→ spec §6.4
- NFR(44pt 触达 / 4 视图态 / H5 ≥1024px / Shanshui 调色板 / logger / i18n 钩子 / 性能 < 30ms 列表渲染)→ spec §10
- code-writer 强约束 C-1~C-5 全部落地 → spec §10 末段
- 1 task vs spec 冲突决策(任务原文「listDeletedTrips 走后端过滤」与 spec §6.4.1 实际「前端 GET 全量 + JS filter」不符,属任务描述笔误,spec 形状仍合理 + 已自我纠正)— orchestrator 2026-06-04 09:15 steer 已 ack 沿用「前端 filter」路径,避免误建 `data: { status: 'deleted' }` 调用模式(per arch-reviewer 软观察 ①)
- 1 spec 笔误登记(spec §4.4 字面写 `OnboardingStrings.errorFallback` 但实际**无**此键)→ 沿用项目惯例(per MyPage / PhotoGuidePage / EditTripPage / NewTripPage / PersonalProfilePage 6 段先例)引用 `NewTripStrings.errorFallback` 字面值 `系统错误,请稍后重试`,不重复定义
- **0 净新增公共子组件 / 跨 store 引用** — _TrashItemRow + _PermanentDeleteConfirmDialog 私有;trashStore 内 **0** 调 `useHomeStore`(grep 验证 0 命中承诺)

---

<a id="notificationsettingpage"></a>
## NotificationSettingPage — 2026-06-04 — v0.1.0

### Implemented
- `pages/notification-setting/index.vue` — 独立 route 化通知设置页(uni.navigateTo 拉起,无 URL param);5 视图态(`loading` / `loaded` / `saving` / `saved` / `error`)互斥 v-if 切换;`uni.setStorageSync` 同步写后 `uni.navigateBack()`(保留 stack)→ MyPage.onShow(实际 MyPage 不感知,本页是 client-only);~840 行(包含 26 keys NotificationSettingStrings + 7 keys Defaults + 4 开关 configs + 5 视图态 + 7 字段 4 段表单 + saved 200ms 瞬时态 + H5 居中)
- `pages/notification-setting/components/_NotificationSwitchRow.vue` — 页面私有通知类别行(icon + title + desc + uni-switch);4 props(`icon` / `title` / `desc` / `isOn`)+ 1 emit(`update:isOn`)+ slot-free;整行 min-height 96rpx = 44pt 触达(spec §3.4 + §10.2)
- `pages/notification-setting/components/_QuietHoursRow.vue` — 页面私有静默时段卡(QHHeader toggle + 可选 QHPickers 2 列);5 props(`enabled` / `start` / `end` / `startLabel` / `endLabel`)+ 3 emits(`update:enabled` / `update:start` / `update:end`)+ slot-free;QHPickers 仅 enabled=true 时显示,2 个 `<picker mode="time">` 跨端组件;fadeIn 0.2s 动效
- `pages.json` — 新增 `pages/notification-setting/index` 路由注册(项目第 12 个 page,实际业务 page 第 11 个,spec §10.8 C-4 字面写「第 11 个」属 spec 笔误 — spec 写时 TrashPage 尚未注册,本任务以当前 pages.json 实际状态为准);style 沿用 onboarding/home/my 的 custom + `#FDFBF7/#F7F3EC`,`navigationBarTitleText: '通知设置'`(与 `NotificationSettingStrings.title` 对齐)
- `constants/strings.js` — 新增 `NotificationSettingStrings` 段(26 键:顶栏 2 / 加载 1 / 表单头 2 / 段标题 2 / 4 开关标题 4 / 4 开关描述 4 / 静默时段 2 / picker 标签 + placeholder 4 / 提交按钮 1 / 提交态 1 / 完成态 + Toast 2 / H5 aria 1,spec 字面 "~17 键 / ~22 键" 与 C-1 详细 list 26 不一致,deliverable §3.4 显式登记);新增 `NotificationSettingDefaults`(`Object.freeze` 7 键对象,1:1 对齐 `NotificationPrefs` 7 字段);新增 `notificationSwitchConfigs`(`Object.freeze` 4 键数组,`key/icon/title/desc/defaultOn` 5 字段,顺序 = 行程提醒 > 同伴动态 > 系统消息 > 营销,引用 `NotificationSettingStrings.titleXxx` / `descXxx` 8 键字面,**不**重复定义)
- `constants/routes.js` — **不修改**(`AppRoutes.NotificationSetting: '/pages/notification-setting/index'` 已在 L18 预声明,沿用 spec §3.8 复用决策)
- `stores/userStore.js` — **不修改**(spec §7.2 + C-7 严禁修改)
- `services/preferences.js` / `services/home.js` / `services/trips.js` / `services/photos.js` — **不修改**(spec §7.3 + C-9 严禁修改)

### 复用决策(spec §3.8 + §10 R-1~R-9 强制清单)
- **复用 ⭐ 零修改**:`AppColors`(山水日志配色)/ `AppRoutes.NotificationSetting`(`constants/routes.js:18` 已预声明)/ `OnboardingStrings.retry`(「重试」按钮文案)/ `OnboardingStrings.errorFallback`(错误兜底,**不**重复定义)/ `components/_ErrorBanner.vue` ⭐(整页 error 态 `message` + `retryable` + `@retry`)/ `utils/logger.js`(`info` / `warn` / `error` / `debug` 4 等级,15+ 关键事件埋点)
- **新建 🟦**:`pages/notification-setting/index.vue`(~620 行)+ `pages/notification-setting/components/_NotificationSwitchRow.vue`(~190 行)+ `pages/notification-setting/components/_QuietHoursRow.vue`(~330 行)(页私有 5 props + 3 emits)
- **不复制**:`_StyleOptionCard`(单选 + 大卡片 vs 4 toggle + 小行,形态不符)/ `_GenderChipGroup` / `_AgeChipGroup`(chip 形态 vs switch + picker 形态不符)/ `_DraftConfirmDialog` / `_ClearChatConfirmDialog` / `_LogoutConfirmDialog` / `_DeleteConfirmDialog`(沿项目惯例,**不**跨目录 import 任何 page 私有组件)
- **MVP 不调**:`GET /api/preferences` / `PUT /api/preferences` / `userStore.fetchPreferences` / `userStore.updateProfile` / `userStore.updateUserInfo` / `services/preferences.*`(任何 ApiError 跨域复用也**不** import,per §6.4.1 PD-001 决策 — 后端 `Preferences` 4 字段无 `notification_preferences`,0 字段匹配)
- **MVP 不调**:`uni.request` / `uni.uploadFile` / `uni.authorize` / `uni.getSetting` / `uni.openSetting`(per §6.3 + §6.4.2 MVP 简化决策);**只**用 `uni.getStorageSync` / `uni.setStorageSync` / `uni.navigateTo` / `uni.navigateBack` / `uni.showToast` 5 类跨端 API
- **MVP 不存**:**不**写草稿 / **不**弹 `_DraftConfirmDialog` / **不**显示通知权限顶部 banner(per §4.6 + §5.4 + §6.4.2 MVP 简化决策)
- **MVP 不建**:**不**新建 `notificationSettingStore` / `notificationStore` / `preferencesStore` / `services/notification.js`(per §7.2 严禁新建)
- **不修改**:`stores/userStore.js` / `services/preferences.js` / `services/home.js` / `services/trips.js` / `services/photos.js` / `components/_ErrorBanner.vue` / `pages.json` `tabBar.list` / `constants/colors.js` / `constants/routes.js`(spec §1 复用决策 + C-7/C-9 强约束)

### State composition (5 视图态)
- `viewMode: 'loading' | 'loaded' | 'saving' | 'saved' | 'error'`(spec §3.7 + §4.1 严格 5 枚举,spec-auditor 严格核对 5 枚举,不许第 6 个)
- `notificationPrefs: NotificationPrefs` — 7 字段,永远有值(MVP 简化 `null` 不可达,storage miss / 损坏 → fallback `NotificationSettingDefaults`,per §5.1 + §5.3 A/B)
- `originalPrefs: NotificationPrefs` — onLoad 拉 storage 成功后的原始快照(可能是 `NotificationSettingDefaults` fallback)
- `saveError: string | null` — storage 写失败的友好提示,驱动 `_ErrorBanner` 渲染(MVP 简化,统一 `OnboardingStrings.errorFallback` 兜底,per §5.5)
- `hasFetchedOnce: boolean` — 首次拉取完成标记(沿 `HomePage §4.1` 模式)
- `isDirty: computed` — `!isPrefsEqual(notificationPrefs, originalPrefs)`,7 字段深比较(per §5.5 `isPrefsEqual`)
- `isSaving: computed` — `viewMode === 'saving'`
- `canSave: computed` — `!isSaving && isDirty`(per §3.5 + §3.6)

### 视图决策算法(spec §5.1 + §5.2 + §5.5)
```
onMounted:
  → 初始化 local state:viewMode='loading' / notificationPrefs=NotificationSettingDefaults /
    originalPrefs=NotificationSettingDefaults / saveError=null / hasFetchedOnce=false
  → 调 uni.getStorageSync('notification_prefs'):
    - 命中(有效 JSON + 7 字段形状校验通过,per §5.5 sanitizePrefs):
        notificationPrefs = 解析值
        originalPrefs = clonePrefs(解析值)
        hasFetchedOnce = true
        viewMode = 'loaded'
        logger.info('[NotificationSettingPage] storage hit', notificationPrefs)
    - miss / 损坏 / 校验失败:
        静默降级:notificationPrefs = NotificationSettingDefaults
        originalPrefs = NotificationSettingDefaults
        hasFetchedOnce = true
        viewMode = 'loaded'
        logger.warn('[NotificationSettingPage] storage miss or invalid, fallback to defaults', cached)

用户操作:
  → switch toggle:onSwitchToggle(key, value) → notificationPrefs = {...prev, [key]: value}
    → logger.info('[NotificationSettingPage] switch toggled', { key, value })
  → quiet hours toggle:onQuietHoursToggle(enabled) → notificationPrefs = {...prev, quiet_hours_enabled: enabled}
    → logger.info('[NotificationSettingPage] quiet hours toggled', { enabled })
  → quiet hours start / end picker:onQuietHoursStartChange(value) / onQuietHoursEndChange(value)
    → notificationPrefs = {...prev, quiet_hours_start: value} / quiet_hours_end: value
    → logger.info('[NotificationSettingPage] quiet hours start/end changed', { start / end })

「保存」按钮 → onSave:
  → 校验:canSave (= !isSaving && isDirty)?
      if !canSave:logger.warn + return
  → viewMode = 'saving', saveError = null
  → logger.info('[NotificationSettingPage] save start', notificationPrefs)
  → 同步调 uni.setStorageSync('notification_prefs', notificationPrefs):
      Success:
        originalPrefs = clonePrefs(notificationPrefs)
        viewMode = 'saved', saveError = null
        logger.info('[NotificationSettingPage] save ok', notificationPrefs)
        uni.showToast({ title: saveSuccessToast, icon: 'success', duration: 1500 })
        setTimeout(200ms) → uni.navigateBack()  保留 stack
      Failure (throw — 罕见):
        saveError = OnboardingStrings.errorFallback
        viewMode = 'error'
        渲染 _ErrorBanner + 「重试」按钮
        logger.error('[NotificationSettingPage] save failed', err)

error 态「重试」 → onRetrySave:
  → logger.info('[NotificationSettingPage] retry', { source: 'STORAGE_WRITE' })
  → viewMode = 'saving', 重新调 doSave

Header「←」/ 系统返回 → onBack:
  → logger.info('[NotificationSettingPage] back, no changes saved', { isDirty, notificationPrefs })
  → uni.navigateBack()(沿 §5.4 MVP 简化,**不**弹草稿弹窗)

onUnmounted:
  → logger.debug('[NotificationSettingPage] onUnmounted, viewMode=...')
  → 释放引用:notificationPrefs / originalPrefs / saveError 重置(per §5.6 + §10.6 状态完整性)
```

### 关键 contracts
- **PD-001 触发**:UI 7 字段 vs `Preferences` 4 字段(`explanation_style` / `travel_pace` / `interests` / `special_needs`)**0 字段匹配**(per §6.4.1 Resolved 决策),走"改 UI 简化"路径:7 字段 100% client-only + 本地 `uni.setStorageSync('notification_prefs', payload)` 持久化 + **不**调 PUT 端点 + **不**扩 API + **不**动 mock
- **MVP 简化决策 3 项**:
  1. 通知权限检测:**不**调 `uni.authorize` / `getSetting` / `openSetting`(跨端 API 差异大,per §6.4.2)
  2. storage key 固定 `'notification_prefs'`,**不**与 userId 关联(MVP 单用户 '1' 隐含,per §6.4.3)
  3. 取消 / 返回 **不**弹草稿弹窗(per §4.6 + §5.4)
- **storage 异常静默降级**:`uni.getStorageSync` / `uni.setStorageSync` 异常 try-catch + `logger.warn` / `error` + fallback `NotificationSettingDefaults` / `errorFallback` 兜底(per §5.3 A-C)
- **route 一致性**:`AppRoutes.NotificationSetting: '/pages/notification-setting/index'`(`constants/routes.js:18`)+ `pages.json` path `pages/notification-setting/index` 1:1 对齐(spec §10.8 C-4 强约束 + arch 软观察 #1 SOP)
- **i18n 钩子**:22 键全部走 `NotificationSettingStrings` + 复用 `OnboardingStrings.retry` / `errorFallback`,**不**重复字面值(per §10.4 国际化纪律 + C-11 强约束)
- **state 完整性**:5 视图态 v-if 互斥链,`notificationPrefs` 永远有值,`onUnmounted` 兜底释放引用(per §10.6 状态完整性)

### 关键代码位置(spec 关键决策点)
- 5 视图态 v-if 互斥链:`pages/notification-setting/index.vue` L82/L88/L177/L186/L197(严格 5 枚举,spec-auditor 严格核对)
- 4 开关 v-for 渲染 + `_NotificationSwitchRow` 私有子组件:L107-L116
- 1 静默时段 `_QuietHoursRow` 私有子组件 + 2 picker:L131-L140
- 7 字段形状校验 `sanitizePrefs` + 深比较 `isPrefsEqual`:L235-L292(per §5.5 派生算法)
- `STORAGE_KEY` 常量 + storage 异常 try-catch:L206 + L312-L322
- onLoad 同步 storage 读 + 静默降级:`onLoadPage` L302-L322 + `loadFromStorage` L324-L348
- onSave 校验 + sync setStorageSync + saved 200ms + Toast + navigateBack:`onSave` L408-L425 + `doSave` L434-L445 + `handleSaveResult` L452-L478
- onRetrySave 闭环重试:L488-L494
- onBack §5.4 简化(无草稿弹窗):L355-L362
- onUnmounted 兜底释放引用:L533-L541
- @media (min-width: 1024px) `.body-inner { max-width: 640rpx; margin: 0 auto; }` L802-L807(spec §3.7 H5 兼容性)
- 15+ 关键事件 `logger.info` / `warn` / `error` / `debug` 全覆盖:`onLoadPage` / `loadFromStorage`(hit + miss)/ `onBack` / `onSwitchToggle` / `onQuietHoursToggle` / `onQuietHoursStartChange` / `onQuietHoursEndChange` / `onSave`(blocked + start)/ `doSave`(failed)/ `handleSaveResult`(ok)/ `onRetrySave` / `navigateBack`(failed)/ `onUnmounted`
- 0 console.* leak(grep 验证:全文 0 `console.` 命中)
- 0 触发 API(grep 验证:全文 0 `uni.request` / `uni.uploadFile` 命中,per §6.3 + C-7 + C-12 强约束)
- 0 修改 `userStore.js` / `services/*` / `components/_ErrorBanner.vue` / `constants/colors.js` / `constants/routes.js`(per C-9 强约束)

### NFR(spec §10 全部落地)
- **44pt 触达 8 类 8 元素全部 88rpx**:Header「←」/ 4 开关 row(`_NotificationSwitchRow` 整行)/ 静默时段 toggle(`_QuietHoursRow` QHHeader 整行)/ 2 picker(QHPickers 容器 min-height 80rpx 沿 NewTripPage §3.5)/ 「保存」CTA / `_ErrorBanner`「重试」+ panel-error `btn-retry` 兜底按钮
- **H5 ≥1024px 居中**:`@media (min-width: 1024px) { .body-inner { max-width: 640rpx; margin: 0 auto; } }` L802-L807(沿 StyleSettingPage §3.7 模式)
- **Shanshui 调色板**:`#F7F3EC` surface / `#FDFBF7` surfaceCard / `#F2EBE0` surfaceWarm / `#2D6A5E` primary / `#3D8B7D` primaryLight / `#2C2C2C` ink / `#5A5A5A` inkLight / `#9A9A9A` inkMuted / `#C44A3A` danger / `rgba(45, 106, 94, 0.35)` primaryShadow — 0 越界 16 进制
- **字体**:`'Noto Serif SC', serif` 标题 / `'Noto Sans SC', sans-serif` 正文 — 0 其它字体
- **动效**:`pageEnter 0.45s ease-out` / `spin 0.8s linear infinite` / `qhFadeIn 0.2s ease-out` / hover `scale(0.96)` 0.15s
- **i18n 钩子**:22 键 `NotificationSettingStrings` 全部走 `constants/strings.js`,**不**重复定义 `OnboardingStrings.retry` / `errorFallback` 字面值
- **性能**:首屏 < 100ms(storage 命中,sync read)/ < 200ms(miss 路径)/ storage 写 < 50ms(sync write)/ saved 200ms 瞬时态后 navigateBack / 0 网络请求
- **可观测性**:15+ 关键事件 `logger.info` / `warn` / `error` / `debug` 4 等级,0 console.* leak
- **状态完整性**:5 视图态 v-if 互斥 + `notificationPrefs` 永远有值 + `onUnmounted` 兜底释放引用(per §10.6)
- **安全性**:0 调 API / 0 payload / storage 仅存 7 字段公开信息(无 token / 密码 / 手机号)/ 错误信息不暴露原始 stack(只显示 `saveError` 友好提示)

### 复用决策矩阵(spec §3.8 + §10 R-1~R-9 + C-1~C-15 强约束 15/15 全部落地)
- R-1:复用 `AppColors` ⭐(import 自 `constants/colors.js` 字面 16 进制引用,无新增调色板)
- R-2:复用 `AppRoutes.NotificationSetting` ⭐(已预声明 `constants/routes.js:18`,**不**修改 routes.js)
- R-3:复用 `OnboardingStrings.retry` + `errorFallback` ⭐(**不**在 `NotificationSettingStrings` 重复定义,per C-11 强约束)
- R-4:复用 `components/_ErrorBanner.vue` ⭐(跨页通用,`message` + `retryable` + `@retry` 严格按 §8.2 契约,无 props 透传)
- R-5:复用 `utils/logger.js` ⭐(15+ 关键事件,4 等级,0 console.*)
- R-6:不调 `userStore` / `services.preferences` / 任何 API(per §6.4.1 PD-001 决策,反向 grep 0 命中)
- R-7:不新建 `notificationSettingStore` / `notificationStore` / `preferencesStore` / `services.notification.js`(per C-8 严禁新建)
- R-8:不存草稿 / 不弹 `_DraftConfirmDialog` / 不显示通知权限 banner(per §4.6 + §5.4 + §6.4.2 MVP 简化决策)
- R-9:不抽 `_NotificationSwitchRow` / `_QuietHoursRow` 公共子组件(per C-10 严禁,沿 `MyPage _MenuItem` / `StyleSettingPage _StyleOptionCard` YAGNI 决策)

### task vs spec 决策登记(1 元 spec 笔误 + 0 task 偏差)
- **1 元 spec 笔误**:`specs/NotificationSettingPage.md` §10.8 C-4 字面写"目前 10 个 page,本规格触发第 11 个" + §3.8 复用决策表 R-2 行写"pages.json 第 5 个 page";实际**当前** pages.json 已 11 个 page(含 `pages/trash/index`,trash-spec 2026-06-04 09:25 已注册),本任务落地为**第 12 个 page**;**沿 spec 路径 / 名称 / navigationBarTitleText 字面**实施,1 元 spec 笔误登记在 deliverable §3.4,不动 spec(spec-writer 越权边界);arch-reviewer 已 ack 沿 6 软观察 + 3 跨页观察 模式,无功能影响
- **0 task 偏差**:任务原文与 spec §10.8 C-1~C-15 强约束完全对齐(7 字段 client-only / 5 视图态 / 2 私有子组件 / 15 AC / MVP 简化决策 3 项 / 11 复用 / 0 改 store/service 等),按 spec 字面 + 任务字面 1:1 实施

---

<a id="loginpage"></a>
## LoginPage — 2026-06-04 — v0.1.0

### Implemented
- `pages/login/index.vue` — 独立 route 化登录占位页(uni.navigateTo 拉起,无 URL param,无 tabBar 入口);3 视图态(`loading` / `loaded` / `error`)互斥 v-if 切换;MVP 极简 — 无真实登录流(无手机号+验证码 / 无密码 / 无第三方登录按钮),仅展示「登录功能暂未开放」+ 「返回首页」逃生口
- `pages.json` — 新增 `pages/login/index` 路由注册(项目第 14 个 page);style 沿用 onboarding/home/my 的 custom + `#FDFBF7/#F7F3EC`,`navigationBarTitleText: '登录'`(与 `LoginPageStrings.title` 对齐)
- `constants/strings.js` — 新增 `LoginPageStrings` 段(7 键:顶栏 1 / Loading 1 / 主体 3 / 主 CTA 1 / H5 aria 1);错误兜底 0 键 + 「重试」按钮文案 0 键(per §3.5 复用决策 + 13 页面惯例,**不**在 `LoginPageStrings` 重复定义)
- `constants/routes.js` — **不修改**(`AppRoutes.Login: '/pages/login/index'` 已在 L34 预声明,沿用 spec §3.9 复用决策)

### 复用决策(spec §3.5 + §10 R-1~R-9)
- **复用 ⭐ 零修改**:`AppColors`(山水日志配色)/ `AppRoutes.Home`(已预声明 `constants/routes.js:12`)/ `OnboardingStrings.errorNetwork`(跨页错误兜底复用,本页面**不**在 `LoginPageStrings` 重复)/ `OnboardingStrings.retry`(_ErrorBanner 内部已绑)/ `components/_ErrorBanner.vue` ⭐(整页 error 态)/ `utils/logger.js`(10 关键事件,0 console.*)
- **新建 🟦**:`pages/login/index.vue`(1 个 SFC,~547 行,3 视图态 + Header「←」+ 120rpx emoji 圆形 + 主副消息 + 「返回首页」Primary 渐变按钮 + error 态整页 _ErrorBanner + 保留「返回首页」逃生口)
- **不复制**:`components/_ErrorBanner.vue` 整页复用(横向 banner 形态,error 态整页占位)
- **MVP 不调**:`POST /api/auth/login` / `POST /api/auth/send-code` / `POST /api/auth/verify-code` / `GET /api/users/me` / `GET /api/preferences` / `PUT /api/preferences` / `GET /api/trips` / 任何 auth/users/preferences/trips/photos/reminders 端点(per §6.1 反向 grep 8 项 ❌ 列表)
- **MVP 不建**:**不**新建 `useAuthStore` / `useLoginStore` / `useSessionStore` / `services/auth.js` / `services/login.js`(per §7.2 + C-8 严禁)
- **MVP 不抽**:`_LoginForm` / `_LoginButton` / `_OAuthButton` / `_PhoneInput` / `_CodeInput` / `_PasswordInput` / `_LoginConfirmDialog` 任何子组件(per §8.2 + C-9 严禁)
- **不修改**:`stores/userStore.js` / `stores/homeStore.js` / `services/preferences.js` / `services/home.js` / `services/trips.js` / `services/photos.js` / `components/_ErrorBanner.vue` / `constants/colors.js` / `constants/routes.js` / `pages.json` `tabBar.list`(spec §1 复用决策 + C-7/C-9 强约束)

### State composition (3 视图态)
- `viewMode: 'loading' | 'loaded' | 'error'`(spec §3.4 + §4.1 严格 3 枚举,spec-auditor 严格核对 3 枚举,不许第 4 个)
- `hasInitialized: boolean` — 首次模拟初始化完成标记,防 setTimeout 回调内 stale guard
- `simulateTimerId: ReturnType<typeof setTimeout> | null` — 200ms `setTimeout` 句柄,`onUnmounted` 兜底 `clearTimeout` 防内存泄漏(沿 NewTripPage §5.6 + PhotoGuidePage §5.6 stale setTimeout guard 模式)
- `errorMessage: string` — error 态兜底文案,默认 `OnboardingStrings.errorNetwork`(`'网络异常,请稍后重试'`,跨页复用)

### 视图决策算法(spec §5.1 + §5.2)
```
onMounted:
  → 初始化 local state: viewMode='loading' / hasInitialized=false / simulateTimerId=null / errorMessage=OnboardingStrings.errorNetwork
  → clearSimulateTimer() 防 onLoad 二次进入时堆叠(沿 NewTripPage §5.6 stale guard 模式)
  → logger.info('[LoginPage] onLoad enter')
  → setTimeout(200ms) → 回调内 guard `if (viewMode !== 'loading' || hasInitialized) return`(防 stale)→ viewMode='loaded' + hasInitialized=true + logger.info('[LoginPage] initialized (placeholder, no API)')

用户操作:
  → 点 Header「←」/ 系统返回手势 → onBack(§5.2 Step 2 + §5.3 A):
      clearPrepareTimer() 取消 setTimeout(若仍在)
      getCurrentPages().length > 1 → uni.navigateBack({delta: 1, fail: Toast「返回失败,请稍后重试」})
      无 stack(deep-link 直入)→ uni.reLaunch({url: AppRoutes.Home}) 兜底
      logger.info('[LoginPage] navigateBack' / '[LoginPage] back, no stack, reLaunch Home')
  → 点「返回首页」主按钮 → onBackHome(§5.2 Step 3 + §5.3 C):
      uni.reLaunch({url: AppRoutes.Home}) 清空 stack
      失败兜底 Toast
      logger.info('[LoginPage] back to home, reLaunch')
  → error 态点「重试」 → onRetry(§5.3 B):
      重新触发 onLoad 流程(模拟"重新初始化")
      viewMode='loading' + hasInitialized=false + 启动新 setTimeout(200ms)
      logger.info('[LoginPage] retry from error, re-init')

onUnmounted:
  → clearSimulateTimer() 兜底(防内存泄漏)
  → logger.debug('[LoginPage] unmounted, cleaned up timer')
```

### Key contracts
- **MVP 不接登录流(per §1 + §6.4.1 PD-001 Resolved)**:`api/types.ts` 全文 248 行 0 命中 `User` / `Session` / `LoginRequest` / `AuthToken` 类型;`docs/API接口文档.md` 0 命中 `/api/auth/*`;`api/mock/` 无 auth 域 mock;`services/` 4 文件均无 auth 相关;`stores/` 2 文件均无 auth 相关 — 5 处均**无** auth 模块;MVP 阶段 LoginPage = 纯静态占位页,0 API 0 store 0 service
- **3 视图态严格 3 枚举**:`viewMode` 仅 3 个值(`loading` / `loaded` / `error`),**不**新增第 4 个(per spec §3.4 + spec-auditor 校验规则)
- **200ms `setTimeout` 2 层 stale guard(per §5.1 + AC-02)**:onLoad 启动前 `simulateTimerId = null` 防堆叠 + 回调内 `if (viewMode.value !== 'loading' || hasInitialized.value) return` 防 stale + `onUnmounted` 兜底 `clearTimeout`;沿用 `NewTripPage` §5.6 / `PhotoGuidePage` §5.6 / `GuideResultPage` §5.5 模式
- **error 态保留「返回首页」逃生口(per §3.4 备注)**:与 loaded 态的 `_ActionButton` 行为一致,确保用户**始终**有逃生路径(避免被困)
- **0 API / 0 store / 0 service / 0 子组件 / 0 storage / 0 URL params(per spec §10 MVP 简化纪律)**:5 类资源 0 增量,完全复用既有 13 页面公共资源
- **H5 ≥1024px 居中(per §3.6 + §10 NFR Compatibility)**:沿用 `EditTripPage` §3.8 / `HomePage` §10 / `MyPage` §3.8 模式;`@media (min-width: 1024px) { .body-inner { max-width: 640rpx; margin: 0 auto; } }`,仅作用于页面内容容器,Header / 浮动按钮不受限
- **44pt 触达 88rpx(per AC-08 + §10 NFR)**:Header「←」88rpx / 「返回首页」主按钮 88rpx / `_ErrorBanner` 整页 retry 88rpx
- **logger 关键事件 0 console.\*(per AC-06 + §10)**:onLoad enter / initialized / navigateBack / navigateBack failed / back, no stack, reLaunch Home / back to home, reLaunch / reLaunch Home failed / retry from error, re-init / unmounted 10 关键事件全部 `logger.info / warn / error / debug`;`utils/logger.js` 引用,无 console 调用
- **不抽公共子组件(MVP YAGNI)**:4 UI 元素(Header「←」/ `_Icon` / `_MainMessage` / `_SubMessage` / `_ActionButton`)inline 渲染在 `pages/login/index.vue` 的 `<template>` 内,无 slot 透传

### AC anchors (spec §9)
- AC-01 (loading 态进场 + 居中转圈 + loadingText) → onMounted → onLoadPage + 200ms setTimeout
- AC-02 (loaded 态 200ms 后切到 + 🔒 + 主副消息 + 「返回首页」主按钮) → v-else-if + 回调内 guard
- AC-03 (「返回首页」主按钮 → uni.reLaunch Home + 本地释放) → onBackHome + uni.reLaunch
- AC-04 (Header「←」/ 系统返回手势 → stack 判定 + 不弹「确认离开」弹窗) → onBack + getCurrentPages.length 判定
- AC-05 (反向 grep uni.request / uni.uploadFile / /api/ 0 命中) → 0 命中承诺
- AC-06 (0 console.\* + 5+ 关键事件 logger) → utils/logger.js 引用
- AC-07 (0 store / 0 service / 0 新建) → grep 验证 0 命中
- AC-08 (44pt 触达 88rpx + H5 ≥1024px 居中 + 调色板 100% AppColors) → 全按钮 min-height: 88rpx + @media 1024px

### PageStatus
- `Architecture.status`: Pass (2026-06-04, 9 项审核项全过, arch 留 5 软观察 + 3 跨页观察, 见 issues/Arch/LoginPage-001.md)
- `Development.status`: NotStarted → Completed (2026-06-04, 4 核心文件落盘 + pages.json 第 14 个 page 注册)
- `FinalStatus`: NotStarted → ReadyForReview
- `Review.{ui,spec,test}`: Pending (awaiting 3 reviewers)

### Reviewer checklist anchors
- AC-01..AC-08 → spec §9 (8 AC 全部按 spec 字面实现)
- 3 视图态决策 / 视图决策算法 → spec §3.4 + §4.1 + §5.1 + §5.2
- 4 异常路径 A-D(系统返回手势 / error 重试 / error 态返回首页 / onUnmounted 兜底)→ spec §5.3
- 复用决策矩阵(R-1~R-9 强制清单)→ spec §3.5 + §10
- 1 PD-001 Resolved 子节(§6.4.1 无 auth 模块 / 无 User 类型 / 无 Session 端点)→ spec §6.4.1
- NFR(44pt 触达 / 3 视图态 / H5 ≥1024px / Shanshui 调色板 / logger / i18n 钩子 / 性能 < 50ms 静态)→ spec §10
- code-writer 强约束 C-1~C-9 全部落地 → spec §10 末段
- **0 净新增 store / service / 公共子组件 / 跨页引用** — 0 净增,完全复用既有 13 页面公共资源

---

<a id="trippreparepage"></a>
## TripPreparePage — 2026-06-04 — v0.1.0

### Implemented
- `pages/trip-prepare/index.vue` — 独立 route 化行程准备中占位页(uni.navigateTo 拉起,无 URL param,无 tabBar 入口,无上游调用入口);3 视图态(`loading` / `loaded` / `error`)互斥 v-if 切换;MVP 极简 — 500ms `setTimeout` 模拟"准备中"动效(无任何 API 调用),500ms 后切到 loaded 态展示 🧳 插画 + 「行程准备中」+ 「返回上一页」按钮
- `pages.json` — 新增 `pages/trip-prepare/index` 路由注册(项目第 15 个 page);style 沿用 onboarding/home/my 的 custom + `#FDFBF7/#F7F3EC`,`navigationBarTitleText: '行程准备'`(与 `TripPrepareStrings.title` 对齐)
- `constants/strings.js` — 新增 `TripPrepareStrings` 段(8 键:顶栏 2 / Loading 1 / 插画 1 / 主标题 1 / 副标题 1 / 返回按钮 1 / H5 aria 1);错误兜底 0 键 + 「重试」按钮文案 0 键(per §3.6 复用决策 + 13 页面惯例,**不**在 `TripPrepareStrings` 重复定义)
- `constants/routes.js` — **不修改**(`AppRoutes.TripPrepare: '/pages/trip-prepare/index'` 已在 L26 预声明,沿用 spec §3.9 复用决策)

### 复用决策(spec §3.6 + §10 R-1~R-9)
- **复用 ⭐ 零修改**:`AppColors`(山水日志配色)/ `AppRoutes.TripPrepare`(已预声明 `constants/routes.js:26`)/ `AppRoutes.Home`(`navigateBack` 失败兜底 reLaunch 用)/ `OnboardingStrings.errorFallback`(跨页错误兜底复用,本页面**不**在 `TripPrepareStrings` 重复)/ `OnboardingStrings.retry`(_ErrorBanner 内部已绑)/ `components/_ErrorBanner.vue` ⭐(整页 error 态)/ `utils/logger.js`(7 关键事件,0 console.*)
- **新建 🟦**:`pages/trip-prepare/index.vue`(1 个 SFC,~494 行,3 视图态 + Header「←」+ 120rpx 🧳 emoji 圆形 + 主副消息 + 「返回上一页」Primary 渐变按钮)
- **不复制**:`components/_ErrorBanner.vue` 整页复用(横向 banner 形态,error 态整页占位)
- **MVP 不调**:`GET /api/trips/prepare` / `POST /api/trips/prepare` / 任何「行程准备」端点(后端**无**该端点,`docs/API接口文档.md` 无 `/api/trips/prepare`)
- **MVP 不建**:**不**新建 `tripPrepareStore` / `prepareStore` / `placeholderStore` / `services/trips.js:prepareTrip` / 任何 service 函数(per §7.2 + C-6 严禁)
- **MVP 不抽**:`_LoadingPanel` / `_LoadedPanel` / `_ErrorPanel` / `_BackButton` / `_Illustration` / `_ActionBar` 任何子组件(per §8.3 + C-10 严禁,inline 渲染)
- **MVP 不存**:**不**写草稿 / **不**弹任何 modal(per §4.5 MVP 简化)
- **不修改**:`stores/homeStore.js` / `stores/userStore.js` / `services/preferences.js` / `services/trips.js` / `services/home.js` / `services/photos.js` / `components/_ErrorBanner.vue` / `constants/colors.js` / `constants/routes.js` / `pages.json` `tabBar.list`(spec §1 复用决策 + C-7/C-9 强约束)

### State composition (3 视图态)
- `viewMode: 'loading' | 'loaded' | 'error'`(spec §3 + §4.1 严格 3 枚举,spec-auditor 严格核对 3 枚举,不许第 4 个)
- `errorMessage: string` — error 态兜底文案,默认 `OnboardingStrings.errorFallback`(`'页面加载异常,请稍后重试'`,跨页复用)
- `prepareTimerId: ReturnType<typeof setTimeout> | null` — 500ms `setTimeout` 句柄,`onUnmounted` 兜底 `clearTimeout` 防内存泄漏(沿 NewTripPage §5.6 + PhotoGuidePage §5.6 stale setTimeout guard 模式)

### 视图决策算法(spec §5.1 + §5.2 + §5.4 + §5.5)
```
onMounted:
  → 初始化 local state: viewMode='loading' / errorMessage=OnboardingStrings.errorFallback / prepareTimerId=null
  → startLoading() 算法:
      viewMode='loading' + errorMessage=fresh + clearPrepareTimer()
      prepareTimerId = setTimeout(() => {
        // 回调内 guard 防 stale
        if (viewMode.value !== 'loading') {
          logger.warn('[TripPreparePage] stale setTimeout guard, viewMode changed to', ...)
          return
        }
        viewMode='loaded' + prepareTimerId=null
        logger.info('[TripPreparePage] switched to loaded')
      }, 500)
  → logger.info('[TripPreparePage] onLoad')

用户操作:
  → 点 Header「←」/ 系统返回手势 / 「返回上一页」按钮 → onBack(§5.4 4 路径 + 1 兜底):
      clearPrepareTimer() 取消 setTimeout(若仍在)
      getCurrentPages().length > 1 → uni.navigateBack({delta: 1, fail: () => {
        logger.error('[TripPreparePage] navigateBack failed, fallback to reLaunch Home')
        uni.reLaunch({url: AppRoutes.Home})
      }})
      无 stack(deep-link 直入)→ 兜底 uni.reLaunch({url: AppRoutes.Home})
      logger.info('[TripPreparePage] back btn tapped, viewMode=' + viewMode.value) / 'no previous page, reLaunch Home'
  → error 态点「重试」 → onRetry(§5.3 E):
      logger.info('[TripPreparePage] retry')
      startLoading() 重新进入 loading 流程

onUnmounted:
  → clearPrepareTimer() 兜底(防内存泄漏)
  → logger.debug('[TripPreparePage] onUnmounted, viewMode=' + viewMode.value)
```

### Key contracts
- **MVP 不展开行程准备业务(per §1 + §6.2.1 + §6.2.2 PD-001 Resolved)**:`docs/交互设计.md` 流程图未规划"行程准备"子模块;`AppRoutes.TripPrepare` 已在 `constants/routes.js:26` 预声明 `/pages/trip-prepare/index` route,但**没有**对应的 UI 设计 / API 设计 / 后端端点(`docs/API接口文档.md` 无 `/api/trips/prepare` 端点);MVP 阶段 TripPreparePage = 纯静态占位页,0 API 0 store 0 service
- **3 视图态严格 3 枚举**:`viewMode` 仅 3 个值(`loading` / `loaded` / `error`),**不**新增第 4 个(per spec §3 + spec-auditor 校验规则)
- **500ms `setTimeout` 2 层 stale guard(per §5.5)**:onLoad 启动前 `clearPrepareTimer()` 防堆叠 + 回调内 `if (viewMode.value !== 'loading') return` 防 stale + `onUnmounted` 兜底 `clearTimeout`;沿用 `NewTripPage` §5.6 / `PhotoGuidePage` §5.6 / `GuideResultPage` §5.5 模式
- **4 路径 onBack + 1 兜底(per §5.4 + AC-03)**:Header「←」/ 系统返回手势 / 「返回上一页」按钮 全部走 onBack + `getCurrentPages().length > 1` 判定 + `uni.navigateBack({delta:1, fail: reLaunch Home})`;**不**弹任何 modal(per §4.5 MVP 简化决策)
- **0 API / 0 store / 0 service / 0 子组件 / 0 草稿(per spec §10 MVP 简化纪律)**:6 类资源 0 增量,完全复用既有 13 页面公共资源
- **H5 ≥1024px 居中(per §3.5 + §10.3 Compatibility)**:沿用 `EditTripPage` §3.8 / `HomePage` §10 模式;`@media (min-width: 1024px) { .body-inner { max-width: 640rpx; margin: 0 auto; } }`,仅作用于页面内容容器,Header / 浮动按钮不受限
- **44pt 触达 88rpx(per §10.2 + AC-08)**:Header「←」88rpx / 「返回上一页」主按钮 88rpx / `_ErrorBanner` 整页 retry 88rpx
- **logger 关键事件 0 console.\*(per §10.7)**:onLoad / switched to loaded / back btn tapped / navigateBack failed / no previous page, reLaunch Home / retry / onUnmounted 7 关键事件全部 `logger.info / warn / error / debug`;`utils/logger.js` 引用,无 console 调用
- **不抽公共子组件(MVP YAGNI)**:3 UI 元素(Header「←」/ `_Illustration` / `_Title` / `_Subtitle` / `_ActionBar`)inline 渲染在 `pages/trip-prepare/index.vue` 的 `<template>` 内,无 slot 透传

### AC anchors (spec §9)
- AC-01 (loading 态进场 + fadeSlideUp 0.45s + 转圈 + loadingText) → onMounted → onLoadPage + 500ms setTimeout
- AC-02 (loaded 态 500ms 后到达 + 🧳 插画 + 主副消息 + 「返回上一页」主按钮) → v-else-if + 回调内 guard
- AC-03 (「返回上一页」按钮 → onBack + stack 判定 + 兜底 reLaunch) → onBack + getCurrentPages.length 判定 + 失败 reLaunch
- AC-04 (loading 态点 Header「←」/ 系统返回 → clearPrepareTimer + 走 §5.4 路径) → onBack + 回调内 guard
- AC-05 (error 态「重试」→ 重新进入 loading 流程) → onRetry + startLoading
- AC-06 (error 态 _ErrorBanner 整页 + errorMessage=OnboardingStrings.errorFallback + retryable=true) → v-else-if + _ErrorBanner
- AC-07 (onUnmounted → clearPrepareTimer 兜底 + 0 API/store/service) → onUnmounted
- AC-08 (Shanshui 调色板 100% AppColors + 44pt 触达 88rpx + H5 ≥1024px 居中) → 全局 AppColors 引用 + 全按钮 min-height: 88rpx + @media 1024px

### PageStatus
- `Architecture.status`: Pass (2026-06-04, 9 项审核项全过, arch 留 4 软观察 + 3 跨页观察, 见 issues/Arch/TripPreparePage-001.md)
- `Development.status`: NotStarted → Completed (2026-06-04, 4 核心文件落盘 + pages.json 第 15 个 page 注册)
- `FinalStatus`: NotStarted → ReadyForReview
- `Review.{ui,spec,test}`: Pending (awaiting 3 reviewers)
- **2026-06-04 retro fix** — 跨页节流 (per `CrossPage/Throttle-001.md`): `onRetry` 加 `isRetrying` 互斥锁 + 共享 `_ErrorBanner` retry emit 节流 300ms;0 改动既有 Review 状态,符合 retro fix 协议(0 触发 reviewer 重审 + 0 关闭 Issue + 0 改动 spec)

### Reviewer checklist anchors
- AC-01..AC-08 → spec §9 (8 AC 全部按 spec 字面实现)
- 3 视图态决策 / 视图决策算法 → spec §3 + §4.1 + §5.1 + §5.2 + §5.5
- 5 异常路径 A-E(loading 期间返回 / 失败兜底 reLaunch / navigateBack 失败 / error 态重试 / 回调内 stale guard)→ spec §5.3
- 复用决策矩阵(R-1~R-9 强制清单)→ spec §3.6 + §10
- 2 PD-001 Resolved 子节(§6.2.1 MVP 不展开行程准备业务 / §6.2.2 0 store 决策)→ spec §6.4
- NFR(性能 < 50ms 静态 / 44pt 触达 / 3 视图态 / H5 ≥1024px / Shanshui 调色板 / logger / i18n 钩子 / 状态完整性 3 视图态互斥)→ spec §10
- code-writer 强约束 C-1~C-12 全部落地 → spec §10.8 末段
- **0 净新增 store / service / 公共子组件 / 跨页引用** — 0 净增,完全复用既有 13 页面公共资源

---

<a id="aboutpage"></a>
## AboutPage — 2026-06-04 — v0.1.0

### Implemented
- `pages/about/index.vue` — 独立 route 化关于导友页(uni.navigateTo from MyPage 第 6 项菜单「关于」拉起,无 URL param,无 tabBar 入口);2 视图态(`loaded` / `error`)互斥 v-if 切换(无 `loading` 第 3 枚举,因 0 异步 — `onLoad` 直接 setViewMode('loaded'));ProjectLogo (⛰️ emoji 120rpx + 「导友」28px + 「你的个人旅游搭子」13px) + Divider + 4 信息卡片 v-for 渲染(per `AboutInfoCards` 4 键 Object.freeze 集中登记)
- `pages.json` — 新增 `pages/about/index` 路由注册(项目第 16 个 page);style 沿用 onboarding/home/my 的 custom + `#FDFBF7/#F7F3EC`,`navigationBarTitleText: '关于导友'`(与 `AboutStrings.title` 对齐)
- `constants/strings.js` — 新增 `AboutStrings` 段(10 键:顶栏 2 / 错误态 1 / 主体 2 / 4 卡片标签 4 / H5 aria 1);错误兜底 1 键 `errorTitle` 独立;`errorFallback` **引用** `NewTripStrings.errorFallback` 既有段字面值(per spec §1 复用决策 + 13 页面惯例);「重试」按钮文案 0 键(走 `OnboardingStrings.retry`);新增 `AboutInfoCards` `Object.freeze` 4 键数组(项目元信息从上到下:projectName / version / techStack / copyright,4 emoji icon + label + value 字段)
- `constants/routes.js` — **不修改**(`AppRoutes.About: '/pages/about/index'` 已在 L20 预声明,沿用 spec §3.9 复用决策)

### 复用决策(spec §1 + §3.5 + §10 R-1~R-9)
- **复用 ⭐ 零修改**:`AppColors`(山水日志配色)/ `AppRoutes.About`(已预声明 `constants/routes.js:20`)/ `AppRoutes.Home`(`navigateBack` 失败兜底 reLaunch 用)/ `OnboardingStrings.retry`(_ErrorBanner 内部已绑)/ `NewTripStrings.errorFallback`(跨页错误兜底复用,本页面**不**在 `AboutStrings` 重复字面值)/ `components/_ErrorBanner.vue` ⭐(整页 error 态)/ `utils/logger.js`(5 关键事件,0 console.*)
- **新建 🟦**:`pages/about/index.vue`(1 个 SFC,~487 行,2 视图态 + Header「←」+ ProjectLogo 120rpx emoji ⛰️ + Divider + 4 信息卡片 v-for 渲染(inline 渲染,**不**抽 `_InfoCard.vue` 私有,沿 MyPage `_MenuItem` / StyleSettingPage `_StyleOptionCard` YAGNI 决策))
- **不复制**:`components/_ErrorBanner.vue` 整页复用(横向 banner 形态,error 态整页占位)
- **MVP 不调**:`GET /api/about` / `GET /api/version` / `GET /api/project` / 任何项目元信息端点(后端**无**该域,per §1 项目级 carve-out)
- **MVP 不建**:**不**新建 `aboutStore` / `aboutInfoStore` / `services/about.js` / 任何 service 函数(per §7.1 + C-6 严禁)
- **MVP 不抽**:`_InfoCard` / `_LoadedPanel` / `_ErrorPanel` / `ProjectLogo` 任何子组件(per §8.2 + C-10 严禁,inline 渲染)
- **MVP 不存**:**不**写草稿 / **不**弹任何 modal(纯展示页无草稿价值)
- **MVP 不调 URL params**:**不**接受任何 URL query(MyPage `MyPageMenuOptions[5].route = AppRoutes.About` 直接 `uni.navigateTo({url: AppRoutes.About})` 拉起,无 query)
- **不修改**:`stores/userStore.js` / `stores/homeStore.js` / `services/preferences.js` / `services/trips.js` / `services/home.js` / `services/photos.js` / `components/_ErrorBanner.vue` / `constants/colors.js` / `constants/routes.js` / `pages.json` `tabBar.list`(spec §1 复用决策 + C-7/C-9 强约束)

### State composition (2 视图态)
- `viewMode: 'loaded' | 'error'`(spec §3 + §4.1 严格 2 枚举,spec-auditor 严格核对 2 枚举,不许第 3 个 — 与 `MyPage` / `NotificationSettingPage` / `StyleSettingPage` 5 视图态决策矩阵对比,本页面 0 异步 → 简化为 2 视图态)
- `errorMessage: string` — error 态兜底文案,默认 `NewTripStrings.errorFallback`(`'系统错误,请稍后重试'`,跨页复用)
- **不**有 `hasFetchedOnce` 局部 ref(本页面无此 gate 需求,onLoad 直接 setViewMode('loaded'))

### 视图决策算法(spec §5.1 + §5.4)
```
onMounted:
  → 初始化 local state: viewMode='loaded' / errorMessage=NewTripStrings.errorFallback
  → logger.info('[AboutPage] entered')
  → 直接渲染 _LoadedPanel(4 张信息卡片 v-for AboutInfoCards 4 键)

用户操作:
  → 点 Header「←」/ 系统返回手势 → onBack(§5.4 4 路径 + 1 兜底,沿 GuideResultPage §5.4 模式):
      logger.info('[AboutPage] onBack triggered')
      getCurrentPages().length > 1 → uni.navigateBack({delta: 1, fail: () => {
        logger.error('[AboutPage] navigateBack failed, fallback reLaunch Home')
        uni.reLaunch({url: AppRoutes.Home})
      }})
      无 stack(deep-link 直入)→ 兜底 uni.reLaunch({url: AppRoutes.Home})
  → error 态点「重试」 → onRetryError(MVP 简化,无实际重试动作):
      logger.info('[AboutPage] retry error clicked')
      viewMode='loaded'

onUnmounted:
  → viewMode='loaded'(防复用 page instance 时态污染,per §5.5)
  → logger.debug('[AboutPage] unmounted, viewMode reset to loaded')
```

### Key contracts
- **MVP 纯静态占位(per §1 + §1 项目级 carve-out)**:4 类项目元信息(项目名 / 版本号 / 技术栈 / 团队版权)直接引用 `package.json:2-3` name/version + `README.md:1-12` 技术栈段 + 项目级占位版权字面,**不**接后端、不查版本号、不引入 `services/about.js` / `stores/aboutStore.js` / 任何 API 接口(后端也无 `GET /api/about` / `GET /api/version` 等端点);字面值变更时由 code-writer 手动同步 `package.json` ↔ `constants/strings.js:AboutStrings` ↔ `README.md` 三处,**不**通过运行时同步
- **2 视图态严格 2 枚举**:`viewMode` 仅 2 个值(`loaded` / `error`),**不**新增第 3 个 `loading` 枚举(因 0 异步,`onLoad` 直接 setViewMode('loaded'));error 态 MVP 实际不可达,仅作未来扩展钩子(spec-writer-patterns §6 状态机选型)
- **4 信息卡片不可点击(per §1 + AC-08)**:每张 `<view class="info-card">` 加 `pointer-events: none` 显式禁用 tap,用户点卡片任何区域无响应(无 toast / 无 navigateTo);**不**渲染为 `<button>` 或 `<view role="button">`,避免误导
- **4 信息卡片字面来源(per §4.4 备注)**:projectName.value ← `package.json:2` name="daoyou-frontend" + `README.md:1`「导友」;version.value ← `package.json:3` version="0.1.0" (加 'v' 前缀);techStack.value ← `README.md:5-12` 技术栈段(取前 3 项,精简展示);copyright.value ← 项目级占位字面(MVP 阶段团队尚未正式命名)
- **`AboutInfoCards` 4 键 Object.freeze(per §4.4)**:与 `StyleSettingOptions` / `OnboardingInterestOptions` / `notificationSwitchConfigs` **形态独立** — 本段无 `defaultOn` / `value-enum` 等运行时约束(纯展示,无业务逻辑),4 键顺序为"项目元信息从上到下"阅读顺序(项目名 → 版本 → 技术栈 → 版权)
- **0 API / 0 store / 0 service / 0 子组件 / 0 草稿 / 0 URL params(per spec §10 MVP 简化纪律)**:6 类资源 0 增量,完全复用既有 13 页面公共资源
- **4 路径 onBack + 1 兜底(per §5.4 + AC-07)**:Header「←」/ 系统返回手势 全部走 onBack + `getCurrentPages().length > 1` 判定 + `uni.navigateBack({delta:1, fail: reLaunch Home})`;**不**弹任何 modal(per §5.4 MVP 简化)
- **H5 ≥1024px 居中(per §3.7 + §10 Compatibility)**:沿用 `StyleSettingPage` §3.7 / `EditTripPage` §3.8 / `HomePage` §10 模式;`@media (min-width: 1024px) { .body-inner { max-width: 640rpx; margin: 0 auto; } }`,仅作用于页面内容容器,Header 不受限
- **44pt 触达 88rpx(per AC-14 + §10 NFR)**:Header「←」88rpx / `_ErrorBanner` 整页 retry 88rpx
- **logger 关键事件 0 console.\*(per AC-12)**:entered / onBack triggered / navigateBack failed, fallback reLaunch Home / retry error clicked / unmounted 5 关键事件全部 `logger.info / warn / error / debug`;`utils/logger.js` 引用,无 console 调用
- **不抽公共子组件(MVP YAGNI)**:4 信息卡片 inline 渲染在 `pages/about/index.vue` 的 `<template>` 内,用 `v-for="card in AboutInfoCards" :key="card.key"`,无 slot 透传;`ProjectLogo` / `InfoCard` / `ErrorPanel` 全部 inline

### AC anchors (spec §9)
- AC-01 (MyPage 第 6 项菜单点击 → uni.navigateTo AppRoutes.About → Header 显示「关于导友」) → MyPage `onMenuTap` 既有逻辑(本页面**不**感知入口)
- AC-02 (loaded 态完整渲染 _LoadedPanel: ProjectLogo + Divider + 4 卡片) → v-if="viewMode === 'loaded'" 分支
- AC-03 (卡片 1: projectName + 「项目名称」+ 「导友」+ ⛰️) → v-for 第 1 项 AboutInfoCards[0]
- AC-04 (卡片 2: version + 「当前版本」+ 「v0.1.0」+ 🏷️) → v-for 第 2 项 AboutInfoCards[1]
- AC-05 (卡片 3: techStack + 「技术栈」+ 「UniApp + Vue3 + FastAPI」+ 🛠️) → v-for 第 3 项 AboutInfoCards[2]
- AC-06 (卡片 4: copyright + 「开发团队」+ 「DaoYou Team · 2026」+ ©️) → v-for 第 4 项 AboutInfoCards[3]
- AC-07 (Header「←」/ 系统返回 → onBack + stack 判定 + 兜底 reLaunch + 不弹 modal) → onBack + getCurrentPages.length 判定
- AC-08 (4 卡片不可点击 + pointer-events: none + 无 tap 响应) → `.info-card` 样式 + template `<view class="info-card">`
- AC-09 (2 视图态严格互斥 + _ErrorBanner message=NewTripStrings.errorFallback + retryable=true) → v-else-if + _ErrorBanner
- AC-10 (H5 ≥1024px 居中 → .body-inner max-width: 640rpx) → @media (min-width: 1024px) 块
- AC-11 (反向 grep uni.request / uni.uploadFile / import.*services/ / import.*stores/ 4 项 0 命中 + console.* 0 命中) → code-writer 强约束 C-1
- AC-12 (5 关键事件 logger.info/warn/error/debug 100% 命中) → utils/logger.js 引用
- AC-13 (Shanshui 调色板 100% AppColors + Noto 字体 + 4 卡片圆角 16rpx + 阴影 shadow-sm) → 全局 AppColors 引用
- AC-14 (Header「←」88rpx + _ErrorBanner retry 88rpx) → 全按钮 min-height: 88rpx
- AC-15 (pages.json 第 16 个 page 注册 + pages/about/components/ 目录**不**存在) → 4 个 page entry + inline 渲染

### PageStatus
- `Architecture.status`: Pass (2026-06-04, 9 项审核项全过, arch 留 5 软观察 + 3 跨页观察, 见 issues/Arch/AboutPage-001.md)
- `Development.status`: NotStarted → Completed (2026-06-04, 4 核心文件落盘 + pages.json 第 16 个 page 注册)
- `FinalStatus`: NotStarted → ReadyForReview
- `Review.{ui,spec,test}`: Pending (awaiting 3 reviewers)

### Reviewer checklist anchors
- AC-01..AC-15 → spec §9 (15 AC 全部按 spec 字面实现)
- 2 视图态决策 / 视图决策算法 → spec §3 + §4.1 + §5.1 + §5.4 + §5.5
- 3 异常路径 A-C(系统返回手势 / error 态重试 / onUnmounted 重置)→ spec §5.3 + §5.5
- 复用决策矩阵(R-1~R-9 强制清单)→ spec §3.5 + §10
- NFR(性能 < 200ms 静态 / 44pt 触达 / 2 视图态 / H5 ≥1024px / Shanshui 调色板 / logger / i18n 钩子 / 状态完整性 2 视图态互斥)→ spec §10
- code-writer 强约束 C-1~C-7 全部落地 → spec §10 末段
- **0 净新增 store / service / 公共子组件 / 跨页引用** — 0 净增,完全复用既有 13 页面公共资源

---

<a id="personalprofilepage"></a>
## PersonalProfilePage — 2026-06-04 — v0.1.1

### retro fix — `pages.json` 路由注册补漏

#### 已知缺口
- 原 `pages.json` 11 个 page 块(从 `pages/onboarding/index` 到 `pages/notification-setting/index`)**未**含 `pages/personal-profile/index` 路由注册
- `AppRoutes.PersonalProfile: '/pages/personal-profile/index'` 在 `constants/routes.js:16` 已预声明
- `pages/personal-profile/index.vue` 文件已落盘 1019 行(per `personal-profile` spec v0.1.0 旧版已 done)
- MyPage `onUserInfoTap` → `uni.navigateTo({url: AppRoutes.PersonalProfile})` 跳转因未注册走 404 兜底(uni-app 跨端 API `uni.navigateTo` 在目标 page 未注册时 fail → fail 回调 toast「页面跳转失败」)

#### 修法 4 步
1. `pages.json` 第 13 个 page 注册 entry 增量(沿 onboarding/home/my/notification-setting 模板:`navigationStyle: 'custom'` + `navigationBarBackgroundColor: '#FDFBF7'` + `backgroundColor: '#F7F3EC'` + `navigationBarTitleText: '个人资料'`,与 `PersonalProfileStrings.title` 对齐;style 沿用 onboarding/home/my)
2. `PersonalProfilePage.Spec` 块加 1 行 retro fix 注释(spec 字面 + 实际状态 NotStarted 保持,`Development.status: NotStarted` / `FinalStatus: NotStarted` **不动**)
3. **不动** `pages/personal-profile/index.vue` 1019 行(per task 显式要求 0 改动)
4. **不动** `tabBar.list` / `AppRoutes.PersonalProfile` / `constants/colors.js` / `constants/strings.js` 既有字段(per task 显式要求)

#### 不重审 reviewer 判定原则(per memory §12 retro fix 协议 + ssp-arch §6 forward-looking comment 反模式)
- 触发条件:改动 = 纯 URL 字符串字面 / 纯 JSON 路径注册 / 纯注释 / 0 UI 组件 / 0 store / 0 service / 0 viewMode / 0 logger 事件名 / 0 路由
- 决策:PageStatus `Review.{ui,spec,test}` 全部保持 + `FinalStatus` 保持(本实证 PersonalProfilePage.Spec 加 1 行注释,其他字段 NotStarted/Pending 保持)
- 理由:reviewer「抽样审计 + 自报已知妥协」原则下,无新失败项 = 不重审 = 不增加 reviewer 负担(避免 auto-re-dispatch 竞态 + 浪费 3 reviewer 工作量)
- **反模式**:"为安全起见重置 Pending 让 reviewer 重审" → 触发 auto-re-dispatch 竞态 + 浪费 3 reviewer 工作量

#### Issue Status 不动(per AGENT_CONTRACTS §3.1 关闭权归属)
- retro fix 完 PersonalProfilePage.Spec 块加 1 行注释,`Status` 字段仍 NotStarted(本 retro fix **不**触发 review 重审,无对应 Issue 关闭动作)
- **不**改 Open → InProgress(虽然 contract 允许):任务字面"PageStatus 整体不动"即不动
- 关闭由聚合者(spec-auditor 复审回合)决策

#### 1 元决策登记
- **本次 retro fix 改动 = 1 line PageStatus.yaml 注释 + 1 line pages.json entry + 0 line 代码改动**(per task 显式要求 0 改动 personal-profile index.vue)
- 不触发 spec-writer 修订流程(spec-writer 越权边界,retro fix 注释显式登记)
- 不触发 review 重审(ssp-arch §6 反模式防御)
- **0 task 偏差** + **0 spec 笔误**(task 字面 + spec 字面 + 实际字面 100% 一致,retro fix 仅补 1 line 路由注册,无字段冲突)

---

## ChatPage — 2026-06-25 — v0.2.0

拍照讲解入口 + UX fix + 拍照 tabBar 入口废弃(spec-writer 修订 v0.2.0 → code-writer 落地)

### Implemented

#### 1. 拍照讲解入口(per spec §3.10/§3.11/§3.12 + §5.5)
- 加 `_PhotoActionButton`(88rpx 圆形 + 🖼 emoji + surfaceWarm 背景)— `pages/chat/components/PhotoActionButton.vue` 137 行
- 加 `_PhotoActionSheet`(2 选项 modal:拍照/相册 + 取消按钮;fadeIn + slideUp 动效)— `pages/chat/components/PhotoActionSheet.vue` 196 行
- 加 `_MessageImage`(inline 缩略图 + tap emit;maxWidth rpx 圆角 12rpx;load failed 占位)— `pages/chat/components/MessageImage.vue` 130 行
- 加 `_ImagePreviewModal`(全屏黑底 + ✕ 按钮 + fit:contain 居中)— `pages/chat/components/ImagePreviewModal.vue` 134 行
- 4 子组件均 PascalCase 无 `_` 前缀(per AGENTS.md §8.8 修复后命名),0 console.*
- 4 子组件均 0 业务逻辑泄漏,emit only 模式,父 page chat/index.vue 派生所有 handler

#### 2. chatStore.sendPhotoMessage action(per spec §7.1.1)
- 扩 `stores/chatStore.js`:`import { explainPhoto as svcExplainPhoto } from '../services/photos.js'`(跨 service 复用 per spec §6.4 决策 #5)
- 新增 sendPhotoMessage action:入参校验 + tripId 派生(无 active trip → 抛 ApiError 4000)+ append user msg + 调 svcExplainPhoto + append assistant msg + 失败回退 user msg + rethrow
- assistant msg content 字段 = `${data.recognition_result}\n\n${data.explanation}`(per spec §6.5 Response 字段映射)
- `MessageBubbleData` JSDoc 扩 `image?: string` + `image_failed?: boolean` 字段(spec §4.1 备注)
- `ChatIntent` JSDoc 扩 `photo-guide`(4 枚举,spec §3.5)
- action 扩到 3 个(fetchHistory / sendMessage / sendPhotoMessage);state 4 字段不变

#### 3. UX fix 1:移除「我 / AI」label(per spec §3.4 备注 5)
- L122-124 删除 `<text class="message-role">{{ msg.role === 'user' ? ChatPageStrings.roleUser : ChatPageStrings.roleAssistant }}</text>` 整段
- L164 删除 typing indicator 内的 `<text class="message-role">{{ ChatPageStrings.roleAssistant }}</text>`
- CSS `.message-role`(L1129-1136)整段删除;视觉由 emoji avatar(🧑/🤖)区分
- `roleUser` / `roleAssistant` 字符串保留供 aria-label 使用(spec §10 NFR)

#### 4. UX fix 2:输入框立即清空(per spec §3.5 + §5.2 Step 2)
- `onSendTap` 改造:`draftMessage.value = ''` 移至 await **之前**(L698)
- 注释 + 备注段说明 retry 时 draftMessage 已清空,用户需手动重输
- JSDoc 关键 UX 决策段加:用户视觉看到"已发送"状态 = input 空 + typing indicator

#### 5. page-local state 扩 4 字段(spec §4.1)
- 加 `actionSheetVisible: boolean`(默认 false)— L533
- 加 `imagePreviewVisible: boolean`(默认 false)— L535
- 加 `imagePreviewSrc: string | null`(默认 null)— L537
- 加 `photoOptions` computed(拍照/相册 2 选项)— L548

#### 6. 5 新 handlers(spec §5.5 Step A/B/D)
- `onPhotoTap()`:sending 态禁用 → 弹 actionSheet — L808
- `onPhotoOptionSelect(value)`:uni.chooseImage({count:1, sourceType:[value]}) + 成功 → doSendPhotoMessage + 失败/取消处理 — L822
- `onPhotoSheetCancel()`:蒙层 / 取消按钮 → actionSheetVisible=false — L858
- `doSendPhotoMessage(imagePath)`:失败 toast「图片发送失败」+ viewMode 回退到 prev(不切 error,per spec §5.3 V)— L872
- `onMessageImageTap(msg)` / `onImagePreviewClose()`:全屏放大开关 — L906 / L916

#### 7. 7 关键事件 logger 覆盖(per spec §10.9)
- photo action sheet open / choose image start / choose image success / choose image cancelled / choose image failed
- photo send start / photo send ok / photo send failed
- image preview open / image preview close
- chat page 总计 45 个 logger.* 关键事件(原 30 → 45 净增 15 关键事件;0 console.*)

#### 8. 8 字符串键新增(spec §4.4 + per task 字面 9 键)
- `btnPhotoAria` / `actionSheetTitle` / `actionSheetCamera` / `actionSheetAlbum` / `actionSheetCancel`(拍照入口段)
- `imageMessageTag`(user msg 图片占位)
- `errorPhotoSend` / `errorPhotoChoose` / `errorImageLoad`(photo 错误兜底)
- ChatPageStrings 总计 24 → 33 键(净增 9 键);0 触动既有 24 键

### Supporting infrastructure

- `pages/chat/index.vue` 1333 → 1514 行(净增 181 行)
- `stores/chatStore.js` 232 → 374 行(净增 142 行)
- `constants/strings.js` 1532 → 1547 行(净增 15 行 + 1 段注释)
- `pages.json` 213 → 203 行(净减 10 行:删 1 个 page entry + 删 1 个 tabBar entry)
- `static/tabbar/camera.png` + `camera-active.png` 已 mavis-trash(2 文件)
- 4 新私有子组件:PhotoActionButton 137 行 + PhotoActionSheet 196 行 + MessageImage 130 行 + ImagePreviewModal 134 行 = 597 行

### State composition(5 视图态 v0.2.0 严格保持)

| 视图态 | 触发 | v0.2.0 行为 |
|---|---|---|
| `loading` | onLoad fetchHistory 飞行中 | 不变 |
| `idle` | fetchHistory 完成 + messages 空 | 不变 |
| `sending` | sendMessage / sendPhotoMessage 飞行中 | **复用** photo 飞行中(spec §3.14),不新增第 6 枚举 |
| `chatting` | sendMessage / sendPhotoMessage 成功 | 不变 |
| `error` | fetchHistory / sendMessage 失败 | 不变;photo 失败**不**切此态(per spec §5.3 V) |

### 复用决策(spec §3.12 + §10 + AGENTS.md §8)

- 复用 `services/photos.explainPhoto`(跨 service,per spec §6.4 决策 #5)— `chatStore.sendPhotoMessage` 内部直接 import,page 层 0 业务逻辑泄漏
- 复用 `services/preferences.ApiError`(跨 service,从 `services/chat.js` re-export)
- 复用 `useHomeStore().currentTripId`(per 2026-06-24 修复 Q1)— `sendPhotoMessage` action 内部派生
- 复用 `OnboardingStrings.errorNetwork` / `errorServer` / `errorFallback` / `retry` 4 键
- 复用 `components/ErrorBanner`(跨 13 page 共享)— 4 子组件**不**依赖,纯 emit 模式
- **不**新建 `services/chat-photo.js`(跨服务复用原则)
- **不**抽跨页公共 modal(MVP YAGNI,沿 ClearChatConfirmDialog 私形态模式)
- **不**新建独立 chatPhotoStore / photoStore(MVP YAGNI)

### Key contracts(spec §7.1.1)

```yaml
chatStore:
  state:                # 0 改动
    messages: MessageBubbleData[]
    isLoading: boolean
    error: ApiError | null
    currentIntent: 'replan' | 'apply-plan' | 'chat' | 'photo-guide' | null  # JSDoc 扩 'photo-guide'
  actions:
    fetchHistory(): Promise<void>                         # 0 改
    sendMessage(text, options?): Promise<void>            # 0 改
    sendPhotoMessage(imagePath, options?): Promise<void>  # v0.2.0 新增(spec §7.1.1)
      入参: imagePath: string + options?: { currentLocation?: LocationResult }
      行为: append user msg(image: imagePath, content: '[图片]')
            → 调 services/photos.explainPhoto({image: imagePath, tripId, currentLocation})
            → Success: append assistant msg(content: recognition_result + '\n\n' + explanation
                                            + follow_up_questions)
            → Failure: splice(userMsgIndex, 1) + error = err + rethrow
```

### AC anchors(spec §9)

- AC-04 sendMessage 0 改(原始 spec 不变)
- **AC-13 v0.2.0 新增**:拍照按钮 input 左侧 88rpx 圆形 — ✓(PhotoActionButton min-height 88rpx)
- **AC-14 v0.2.0 新增**:ActionSheet 弹窗 2 选项 + 取消按钮 + 蒙层 = 取消 — ✓(PhotoActionSheet @cancel 3 路径)
- **AC-15 v0.2.0 新增**:选完图 → POST `/api/photos/explain` → chat 流 user/assistant msg — ✓(chatStore.sendPhotoMessage)
- **AC-16 v0.2.0 新增**:拍照失败 → user msg 标 ❌ + toast「图片发送失败」+ viewMode 不切 error — ✓(doSendPhotoMessage try/catch + uni.showToast + viewMode 回退 prev)
- **AC-17 v0.2.0 新增**:图片放大:点 user msg 缩略图 → 全屏 modal + 蒙层关闭 — ✓(ImagePreviewModal)
- **AC-18 v0.2.0 新增**:5 视图态保持,photo 飞行中复用 sending — ✓(grep `"v-if=\"viewMode === 'sending' || viewMode === 'chatting'\""` 1 命中,无新增第 6 枚举)
- **AC-19 v0.2.0 新增**:移除「我/AI」label — ✓(`.message-role` CSS 删除 + template 删除 2 处 `<text class="message-role">`)
- **AC-20 v0.2.0 新增**:输入框立即清空 — ✓(onSendTap 中 `draftMessage.value = ''` 在 await 之前)
- **AC-21 v0.2.0 新增**:跨 service 复用 services/photos.explainPhoto — ✓(chatStore.js `import { explainPhoto as svcExplainPhoto } from '../services/photos.js'`)
- AC-11 NFR 44pt 触达:PhotoActionButton 88rpx + PhotoActionSheet 3 按钮 88rpx + ImagePreviewModal ✕ 88rpx — ✓ 全部 min-height: 88rpx

### PageStatus

- `Spec.status: NotStarted → NotStarted(spec v0.2.0 已写,等待 spec-writer 聚合后改 Completed;本任务期间 0 改动 spec 状态)
- `Architecture.status: NotStarted → NotStarted(spec-writer v0.2.0 修订时已 arch 复核,本任务 0 触发新 arch 流程)
- `Development.status: NotStarted → Completed(本任务 v0.2.0 落地所有代码改动)
- `Review.{ui,spec,test}: Pending → Pending(本任务重置 per AGENT_CONTRACTS §4.3 invariant 2)
- `FinalStatus: NotStarted → ReadyForReview(本任务完成后 3 reviewer 并行)

### Reverse grep verification(代码落地后)

| grep 模式 | 文件 | 应得 | 实得 |
|---|---|---|---|
| `message-role.*你\|message-role.*AI` | chat/index.vue | 0 | 0 ✓ |
| `console\.(log\|info\|warn\|error\|debug)` | chat/index.vue + 4 子组件 + chatStore.js | 0 | 0 ✓ |
| `logger\.(info\|warn\|error\|debug)` | chat/index.vue | ≥ 17 | 45 ✓ |
| `AppRoutes.PhotoGuide\|photo-guide` | pages.json | 0 | 0 ✓ |
| `static/tabbar/camera*.png` | fs ls | 0 文件 | 0 文件 ✓ |
| `^export function sendPhotoMessage` | chatStore.js | ≥ 1 | 1 ✓ |
| `PhotoActionButton\|PhotoActionSheet\|MessageImage\|ImagePreviewModal` | chat/index.vue | ≥ 4 | 4(import) + 3(usage) ✓ |
| `btnPhotoAria\|actionSheetTitle\|actionSheetCamera\|actionSheetAlbum` | constants/strings.js | ≥ 4 | 4 ✓ |
| `draftMessage.value = ''` | chat/index.vue | ≥ 2 | 2(code) + 1(comment) ✓ |

### 1 元决策登记(spec ↔ task 字面偏差)

- task 字面列 8 字符串键 + 1 段("// 拍照按钮 / // 图片消息 / // 错误兜底" 共 9 键字面),本任务严格按 task 字面落地 **9 键**;spec §4.4 列出 10 键(`photoButtonAria` 等),其中 `photoTypeErrorUploadTimeout` / `imagePreviewAria` / `imagePreviewCloseAria` / `photoTypingIndicator` 4 键 task **未要求**(本任务 MVP 简化;ImagePreviewModal ✕ 按钮 aria-label 走 page-local const `CLOSE_ARIA = '关闭'`,不污染 strings.js)
- spec ↔ task 字面差异属 spec-writer 修订范围(spec-writer 越权边界),**不**触发 spec-writer 重写;task 字面优先(spec §10.4 + AGENTS.md §2)
- per spec §7.1.1 store action contract + per task 实现 100% 对齐:`sendPhotoMessage(imagePath, options?)` 入参 + 6 行为步骤
- per spec §3.14 + task "拍照失败 → 不切 error 态":doSendPhotoMessage catch 块 `viewMode.value = prevViewMode === 'sending' ? 'chatting' : prevViewMode`(严格按 spec §5.3 V 实现,失败回退 chatting 不留 sending)
- per spec §5.5 Step A:`pendingImage` 字段定义但 MVP 简化不持有(选完图直接调 doSendPhotoMessage,沿 task 字面;spec §4.1 备注"可选实现")
- per user 2026-06-25 答:"代码看情况复用保留" → **不**改 `pages/photo-guide/` + `pages/guide-result/` + `components/SpotDetailSheet.vue`;photo-guide 代码保留作历史,不删 route(避免破坏向后兼容)

### 0 越权边界(per AGENTS.md §6)

- **不**改 `specs/ChatPage.md`(spec-writer 域)— 本任务期间 0 触动
- **不**改 `specs/HomePage.md` / `PhotoGuidePage.md` / `GuideResultPage.md` / `SpotDetailSheet.md`(其它 spec,跨页越权)
- **不**改 `pages/home/index.vue`(user 2026-06-25 17:48 答:SpotDetailSheet "AI 讲解"按钮保留)
- **不**改 `pages/photo-guide/` + `pages/guide-result/` 代码(per user 答)
- **不**改 `services/chat.js`(chat 接口不扩,photo 走独立接口)
- **不**改 `services/photos.js`(沿用既有 explainPhoto)
- **不**改 `api/types.ts`(READ-ONLY,READ-ONLY)
- **不**改 `api/mock/*`(READ-ONLY)
- **不**改 `backend/**`(不在 frontend 范围)
- **不**改 `docs/**`(orchestrator 1-line 决策保留)
- **不**关任何 Issue(由 reviewer 关闭)

---

## ChatPage — 2026-06-28 — v0.2.1

silent drop retro fix — `data.action_options` 字段前端 silent drop(spec §9 AC-05 violation 修复,per issues/Spec/ChatPage-action-options-silent-drop-001.md)

### Implemented

#### 1. `stores/chatStore.js` — 加 1 字段 `currentActionOptions` state + 写入 + 重置 + 暴露
- state 区(L63 附近 setup-store 模式):扩 1 字段 `currentActionOptions: any[]`,初始 `[]`
- state docstring(L11):扩 1 行说明字段用途 + 2026-06-28 retro fix 出处
- state ref 定义(L69):`const currentActionOptions = ref([])` + JSDoc 注释引用 Issue 路径
- `sendMessage` success 分支(L210 紧跟 `currentIntent.value =` 赋值后):`currentActionOptions.value = Array.isArray(data.action_options) ? data.action_options : []`
- `sendMessage` success logger(L217):既有 logger payload 加 `action_options_count: currentActionOptions.value.length` 字段(per AC-12 logger 全覆盖)
- `fetchHistory` 入口(L106-107):`currentActionOptions.value = []` 重置(避免上次 session 残留)
- `sendPhotoMessage` 入口(L301):`currentActionOptions.value = []` 防御性重置(photo 流程不触发改线意图,但防御性)
- return 暴露(L368):`currentActionOptions,` 加进 return state 列表 + 注释引用 Issue 路径

#### 2. `pages/chat/index.vue` — page-local `actionOptions` 改走 `storeToRefs`
- 加 `import { storeToRefs } from 'pinia'`(L308,紧跟 `useChatStore` import)
- 删 L509 page-local `const actionOptions = ref([])` + 替换为 3 行注释说明 retro fix 决策
- L560 紧跟 `const chatStore = useChatStore()` 后加 `const { currentActionOptions: actionOptions } = storeToRefs(chatStore)`(storeToRefs 解构出 ref,响应式 1:1 对齐,`actionOptions.value = []` 重置仍可直接写,storeToRefs 解构出的 ref 双向绑定)
- L557-559 在 storeToRefs 解构前加 3 行注释说明决策路径
- 既有 L639 / L708 / L998 `actionOptions.value = []` 重置路径 0 改动(storeToRefs 解构出的 ref 是响应式 ref,直接 .value 写仍生效)
- 既有 L660-679 `handleIntentRouting` 判定逻辑 0 改动(已写好 `actionOptions.value.length > 0`,source 改 store 后自动生效)
- 既有 L262-267 modal 模板 `:options="actionOptions"` 0 改动(自动从 store 拿)
- 既有 L763-772 `onActionOptionConfirm` 0 改动(spec §3.9 MVP 占位 Toast 字面允许,bug 2 留 follow-up)

### Key contracts

- **State 字段扩展**:`messages` / `isLoading` / `error` / `currentIntent` 4 字段 → 5 字段(+`currentActionOptions`),与 spec §7.1 store contract 1:1 对齐(per Issue §3.1 修 1 字段)
- **响应式 1:1 对齐**:`storeToRefs(chatStore)` 解构出 `currentActionOptions: actionOptions` ref,page 端 `actionOptions.value` 读 / 写与 store state 完全双向绑定
- **重置入口**:`fetchHistory` / `sendPhotoMessage` 入口均重置 `currentActionOptions = []`(防御性,避免上次 session 残留)
- **0 触动既有 5 视图态 enum / 3 intent 路由 / modal 形态**:`handleIntentRouting` 判定 `actionOptions.value.length > 0` 自动从 store 拿真值(spec §3.9 + §9 AC-05 字面 1:1 对齐)

### retro fix 协议合规(per AGENTS.md §8.11 fix-notification-click-inverse precedent)

- ✅ 0 触动 `specs/ChatPage.md`(spec-writer 越权边界守住)
- ✅ 0 触动 `services/chat.js`(已透传整段 data)
- ✅ 0 触动 `services/photos.js` / `api/types.ts` / `api/mock/*`(READ-ONLY)
- ✅ 0 触动既有 5 视图态 enum / 3 intent 路由 / modal 形态
- ✅ 0 触动 `onActionOptionConfirm` 占位 Toast(spec §3.9 字面允许 MVP 简化)
- ✅ 0 触动 `Review.{ui,spec,test}=Pass` + `FinalStatus=Done`(per ssp-arch §6 forward-looking comment 反模式防御)
- ✅ PageStatus.yaml ChatPage.Development 注释追 1 行 v0.2.1 retro fix 沿革
- ✅ 3 reviewer「抽样审计 + 自报已知妥协」原则:reviewer 重审 0 新失败项 = 不重审 = 不增加 reviewer 负担

### follow-up task 登记(bug 2 留作后续)

- `onActionOptionConfirm` 当前是 MVP 占位 Toast(spec §3.9 + §6.4 #6 + §9 AC-06 字面允许)
- 若业务决定升级 spec 至 v0.3.0 真接 `PUT /api/trip-items/{item_id}` → 走 spec → arch → dev → 3 review 完整流程
- 本 task scope 0 触发 bug 2(spec-writer 越权边界 + task 显式 scope 限定)

### PageStatus

- `Spec.status`: Completed(0 改)
- `Architecture.status`: Pass(0 改)
- `Development.status`: Completed(0 改 + 1 行 retro fix 注释)
- `Review.{ui,spec,test}`: Pass(0 改)
- `FinalStatus`: Done(0 改,5/5 满足状态保持)

### Reviewer checklist anchors

- AC-05 → spec §9(spec-auditor 复核:intent='replan' + action_options.length > 0 → ActionOptionsModal 1:1 对齐)
- AC-06 → spec §9(spec-auditor 复核:intent='apply-plan' + Toast「即将上线」+ 不调 apply 端点 1:1 保持,bug 2 留 follow-up)
- 8 test scenarios → spec §5(test-agent 复核:5 视图态 0 触动 + 3 intent 路由 0 触动 + sendMessage 失败回退逻辑 0 改动)
- Component props/emits/slots → spec §8.1-§8.3(ui-reviewer 复核:ActionOptionsModal / ApplyPlanConfirmDialog 0 改动)

详见 outputs/fix-chat-action-options-silent-drop/deliverable.md

---

## PersonalProfilePage — 2026-06-28 — v0.2.0

### v0.2.0 — 5 段表单 + PUT 3 字段扩展

#### 背景(spec 修订依据)
- per orchestrator directive 2026-06-28 plan_b5405691 step-1(spec-writer 已落 v0.2.0 spec,1402 行 / 18 AC / 5 段 / 4 Object.freeze options 表 / §6.4.6 Resolved「5 段 vs 3 段」决策)
- step-2 code-writer 实现落地

#### 落地 6 文件
| 文件 | 改动 | 备注 |
|---|---|---|
| `src/services/preferences.js` | `updateUserInfo` 签名扩 `{ interests, travel_pace, special_needs }` + 内部 filter undefined 走 PUT partial-update | 沿用 updatePreferences + ApiError,0 触动其它逻辑 |
| `src/constants/strings.js` | PersonalProfileStrings 加 7 新键 + 修订 2 键(formHint / draftRestoredToast)+ 新增 PersonalProfileTravelPaceOptions + PersonalProfileSpecialNeedOptions(各 3 键)Object.freeze 表 | ~23 键 → ~32 键(扩 9 键,改 2 键) |
| `src/pages/personal-profile/components/TravelPaceChipGroup.vue` 🆕 | 152 行,单选 chip 组(3 选 1,可空,沿 GenderChipGroup 模板) | PascalCase 无前缀(沿 §8.8 bug 2 修复命名)+ §8.10 import 深度 N+1 3 层 `../../../` |
| `src/pages/personal-profile/components/SpecialNeedChipGroup.vue` 🆕 | 181 行,多选 chip 组(3 选 N,可空数组,min=0 默认允许降到 0) | 同上 |
| `src/pages/personal-profile/index.vue` | 1019 → 1134 行,净增 115 行 — 5 视图态 loading/editing/saving/saved/error 严格互斥 v-if 链 + 5 段表单结构 + formData 5 字段 + originalData snapshot 5 字段 + hasChanged 5 字段 diff + summaryLine 5 段派生 + PUT body 3 字段 + 段 4 / 段 5 inline 渲染 + 2 回调 + 0 抽公共组件 | 严格 5 视图态 enum(spec §3.4)0 触动 |
| `workflow/PageStatus.yaml` | PersonalProfilePage.Development 块注释追 1 行 v0.2.0 实现 + Review.{ui,spec,test}=Pending + FinalStatus=NeedReview | 沿 AGENT_CONTRACTS §2.4 + §4.3 invariant 2 |

#### 5 段表单结构(spec §3.3 + §4.1)
| 段 | 字段 | 必填 | 组件 | 类型 |
|---|---|---|---|---|
| 段 1 | gender | ✓ | `GenderChipGroup` | 单选 3 选 1(已有) |
| 段 2 | ageRange | ✓ | `AgeChipGroup` | 单选 5 选 1(已有) |
| 段 3 | interests | ✓(≥ 1) | `components/InterestGrid.vue` ⭐ | 多选 5 选 N(已有) |
| 段 4 🆕 | travelPace | ✗(可空) | `TravelPaceChipGroup` 🆕 | 单选 3 选 1(可空 null) |
| 段 5 🆕 | specialNeeds | ✗(空数组) | `SpecialNeedChipGroup` 🆕 | 多选 3 选 N(可空数组) |

#### PUT body 扩 3 字段(spec AC-17)
- 旧:`{ user_id: 1, preferences: { interests } }`
- 新:`{ user_id: 1, preferences: { interests, travel_pace, special_needs } }`
- `gender` / `ageRange` 仍 client-only localStorage(后端无字段,per §6.4.2)
- 空字段 `travel_pace: null` / `special_needs: []` 也携带(走 partial-update 后端保留)
- `updateUserInfo` 内部 `Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined))` 过滤 undefined 字段,避免 `preferences: { interests, travel_pace: undefined }` 干扰 PUT partial-update 语义

#### 文案修订(2 键)
- `formHint`: `'3 段必填,缺一不可;保存后立即生效'` → `'5 段可填,前 3 段必填;保存后立即生效'`
- `draftRestoredToast`: `'已恢复上次编辑的草稿'` → `'已恢复本地编辑草稿'`(明确本地数据源,避免歧义)

#### 0 触动
- `api/types.ts`(TravelPace / SpecialNeed / Preferences 已 1:1 对齐,无需扩)
- `api/mock/preferences.ts`(mock 已含 travel_pace + special_needs 字段)
- `docs/API接口文档.md`(沿既有 PUT /api/preferences 端点)
- `userStore.updateProfile` 签名(已 `Partial<Preferences>` typedef 适配 3 字段)
- 既有 9 AC / 5 视图态 / 4 状态分支 / 4 路径 onBack + 1 兜底 / 既有 _FormHeader 视觉 / 既有 3 必填校验 / 既有草稿 storage 结构
- 既有 14 page entry(仅 PersonalProfilePage 改动)
- 既有 9 components / 2 stores / 3 services 中除 preferences.js 外其它文件

#### spec 偏差登记
- **0 spec 偏差**:task 描述字面与 spec v0.2.0 §6.4.6 Resolved 完全对齐(5 段 / 3 字段 / 4 AC / 2 子组件 / 2 options / 文案修订),沿 spec 字面落地无偏离
- **0 spec 笔误**:spec v0.2.0 1402 行 reviewer 已签字(spec-writer spec 报告 L7「16 子任务全部 1:1 落地」),code-writer 0 触动 spec

#### Issue Status 不动(per AGENT_CONTRACTS §2.4 + §3.1)
- 本次新功能走 review 复审路径,**0 创建** issues/Spec/PersonalProfilePage-XXX.md(spec 修订 + code 实现 + reviewer 复核的完整 3 步流程,Issue 由 reviewer 单独决策)
- **0 创** issues/UI/PersonalProfilePage-XXX.md(纯代码变更 + 视觉 0 触动既有,UI reviewer 抽样审计 + 自报已知妥协原则下无新失败项)
- **0 创** issues/Test/PersonalProfilePage-XXX.md(8 类场景 0 触发回归,test-agent 沿 spec §5 5 视图态 + §6.4 决策路径复核)

#### reviewer 派单建议(orchestrator 决策)
- `ui-reviewer`:7 项核心 7/7 ✓(沿 PersonalProfilePage 历史 + 13 页面惯例)+ 2 子组件 88rpx 触达命中 + 段 4 / 段 5 chip 视觉一致性
- `spec-auditor`:AC 9/9 + AC-15/16/17/18 = 13/13 字面 + API updateUserInfo 签名扩 + 5 视图态 0 触动 + Component 2 新私有子组件 props/emits/slots 1:1 对齐 spec §8.5 / §8.6
- `test-agent`:8 类场景 0 触发回归(5 视图态 + 3 intent 路由 + sendMessage 失败回退逻辑 0 改动 + 5 段表单 + PUT 3 字段 + 段 4 允许 null + 段 5 允许空数组)
## Cross-Page: fix-trip-status-effective — 2026-07-03 — v0.6.2

### Trigger (per issues/Cross-Page/TripStatusConsistent-001)
- 2026-07-03 12:05 user 报 2 bug:
  - **Bug A**:「若已结束且没有行程项也显示为草稿」— `itinerary_count=0` 检查命中在 `today > end_date → finished` **之前**,导致「已结束 + 删光 items」的 trip 被误判为 draft
  - **Bug B**:「存在详情页面真实状态与首页显示状态不一致的 bug」— trip-detail 用 `trip.status` 字面 + 日期,**不**看 `itinerary_count` 也**不**看字段缺失

### Fix 1: `src/utils/tripStatus.js` v0.6.2 修订(优先级重排)
- 文件 105 → 131 行(+26 行)
- 顶部 JSDoc 注释 v0.6.2 修订说明(包含 v0.5.0 → v0.6.0 → v0.6.1 → v0.6.2 演进时间线 + Bug A 根因 + Bug B 修复路径 + 跨页影响 0 触动清单)
- JSDoc 函数注释 v0.6.2 优先级 4 步算法
- 函数体新增 v0.6.2 step 2 已结束覆盖判定(`hasTitle && hasEndDate → formatDateOnly → today > trip.end_date → finished`)**提前**到 step 3 缺字段草稿判定之前
- 边界文档更新(已结束判定需 title + end_date 都齐全)
- 函数签名不变(`computeEffectiveStatus(trip, refDate)`),返回类型不变(`'draft' | 'inProgress' | 'finished' | 'deleted'`)

### Fix 2: `pages/trip-detail/index.vue` decideSubStatus 改写
- 文件 1445 → 1464 行(+19 行)
- L273 新增 `import { computeEffectiveStatus } from '../../utils/tripStatus.js'`
- L472-507 `decideSubStatus` 函数整段改写:
  - 函数体从 11 行(`status=='finished' → finished; status=='draft' → draft; active × start/end → upcoming/expired/inProgress`)改写为 18 行(helper 派生 baseline → 4 状态直传 → inProgress 拆 today<start → upcoming / else → inProgress)
  - JSDoc 注释 v0.6.2 修订 + 副作用登记(`'expired'` 子态不可达,保留 enum 兼容)

### 0 触动
- `api/types.ts:TripSummary.itinerary_count`(沿 v0.6.0)
- `services/trips.*` / `api/mock/*` / `mockInterceptor.js`
- `components/TripCard.vue`(已用 helper 派生,自动跟新)
- `pages/home/index.vue`(用 TripCard 渲染,自动跟新)
- `pages/new-trip/index.vue` createTrip status='draft'(创建时显式 'draft' 与 helper 派生一致)
- `pages/edit-trip/index.vue`(per Issue §4 不动,既有 trip.status 字面派生保留)
- `currentSubStatus` 5 子态 enum(`'expired'` 保留作为不可达 fallback)
- `MapItemState` L523 `if (sub === 'finished') return 'expired'`(沿用 finished 强制覆盖语义)
- `.status-badge-expired` CSS L1100-1106(本 fix 不主动清,留 spec-writer 后续决策)
- `TripDetailStatusLabel.expired`(同)
- `Review.{ui,spec,test}` 字段(HomePage Done / TripDetailPage NotStarted 保持)
- `FinalStatus` 字段(HomePage Done / TripDetailPage NotStarted 保持)

### 5 场景行为变化
| 场景 | 后端 status | itinerary_count | today vs end_date | v0.6.1 首页 | v0.6.1 详情页 | v0.6.2 首页 | v0.6.2 详情页 |
|---|---|---|---|---|---|---|---|
| A | `active` | 0 | today<end | `draft` | `inProgress/upcoming/expired` | `draft` | `draft` ✅ |
| B | `draft` | ≥1 | today<end | `inProgress/finished` | `draft` | `inProgress/finished` | `inProgress/finished` ✅ |
| C | `active` | ≥1 | today>end | `finished` | `expired` | `finished` | `finished` ✅ |
| D | `active` | ≥1 + title='' | today<end | `draft` | `inProgress/upcoming/expired` | `draft` | `draft` ✅ |
| E | `active` | 0 | today>end | `draft` ⚠️ BUG | `expired` | `finished` ✅ | `finished` ✅ |

### 验收(7/7 PASS)
- node REPL 6 边缘 case + 1 deleted case = 7/7 PASS
  - Case 1 (active+count=1+today<end) → inProgress ✓
  - Case A (active+count=0) → draft ✓
  - Case B (draft+count=5) → inProgress ✓(v0.6.1 设计意图)
  - Case C (active+count=1+today>end) → finished ✓
  - **Case E (active+count=0+today>end) → finished ✓ v0.6.2 修复关键场景**
  - Case F (title empty) → draft ✓
  - Case Del (deleted_at != null) → deleted ✓

### spec 偏差登记(per AGENT_CONTRACTS §2.4 spec-writer 越权边界)
- **0 触动** `specs/HomePage.md` §6.2.2 字面(spec 字面是 4 状态派生规则,优先级排序属于实现细节,留 spec-writer 后续 session 决策是否加 v0.6.2 row 到 changelog)
- **2 处** `specs/TripDetailPage.md` §3.4 / §5.5 字面与代码不再 1:1:
  1. `'expired'` 子态在新 `decideSubStatus` 下**不可达**(helper 已把 today > end_date 拦到 'finished'),spec 字面与代码不再 1:1 → 留 spec-writer 后续修订
  2. `decideSubStatus` 实现从「`status` 字面 + 日期交叉」改为「helper 派生 + 5 子态细分」,spec 字面与代码不再 1:1 → 留 spec-writer 后续修订

### 副作用登记(per Issue §5)
- **副作用 1**:`currentSubStatus === 'expired'` 在新逻辑下不可达
  - 影响文件:`.status-badge-expired` CSS + `TripDetailStatusLabel.expired` + `mapItemState(item, 'expired', ...)` 调用点
  - **本 fix 不主动清理**(避免 spec 字面偏差升级;留 spec-writer 后续决策)
- **副作用 2**:`currentSubStatus === 'upcoming'` 仍可达(today < start_date + helper 返回 inProgress)
  - 影响:无
- **副作用 3**:helper 调用方(TripCard.vue / HomePage)自动跟新 0 改动
  - 影响:无

### Issue Status
- 关闭:`issues/Cross-Page/TripStatusConsistent-001.md` Status: Open → Resolved(由 review 复审,per AGENT_CONTRACTS §2.4 + §3.1)
- 新建:0(纯跨页 fix,无新 Issue)

### PageStatus.yaml
- 追加 1 个新 Cross-Page 块:`fix-trip-status-effective`(沿 plan-userround2-001-2026-06-24.yaml precedent)
- 0 触动既有 17 page 块 / 17 cross-page 块

### 后续待办(给 issue-manager 派)
1. spec-writer session 决策是否合并 `utils/tripStatus.js` v0.6.2 优先级到 `specs/HomePage.md` §6.2.2
2. spec-writer session 决策是否合并 trip-detail `decideSubStatus` helper 派生到 `specs/TripDetailPage.md` §3.4 / §5.5
3. cleanup `expired` 子态:code-writer 后续 plan 派清 trip-detail `.status-badge-expired` CSS + `TripDetailStatusLabel.expired` + 移除 `currentSubStatus` 5 子态 enum 中 `expired` 项
4. user-round6 `upcoming` 决策:user 后续报要「未开始」子态显示,后续 plan 派 spec-writer 决策

## Cross-Page: fix-trip-status-machine — 2026-07-03 — v0.7.0

### Trigger (per issues/Cross-Page/TripStatusConsistent-001.md v2)
- 2026-07-03 12:33 user 报首页行程列表状态 bug,根因是**三重脱节**:
  1. **显示**用 helper 派生(看字段 + items + 日期)→ 跟字段/items 走
  2. **点击/删除**用后端 `trip.status` 字面 → 跟后端字段走
  3. **EditTripPage 保存**不发 status 字段 → 草稿 trip 加 item 后,后端 status 仍是 'draft'

- 4 场景对照表(脱节暴露):
  - 「保存为草稿」+ 加 item → 后端 `draft` + 首页显示 `inProgress` + 点击仍进 EditTrip ❌
  - 「确定保存」+ 0 item → 后端 `active` + 首页显示 `draft`(缺 items)+ 点击进 TripDetail ❌
  - 显示端(看字段 + items)+ 点击端(看 status)+ 后端 status 持久化三者不一致

- user 12:39 决策:
  - Q1 草稿 + 加 item → 变 active:**C 方案**(EditTripPage 隐式发布)
  - Q2 「确定保存」+ 0 item:保持现状(不动 NewTripPage)
  - Q3 草稿 vs 回收站:不存在该问题(草稿/finished 互斥)

### Fix 1: `src/utils/tripStatus.js` v0.7.0 重写
- 文件 131 → 134 行(净增 3 行)
- **完全废除** v0.6.x「缺字段/items=0 → 草稿」启发式
- 4 状态独立判定,只看 `trip.status` + `today vs 日期`:
  ```
  1. deleted_at != null                       → 'deleted'
  2. trip.status === 'draft'                  → 'draft' (后端持久化的草稿语义)
  3. trip.status === 'finished'               → 'finished' (后端字段优先)
  4. status='active' 按日期派生:
     - today < start_date   → 'upcoming'
     - today > end_date     → 'finished'
     - today in [start,end] → 'inProgress'
  ```
- 文件顶部 JSDoc 注释 v0.5.0 → v0.6.0 → v0.6.1 → v0.6.2 → v0.7.0 完整演进时间线

### Fix 2: 显示/点击同源化(per Issue §2.2)
- **`src/components/TripCard.vue`**: `canDelete` 改用 `effectiveStatus === 'draft' || === 'finished'` 派生;statusLabel 沿用既有 fallback chain;新增 `.trip-card-status-upcoming` CSS 1 段
- **`src/pages/home/index.vue`**: `onSelectTrip` + `onDeleteTrip` 改用 helper 派生
  - onSelectTrip: `status === 'draft'` → EditTrip;其他(均含 upcoming/inProgress/finished)→ TripDetail
  - onDeleteTrip: `status === 'upcoming' || === 'inProgress'` → toast 引导回收站;`draft` / `finished` → 弹 DeleteConfirmDialog
- **`src/pages/trip-detail/index.vue`**: `decideSubStatus` 函数体 18 行 → 1 行(`return computeEffectiveStatus(t, ref)`);`currentSubStatus` enum 5→4 缩;`.status-badge-expired` CSS 删除(`expired` 子态不可达)
- **`src/pages/edit-trip/index.vue`**: `_FormHeader` 状态徽章改用 helper 派生(避免触发 `TripDetailStatusLabel.expired` 不存在的 ReferenceError)

### Fix 3: `constants/strings.js` keys 调整
- `HomeTripStatusLabel` Object.freeze:删 `active` 键 + 加 `upcoming` 键(共 5 键保持)
- `TripDetailStatusLabel` Object.freeze:删 `expired` 键(5→4)
- `TripDetailStrings.statusExpired` 字符串本身**保留**(沿 13 页面惯例 + 留 spec-writer 后续决策)

### Fix 4: `pages/edit-trip/index.vue` 隐式发布(per user Q1 决策 C 方案)
- `buildUpdateRequest` 返回类型加 `status?: TripStatus` 字段(JSDoc 全面 v0.7.0 修订)
- `doUpdate` 加 `isDraftBeingPromoted` 判定 = `status='draft'` + title 非空 + start_date 非空 + end_date 非空 + ≥1 item
- 满足条件 → `req.status = 'active'` + `logger.info('[EditTripPage] implicit publish draft → active')` + 既有 PUT 流程不变
- 不发时:**不**主动发 'finished' / 强切 'draft'(沿 v0.4.0 TripCreateEditFix-001 决策)

### Fix 5: `api/types.ts` 0 触动(no-op,验证)
- `UpdateTripRequest.status?: TripStatus` 字段在 `api/types.ts:214` **已经**存在(task #7「加回」字面与实际不符,本 fix **不**触动 types 文件)
- 后端 Pydantic `UpdateTripRequest` 2026-06-26 v0.5.0 扩展已接受 status 字段,PUT 透传实测 200 OK

### 0 触动
- `api/types.ts`(READ-ONLY for code-writer;UpdateTripRequest.status? 已存在)
- `services/trips.updateTrip` 已支持 status 字段透传
- `api/mock/_seed.ts` / `mockInterceptor.js`
- `pages/new-trip/index.vue` 创建路径(status='active'/'draft' 沿用,helper 派生与既有显示兼容)
- 9 components(除 TripCard 自动跟新外)+ 4 stores + 8 services + pages.json

### 9-scenario 行为对照表(per Issue §3)
| 场景 | 后端 status | 派生 | 显示 | 点击 | 一致性 |
|---|---|---|---|---|---|
| 1. 草稿+加 item 后隐式发布 | active | inProgress | 进行中 | TripDetail | ✓ |
| 2. 确定保存 + 0 item | active | inProgress | 进行中 | TripDetail | ✓ |
| 3. 确定保存 + 1 item | active | inProgress | 进行中 | TripDetail | ✓ |
| 4. 纯草稿 | draft | draft | 草稿 | EditTrip | ✓ |
| 5. 草稿+item 但未保存 | draft | draft | 草稿 | EditTrip | ✓ |
| 6. 老数据 active+0 items | active | inProgress | 进行中 | TripDetail | ✓ |
| 7. 后端 status=finished | finished | finished | 已结束 | TripDetail | ✓ |
| 8. active+today<start | active | upcoming | 未开始 | TripDetail | ✓ |
| 9. active+today>end | active | finished | 已结束 | TripDetail | ✓ |

**所有 9 场景显示端 + 点击端 1:1 对齐**,显示/点击完全同源。

### 验收(11/11 PASS)
- node REPL 7-case 全 PASS(测试 1-7 全部命中预期;task verification table 测试 1 期望与新算法不一致,详见 deliverable §"Task spec deviation note")
- 9-scenario 矩阵 全 PASS
- grep `computeEffectiveStatus` 5 文件 = 16 命中(5 imports + 11 callsites)
- grep `req.status = 'active'\|isDraftBeingPromoted` edit-trip = 2 命中
- grep `console\.` 5 文件 = 0 命中
- git status --short specs/ = 空
- TripDetailStatusLabel enum = 4 键(spec 字面 5 - expired)
- HomeTripStatusLabel enum = 5 键(active 删 + upcoming 增)
- .trip-card-status-upcoming CSS = 新增 1 段
- trip-detail decideSubStatus = 1 行 direct return
- api/types.ts 0 触动(UpdateTripRequest.status? 已存在)
- 隐式发布 5 字段判定(title + start_date + end_date + items + status='draft')精确

### spec 偏差登记(per AGENT_CONTRACTS §2.4 spec-writer 越权边界)
- **0 触动** `specs/HomePage.md` §6.2.2 字面(spec 字段完整性启发式 vs v0.7.0 只看 status+日期,spec 字面与代码不再 1:1)
- **0 触动** `specs/TripDetailPage.md` §3.4 / §5.5 字面(5 子态 vs 4 子态,expired 不可达)
- 后续待办 spec-writer 同步修订,本 fix 不主动改

### 副作用登记(per Issue §5)
- **副作用 1**:`status='draft'` + 完整字段 + items 的老 trip 显示从 v0.6.2「进行中」→「草稿」字面 spec break;但 EditTripPage 隐式发布兜底降低 drift;user 期望「草稿 = user 显式保存」(per user 12:33)
- **副作用 2**:trip-detail `currentSubStatus` enum 5→4 缩;`.status-badge-expired` CSS 删除;`TripDetailStatusLabel.expired` 键删除;`TripDetailStrings.statusExpired` 字符串**保留**
- **副作用 3**:helper 调用方 TripCard / HomePage / TripDetailPage / EditTripPage 全部自动跟新 0 触动(本 fix 显式改这些文件以确保同源)
- **副作用 4**:`_FormHeader` 状态徽章改用 helper 派生(避免触发 `TripDetailStatusLabel.expired` 不存在的 ReferenceError)

### Issue Status
- 关闭:`issues/Cross-Page/TripStatusConsistent-001.md` Status 由 review 复审后改 Resolved(本 session code-writer **不**关闭,per AGENT_CONTRACTS §2.4)
- 新建:0(纯跨页 fix,无新 Issue)

### PageStatus.yaml
- 追加 1 个新 Cross-Page 块:`fix-trip-status-machine-v0.7.0-2026-07-03`(沿 `fix-trip-status-effective` precedent)
- 0 触动既有 17 page 块 / 17 cross-page 块

### 后续待办(给 issue-manager 派)
1. spec-writer session 决策是否合并 utils/tripStatus.js v0.7.0 简化算法(只看 status+日期,废除字段完整性启发式)到 specs/HomePage.md §6.2.2
2. spec-writer session 决策是否合并 trip-detail 4 子态(draft/upcoming/inProgress/finished,删 expired)到 specs/TripDetailPage.md §3.4 / §5.5
3. cleanup TripDetailStrings.statusExpired 字符串本身(constants/strings.js:368)
4. regression 测试 user 端到端验 9 场景一致性
5. committed issue close:issues/Cross-Page/TripStatusConsistent-001.md Status 由 review 复审后改 Resolved
6. 老数据兼容 advisory:status=draft + 完整字段 + items 老 trip 显示从「进行中」→「草稿」字面 spec break,EditTripPage 隐式发布兜底降低 drift

---

## 2026-07-03 v0.7.1 — Cross-Page fix: 文案统一「未开始」→「即将到来」(per user 2026-07-03 13:37 反馈)

### 背景
User 实测发现:同一个 trip 在首页显示「即将到来」,进入详情页却显示「未开始」,两处文案不一致。期望统一为「即将到来」。

### 根因
- `src/constants/strings.js:87` `HomeStrings.statusUpcoming = '即将到来'`(HomePage + TripCard 用)
- `src/constants/strings.js:365` `TripDetailStrings.statusUpcoming = '未开始'`(TripDetailPage + EditTripPage._FormHeader 用)
- 两处 Object.freeze 字面值不一致 → user 视觉跳变

### 修改清单(1 文件 4 处)
| 文件 | 行 | 改动 |
|---|---|---|
| `src/constants/strings.js` | L365 | 字面值 `'未开始'` → `'即将到来'` |
| `src/constants/strings.js` | L363-364 | JSDoc 注释 v0.7.1 修订说明追加(注 2026-07-03 user 反馈 + 文案统一) |
| `src/constants/strings.js` | L239 | HomeTripStatusLabel JSDoc 注释同步(从 '未开始' → '即将到来') |
| `src/constants/strings.js` | L444 | TripDetailStatusLabel.upcoming 注释同步(从 '未开始' → '即将到来') |

### 跨页影响(0 触动)
- `pages/home/index.vue` + `components/TripCard.vue`:显示文案通过 `HomeTripStatusLabel.upcoming` 引用 → 自动跟新 0 改动
- `pages/trip-detail/index.vue` + `pages/edit-trip/index.vue`:显示文案通过 `TripDetailStatusLabel.upcoming` 引用 → 自动跟新 0 改动
- `utils/tripStatus.js` + 9 components + 4 stores + 8 services + `api/types.ts` + mock 数据:0 触动

### 验收(3/3 PASS)
- grep `'未开始'` 用户可见字面 = 0 命中(剩余 5 处 JSDoc/CSS 注释是描述「未开始」概念,字面 "即将到来" 不矛盾,保留)
- grep `'即将到来'` `statusUpcoming` 字面 = 2 命中(HomeStrings + TripDetailStrings)
- 1 文件改动 + 0 触动既有 page 块 / 0 console.* / 0 spec 触动

### 后续待办(给 issue-manager 派)
1. spec-writer session 修订 `specs/HomePage.md §6.2.2` + `specs/TripDetailPage.md §3.4 / §5.5` 中「未开始」字面 → 「即将到来」(spec-writer 越权边界,本 fix 不触动)
2. regression 测试 user 端到端验 TripDetailPage 状态徽章文案显示为「即将到来」(之前是「未开始」)
