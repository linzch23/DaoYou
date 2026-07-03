import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMdLite } from '../src/utils/markdown-lite.js'

// ────────── inline 行为(老 11 个 case 全部保留)──────────

test('returns empty array for empty / non-string input', () => {
  assert.deepEqual(parseMdLite(''), [])
  assert.deepEqual(parseMdLite(null), [])
  assert.deepEqual(parseMdLite(undefined), [])
  assert.deepEqual(parseMdLite(42), [])
})

test('plain text without any markdown stays as a single text segment', () => {
  assert.deepEqual(parseMdLite('你好,这是一段普通文字。'), [
    { type: 'text', text: '你好,这是一段普通文字。' },
  ])
})

test('renders single **bold** segment', () => {
  assert.deepEqual(parseMdLite('这是**故宫**的介绍'), [
    { type: 'text', text: '这是' },
    { type: 'bold', text: '故宫' },
    { type: 'text', text: '的介绍' },
  ])
})

test('renders multiple **bold** segments in one string', () => {
  assert.deepEqual(parseMdLite('**故宫** 和 **天坛** 都是北京地标'), [
    { type: 'bold', text: '故宫' },
    { type: 'text', text: ' 和 ' },
    { type: 'bold', text: '天坛' },
    { type: 'text', text: ' 都是北京地标' },
  ])
})

test('renders __bold__ underscore variant as bold', () => {
  assert.deepEqual(parseMdLite('这是__天安门__广场'), [
    { type: 'text', text: '这是' },
    { type: 'bold', text: '天安门' },
    { type: 'text', text: '广场' },
  ])
})

test('does NOT render single *italic* — falls back to text', () => {
  // Per user 2026-07-03 decision: italic removed for mobile readability
  const segs = parseMdLite('这是 *斜体* 但不渲染')
  assert.deepEqual(segs, [{ type: 'text', text: '这是 *斜体* 但不渲染' }])
})

test('leaves [text](url) link markers as plain text (no link parsing)', () => {
  // Per user 2026-07-03 decision: no link navigation; markers are kept literal
  const segs = parseMdLite('**故宫** 详情见 [官网](https://example.com)')
  assert.deepEqual(segs, [
    { type: 'bold', text: '故宫' },
    { type: 'text', text: ' 详情见 [官网](https://example.com)' },
  ])
})

test('handles unclosed ** gracefully (treats as plain text)', () => {
  assert.deepEqual(parseMdLite('这是**未闭合的加粗'), [
    { type: 'text', text: '这是**未闭合的加粗' },
  ])
})

test('handles adjacent bold segments without space', () => {
  assert.deepEqual(parseMdLite('**a****b**'), [
    { type: 'bold', text: 'a' },
    { type: 'bold', text: 'b' },
  ])
})

test('handles numeric bold content', () => {
  assert.deepEqual(parseMdLite('建于 **1406** 年'), [
    { type: 'text', text: '建于 ' },
    { type: 'bold', text: '1406' },
    { type: 'text', text: ' 年' },
  ])
})

test('preserves newlines as plain text (no <br> injection)', () => {
  // 这是无 list marker 的多行,整段当 1 个 text(保留 \n)
  const segs = parseMdLite('第一行\n第二行')
  assert.deepEqual(segs, [{ type: 'text', text: '第一行\n第二行' }])
})

// ────────── list 行为(v0.4.1 新增)──────────

test('single dash list with 2 items renders as list block', () => {
  const segs = parseMdLite('- 第一个\n- 第二个')
  assert.deepEqual(segs, [
    {
      type: 'list',
      items: [
        [{ type: 'text', text: '第一个' }],
        [{ type: 'text', text: '第二个' }],
      ],
    },
  ])
})

test('list with bold content inside each item is parsed inline', () => {
  const segs = parseMdLite('- **故宫** 门票 60 元\n- **天安门** 门票 0 元')
  assert.deepEqual(segs, [
    {
      type: 'list',
      items: [
        [
          { type: 'bold', text: '故宫' },
          { type: 'text', text: ' 门票 60 元' },
        ],
        [
          { type: 'bold', text: '天安门' },
          { type: 'text', text: ' 门票 0 元' },
        ],
      ],
    },
  ])
})

test('text before and after a list stays as separate text segments', () => {
  const segs = parseMdLite('前面\n- 第一个\n- 第二个\n后面')
  assert.deepEqual(segs, [
    { type: 'text', text: '前面' },
    {
      type: 'list',
      items: [
        [{ type: 'text', text: '第一个' }],
        [{ type: 'text', text: '第二个' }],
      ],
    },
    { type: 'text', text: '后面' },
  ])
})

test('list followed by non-list line splits into separate list block', () => {
  // 验证:连续 "- " 合并,夹的非 "- " 行断开
  const segs = parseMdLite('- a\n普通文本\n- b')
  assert.deepEqual(segs, [
    {
      type: 'list',
      items: [[{ type: 'text', text: 'a' }]],
    },
    { type: 'text', text: '普通文本' },
    {
      type: 'list',
      items: [[{ type: 'text', text: 'b' }]],
    },
  ])
})

test('text with bold in the middle of a list-containing message works', () => {
  // 验证:bold 在 text 段内(无 list 包裹)能正确解析
  const segs = parseMdLite('重要信息:**请注意安全**\n- 规则一\n- 规则二')
  assert.deepEqual(segs, [
    { type: 'text', text: '重要信息:' },
    { type: 'bold', text: '请注意安全' },
    {
      type: 'list',
      items: [
        [{ type: 'text', text: '规则一' }],
        [{ type: 'text', text: '规则二' }],
      ],
    },
  ])
})

test('empty list item (just "- ") is NOT a list marker (MVP 简化)', () => {
  // ".+" 要求至少 1 字符,纯 "- " 不算 list marker,降级为 text
  // 这是 MVP 简化决策:避免空 list 渲染异常边界
  const segs = parseMdLite('- \n- 第二个')
  assert.deepEqual(segs, [
    { type: 'text', text: '- ' },
    {
      type: 'list',
      items: [[{ type: 'text', text: '第二个' }]],
    },
  ])
})

test('dash without trailing space is NOT a list marker (kept as text)', () => {
  // "-abc" 不是 list 标记(要求 "- " + 1 空格)
  const segs = parseMdLite('-abc\n-def')
  assert.deepEqual(segs, [{ type: 'text', text: '-abc\n-def' }])
})

test('dash with leading space is NOT a list marker (MVP 简化)', () => {
  // "  - 子项" 嵌套列表 MVP 不支持,当普通 text
  const segs = parseMdLite('前面\n  - 嵌套项\n后面')
  assert.deepEqual(segs, [{ type: 'text', text: '前面\n  - 嵌套项\n后面' }])
})

test('list item content supports newline within item via bold only single-line', () => {
  // MVP 简化:bold 不跨行;list-item 内有换行会断开(但 list-item 内本身只 1 行,无问题)
  // 实际场景:list-item 不可能含 \n,因为按行切每行最多 1 个 "- " 前缀
  const segs = parseMdLite('- 这是**粗体**项')
  assert.deepEqual(segs, [
    {
      type: 'list',
      items: [[{ type: 'text', text: '这是' }, { type: 'bold', text: '粗体' }, { type: 'text', text: '项' }]],
    },
  ])
})

test('blank line between two lists emits a text "\\n" separator (preserves paragraph break)', () => {
  // MVP 设计:空行作为段落分隔(text "\n"),不会合并 2 个 list 块
  const segs = parseMdLite('- a\n\n- b')
  assert.deepEqual(segs, [
    {
      type: 'list',
      items: [[{ type: 'text', text: 'a' }]],
    },
    { type: 'text', text: '\n' },
    {
      type: 'list',
      items: [[{ type: 'text', text: 'b' }]],
    },
  ])
})
