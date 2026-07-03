/**
 * Lightweight inline + block markdown parser for AI chat bubbles.
 *
 * MVP scope (per task 2026-07-03 + 2026-07-03 v0.4.1 list extension):
 *   - **bold**         → bold segment
 *   - __bold__         → bold segment (underscore variant, regex-handled)
 *   - - list item      → list block (lines starting with "- " (dash + 1 space));
 *                        consecutive "- " lines merge into a single list block
 *   - everything else  → plain text segment
 *
 * Out of scope (intentionally NOT parsed):
 *   - *italic* / _italic_         (per user 2026-07-03 decision — bad mobile readability)
 *   - [text](url) links           (per user 2026-07-03 decision — no link navigation)
 *   - # headings, 1. ordered list, > quotes, code blocks, images
 *   - nested lists (MVP 简化)
 *   - bold across line boundaries (MVP 简化 — bold 只在单行内生效)
 *
 * The parser returns a flat array of segments so that:
 *   1. Vue template can render via v-for on <text> / <view> (uni-app native, no v-html)
 *   2. Cross-platform parity: H5 (multiple <span> + <div>) and Android (SpannableString
 *      + LinearLayout) both render correctly without any extra plugin
 *   3. Zero XSS surface — no HTML string is ever constructed
 *
 * Segment shapes (TypeScript-style for documentation):
 *   - { type: 'text',  text: string }
 *   - { type: 'bold',  text: string }
 *   - { type: 'list',  items: InlineSegment[] }
 *       where InlineSegment = { type: 'text' | 'bold', text: string }
 *
 * @param {unknown} input Raw markdown string (anything non-string returns [])
 * @returns {Array<{ type: 'text' | 'bold' | 'list', ... }>}
 */
export function parseMdLite(input) {
  if (typeof input !== 'string' || input.length === 0) {
    return []
  }

  // 按行切(\n / \r\n 都行)
  const lines = input.split(/\r?\n/)
  const segments = []
  let textBuffer = ''
  let i = 0

  // 把累积的 text buffer inline 解析并 flush
  function flushTextBuffer() {
    if (textBuffer.length === 0) return
    const inlineSegs = parseInlineMd(textBuffer)
    for (const seg of inlineSegs) {
      segments.push(seg)
    }
    textBuffer = ''
  }

  while (i < lines.length) {
    const line = lines[i]
    const listMatch = line.match(/^- (.+)$/)

    if (listMatch) {
      // 遇到 list 行,先 flush 前面累积的 text
      flushTextBuffer()

      // 收集连续 "- " 行为 1 个 list 段
      const items = []
      while (i < lines.length) {
        const m = lines[i].match(/^- (.+)$/)
        if (!m) break
        // 每个 list-item 内部再做 inline 解析(支持 **bold** 混在 list-item 内)
        items.push(parseInlineMd(m[1]))
        i++
      }
      segments.push({ type: 'list', items })
    } else if (line === '' && textBuffer === '') {
      // 空行 + 空 buffer → 段落分隔,直接 push 一个 text '\n'(保留 markdown 段落语义)
      segments.push({ type: 'text', text: '\n' })
      i++
    } else {
      // 普通行累积到 textBuffer(textBuffer 非空时用 '\n' 分隔,空 buffer 时直接设值)
      textBuffer = textBuffer.length > 0 ? textBuffer + '\n' + line : line
      i++
    }
  }

  // 收尾
  flushTextBuffer()
  return segments
}

/**
 * Inline-only markdown parser (no list handling). Used internally by parseMdLite
 * for both top-level text blocks and individual list-item contents.
 *
 * Returns an array of { type: 'text' | 'bold', text: string } segments where
 * `text` is the already-stripped content (asterisks / underscores removed).
 *
 * @param {string} input Single-line or multi-line text without list markers
 * @returns {Array<{ type: 'text', text: string } | { type: 'bold', text: string }>}
 */
function parseInlineMd(input) {
  if (typeof input !== 'string' || input.length === 0) {
    return []
  }
  // Capture group 1: **xxx**  (asterisk variant)
  // Capture group 2: __xxx__  (underscore variant)
  const BOLD_PATTERN = /\*\*(.+?)\*\*|__(.+?)__/g
  const segments = []
  let lastIndex = 0
  for (const match of input.matchAll(BOLD_PATTERN)) {
    const start = match.index
    if (start > lastIndex) {
      segments.push({ type: 'text', text: input.slice(lastIndex, start) })
    }
    // match[1] = **xxx** capture, match[2] = __xxx__ capture
    const boldText = (match[1] ?? match[2] ?? '').toString()
    segments.push({ type: 'bold', text: boldText })
    lastIndex = start + match[0].length
  }
  if (lastIndex < input.length) {
    segments.push({ type: 'text', text: input.slice(lastIndex) })
  }
  return segments
}
