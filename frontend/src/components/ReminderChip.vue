<!--
  ReminderChip.vue — 跨页通用旅行小贴士胶囊
  
  Spec contract: specs/HomePage.md §8.8
  
  Props
    type    : ReminderType   4 枚举(weather / departure / conflict / rest)
    content : string         chip 文字内容
  
  Emits
    tap     : void
  
  Slots:无
  
  视觉(4 类 → 4 套样式,见 spec §3.2):
    weather    → Warning 浅 + Warning 文字
    departure  → primarySoft + primary 文字
    conflict   → dangerSoft + danger 文字
    rest       → primarySoftStrong + primary 文字
-->
<template>
  <view
    class="reminder-chip"
    :class="`reminder-chip-${type}`"
    :aria-label="labelAria"
    role="button"
    hover-class="reminder-chip-hover"
    :hover-stay-time="50"
    @click="onTap"
  >
    <text class="reminder-emoji" aria-hidden="true">{{ emoji }}</text>
    <text class="reminder-content">{{ content }}</text>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { HomeStrings, HomeReminderTypeLabel } from '../constants/strings.js'

const props = defineProps({
  type: {
    /** @type {import('vue').PropType<import('../api/types').ReminderType>} */
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['tap'])

const EMOJI_MAP = Object.freeze({
  weather: '🌧️',
  departure: '⏰',
  conflict: '⚠️',
  rest: '😴',
})

const emoji = computed(() => EMOJI_MAP[props.type] || '🔔')
const labelAria = computed(() => {
  const tag = HomeReminderTypeLabel[props.type] || HomeStrings.reminderChipDefault
  return `${tag}提醒:${props.content}`
})

function onTap() {
  emit('tap')
}
</script>

<style scoped>
.reminder-chip {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 20rpx;
  /* spec §3.2:内边距 12rpx 20rpx */
  border-radius: 9999px;
  /* radius-full */
  min-height: 64rpx;
  box-sizing: border-box;
  flex-shrink: 0;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out;
}

.reminder-chip-hover {
  opacity: 0.85;
  transform: scale(0.96);
}

.reminder-emoji {
  font-size: 24rpx;
  /* 12px */
  line-height: 1;
}

.reminder-content {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 24rpx;
  /* 12px,见 UI §三 标签 */
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
}

/* ───────── 4 类型样式(对应 spec §3.2 表)───────── */
.reminder-chip-weather {
  background: rgba(212, 160, 58, 0.12);
  /* Warning 浅 */
}
.reminder-chip-weather .reminder-content {
  color: #D4A03A;
  /* Warning */
}

.reminder-chip-departure {
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft */
}
.reminder-chip-departure .reminder-content {
  color: #2D6A5E;
  /* primary */
}

.reminder-chip-conflict {
  background: rgba(196, 74, 58, 0.08);
  /* dangerSoft */
}
.reminder-chip-conflict .reminder-content {
  color: #C44A3A;
  /* danger */
}

.reminder-chip-rest {
  background: rgba(45, 106, 94, 0.12);
  /* primarySoftStrong */
}
.reminder-chip-rest .reminder-content {
  color: #2D6A5E;
  /* primary */
}
</style>
