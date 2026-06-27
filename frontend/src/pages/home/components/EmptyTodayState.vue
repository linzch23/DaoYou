<!--
  pages/home/components/EmptyTodayState.vue

  Section 1 今日无行程占位组件(2026-06-24 Fix A 新增)

  Spec 背景:用户报「Section 1(今日行程)为假」+「再次进入时消失」
  根因:
    - 之前 homeStore.fetchToday 错误传 activeTrip.start_date(行程起始日),
      导致后端查询 trip start_date 那天 → today_items 多为空
    - home/index.vue sectionVisibility.showDiary 用 today_items.length > 0 判定
      → 空时整段 Section 1 不渲染

  本组件职责:
    - 仅占位展示,无 tap 入口(沿 13 页面惯例)
    - 3 props(title / subtitle / emoji)1:1 对齐 HomeStrings.emptyTodayXxx 3 键
    - 不触发任何 store / service 调用

  复用决策(per AGENTS.md §0 + §8.4 + §8.6):
    - 不抽到 components/(MVP YAGNI,inline 渲染足够)
    - 仅 home page 用,MVP YAGNI

  Section 1 容器(父 home/index.vue):
    <view v-if="sectionVisibility.showDiary" class="section section-diary">
      <HomeDiary v-if="hasTodayItems" :today="store.today" ... />
      <EmptyTodayState
        v-else
        :title="strings.emptyTodayTitle"
        :subtitle="strings.emptyTodaySubtitle"
        :emoji="strings.emptyTodayEmoji"
      />
    </view>
-->
<template>
  <view class="empty-today-state">
    <text
      class="empty-today-emoji"
      aria-hidden="true"
    >{{ emoji }}</text>
    <text class="empty-today-title">{{ title }}</text>
    <text
      v-if="subtitle"
      class="empty-today-subtitle"
    >{{ subtitle }}</text>
  </view>
</template>

<script setup>
defineProps({
  /** 主标题,1:1 对齐 HomeStrings.emptyTodayTitle */
  title: { type: String, required: true },
  /** 副标题(可空),1:1 对齐 HomeStrings.emptyTodaySubtitle */
  subtitle: { type: String, default: '' },
  /** 主 emoji,1:1 对齐 HomeStrings.emptyTodayEmoji */
  emoji: { type: String, default: '🌙' },
})
</script>

<style scoped>
.empty-today-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 40rpx;
  gap: 16rpx;
  background: #FDFBF7;
  /* surfaceCard */
  border-radius: 16px;
  /* radius-lg */
  margin: 0 40rpx;
  box-sizing: border-box;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  /* shadow-sm */
}

.empty-today-emoji {
  font-size: 72rpx;
  /* 36px,大图标 */
  line-height: 1;
}

.empty-today-title {
  display: block;
  font-family: 'Noto Serif SC', serif;
  font-size: 32rpx;
  /* 16px,段标题 */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
  text-align: center;
}

.empty-today-subtitle {
  display: block;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px,辅助说明 */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
  text-align: center;
  max-width: 480rpx;
}
</style>