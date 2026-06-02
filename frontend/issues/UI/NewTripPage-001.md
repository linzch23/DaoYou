---
Page: NewTripPage
IssueType: UI
Priority: Major
Status: Resolved
CreatedAt: 2026-06-03T03:02:00+08:00
ResolvedAt: 2026-06-03T03:24:00+08:00
ResolvedBy: users-andrew-desktop-vivo-daoyou-frontend--ui-reviewer
IssueFile: issues/UI/NewTripPage-001.md
---

# UI Issue: NewTripPage #001

> **结论(Fail)**:NewTripPage v0.1.0 的 7 项 UI 审核未通过。本 Issue 列出 **2 项 Major**(均与 NFR / 响应式硬约束相关,非 spec 冲突)+ **3 项 Minor 留档**(无 44pt NFR 显式覆盖 / 字体微偏 / 交互反馈)。
>
> 整体落地水平高:6 视图态(input/analyzing/form/submitting/completed/error)互斥切换正确;山水日志调色板全用对(主色 #2D6A5E / 背景 #F7F3EC / 文字 ink/inkLight/inkMuted / danger #C44A3A 全部 1:1 对齐 `AppColors` 调色板,虽硬编码 16 进制与项目约定一致);字体族(Noto Serif SC 标题 / Noto Sans SC 正文)与字号 22/18/15/14/13/12px 与 spec §3.1 / §3.2 / §3.4 / §3.5 完全对齐;hover scale 0.96 + 0.15s 6 处一致;动效 pageEnter 0.45s ease-out + dialogFadeIn 0.2s + dialogSlideUp 0.3s ease-spring + spin 0.8s linear 全部与 `docs/UI风格定义.md` §七 对齐;_DraftConfirmDialog 3 按钮 + 蒙层点击 = 不保存(spec §5.4 备注)实现正确;草稿 uni.setStorageSync 持久化 + 2 草稿 Toast(成功/失败)对仗。
>
> 但 2 项 Major 都与 spec §3.8 响应式 + §10 NFR 触达硬规则直接相关,需 code-writer 优先修复。

## 审核项(7 项清单逐项)

| # | 审核项 | 结论 | 关键依据 |
|---|---|---|---|
| 1 | 布局 | ❌ **Fail (Major #2)** | Header / 6 视图态 / form 7 字段 / chips / `_DraftConfirmDialog` / `_ErrorOverlay` 全部结构清晰;**`.btn-attach-file` 56rpx = 28pt 违反 spec §10 NFR 44pt × 44pt(88rpx)**,spec §3.3 与 §10 NFR 存在 28pt vs 44pt 内部冲突(见 M2) |
| 2 | 字体 | ⚠️ Pass with Minor | header-title 44rpx=22px 600 / greeting-title 36rpx=18px 600 / form-title 36rpx=18px 600 / panel-center-title 32rpx=16px / form-field-label 28rpx=14px 500 / btn-retry-text 30rpx=15px 600 — 全部对齐 `docs/UI风格定义.md` §三;**btn-submit-text 32rpx=16px 略超 spec §3.1 「14-15px」范围(1px,Minor 留档)** |
| 3 | 间距 | ⚠️ Pass with Minor | 8/16/24/32rpx 节奏覆盖;.body-inner `padding: 24rpx 40rpx 32rpx`(移动端水平 40rpx ✓);.form-fields `gap: 16rpx`(spec §3.1 ✓);.form-field `gap: 8rpx`(spec §3.1 ✓);.action-row `gap: 16rpx`;**区块间间距 24/32rpx 混用(24rpx textarea→file-row vs 32rpx greeting→textarea 与 file-row→action-row,spec §3.1 写「区块间 24rpx」,Minor 留档)** |
| 4 | 颜色 | ✅ Pass | `#2D6A5E` = primary / `#3D8B7D` = primaryLight / `#F7F3EC` = surface / `#F2EBE0` = surfaceWarm / `#FDFBF7` = surfaceCard / `#2C2C2C` = ink / `#5A5A5A` = inkLight / `#9A9A9A` = inkMuted / `#C44A3A` = danger / `#E8E0D4` = divider / `#FFFFFF` = inkInverse 全部对齐;**与 HomePage / SpotDetailSheet 硬编码 16 进制风格一致**(项目约定,`pages/home/index.vue` 全硬编码,无 `AppColors` 对象引用);**`.completed-check` background `primarySoftStrong` (rgba 0.12) vs spec §5.5 L426 写「背景 primarySoft」(rgba 0.08) — Minor 视觉偏差(0.04 alpha)** |
| 5 | 动效 | ✅ Pass | pageEnter 0.45s cubic-bezier(0.22, 1, 0.36, 1)(L919,UI §七 ease-out ✓);loading-spinner spin 0.8s linear infinite(L1256,smooth 60fps ✓);dialogFadeIn 0.2s ease-out(_DraftConfirmDialog L139,任务 §5 ✓);dialogSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)(L153,ease-spring ✓);6 处 hover scale(0.96)(header-back L956 / btn-attach-file L1096 / btn-submit L1219 / btn-retry L1334 / chip L1508 / dialog-btn-primary L219)— **与 OnboardingPage 已修 `.cell-hover` / HomePage 11 处全 0.96 节奏一致** |
| 6 | 响应式 | ❌ **Fail (Major #1)** | `@media (min-width: 1024px) { .body-inner { max-width: 640rpx; margin: 0 auto; } }`(L1559-1564)存在;**但 `.body-inner` 在 L995-997 同时有无条件 `max-width: 640rpx; margin: 0 auto;`,@media 块与无条件规则完全冗余,移动端(< 1024px)内容区被无条件压到 640rpx(spec §3.8 显式要求「移动端零变化」,违反)**;草稿弹窗 `_DraftConfirmDialog.vue` L142-155 `width: 80%; max-width: 600rpx;` —— 600rpx vs spec 隐含 640rpx(40rpx = 5% 差异,Minor 留档);`_ErrorOverlay` 不存在(本页面 error 态 inline 在 panel-center,复用 body-inner,无独立 @media 需要) |
| 7 | 视觉一致性 | ⚠️ Pass with Minor | 山水日志调色板统一 / 字体族统一 / 6 视图态与 HomePage 5 视图态 + SpotDetailSheet 4 视图态视觉语言一致(同样 _ErrorBanner 形态 + 同样 CTA 渐变 + 同样 居中 panel);**输入框无 `:focus` 描边状态**(spec §3.1 L163 显式要求「focus 时 `AppColors.primary` 描边」,实现未实装,Minor 留档);**`.completed-check` background `primarySoftStrong` vs spec 写 `primarySoft`**(见审核项 #4) |

---

## Major #1(审核项 6 响应式)— `.body-inner` 无条件 `max-width: 640rpx` 违反 spec §3.8

### 问题描述

`pages/new-trip/index.vue` L994-1001:

```css
.body-inner {
  max-width: 640rpx;          /* ← 无条件,移动端也被压到 640rpx */
  margin: 0 auto;
  padding: 24rpx 40rpx 32rpx;
  box-sizing: border-box;
}
```

而 L1559-1564:

```css
@media (min-width: 1024px) {
  .body-inner {
    max-width: 640rpx;        /* ← 与无条件规则完全冗余 */
    margin: 0 auto;
  }
}
```

两个规则**完全相同**,@media 块**没有任何增量作用**。在 750rpx 设计稿(375px 物理)移动端:

- `.body-inner` 实际宽度 = min(750rpx, 640rpx) = **640rpx**(被无条件 max-width 强制收窄)
- 居中后两侧各留 55rpx 空白
- `padding: 24rpx 40rpx 32rpx` = 40rpx 水平 padding 叠加在 640rpx 上
- **内容区实际宽度 = 640rpx − 80rpx = 560rpx**

而 spec §3.8 L248-250 显式要求:

> 沿用 HomePage v0.1.0 §10 NFR 模式:`@media (min-width: 1024px) { .newtrip-page { max-width: 640rpx; margin: 0 auto; } }`
> 仅作用于页面内容容器,Header / Footer 不受限
> **移动端(< 1024px)零变化**

移动端本应是:

- `.body-inner` 实际宽度 = 750rpx(全屏)
- `padding: 24rpx 40rpx 32rpx` = 40rpx 水平 padding
- **内容区实际宽度 = 750rpx − 80rpx = 670rpx**

**实测对比**:移动端内容区被无条件压窄 **110rpx(14.7%)**,违反 spec §3.8「移动端零变化」硬约束 + 沿用 HomePage 模式的显式声明。

### 期望表现(per spec)

- **移动端(< 1024px)**:内容区 = 670rpx(750rpx 全宽 − 80rpx padding),与 spec 移动端零变化一致
- **大屏(≥ 1024px)**:内容区 = 640rpx − 80rpx padding = 560rpx 居中(与 HomePage `.state-*` 一致)
- 浮层 / Header / Footer 不受限(`spec §3.8 L249`)
- `position: fixed` 浮动元素(`_DraftConfirmDialog`)不受 `@media` 约束(草稿弹窗本身已有 `width: 80%; max-width: 600rpx;` 自带居中,见 Minor #1)

### 修复建议(给 code-writer)

**最小改动方案**——删掉 L995-996 的无条件 `max-width: 640rpx; margin: 0 auto;`,**只保留 @media 块**:

```css
/* pages/new-trip/index.vue L994-1001 — 删除 max-width / margin 行 */
.body-inner {
  padding: 24rpx 40rpx 32rpx;
  /* space-md / space-lg / space-xl */
  box-sizing: border-box;
}
```

```css
/* pages/new-trip/index.vue L1559-1564 — 保留不动(从此是唯一约束点) */
@media (min-width: 1024px) {
  .body-inner {
    max-width: 640rpx;
    margin: 0 auto;
  }
}
```

> 注:删除 L995-996 的两行后,@media 块在 ≥1024px 生效(560rpx 居中),< 1024px 不生效(670rpx 全宽)。功能上等价于"先无 max-width,再在 ≥1024px 收窄居中",正是 spec §3.8 想要的语义。
>
> 备选方案 A(spec 字面化):把 max-width 加到 `.newtrip-page` 上(per spec L248 模板 `.newtrip-page { max-width: 640rpx; ... }`)。但这会**约束整页包括 Header 背景**,违背 spec L249「仅作用于页面内容容器,Header / Footer 不受限」。**不推荐**。
>
> 备选方案 B(沿用 OnboardingPage 模式):`pages/onboarding/index.vue` L249-256 也用了无条件 `max-width: 640rpx`,本问题是 OnboardingPage 同款。但 OnboardingPage spec 描述不同(由 spec-writer 在 OnboardingPage v0.2.0 修订时确认),本 NewTripPage spec 显式说「沿用 HomePage 模式」,**按 NewTripPage spec 字面应选本方案**。

### 期望依据

- `specs/NewTripPage.md` §3.8 H5 ≥ 1024px 响应式 L248-250(显式「沿用 HomePage v0.1.0 §10 NFR 模式」 + 「移动端零变化」)
- `pages/home/index.vue` L557-566(参照实现,`.state-*` 全部 @media-only)
- `AGENTS.md` §8.1 "H5 ≥1024px @media 居中"项目约定
- ui-reviewer memory `ui-review-checklist.md` §5 H5 大屏 @media 居中(3 步定位)

---

## Major #2(审核项 1 布局 / 10 NFR 可访问性)— `.btn-attach-file` 56rpx 违反 44pt 触达下限

### 问题描述

`pages/new-trip/index.vue` L1076-1092:

```css
.btn-attach-file {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  min-height: 56rpx;          /* ← 56rpx = 28pt,违反 44pt 触达下限 */
  /* space-sm */
  padding: 0 24rpx;
  background: transparent;
  border: 1.5px dashed #9A9A9A;
  /* inkMuted 虚线 */
  border-radius: 9999px;
  /* radius-full */
  box-sizing: border-box;
  transition: background 0.15s ease-out, transform 0.15s ease-out;
}
```

`.btn-attach-file` 是 input 态核心可点击元素(spec §3 L97 「📎 添加文件」幽灵按钮),L82-110 在 form 中被 `<view class="file-row">` 包裹,L83-93 由 `@click="onAttachFile"` 触发 `uni.chooseFile`。

**56rpx = 28pt**(按 750rpx 设计稿 1rpx = 0.5pt 换算),远低于 spec §10 NFR L942/963 的 **44pt × 44pt (88rpx)** 触达下限。

### 期望依据(spec 内部冲突 + NFR 优先级)

**spec §3.3 L175 写**:
> 「📎 添加文件」按钮(幽灵按钮,**小尺寸 56rpx 高**)

**spec §10 NFR L942 + L963 写**:
> 所有可点击元素(**「←」返回 /「📎 添加文件」/ 7 字段 chips / 双按钮 / `_DraftConfirmDialog` 3 按钮 /「重试」**)点击区域 ≥ 44pt × 44pt(UniApp rpx → pt 换算:88rpx = 44pt)

这是 spec **内部冲突**:§3.3 写 56rpx,§10 NFR 显式把「📎 添加文件」列为 44pt 必达标元素。两者**矛盾**。

按 DaoYou 项目惯例(per ui-reviewer memory `ui-review-checklist.md` §6 "Spec 数值合理性自检"):

> 看到 spec 数值明显低于 NFR 下限(56rpx=28pt 远低于 44pt),**优先判断为 spec 笔误**

理由:

- 56rpx = 28pt,远低于 iOS HIG 44pt / Material 48dp / 微信小程序 88rpx 触达下限,**任何触达规范都不允许**
- §10 NFR 把"📎 添加文件"显式列入清单,说明 spec-writer 写 NFR 时**明确意识到**这是可点击元素
- §3.3 写"小尺寸 56rpx 高"**很可能是描述性笔误**(56rpx 也许来自 design 稿视觉高度,不是触达高度)

**NFR 优先级高于 §3.3 描述性段落**(NFR 是项目级硬规则,§3.3 是 per-spec 描述),按 NFR 88rpx 修复。

### 期望表现(per spec §10 NFR)

- 移动端点击区域 = 88rpx × 88rpx = 44pt × 44pt(满足 Apple HIG + Material + 微信小程序规范)
- 视觉上:**容器高度从 56rpx → 88rpx**,内部 28rpx emoji 字符 + 26rpx 「添加文件」文字不变(emoji + 文字 + 虚线边框 + 半透明背景,沿用)
- 虚线边框 `border: 1.5px dashed` 居中在新 88rpx 容器中,边距与原来视觉接近

### 修复建议(给 code-writer)

**最小改动方案**——只改 `min-height`:

```css
/* pages/new-trip/index.vue L1082 — 改 1 行 */
.btn-attach-file {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  min-height: 88rpx;          /* ← 56rpx → 88rpx,满足 44pt 触达 */
  /* spec §10 NFR 44pt 触达 */
  padding: 0 24rpx;
  background: transparent;
  border: 1.5px dashed #9A9A9A;
  border-radius: 9999px;
  box-sizing: border-box;
  transition: background 0.15s ease-out, transform 0.15s ease-out;
}
```

视觉上,容器高度 56rpx → 88rpx,**vertical padding 32rpx 增加**,内部 28rpx emoji + 26rpx 文字(均 line-height 1)继续居中。border 1.5px dashed 仍 24rpx horizontal padding 居中。

> 兼容性说明:此修复**仅触及** `.btn-attach-file` 的高度,与 `.btn-attach-file-hover`(L1094-1097)的 `transform: scale(0.96)` 兼容,与其他 hover 状态(`.btn-submit-hover` 0.96 / `.btn-retry-hover` 0.96 等)零关联。`_DraftConfirmDialog` / `_ErrorBanner` / `header-back` 等其他 88rpx 触达元素零影响。
>
> Spec 修订建议(交给 spec-auditor / spec-writer):把 spec §3.3 L175 的"小尺寸 56rpx 高"改为"小尺寸 88rpx 高(满足 44pt 触达 NFR)",消除内部冲突;或由 spec-writer 在下次修订时统一加注释"(此高度仅视觉,触达 NFR 仍按 44pt)"。

### 期望依据

- `specs/NewTripPage.md` §10 NFR 可访问性 L942 + L963(显式「📎 添加文件 ≥ 44pt」)
- `docs/Frontend Code Style Guide.md` + `docs/UI风格定义.md`(UniApp 触达下限 88rpx = 44pt 行业标准)
- ui-reviewer memory `ui-review-checklist.md` §2 44pt 触达下限(8 rpx = 1pt 换算,UniApp 750rpx 设计稿)
- 失败样本参照:`components/SpotDetailSheet.vue` `.sheet-close` 64rpx(32pt)→ 88rpx(44pt)修复(`issues/UI/SpotDetailSheet-001.md` Major #2,已 Resolved)

---

## Minor 留档(非失败项,留作下轮修订参考)

### Minor #1(留档)— `.file-chip-remove` 32pt 隐含 NFR 覆盖

- **现状**:`pages/new-trip/index.vue` L1141-1153 `.file-chip-remove` `width: 64rpx; height: 64rpx; min-width: 64rpx; min-height: 64rpx;` = **32pt × 32pt**
- **NFR 解读**:spec §10 L942/963 显式 NFR 列表(「←」/「📎 添加文件」/ 7 字段 chips / 双按钮 / `_DraftConfirmDialog` 3 按钮 /「重试」)**不包含 file chip X 按钮**;但 NFR 引导语 "所有可点击元素 ≥ 44pt" 隐含覆盖 file chip X
- **判定**:**Minor 留档**,不作为失败项(2 理由):
  1. spec NFR 列表未显式列入 file chip X
  2. 32pt = 64rpx 是 iOS / 微信小程序 inline X 按钮行业标准(如 chips 内部 X / 标签 ✕)
- **建议**:code-writer 可选地把 `min-height/min-width: 64rpx` → `88rpx`(严格 NFR 一致);若选择保留 64rpx,需在 deliverable §3 主动登记 32pt 偏离 NFR 理由
- **已知**:`code-writer` `outputs/ntp-dev/deliverable.md` §3.7 主动登记 file-chip-remove 32pt;`spec-auditor` 2026-06-03 02:58 软观察 #4 显式移交 ui-reviewer(OOS)

### Minor #2(留档)— `.btn-submit-text` 字体 16px vs spec「14-15px」

- **现状**:`pages/new-trip/index.vue` L1228-1235 `.btn-submit-text` `font-size: 32rpx; /* 16px */`
- **spec 解读**:spec §3.1 L159 写"主按钮(确定 / 确认 / 保存草稿)... 白字 14-15px 600",`docs/UI风格定义.md` §八 主按钮段写"文字：白色，14-15px，font-weight: 600" — 32rpx = 16px 略超 1px
- **判定**:**Minor 留档** — 1px 偏差在 750rpx 设计稿下视觉差异可忽略,且其他页面(HomePage `.btn-add-trip-text`、OnboardingPage `.complete-button-text`)也多用 30rpx / 32rpx(15-16px),与项目惯例一致
- **建议**:code-writer 可选地把 32rpx → 30rpx(15px,严格 spec 14-15px 范围),或留 32rpx 与项目惯例一致;spec-writer 可在下次修订时把 spec 改为"14-16px"扩大范围

### Minor #3(留档)— 输入框缺 `:focus` 描边状态

- **现状**:`pages/new-trip/index.vue` `.form-field-input`(L1428-1446)+ `.form-field-picker`(L1453-1465)无 `:focus` 选择器
- **spec 解读**:spec §3.1 L163 显式写"输入框:`AppColors.surfaceCard` 背景 + 1.5px `AppColors.divider (#E8E0D4)` 描边,**focus 时 `AppColors.primary` 描边**"
- **判定**:**Minor 留档** — 交互反馈缺失(用户点输入框时无视觉变化),**不影响布局/可达性**(输入框本身可点 80rpx = 40pt ≥ iOS 触控下限 44pt 偏 4pt,但 UniApp input 自带 native 焦点反馈)
- **建议**:code-writer 在 `.form-field-input` 和 `.form-field-picker` 加 `.form-field-input:focus` / `.form-field-picker:focus` 规则,设 `border-color: #2D6A5E;`(1 行 CSS,不增加 JS / props / emits)

---

## 关联页面

- `pages/new-trip/index.vue`(主页面 1565 行,M1 响应式 + M2 布局核心修复点 — L994-1001 body-inner / L1076-1092 btn-attach-file)
- `pages/new-trip/components/_DraftConfirmDialog.vue`(291 行,3 按钮 88rpx 触达 ✓ / dialog max-width 600rpx vs 640rpx Minor 留档)

## 关联 Specification

- `specs/NewTripPage.md` v0.1.0:
  - **§3.1 视觉风格**(L153-165)— 色板 / 字号 / 间距(M2 涉及 §10 NFR 触达)
  - **§3.3 文件上传 chips**(L173-177)— btn-attach-file 56rpx 描述(M2 内部冲突)
  - **§3.8 H5 ≥ 1024px 响应式**(L246-251)— body-inner @media 居中(M1 主线)
  - **§10 NFR 可访问性**(L942 + L963)— 44pt 触达下限,显式列「📎 添加文件」(M2 主线)
  - **§10 NFR 兼容性**(L971)— 大屏 640rpx 居中(M1 间接)

## 关联 issue(同级 / 上下游)

- **上游**:`issues/Arch/NewTripPage-001.md` 9/9 ✓ Pass,留 6 条软观察(M1 / M2 不在 arch 6 软观察中 — arch 软观察关注草稿恢复一致性 / AI 模拟 setTimeout 体感 / `_DraftConfirmDialog` 后续抽 components/ / 草稿 LRU / POST retry 节流 / HomePage「+」按钮 cross-page 契约)
- **同级**:`issues/Test/NewTripPage-001.md` 未创建(0 失败,test-agent 8/8 PASS);`issues/Spec/NewTripPage-001.md` 未创建(0 硬 FAIL,spec-auditor 5/5 核对 PASS)
- **Pre-existing 参照**:`issues/UI/SpotDetailSheet-001.md` Major #1(@media 1024px 居中) + Major #2(44pt 触达 .sheet-close / .sheet-drag-handle)与本 Issue 2 项 Major 同类 — 验证 DAO H5 响应式 + 44pt NFR 是持续硬约束

## 期望修复时间

code-writer 收到本 Issue 后,预计 1 个 commit 完成 2 项 Major + 3 Minor 修复(均为纯 CSS 增量 / 1 行数值调整,改动面小,无 JS / props / emits 变更);spec-writer 在 spec-auditor 拍板后可顺手修 §3.3「56rpx」与 §10 NFR 的内部冲突(改 1 行数值)。
