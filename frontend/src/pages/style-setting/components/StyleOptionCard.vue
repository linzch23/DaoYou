<!--
  StyleOptionCard.vue — 页面私有讲解风格选项卡

  Spec contract: specs/StyleSettingPage.md §3.4 + §8.3
  Route: /pages/style-setting/index
  入口:StyleSettingPage(本页面) v-for 渲染 3 张卡(per §3.4 表格)
  用途:展示 1 个候选讲解风格(图标 + 标题 + 描述)+ 选中态高亮 + 点击回调

  Props
    explanationStyle: string    ExplanationStyle 3 枚举之一
                                  ('professional' | 'fun' | 'children')
                                  ⚠️ 不用 'style' 作 prop 名 — Vue 3 保留名为 class/style,
                                     父组件 :style="opt.value" 会被 Vue 编译为原生 CSS 绑定
                                     (Object),导致 type:String 校验失败 + 实际值不可达。
                                     重命名为 explanationStyle 绕开此限制(per UI-016 fix)。
    title           : string    短标签(走 StyleSettingStrings.styleTitleXxx)
    desc            : string    长描述(走 StyleSettingStrings.styleDescXxx)
    icon            : string    emoji 字符串(64rpx 左侧)
    isSelected      : boolean   是否选中态(true → primarySoft 背景 + 1.5px primary 描边 + 右侧 ✓)
    onTap           : function  点击回调,签名为 (style: string) => void

  注:
    1) 私有子组件(per Code Style §3.4 `_` 前缀),MVP 唯一调用方 = StyleSettingPage
    2) slot-free(本规格不预留 slot 扩展)
    3) 44pt 触达:整行 min-height 112rpx(容纳 64rpx icon + title + desc 2 行 + 触达)
    4) 选中态视觉:背景 primarySoft + 1.5px primary 描边 + 右侧 36rpx ✓ 实心圆
-->
<template>
  <view
    :class="['option-row', isSelected ? 'option-row-selected' : '']"
    role="button"
    :aria-label="title"
    :aria-pressed="isSelected || undefined"
    hover-class="option-row-hover"
    :hover-stay-time="50"
    @click="handleTap"
  >
    <view class="option-icon" aria-hidden="true">
      <text class="option-icon-emoji">{{ icon }}</text>
    </view>
    <view class="option-text">
      <text class="option-title">{{ title }}</text>
      <text class="option-desc">{{ desc }}</text>
    </view>
    <view
      v-if="isSelected"
      class="option-check"
      aria-hidden="true"
    >
      <text class="option-check-glyph">✓</text>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  // UI-016 fix: 重命名 'style' → 'explanationStyle'
  // 原因:Vue 3 保留 prop 名 class/style,父组件 :style="opt.value" 会被编译为原生
  // CSS 样式绑定(Object),与 type:String 校验冲突;重命名后变成普通 prop pass-through。
  explanationStyle: {
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
  icon: {
    type: String,
    required: true,
  },
  isSelected: {
    type: Boolean,
    default: false,
  },
  onTap: {
    type: Function,
    required: true,
  },
})

/**
 * 点击 → 调用 onTap(explanationStyle)
 * 父级通过 closure 知道是哪个 option(per spec §3.4 + §8.3)
 */
function handleTap() {
  props.onTap(props.explanationStyle)
}
</script>

<style scoped>
.option-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20rpx;
  /* space-md,icon 与 text 间 20rpx */
  min-height: 112rpx;
  /* ≥ 44pt tap area(spec §3.4 备注) */
  padding: 24rpx;
  /* space-lg */
  background: #FDFBF7;
  /* surfaceCard */
  border-radius: 12px;
  /* radius-md */
  border: 1.5px solid transparent;
  /* 选中态 primary 描边预留 */
  box-sizing: border-box;
  transition: background 0.15s ease-out, border-color 0.15s ease-out, transform 0.15s ease-out;
}

.option-row-hover {
  background: rgba(45, 106, 94, 0.04);
  /* primarySoft(浅版)— 明显视觉反馈,UI-016 fix */
  transform: scale(0.98);
  /* 微微缩小,触感更明确 */
  opacity: 0.92;
  /* 与 scale + bg 三重叠加,确保弱光环境下也可见 */
}

.option-row-selected {
  background: rgba(45, 106, 94, 0.08);
  /* primarySoft */
  border-color: #2D6A5E;
  /* primary 1.5px 描边 */
}

.option-row-selected.option-row-hover {
  /* 选中态 hover 不再叠加 scale/opacity,避免抖动 */
  background: rgba(45, 106, 94, 0.14);
  /* primarySoftStrong — 选中后再 hover 加深,提示「已选」 */
  transform: scale(0.98);
}

.option-icon {
  flex-shrink: 0;
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.option-icon-emoji {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 64rpx;
  line-height: 1;
  color: #2C2C2C;
  /* ink */
}

.option-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  box-sizing: border-box;
}

.option-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 32rpx;
  /* 16px */
  font-weight: 600;
  color: #2C2C2C;
  /* ink */
  line-height: 1.4;
}

.option-desc {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 26rpx;
  /* 13px */
  color: #5A5A5A;
  /* inkLight */
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* 单行省略(spec §3.4 备注 desc > 32 字符时) */
}

.option-check {
  flex-shrink: 0;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: #2D6A5E;
  /* primary 实心圆 */
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.option-check-glyph {
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 22rpx;
  /* 11px */
  font-weight: 700;
  color: #FFFFFF;
  line-height: 1;
  margin-top: -2rpx;
  /* 视觉居中补偿 */
}
</style>
