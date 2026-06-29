<!--
  TravelPaceChipGroup.vue — 页面私有单选 chip 组(旅行节奏 3 选 1,可空)

  Spec contract: specs/PersonalProfilePage.md §8.5(v0.2.0 新增)
  Source template: 同目录 GenderChipGroup.vue(单选形态 1:1 复用)

  Props
    modelValue : 'compact' | 'normal' | 'slow' | null   v-model,单选(3 选 1);null = 未选
    options    : Array<{ value, label }>               默认 3 项,PersonalProfileTravelPaceOptions
    disabled   : boolean                               是否禁用整组(本页面**不**用)

  Emits
    update:modelValue : 'compact' | 'normal' | 'slow' | null   v-model
    change            : { value, selected }

  Slots
    chip-{value}      : { option, selected }                   自定义 chip 渲染

  视觉:
    - 与 GenderChipGroup 完全一致(沿 §3.1 单选 chip 配色,1.5px 描边,88rpx = 44pt 触达)
    - 未选:surfaceWarm 填充 + divider 描边 + ink 文字
    - 选中:primarySoft 填充 + primary 描边 + primary 文字
    - min-height: 88rpx = 44pt 触达(NFR)

  备注:
    - 本组件**仅** PersonalProfilePage 使用(无跨页复用场景)
    - MVP 阶段**不**抽公共 _ChipGroup.vue(per §3.6 R-1 + §8.8 bug 2 修复命名)
    - 「可选」语义通过外部空值提示(段 4 不显 _RequiredMark)+ formData.travelPace === null 表达
-->
<template>
  <view class="travel-pace-chip-group" :aria-disabled="disabled || undefined">
    <view
      v-for="option in options"
      :key="option.value"
      class="chip"
      :class="{ 'chip-selected': modelValue === option.value, 'chip-disabled': disabled }"
      :aria-pressed="modelValue === option.value"
      :aria-label="option.label"
      :data-value="option.value"
      role="button"
      :hover-stay-time="50"
      hover-class="chip-hover"
      @click="onToggle(option)"
    >
      <slot
        :name="`chip-${option.value}`"
        :option="option"
        :selected="modelValue === option.value"
      >
        <text
          class="chip-text"
          :class="{ 'chip-text-selected': modelValue === option.value }"
        >{{ option.label }}</text>
      </slot>
    </view>
  </view>
</template>

<script setup>
import { PersonalProfileTravelPaceOptions } from '../../../constants/strings.js'

const props = defineProps({
  /** @type {import('vue').PropType<'compact' | 'normal' | 'slow' | null>} */
  modelValue: {
    type: String,
    default: null,
    validator: (v) => v === null || v === 'compact' || v === 'normal' || v === 'slow',
  },
  /** @type {import('vue').PropType<Array<{ value: string, label: string }>>} */
  options: {
    type: Array,
    default: () => PersonalProfileTravelPaceOptions,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'change'])

/**
 * 单选切换:点击当前选中项 → 取消(modelValue=null);点击其它项 → 切到新值
 * spec §5.1 + AC-15 显式允许 null(可空语义,per 「3 选 1(可选)」)
 * @param {{ value: 'compact' | 'normal' | 'slow', label: string }} option
 */
function onToggle(option) {
  if (props.disabled) return
  const currentlySelected = props.modelValue === option.value
  const next = currentlySelected ? null : option.value
  emit('update:modelValue', next)
  emit('change', { value: option.value, selected: !currentlySelected })
}
</script>

<style scoped>
.travel-pace-chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  /* space-md,chip 间 16rpx(spec §3.3 段 4) */
  box-sizing: border-box;
}

.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  /* ≥ 44pt tap area(spec §10 NFR) */
  padding: 0 24rpx;
  background: #F2EBE0;
  /* surfaceWarm(未选) */
  border: 1.5px solid #E8E0D4;
  /* divider(未选) */
  border-radius: 9999px;
  /* radius-full */
  box-sizing: border-box;
  transition: background 0.15s ease-out, border-color 0.15s ease-out, transform 0.15s ease-out;
}

.chip-hover {
  transform: scale(0.96);
}

.chip-selected {
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft(选中) */
  border-color: #2D6A5E;
  /* primary(选中) */
}

.chip-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.chip-text {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 28rpx;
  /* 14px */
  color: #2C2C2C;
  /* ink(未选) */
  line-height: 1.4;
  font-weight: 500;
}

.chip-text-selected {
  color: #2D6A5E;
  /* primary(选中) */
  font-weight: 600;
}
</style>