---
Page: SpotDetailSheet
IssueType: Spec
Priority: High
Status: InProgress
CreatedAt: 2026-06-02T23:30:00+08:00
ResolvedAt: null
ResolvedBy: null
IssueFile: issues/Spec/SpotDetailSheet-001.md
ReviewNotes: |
  2026-06-02 23:50 re-audit #1 by spec-auditor: code-writer **未**修复 2 条硬 FAIL;
  file mtime 23:08(原 code-writer 完成时)未变;grep 全项目 `notfound, bad spotId` / `today cleared mid-flight` 仍 0 命中;
  现状: pages/spot-detail-sheet/index.vue:169-181 parseQuery 3 早返回分支仍静默;
        pages/spot-detail-sheet/index.vue:254-261 watch(() => store.today) 仍无 warn 分支;
  Status 保持 Open;PageStatus.yaml Review.spec 仍 Fail,FinalStatus 仍 NeedFix;
  聚合: ui Fail + spec Fail + test Pass → 等 code-writer 真正落地 2 处 logger 增量。
---

# Spec Issue: SpotDetailSheet #001

> **结论(Fail)**:`specs/SpotDetailSheet.md` v0.1.0 与 `pages/spot-detail-sheet/index.vue` 425 行 + `components/SpotDetailSheet.vue` 494 行 + `pages/spot-detail-sheet/components/_ErrorOverlay.vue` 176 行 + `stores/homeStore.js` 300 行 + `services/home.js` 183 行 + `constants/strings.js` 222 行 经 5 项核对(AC / API / Store / State Flow / Component Contract),发现 **2 条硬 FAIL**,均围绕 logger 契约缺失(AC-04 / AC-08 / AC-12 同源 3 项日志缺失中的 2 个关键节点)。
>
> 其余 52 项核对全 PASS(API Contract 8/8 + Store Contract 7/7 + State Flow 11/11 + Component Contract 16/16 + AC 10/12 + 2 OOS 视觉留给 ui-reviewer)。
>
> 修复建议(给 code-writer):**纯 logger 增量**,2 行代码,30 秒搞定。

---

## 失败项 #1 — AC-04:URL `?spotId` 缺省/非数字/<=0 时缺 `notfound, bad spotId` 日志

### 审核项
- **§9 AC-04** — Acceptance Criteria(可观测性子句)
- **§5.3.A** — State Flow 异常流程 A
- **§9 AC-12** — Acceptance Criteria(logger 6 关键事件埋点)
- **§10 NFR 可观测性** — 关键事件打点埋点:`navigate` / `guide` / `toggleFavorite` / `close` / `notfound, bad spotId` / `today cleared mid-flight`

### 规格约定

**`specs/SpotDetailSheet.md` §9 AC-04**(L652):

> - [ ] **AC-04** Given URL `?spotId` 缺省 / 空 / 非数字 / `<= 0`,When 页面 `onLoad(query)` 解析,Then 立即判定 `viewMode='notfound'`,渲染 `_ErrorOverlay`(标题"该景点不可用,返回首页",按钮"返回首页"),点击按钮触发 `uni.reLaunch({ url: AppRoutes.Home })`;**不**发起任何 fetch;`logger.info('[SpotDetailSheetPage] notfound, bad spotId', { rawSpotId })`。

**`specs/SpotDetailSheet.md` §5.3 异常流程 A**(L347-351):

> A. URL ?spotId 缺省 / 非数字 / 解析失败:
>    → onLoad 时立即判定
>    → viewMode = 'notfound'
>    → 渲染 _ErrorOverlay("该景点不可用,返回首页")
>    → 「返回首页」按钮 → uni.reLaunch({ url: AppRoutes.Home })

**`specs/SpotDetailSheet.md` §9 AC-12**(L671)+ §10 NFR 可观测性(L711):

> **AC-12**:... `logger` 记录关键事件(`navigate` / `guide` / `toggleFavorite` / `close` / `notfound, bad spotId` / `today cleared mid-flight`)...
>
> **NFR 可观测性** — 关键事件打点埋点:`navigate` / `guide` / `toggleFavorite` / `close` / `notfound, bad spotId` / `today cleared mid-flight`。

### 实际实现

**`pages/spot-detail-sheet/index.vue` L169-181 parseQuery 函数**:

```js
function parseQuery(options) {
  const raw = options?.spotId
  if (raw === undefined || raw === null || raw === '') {
    spotId.value = null
    return                              // ← 静默,无 logger.info
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) {
    spotId.value = null
    return                              // ← 静默,无 logger.info
  }
  spotId.value = n
}
```

**`pages/spot-detail-sheet/index.vue` L279-289 onErrorAction 函数**(用户点按钮时才有日志):

```js
function onErrorAction() {
  if (viewMode.value === 'notfound') {
    logger.info('[SpotDetailSheetPage] notfound, back to home', {  // ← 事件名 'notfound, back to home' ≠ spec 'notfound, bad spotId'
      spotId: spotId.value,
    })
    uni.reLaunch({ url: AppRoutes.Home })
  } else if (viewMode.value === 'error') {
    logger.info('[SpotDetailSheetPage] error, retry')
    viewMode.value = 'loading'
    fetchAndDecide()
  }
}
```

**全项目 grep 验证**(`grep "notfound, bad spotId" /Users/andrew/Desktop/Vivo/DaoYou/frontend/`):0 命中

### 差异

1. **行为正确**:`parseQuery` 在 URL 缺省/空/非数字/<=0 时正确置 `spotId.value = null`,后续 `decideViewMode` 正确判定 `viewMode='notfound'`,`_ErrorOverlay` 渲染 notfound type,`onErrorAction` 触发 `uni.reLaunch` —— 全部对齐 spec §5.3.A
2. **日志契约缺失**:`parseQuery` 在 3 个早返回分支(L172 / L177 / **未触发 raw 解析失败时的 logger.info**)静默,无任何日志输出,仅在用户后续点击"返回首页"按钮时才在 `onErrorAction` 记录"notfound, back to home"
3. **事件名偏差**:仅有的 `notfound, back to home` 日志事件名与 spec §9 AC-04 显式要求的 `notfound, bad spotId` 不同,语义相似但**事件名不匹配**(spec-auditor 严格按 spec 字面核对)
4. **触发时机错配**:spec §5.3.A + §9 AC-04 明确"onLoad 时立即判定"触发日志,但代码的日志在用户点击按钮后才触发,延迟了整段用户停留时间(push 通知场景下,用户从未点击"返回首页"按钮就返回上一页,本条日志永远不出现)

### 修复建议(给 code-writer,**不**给具体代码)

1. 在 `parseQuery` 函数的 3 个早返回分支(URL 缺省/空/非数字/<=0)前,各加一行 `logger.info('[SpotDetailSheetPage] notfound, bad spotId', { rawSpotId: <raw value> })`
2. 已有 `notfound, back to home` 日志可保留(用户点击按钮时记录,语义不同:一个是 URL 解析失败,一个是用户主动操作),也可以删除(spec 没要求)
3. 修复后**不**需要重审其他 AC,纯 logger 增量,功能行为不变

### 关联 Specification
- `specs/SpotDetailSheet.md` §9 AC-04(L652)
- `specs/SpotDetailSheet.md` §5.3 异常流程 A(L347-351)
- `specs/SpotDetailSheet.md` §9 AC-12(L671)
- `specs/SpotDetailSheet.md` §10 NFR 可观测性(L711)

---

## 失败项 #2 — AC-08:`homeStore.today` 被外部清空时缺 `today cleared mid-flight` 日志

### 审核项
- **§9 AC-08** — Acceptance Criteria(异常 case)
- **§9 AC-12** — Acceptance Criteria(logger 6 关键事件埋点)
- **§10 NFR 可观测性** — 关键事件打点埋点

### 规格约定

**`specs/SpotDetailSheet.md` §9 AC-08**(L656):

> - [ ] **AC-08** Given 浮层已在 `viewMode='sheet'`,When `homeStore.today` 被外部清空(例如用户登出,`homeStore.clearHome()` 被调用),Then 浮层**不**自动消失(本次访问期间 selectedSpot 已固定),但下一次 `onLoad` 重新进入会因 `homeStore.today === null` 重新决策;`logger.warn('[SpotDetailSheetPage] today cleared mid-flight, keep sheet')`。

**`specs/SpotDetailSheet.md` §9 AC-12**(L671)+ §10 NFR 可观测性(L711):同失败项 #1。

### 实际实现

**`pages/spot-detail-sheet/index.vue` L254-261 watch(() => store.today)**:

```js
watch(
  () => store.today,
  () => {
    if (viewMode.value === 'loading' && spotId.value !== null) {
      decideViewMode()
    }
  }
)
```

**`pages/spot-detail-sheet/index.vue` L264-271 watch(() => store.error)**:

```js
watch(
  () => store.error,
  (next) => {
    if (next && viewMode.value === 'loading') {
      viewMode.value = 'error'
    }
  }
)
```

**全项目 grep 验证**(`grep "today cleared mid-flight" /Users/andrew/Desktop/Vivo/DaoYou/frontend/`):0 命中

### 差异

1. **行为正确**:`watch(() => store.today)` 在 'loading' 态时正确 re-decide,符合 spec §5.1 watcher 备注;'sheet' 态下 watcher 不动作,`selectedSpot` 保持固定,符合 AC-08 显式"浮层**不**自动消失"要求
2. **日志契约缺失**:**`watch(() => store.today)` 整体无 `logger.warn('[SpotDetailSheetPage] today cleared mid-flight, keep sheet')` 触发逻辑**
   - 当前实现:'sheet' 态下 today 被清空,watcher 不动作,无任何日志
   - spec 要求:'sheet' 态下 today 被清空,触发 `logger.warn` 记录异常,方便 issue 排查
3. **触发条件精确性**:spec §9 AC-08 说"homeStore.today 被外部清空(例如用户登出,`homeStore.clearHome()` 被调用)";这意味着 `store.today` 从非 null 变 null **且** 当前 viewMode='sheet'。当前实现 watch 触发但无任何分支处理
4. **与 AC-12 关联**:AC-08 显式把 `today cleared mid-flight` 列为 6 关键事件之一,AC-12 复述此列表;两条 AC 共同要求此日志存在

### 修复建议(给 code-writer,**不**给具体代码)

1. 在 `watch(() => store.today)` 的回调里增加一个分支:当 `viewMode.value === 'sheet'` 且 `store.today === null`(前值非 null)时,触发 `logger.warn('[SpotDetailSheetPage] today cleared mid-flight, keep sheet')`
2. 注意:**不**应让这个 warn 触发任何 viewMode 切换(AC-08 显式说"浮层不自动消失",只 warn 不动 viewMode)
3. 修复后**不**需要重审其他 AC,纯 logger 增量,功能行为不变

### 关联 Specification
- `specs/SpotDetailSheet.md` §9 AC-08(L656)
- `specs/SpotDetailSheet.md` §9 AC-12(L671)
- `specs/SpotDetailSheet.md` §10 NFR 可观测性(L711)
- `specs/SpotDetailSheet.md` §5.3 异常流程 A(L347-351)(参考,本条无 A-H 直接子流程对应)

---

## 软观察(非硬 FAIL,可选修复)

> 这些观察**不**构成 Spec Issue,代码与 AC-12 在功能向一致(都打了日志),但**精确性**有偏差。spec-auditor 不强制修复,留给 code-writer 在修硬 FAIL 时顺手 polish。

### OBS-SDS-001 — `onToggleFavorite` 日志事件名/字段名偏差

**规格**:`specs/SpotDetailSheet.md` §5.2 Step D L319 `logger.info('[SpotDetailSheetPage] toggleFavorite', { spotId: spot.id, isFavorite: !has })`

**实际**:`pages/spot-detail-sheet/index.vue` L368-372:
```js
logger.info('[SpotDetailSheetPage] toggle favorite', {  // ← 事件名 'toggle favorite'(空格)≠ spec 'toggleFavorite'(camelCase)
  spotId: id,                                            // ✓ 字段名 + 值一致
  has: !has,                                             // ← 字段 'has' vs spec 'isFavorite'(同义但命名不同)
  total: next.length,                                    // ← code 多一个 'total' 字段(spec 未列)
})
```

**修复建议**(可选):
- 事件名 `toggle favorite` → `toggleFavorite`
- 字段名 `has` → `isFavorite`
- `total: next.length` 可保留(增量调试信息)或删除(spec 严格)

---

## 重审记录

> 由 spec-auditor 在 code-writer 修复后填写

### 重审 #1 — 2026-06-02 23:50 spec-auditor 复审 r2(FAIL 维持)

**结论**:code-writer **未**修复任何硬 FAIL;`Status` 保持 `Open`,**不**改 Resolved。

**验证证据**:
1. **文件 mtime**:`pages/spot-detail-sheet/index.vue` mtime = `2026-06-02 23:08`(原 code-writer 完成时);本次复审时间 `2026-06-02 23:50`,中间 42 分钟无任何修改
2. **全项目 grep 验证**:
   - `grep -rn "notfound, bad spotId" /Users/andrew/Desktop/Vivo/DaoYou/frontend/` 仅命中 4 处:**3 处是 spec 自身**(specs/SpotDetailSheet.md L652 / L671 / L711),**1 处是本 Issue 自身**(L34);**0 处** 命中代码文件
   - `grep -rn "today cleared mid-flight" /Users/andrew/Desktop/Vivo/DaoYou/frontend/` 仅命中 4 处:**3 处是 spec 自身**(L656 / L671 / L711),**1 处是本 Issue 自身**(L121);**0 处** 命中代码文件
3. **现行代码位置**(与初审一致):
   - `pages/spot-detail-sheet/index.vue:169-181` parseQuery 3 个早返回分支(URL 缺省/空/非数字/<=0)— 仍**静默**,无 `logger.info('[SpotDetailSheetPage] notfound, bad spotId', { rawSpotId })`
   - `pages/spot-detail-sheet/index.vue:254-261` watch(() => store.today) 仍**无任何分支**触发 `logger.warn('[SpotDetailSheetPage] today cleared mid-flight, keep sheet')`
4. **现行 logger 偏差**(与初审一致):
   - L281 `notfound, back to home`(事件名 ≠ spec `notfound, bad spotId`;触发时机 = 按钮点击而非 onLoad)
   - L368 `toggle favorite`(事件名空格 vs spec camelCase `toggleFavorite`;字段 `has` vs spec `isFavorite`)

**5 项核对汇总**(与初审一致,**无回归**):
- AC: 10/12 PASS(AC-04 FAIL / AC-08 FAIL;AC-09/AC-10 OOS 留 ui-reviewer)
- API Contract: 8/8 PASS
- Store Contract: 7/7 PASS
- State Flow: 11/11 PASS
- Component Contract: 16/16 PASS
- 1 软观察(不变): toggle favorite 事件名/字段名偏差

**再次给出修复建议**(给 code-writer,本轮仍不修就再次维持 Fail):
1. `parseQuery`(L169-181)在 3 个早返回分支前各加 `logger.info('[SpotDetailSheetPage] notfound, bad spotId', { rawSpotId: <raw> })`;总计 ≤ 3 行新增
2. `watch(() => store.today)`(L254-261)回调里加分支:`if (viewMode.value === 'sheet' && newVal === null && oldVal !== null) logger.warn('[SpotDetailSheetPage] today cleared mid-flight, keep sheet')`;1 个分支
3. (可选 polish,与硬 FAIL 无关)L368 事件名 `toggle favorite` → `toggleFavorite`,字段名 `has` → `isFavorite`

**总修复成本**:2~3 行代码,30 秒。本轮 r2 复审已确认 5 项核对无回归,**r3 复审时只需 grep 2 个字符串是否在 pages/spot-detail-sheet/index.vue 命中即可**。

### 重审 #2 — 等待 code-writer 修复

(本 Issue Status 仍 `Open`;等 code-writer 修 2 条硬 FAIL 后由 spec-auditor 写「重审 #2 → Resolved」记录)
