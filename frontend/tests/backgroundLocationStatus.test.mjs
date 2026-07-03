import assert from 'node:assert/strict'
import test from 'node:test'

import {
  describeBackgroundLocationResult,
} from '../src/services/backgroundLocationStatus.js'

test('background location diagnostics explain missing destination coordinates', () => {
  assert.deepEqual(
    describeBackgroundLocationResult(
      { success: true, running: false },
      { success: false, code: 'no_pending_destination' },
    ),
    {
      success: false,
      message: '今日待出发节点缺少坐标，或没有可监控的目的地',
    },
  )
})

test('background location diagnostics distinguish upload and plugin failures', () => {
  assert.equal(
    describeBackgroundLocationResult(
      { success: false, code: 'location_report_failed' },
      { success: true, running: true },
    ).message,
    '后台服务已启动，但本次位置上传失败',
  )
  assert.equal(
    describeBackgroundLocationResult(
      { success: true },
      { success: false, code: 'plugin_unavailable' },
    ).message,
    '当前安装包未包含后台定位原生插件',
  )
})
