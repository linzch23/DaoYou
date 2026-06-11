<!--
  UnreadBadge.vue — HomePage 页面私有未读提醒数角标(spec §8.9)
  
  Spec contract: specs/HomePage.md §8.9
  
  Props
    count : number       未读数;0 时不渲染
    max   : number       超过则显示 "{max}+"(默认 99)
  
  Emits:无
  
  Slots:无
-->
<template>
  <view
    v-if="count > 0"
    class="unread-badge"
    :aria-label="`${count} 条未读提醒`"
  >
    <text class="unread-badge-text">{{ displayText }}</text>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  count: {
    type: Number,
    required: true,
  },
  max: {
    type: Number,
    default: 99,
  },
})

const displayText = computed(() => {
  if (props.count > props.max) return `${props.max}+`
  return String(props.count)
})
</script>

<style scoped>
.unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 12rpx;
  border-radius: 18rpx;
  background: #D4613A;
  /* Accent(丹霞红) */
  box-sizing: border-box;
  flex-shrink: 0;
}

.unread-badge-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  /* 11px */
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1;
}
</style>
