// frontend/constants/routes.js
// 路由路径常量 —— 参见 docs/Frontend Code Style Guide.md §11
//
// 规则:页面间跳转**必须**使用本文件常量,template / store / service 中禁止硬编码路径字符串。
// 当前项目使用 uni-app 的 pages.json 注册路由;此处的 key 与 pages.json 路径一一对应。

export const AppRoutes = {
  // 首启 / 启动器拉起
  Onboarding: '/pages/onboarding/index',

  // Tab 主区
  Home: '/pages/home/index',
  My: '/pages/my/index',

  // 个人中心子页
  PersonalProfile: '/pages/personal-profile/index',
  StyleSetting: '/pages/style-setting/index',
  NotificationSetting: '/pages/notification-setting/index',
  Trash: '/pages/trash/index',
  About: '/pages/about/index',

  // 行程相关
  TripDetail: '/pages/trip-detail/index',
  NewTrip: '/pages/new-trip/index',
  EditTrip: '/pages/edit-trip/index',
  TripPrepare: '/pages/trip-prepare/index',

  // 业务子页
  SpotDetailSheet: '/pages/spot-detail-sheet/index',
  PhotoGuide: '/pages/photo-guide/index',
  Chat: '/pages/chat/index',  // 2026-06-24 Fix B 新增,行程列表 chat 入口跳此页
  GuideResult: '/pages/guide-result/index',

  // 鉴权
  Login: '/pages/login/index',
}
