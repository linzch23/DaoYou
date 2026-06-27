<!--
  TripList.vue — HomePage 行程列表(按 start_date 升序,见 spec §3.6 + §5.2)
  
  Spec contract: specs/HomePage.md §8.5
  
  Props
    trips  : TripSummary[]   行程列表(已由 homeStore 排序过,组件内不重排)
  
  Emits
    selectTrip : TripSummary   用户点某条 TripCard,父组件跳详情
    chat       : TripSummary   用户点 TripCard chat 按钮 → ChatPage(2026-06-24 加,转发)
    delete     : TripSummary   用户点 TripCard delete 按钮 → DeleteConfirmDialog(2026-06-24 加,转发)
-->
<template>
  <view class="trip-list">
    <view
      v-for="trip in trips"
      :key="trip.id"
      class="trip-list-item"
    >
      <TripCard
        :trip="trip"
        @tap="onSelect(trip)"
        @chat="emit('chat', trip)"
        @delete="emit('delete', trip)"
      />
    </view>
  </view>
</template>

<script setup>
import TripCard from './TripCard.vue'

defineProps({
  /** @type {import('vue').PropType<Array<import('../api/types').TripSummary>>} */
  trips: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['selectTrip', 'chat', 'delete'])

/**
 * @param {import('../api/types').TripSummary} trip
 */
function onSelect(trip) {
  emit('selectTrip', trip)
}
</script>

<style scoped>
.trip-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  /* space-md */
  padding: 16rpx 0;
  box-sizing: border-box;
}

.trip-list-item {
  width: 100%;
  box-sizing: border-box;
}
</style>
