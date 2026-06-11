// frontend/constants/colors.js
// 山水日志(Shanshui Diary)配色 —— 参见 docs/UI风格定义.md §二
//
// 用法:
//   <view :style="{ background: AppColors.surface }" />
//   <text :style="{ color: AppColors.ink }">...</text>
//
// 颜色值(节选,与 UI 风格定义一一对应):
//   Primary       #2D6A5E   远山青
//   Primary Light #3D8B7D   远山青浅
//   Primary Dark  #1D4A3E   远山青深
//   Surface       #F7F3EC   宣纸
//   Surface Warm  #F2EBE0   宣纸暖
//   Surface Card  #FDFBF7   宣纸白
//   Accent        #D4613A   丹霞
//   Ink           #2C2C2C   墨主
//   Ink Light     #5A5A5A   墨次
//   Ink Muted     #9A9A9A   墨辅
//   Success       #4A9B7F
//   Warning       #D4A03A
//   Danger        #C44A3A

export const AppColors = {
  // Primary 远山青
  primary: '#2D6A5E',
  primaryLight: '#3D8B7D',
  primaryDark: '#1D4A3E',
  primarySoft: 'rgba(45, 106, 94, 0.08)',
  primarySoftStrong: 'rgba(45, 106, 94, 0.12)',
  primaryBorder: 'rgba(45, 106, 94, 0.15)',
  primaryShadow: 'rgba(45, 106, 94, 0.35)',

  // Surface 宣纸
  surface: '#F7F3EC',
  surfaceWarm: '#F2EBE0',
  surfaceCard: '#FDFBF7',

  // Accent 丹霞
  accent: '#D4613A',

  // Ink 墨
  ink: '#2C2C2C',
  inkLight: '#5A5A5A',
  inkMuted: '#9A9A9A',
  inkInverse: '#FFFFFF',

  // 功能色
  success: '#4A9B7F',
  warning: '#D4A03A',
  danger: '#C44A3A',
  dangerSoft: 'rgba(196, 74, 58, 0.08)',
  dangerBorder: 'rgba(196, 74, 58, 0.2)',

  // 边框 / 分割
  borderSubtle: 'rgba(45, 106, 94, 0.06)',
  borderStrong: 'rgba(45, 106, 94, 0.1)',
  divider: '#E8E0D4',

  // 半透明蒙层 / 选中态
  scrim: 'rgba(0, 0, 0, 0.04)',
}
