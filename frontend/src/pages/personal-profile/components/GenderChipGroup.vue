<!--
  GenderChipGroup.vue — 页面私有单选 chip 组(性别 3 选 1,下划线前缀 = private,见 Code Style §3.4)
  
  Spec contract: specs/PersonalProfilePage.md §8.3
  
  Props
    modelValue : 'male' | 'female' | 'other' | null   v-model,单选(3 选 1);null = 未选
    options    : Array<{ value, label }>              默认 3 项,PersonalProfileGenderOptions
    disabled   : boolean                              是否禁用整组(本页面**不**用)
  
  Emits
    update:modelValue : 'male' | 'female' | 'other' | null   v-model
    change            : { value, selected }
  
  Slots
    chip-{value}      : { option, selected }                 自定义 chip 渲染
  
  视觉:
    - 未选:surfaceWarm 填充 + divider 描边 + ink 文字
    - 选中:primarySoft 填充 + primary 描边 + primary 文字
    - min-height: 88rpx = 44pt 触达(NFR)
    - 与 InterestGrid 多选 cell 形态独立(单选行内 chips 横向 flex-wrap)
  
  备注:
    - 本组件**仅** PersonalProfilePage 使用(无跨页复用场景)
    - MVP 阶段**不**抽公共 _ChipGroup.vue(per specs/OnboardingPage.md §10 R-1 模式)
    - 必填标红 _RequiredMark 放在组件**外部**(在 _Section1_Gender 父级控制)
-->
<template>
  <view class="gender-chip-group" :aria-disabled="disabled || undefined">
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
import { PersonalProfileGenderOptions } from '../../../constants/strings.js'

const props = defineProps({
  /** @type {import('vue').PropType<'male' | 'female' | 'other' | null>} */
  modelValue: {
    type: String,
    default: null,
    validator: (v) => v === null || v === 'male' || v === 'female' || v === 'other',
  },
  /** @type {import('vue').PropType<Array<{ value: string, label: string }>>} */
  options: {
    type: Array,
    default: () => PersonalProfileGenderOptions,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'change'])

/**
 * 单选切换:点击当前选中项 → 取消(modelValue=null);点击其它项 → 切到新值
 * @param {{ value: 'male' | 'female' | 'other', label: string }} option
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
.gender-chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  /* space-md,chip 间 16rpx(spec §3.3 段 1) */
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
