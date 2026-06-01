# Frontend Code Style Guide

Version: 1.0

Purpose:
为 AI 协作团队在 uni-app 项目中提供统一编码规范，确保可维护、可审查、可生成、可长期执行。

原则:

1. 一致性优先于个人偏好
2. 可维护性优先于代码简洁性
3. 明确优先于隐式
4. 禁止 Agent 自由发挥业务逻辑或界面布局
5. Feature 是最小协作单位

---

# 1. Project Structure

所有功能模块必须采用 **Feature First** 结构：

```
src/
└── features/
    └── feature_name/
        ├── api/            # 请求封装
        ├── components/     # 页面独立组件
        ├── pages/          # 页面
        ├── store/          # Pinia 状态管理
        └── utils/          # 功能性工具
```

禁止：

* 跨 Feature 引用内部实现（只能通过 store 或 api 暴露接口）
* 页面直接调用 utils 以外的模块

---

# 2. Naming Convention

## 2.1 文件名

* 使用 **kebab-case**
* 页面文件夹与文件一致
* 单个组件文件命名与组件名一致

正确：

```
trip-list.vue
trip-detail.vue
trip-card.vue
user-profile.vue
```

错误：

```
TripList.vue
tripList.vue
TripCardComponent.vue
```

## 2.2 组件与页面

* 页面：PascalCase，例如 `TripListPage.vue`
* 组件：PascalCase，例如 `TripCard.vue`
* store：PascalCase，例如 `TripStore.js`

## 2.3 变量

* 使用 camelCase
* Boolean 必须以 `is/has/can/should` 开头

正确：

```
tripList
isLoading
hasPermission
canEdit
```

错误：

```
trip_list
loadingFlag
permission
editable
```

---

# 3. Vue 组件规范

1. 单文件组件 (SFC) 必须包含以下顺序：

   ```
   <template>
   <script setup>
   <style scoped>
   ```
2. 不允许在 `<template>` 中直接使用逻辑（计算或 API 调用）
3. 组件只处理 UI，不调用 API 或 store 以外的外部逻辑
4. 内部子组件私有，使用 `_` 前缀命名，例如 `_TripCardHeader.vue`

---

# 4. Pages 规则

* 页面只处理：

  * 页面布局
  * 状态监听
  * 用户事件转发
* 禁止：

  * API 调用（使用 feature/api 封装）
  * 复杂业务逻辑（放到 store 或 utils）
* 必须支持以下状态：

  * loading
  * success
  * empty
  * error

---

# 5. API 规则

* 所有接口必须在 feature/api 下封装
* 接口返回数据必须使用 DTO（定义 JS/TS 类型）
* 禁止页面或组件直接调用 uni.request
* 接口调用返回数据必须映射到 store 或 Entity

---

# 6. Store (Pinia) 规范

* 每个 Feature 独立 store
* store 仅管理状态和方法
* 禁止直接操作 API 数据（必须通过 api 层封装）
* 所有状态必须初始化为明确类型

---

# 7. DTO / Entity 规则

* DTO 用于映射 API 数据
* Entity 用于业务逻辑
* DTO 不允许进入页面模板

```
API → DTO → Entity → Store → Page → Template
```

* 禁止在页面 template 里使用 DTO 字段

---

# 8. Utils

* 功能性工具函数必须纯函数
* 禁止直接访问页面 DOM 或 store
* 工具函数放在 feature/utils 或 global/utils

---

# 9. Error Handling

* 不允许空 catch

```
try {
   ...
} catch (e) {
   logger.error(e)
}
```

* 所有错误必须向上抛给 store 或 page 处理
* 页面必须显示友好提示

---

# 10. Constants

* 所有常量集中管理：`src/constants/`
* 禁止 magic number 或硬编码字符串
* 颜色、间距、动画时间统一命名：

```
AppColors.primary
AppSpacing.md
AppDuration.fast
```

---

# 11. Routing

* 所有路由统一在 `src/router/index.js` 注册
* 页面间跳转使用路由常量，禁止硬编码字符串

正确：

```js
router.push({ name: AppRoutes.TripDetail, params: { id: 1 } })
```

错误：

```js
router.push('/trip/detail/1')
```

---

# 12. Style / CSS

* 使用 `<style scoped>`
* 禁止全局样式污染 Feature
* 统一变量：`src/assets/styles/variables.scss`
* 颜色、字体、间距必须使用变量

---

# 13. Logging

* 禁止使用 `console.log`
* 使用统一 logger：`src/utils/logger.js`
* 禁止提交调试日志

---

# 14. Review Checklist

每次提交必须检查：

[ ] 文件结构正确
[ ] 页面/组件命名正确
[ ] store 命名正确
[ ] API 调用封装完整
[ ] DTO/Entity 流程正确
[ ] 状态完整（loading/success/empty/error）
[ ] 没有魔法数字
[ ] 没有 console.log / TODO / debugger
[ ] 无循环依赖
[ ] 路由使用常量
[ ] CSS 使用变量

---

# 15. Agent Restrictions

Agent 在 uni-app 项目中必须遵守：

1. 禁止修改 API 文档或接口定义
2. 禁止修改项目目录结构
3. 禁止新增依赖或插件
4. 禁止修改已完成模块
5. 禁止修改路由或 Design System
6. 禁止实现 SPEC 中未列出的非目标功能
7. 若发现需求缺失，必须停止实现并提出问题

---

# 16. Coding Rules Summary

```
Page  → 只做 UI + 事件转发
Component → UI + 内部子组件
Store → 状态管理 + 方法
API → 请求封装 + DTO 映射
Utils → 纯函数
Constants → 全局常量
Routing → 常量注册
Style → 变量 + scoped
Logging → logger.js
```

> 保证 Agent 生成的代码可预测、可审查、可长期维护。
