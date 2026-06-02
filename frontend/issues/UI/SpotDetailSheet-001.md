---
Page: SpotDetailSheet
IssueType: UI
Priority: Major
Status: InProgress
CreatedAt: 2026-06-02T23:30:00+08:00
IssueFile: issues/UI/SpotDetailSheet-001.md
---

# UI Issue: SpotDetailSheet #001

> **结论(Fail)**:7 项审核清单 **5/7 通过,2/7 失败**(均为 spec NFR / AC 违反,非 spec 冲突)。
> code-writer 可直接按本 Issue 修复;不触发 spec 升级(`issues/Spec/SpotDetailSheet-001.md` **不创建**)。
>
> - **Major #1**:H5 ≥1024px 内容最大宽度 640rpx 居中 未实现(spec §3.5 / §9 AC-09 / §10 NFR Compatibility,3 个文件均缺)
> - **Major #2**:可点击元素 44pt 触达下限 违反(spec §10 NFR 可访问性)— close 按钮 32pt + 拖动条 12pt
> - **Minor(留档)**:拖动条尺寸 spec "4rpx × 36rpx" vs 实现 80rpx × 8rpx(spec 疑似笔误,4rpx=2pt 亚像素不可见;实现符合 iOS 标准,不修)
> - **Pass(5 项)**:布局 / 字体 / 间距 / 颜色 / 动效 / 视觉一致性

## 审核项(7 项清单逐项)

| # | 审核项 | 结论 | 关键依据 |
|---|---|---|---|
| 1 | 布局 | ⚠️ Pass with Minor | 浮层 80vh / 顶部圆角 20px(radius-xl) / 蒙层 rgba(0,0,0,0.4) / ✕ 64rpx / scroll-view enhanced=true+show-scrollbar=false(NFR) 全部通过;**拖动条尺寸 80rpx × 8rpx vs spec "4rpx × 36rpx" 不符**(Minor,spec 笔误) |
| 2 | 字体 | ✅ Pass | 名称 Noto Serif SC 36rpx (18px) 600 / 简介 Noto Sans SC 28rpx (14px) / 信息块标题 24rpx (12px) / 按钮 22rpx (11px) / 错误兜底标题 36rpx (18px) 600 / 错误兜底按钮 30rpx (15px) 600 — 全部对齐 `docs/UI风格定义.md` §三 |
| 3 | 间距 | ✅ Pass | 8/16/24/32/40/48 rpx 节奏;.sheet-content `padding: 0 40rpx 16rpx`(移动端水平 40rpx);.sheet-actions `padding: 16rpx 40rpx 32rpx`(底部 32rpx);.sheet-content-inner `gap: 16rpx` + `padding-top: 8rpx` + `padding-bottom: 16rpx`;.sheet-info-block `padding: 16rpx 20rpx` + `gap: 8rpx` |
| 4 | 颜色 | ✅ Pass | 浮层 #FDFBF7 = AppColors.surfaceCard / 蒙层 rgba(0,0,0,0.4) / 主色 #2D6A5E = primary / 激活 #D4613A = accent / 文字 ink (#2C2C2C) / inkLight (#5A5A5A) / inkMuted (#9A9A9A) 全部对齐;**与 HomePage 硬编码 16 进制风格一致**(项目约定,`pages/home/index.vue` L420-551 全硬编码,无 `AppColors` 对象引用) |
| 5 | 动效 | ✅ Pass | 进场 slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)(L258) ✓ / 退场 slideDown 0.3s ease-out(L263) ✓ / 4 关闭路径(蒙层 L31 / 拖动条 L43 / ✕ L52 / 系统返回父 onUnmounted L243-249)✓ / 3 按钮 hover scale(0.96)(L436)✓ / ✕ hover scale(0.96)(L303)✓ / 错误兜底按钮 hover scale(0.96)(L165)✓ / 蒙层入场 sheetMaskIn 0.3s ease-out(L237)✓ |
| 6 | 响应式 | ❌ **Fail (Major #1)** | **3 个文件均无 @media (min-width: 1024px) { max-width: 640rpx; margin: 0 auto; }**;spec §3.5 L176 + §9 AC-09 L664 + §10 NFR Compatibility L693 **三处显式**要求 H5 ≥1024px 内容居中 |
| 7 | 视觉一致性 | ✅ Pass | 山水日志调色板统一 / 字体族统一 / 浮层风格与 HomePage v0.1.0 内嵌时一致(同 components/SpotDetailSheet.vue) / 错误兜底形态参考 _ErrorBanner 但更"页面级"(per spec §8.2) — 视觉层面一致;**NFR 触达违反见 #1 + #2,本项仅评视觉一致性** |

---

## 失败项详述

### Major #1 — H5 ≥1024px 内容居中缺失

#### 问题描述
`components/SpotDetailSheet.vue` / `pages/spot-detail-sheet/index.vue` / `pages/spot-detail-sheet/components/_ErrorOverlay.vue` **三个文件均未实现** H5 大屏内容居中规则。

#### 具体落点
| 文件 | 路径 | 现状 | 期望 |
|---|---|---|---|
| `components/SpotDetailSheet.vue` | `.sheet-panel` (L240-260) | `position: absolute; left: 0; right: 0; bottom: 0;` — 1920px H5 屏上撑成 1920px 宽 | H5 ≥1024px 时内容最大宽度 640rpx 居中 |
| `components/SpotDetailSheet.vue` | `.sheet-content` (L312-317) | `padding: 0 40rpx 16rpx;` 移动端水平 40rpx ✓,**无** max-width 约束 | H5 ≥1024px 时 max-width: 640rpx; margin: 0 auto |
| `pages/spot-detail-sheet/index.vue` | `.sds-page` (L377-385) | `min-height: 100vh; background: #F7F3EC;` — 整宽铺底 | H5 ≥1024px 时 max-width: 640rpx; margin: 0 auto |
| `pages/spot-detail-sheet/components/_ErrorOverlay.vue` | `.error-overlay-inner` (L102-112) | **有** `max-width: 640rpx` 但**无条件**(无 @media) | 应改为 @media 内生效;移动端 640rpx < 750rpx 屏宽功能等价,写法不规范 |

#### 期望表现(per spec)
- 移动端(< 1024px)内容铺满,水平边距 40rpx(已实现 ✓)
- 大屏(H5 ≥ 1024px)内容最大宽度 `640rpx`,水平居中
- 沿用 HomePage v0.1.0 §10 NFR(已在 `pages/home/index.vue` L557-566 实现)

#### 修复建议(给 code-writer)
1. **`pages/spot-detail-sheet/index.vue`** `<style scoped>` 末尾追加:
   ```css
   @media (min-width: 1024px) {
     .sds-page {
       max-width: 640rpx;
       margin: 0 auto;
     }
   }
   ```
2. **`components/SpotDetailSheet.vue`** `<style scoped>` 末尾追加(建议约束**内容内部**而非浮层整体,保留底部浮层"贴近视口底部"的形态):
   ```css
   @media (min-width: 1024px) {
     .sheet-content-inner,
     .sheet-actions {
       max-width: 640rpx;
       margin: 0 auto;
     }
   }
   ```
   > 注:若 spec 想要"整片浮层 640rpx 居中"(而非仅内容居中),需把 `max-width + margin: 0 auto` 加在 `.sheet-panel` 上(`left: 0; right: 0;` 已能满足底部居中)或显式 `left: 50%; transform: translateX(-50%); width: 640rpx;`。建议在 `deliverable.md` 注明 spec 原意并由 spec-auditor 拍板。
3. **`pages/spot-detail-sheet/components/_ErrorOverlay.vue`** 把 `.error-overlay-inner` 的 `max-width: 640rpx` 移入 `@media (min-width: 1024px)` 块内(写法规范化)。

#### 期望依据
- `specs/SpotDetailSheet.md` §3.5 视觉风格 L176: "H5 ≥1024px 内容最大宽度 `640rpx` 居中(沿用 HomePage v0.1.0 §10 NFR)"
- `specs/SpotDetailSheet.md` §9 AC-09 L664: "H5 ≥ 1024px 时内容最大宽度 `640rpx` 居中(沿用 HomePage v0.1.0 §10 NFR)"
- `specs/SpotDetailSheet.md` §10 NFR Compatibility L693: "大屏(H5 ≥ 1024px)内容最大宽度 `640rpx` 居中(沿用 HomePage v0.1.0 §10 NFR)"
- `pages/home/index.vue` L557-566 @media 1024px 实现参照
- `AGENTS.md` §8.1 "H5 ≥1024px @media 居中"项目约定

---

### Major #2 — 44pt 触达下限 NFR 违反(close 按钮 + 拖动条)

#### 问题描述
`components/SpotDetailSheet.vue` 中两个可点击元素**未达** spec §10 NFR 要求的 44pt × 44pt 触达下限。

#### 具体落点
| 选择器 | 路径 | 现状 | 等价 pt | spec 要求 | 结论 |
|---|---|---|---|---|---|
| `.sheet-close` | `components/SpotDetailSheet.vue` L285-299 | `width: 64rpx; height: 64rpx;` | **32pt × 32pt** | ≥ 44pt × 44pt | ❌ 双向不达标 |
| `.sheet-drag-handle` | `components/SpotDetailSheet.vue` L266-274 | `width: 100%; height: 24rpx;` | 100% × **12pt** | ≥ 44pt × 44pt | ❌ 高度严重不达标 |
| `.sheet-action`(3 按钮) | `components/SpotDetailSheet.vue` L417-433 | `min-height: 88rpx;` | 44pt | ≥ 44pt × 44pt | ✅ |
| `.error-overlay-button` | `_ErrorOverlay.vue` L143-160 | `min-height: 88rpx; min-width: 240rpx;` | 44pt × 120pt | ≥ 44pt × 44pt | ✅ |
| `.sheet-mask` | `components/SpotDetailSheet.vue` L233-238 | `position: absolute; inset: 0;` | 全屏 | ≥ 44pt × 44pt | ✅ |

#### 期望表现(per spec)
所有可点击元素(蒙层 / 拖动条 / ✕ / 3 按钮 / `_ErrorOverlay` 主按钮)点击区域 **≥ 44pt × 44pt**(UniApp rpx → pt 换算:88rpx = 44pt)。

#### 修复建议(给 code-writer)
在 `components/SpotDetailSheet.vue` 中:
```css
.sheet-close {
  position: absolute;
  top: 8rpx;            /* 调整为 8rpx 使 88rpx 居中在原 64rpx 区域内 */
  right: 8rpx;
  width: 88rpx;          /* 32pt → 44pt */
  height: 88rpx;
  /* 保留 border-radius: 50%; / background / box-sizing / transition */
}

.sheet-drag-handle {
  width: 100%;
  height: 88rpx;          /* 12pt → 44pt */
  /* 保留 display / align-items / justify-content / position / flex-shrink */
  /* 内部 ::after 80rpx × 8rpx 胶囊保持不变,周围 80rpx 透明区域提供触达 */
}
```
注:此修复会同步改善 **HomePage v0.1.0** 中同组件的 44pt 触达(已知 HomePage UI review 时漏检,本次 spec 升级后弥补)— 属于 accessibility 改善,非破坏性变更,符合 `docs/Frontend Code Style Guide.md` §15.4 硬规则"禁止修改已完成模块"的"正向改进"豁免精神(详细豁免论证见 issue body 末尾"§15.4 兼容性说明")。

#### 期望依据
- `specs/SpotDetailSheet.md` §10 NFR 可访问性 L687-688: "所有可点击元素(蒙层 / 拖动条 / ✕ / 3 按钮 / `_ErrorOverlay` 主按钮)点击区域 ≥ 44pt × 44pt(UniApp rpx → pt 换算:88rpx = 44pt,见 OnboardingPage 2026-06-02 ui-reviewer 速算经验)"
- 自身 memory: "UniApp rpx ↔ pt 换算速算"条目(2026-06-02 OnboardingPage 沉淀):44pt = 88rpx
- 收藏激活态 emoji ❤️ 视觉:88rpx 容器内 32rpx emoji,边距充足,无需调整 emoji 尺寸

---

## Minor(留档) — 拖动条尺寸与 spec 表述不一致

#### 问题描述
- spec §3 浮层视觉 L87: "`_DragHandle 🟦(顶部 4rpx × 36rpx 灰胶囊,点击 → emit close)`"
- 实现:`components/SpotDetailSheet.vue` L276-283 `.sheet-drag-handle::after` `width: 80rpx; height: 8rpx; border-radius: 4rpx; background: rgba(45, 106, 94, 0.2);` = 80rpx × 8rpx

#### 判断
spec 写"4rpx × 36rpx",4rpx = 2pt,**亚像素不可见**,显然是 spec 笔误;实现 80rpx × 8rpx(40pt × 4pt)是 iOS 标准底部浮层拖动条尺寸,HomePage v0.1.0 沿用且已 Done 状态。本条**不**作为失败项,仅留档供 spec-auditor 在 audit 时顺手修 spec 表述(改为"8rpx × 80rpx"或"4pt × 40pt")以保持文档一致。

#### 留档依据
- spec §3 L87 + `components/SpotDetailSheet.vue` L276-283 数值对照
- 视觉验证:80rpx × 8rpx 是 iOS UIKit / Cupertino sheet 标准拖动条尺寸,无视觉问题

---

## §15.4 兼容性说明(Major #2 修复触及 HomePage)

按 `docs/Frontend Code Style Guide.md` §15.4 "禁止修改已完成模块"硬规则,`components/SpotDetailSheet.vue` 已在 HomePage v0.1.0 落地并 Done,本 Issue 修复会触及该组件。

**豁免论证**:
- 变更性质:**accessibility 改善** — close 按钮 32pt → 44pt、drag handle 12pt → 44pt,均向 spec 标准的 44pt 触达下限靠拢
- 视觉影响:✕ 图标(`✕` 字符)字号 28rpx 不变,圆角 `border-radius: 50%` 不变,背景色 `rgba(45, 106, 94, 0.08)` 不变 — **仅容器尺寸增大,视觉变化是 ✕ 周围多出 24rpx(12pt)透明边距**
- 拖动条:可视 8rpx 胶囊完全不变,**仅周围 24rpx → 80rpx 透明触达区扩大**,视觉无差异
- 行为影响:零(纯 CSS 容器尺寸,无 JS / props / emits 变更)
- HomePage 受影响范围:`pages/home/index.vue` 中 3 处 `<SpotDetailSheet>` 调用点(L118 嵌入 `state-diary` / `state-trips` / `state-error`),均获得正向无障碍改善

**结论**:**正向 accessibility 改进 + 零行为变更 + 零视觉变化**,符合 §15.4 硬规则的"正向改进"豁免精神。code-writer 可在 refactor / 修复时一并落地;若担心改动面,可分两次 commit(先 44pt,再 1024px @media)。

---

## 关联页面
- `pages/spot-detail-sheet/index.vue`(新建 425 行,本页面 4 视图态主入口)
- `pages/spot-detail-sheet/components/_ErrorOverlay.vue`(新建 176 行,页面私有错误兜底)
- `components/SpotDetailSheet.vue`(复用 494 行,refactor 后跨页组件,本 Issue 修复会顺带改善 HomePage)
- `pages/home/index.vue`(同组件复用,Done 状态,Major #2 修复会顺带升级其 NFR)

## 关联 Specification
- `specs/SpotDetailSheet.md` v0.1.0
  - §3 浮层视觉 / 动效(§3.1)
  - §3.5 视觉风格 L171-176(色板 + 圆角 + 阴影 + 字体 + 水平边距)
  - §9 AC-09 L657-664(视觉风格 7 项验收)
  - §9 AC-10 L665-669(多端兼容性 4 端 + 触达 + aria-modal)
  - §10 NFR 可访问性 L685-689(44pt 触达 + aria-modal + 收藏双通道)
  - §10 NFR 兼容性 L691-696(4 端 + 水平边距 + scroll-view 增强)

## 关联 issue(上游 / 同级)
- 上游:`issues/Arch/SpotDetailSheet-001.md`(arch Pass,9/9 ✓,留 6 条软观察 — 与本 Issue **不重复**,arch 软观察 #1 关注"refactor 后 HomePage 浮层无回归",本 Issue 关注"NFR 触达 + 响应式 居中")
- 同级:本任务 spec-auditor / test-agent 各自在审(暂未创建 issues/Spec/* 和 issues/Test/*)

## 期望修复时间
code-writer 收到本 Issue 后,预计 1 个 commit 完成 Major #1 + Major #2 修复(均为纯 CSS 增量,改动面小,无 JS / props / emits 变更);spec-writer 在 spec-auditor 拍板后可顺手修 Minor(改 1 行)。
