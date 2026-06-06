<!--
  NotificationSwitchRow.vue — 页面私有通知类别开关行

  Spec contract: specs/NotificationSettingPage.md §8.3
  Route: /pages/notification-setting/index
  入口:NotificationSettingPage(本页面) v-for 渲染 4 行(per §3.4 表格)
  用途:展示 1 个通知类别(图标 + 标题 + 描述)+ 右侧 uni-switch 切换

  Props
    icon  : string   emoji 图标,左侧 64rpx
    title : string   中文短标签(走 NotificationSettingStrings.titleXxx)
    desc  : string   中文长描述(走 NotificationSettingStrings.descXxx)
    isOn  : boolean  当前 switch 状态(由 parent 注入)

  Emits
    update:isOn : boolean  switch 切换时触发,parent 接收新值更新 notificationPrefs[<key>]

  注:
    1) 私有子组件(per Code Style §3.4 `_` 前缀),MVP 唯一调用方 = NotificationSettingPage
    2) slot-free(本规格不预留 slot 扩展)
    3) 44pt 触达:整行 min-height 96rpx(容纳 64rpx icon + 2 行 text + 触达)
    4) <switch> 用 uni-switch 跨端组件,:checked 绑 isOn,@change 触发 update:isOn
    5) 交互设计(per UI-018 fix A):switch 是「开关按钮」语义,本身是**唯一触发区**;
       行内其他区域(icon / 标题 / 描述)点击**不**触发切换,仅产生 hover 视觉反馈(沿用 iOS / Android 行业共识)
       历史上 整行 + switch 双触发 在 H5 端会 double-fire 互相抵消(外层 view click 先于 switch change 触发,状态翻 2 次净效果 = 不变)
-->
<template>
  <view
    class="switch-row"
    :aria-label="title"
    hover-class="switch-row-hover"
    :hover-stay-time="50"
  >
    <view class="switch-icon" aria-hidden="true">
      <text class="switch-icon-emoji">{{ icon }}</text>
    </view>
    <view class="switch-text">
      <text class="switch-title">{{ title }}</text>
      <text class="switch-desc">{{ desc }}</text>
    </view>
    <switch
      class="switch-control"
      :checked="isOn"
      color="#2D6A5E"
      :aria-label="title"
      :aria-pressed="isOn || undefined"
      @change="onSwitchChange"
    />
  </view>
</template>

<script setup>
const props = defineProps({
  icon: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  desc: {
    type: String,
    required: true,
  },
  isOn: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['update:isOn'])

/**
 * switch 本身 change 事件 → emit 反值(per UI-018 fix A:**唯一**触发区)
 * 移除历史 onRowTap 整行 click 触发,避免 H5 上 double-fire 互相抵消
 * @param {Event} e
 */
function onSwitchChange(e) {
  const next = !!(e?.detail?.value)
  if (next === props.isOn) return
  emit('update:isOn', next)
}
</script>

<style scoped>
.switch-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20rpx;
  /* space-md,icon 与 text 间 20rpx(spec §3.1 节奏) */
  min-height: 96rpx;
  /* ≥ 44pt tap area + 容纳 64rpx icon + 2 行 text(spec §3.4 + §10.2) */
  padding: 24rpx;
  /* space-lg */
  background: #FDFBF7;
  /* surfaceCard */
  border-radius: 12px;
  /* radius-md */
  box-sizing: border-box;
  transition: background 0.15s ease-out, transform 0.15s ease-out;
}

.switch-row-hover {
  background: #F2EBE0;
  /* surfaceWarm 视觉反馈 */
  opacity: 0.96;
}

.switch-icon {
  flex-shrink: 0;
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.switch-icon-emoji {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 56rpx;
  /* emoji 视觉 64rpx 容器(实际 56rpx emoji 字号填充) */
  line-height: 1;
  color: #2C2C2C;
  /* ink */
}

.switch-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  box-sizing: border-box;
}

.switch-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 32rpx;
  /* 16px */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.switch-desc {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
}

.switch-control {
  flex-shrink: 0;
  /* uni-switch 跨端组件,color 控制激活态(per spec §3.1) */
}
</style>
