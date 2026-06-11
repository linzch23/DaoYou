#!/usr/bin/env node
/**
 * preview-all.mjs — 启动 6 个 dev server,每个跑不同 page 作为入口
 * 用 ?entry=xxx URL query 决定初始 page(在 main.js 实现)
 */
import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const PAGES = [
  { key: 'onboarding',  port: 5173, title: '引导页' },
  { key: 'home',        port: 5174, title: '首页(行程)' },
  { key: 'new-trip',    port: 5175, title: '新建行程' },
  { key: 'trip-detail', port: 5176, title: '行程详情' },
  { key: 'photo-guide', port: 5177, title: '拍照讲解' },
  { key: 'my',          port: 5178, title: '我的(设置中心)' },
]

// 1. 清理旧 server
try {
  const { execSync } = await import('node:child_process')
  execSync('pkill -f "npx uni" 2>/dev/null; sleep 2', { stdio: 'ignore' })
} catch {}

console.log(`\n[preview-all] starting ${PAGES.length} dev servers with ?entry= query\n`)

const results = []
for (const p of PAGES) {
  const log = `/tmp/uni-preview-${p.port}.log`
  const out = await import('node:fs').then(fs => fs.openSync(log, 'w'))
  const child = spawn(
    'npx',
    ['uni', `--port=${p.port}`],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        // 通过 env 传入 initial entry(供 main.js 读取)
        UNI_PREVIEW_ENTRY: p.key,
      },
      stdio: ['ignore', out, out],
      detached: true,
    }
  )
  child.unref()
  results.push({ ...p, pid: child.pid, log })
  console.log(`  ✓ ${p.key.padEnd(13)} port ${p.port}  pid ${child.pid}  log ${log}`)
}

console.log(`\n[preview-all] waiting 10s for all servers to be ready...`)
await sleep(10000)

console.log(`\n${'='.repeat(70)}`)
console.log(`[preview-all] all ${results.length} servers up:`)
console.log(`${'='.repeat(70)}\n`)
for (const r of results) {
  console.log(`  http://localhost:${r.port}/?entry=${r.key}    ← ${r.title}`)
}
console.log(`\n[preview-all] logs: /tmp/uni-preview-*.log`)
console.log(`[preview-all] stop all: pkill -f "npx uni"\n`)
