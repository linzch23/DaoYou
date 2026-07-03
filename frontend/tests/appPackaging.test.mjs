import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('trip detail reads tripId from the uni-app onLoad options', async () => {
  const source = await readFile(
    path.join(frontendRoot, 'src/pages/trip-detail/index.vue'),
    'utf8',
  )

  assert.match(source, /import\s*\{[^}]*\bonLoad\b[^}]*\}\s*from\s*['"]@dcloudio\/uni-app['"]/)
  assert.match(source, /onLoad\s*\(\s*\(\s*options\s*\)\s*=>\s*\{\s*initialize\(options\)/s)
  assert.doesNotMatch(source, /function\s+getCurrentPageOptions\s*\(/)
})

test('every configured tabBar icon exists under the uni-app source static directory', async () => {
  const pages = JSON.parse(
    await readFile(path.join(frontendRoot, 'src/pages.json'), 'utf8'),
  )

  for (const item of pages.tabBar.list) {
    for (const property of ['iconPath', 'selectedIconPath']) {
      const configuredPath = item[property]
      const icon = await readFile(path.join(frontendRoot, 'src', configuredPath))
      assert.ok(icon.length > 0, `${configuredPath} must be a non-empty source asset`)
    }
  }
})

test('trip card action icons use ASCII static asset paths', async () => {
  const source = await readFile(
    path.join(frontendRoot, 'src/components/TripCard.vue'),
    'utf8',
  )

  for (const iconName of ['chat.png', 'delete.png']) {
    assert.match(source, new RegExp(`/static/tabbar/${iconName.replace('.', '\\.')}`))
    const icon = await readFile(
      path.join(frontendRoot, 'src/static/tabbar', iconName),
    )
    assert.ok(icon.length > 0, `${iconName} must be a non-empty source asset`)
  }
  assert.doesNotMatch(source, /\/static\/tabbar\/(?:AI对话|删除_delete)\.png/)
})

test('trip item editing uses a dedicated event and restores the city field', async () => {
  const fieldSource = await readFile(
    path.join(
      frontendRoot,
      'src/pages/new-trip/components/ItineraryArrangeField.vue',
    ),
    'utf8',
  )
  const pageSource = await readFile(
    path.join(frontendRoot, 'src/pages/edit-trip/index.vue'),
    'utf8',
  )

  assert.match(fieldSource, /'update-item'/)
  assert.match(fieldSource, /emit\('update-item', updatedItem\)/)
  assert.match(fieldSource, /city:\s*item\.city\s*\|\|\s*''/)
  assert.doesNotMatch(
    fieldSource,
    /id:\s*existing\?\.id[\s\S]{0,400}id:\s*Date\.now\(\)/,
  )
  assert.match(pageSource, /@update-item="onUpdateItem"/)
  assert.match(pageSource, /async function onUpdateItem\(updatedItem\)/)
  assert.match(
    pageSource,
    /updateTripItem\(updatedItem\.id,\s*\{/,
  )
})

test('packaged app uses the product display name', async () => {
  const manifest = JSON.parse(
    await readFile(path.join(frontendRoot, 'src/manifest.json'), 'utf8'),
  )

  assert.equal(manifest.name, '导友')
})

test('background location service records recent-task removal for device diagnostics', async () => {
  const source = await readFile(
    path.join(
      frontendRoot,
      'nativeplugins/VivoPushPlugin/android/src/main/java/com/daoyou/plugin/backgroundlocation/BackgroundLocationService.java',
    ),
    'utf8',
  )

  assert.match(source, /void\s+onTaskRemoved\s*\(\s*Intent\s+rootIntent\s*\)/)
  assert.match(source, /Log\.i\(TAG,\s*"Task removed;/)
})

test('permanent trash deletion sends user_id as a query parameter', async () => {
  const source = await readFile(
    path.join(frontendRoot, 'src/services/trips.js'),
    'utf8',
  )
  const functionSource = source.match(
    /export function permanentlyDeleteTrip\(tripId\) \{([\s\S]*?)\n\}/,
  )?.[0]

  assert.ok(functionSource, 'permanentlyDeleteTrip must exist')
  assert.match(
    functionSource,
    /url:\s*`\$\{BASE_URL\}\/api\/trash\/trips\/\$\{tripId\}\?user_id=\$\{MVP_USER_ID\}`/,
  )
  assert.doesNotMatch(functionSource, /data:\s*\{\s*user_id:\s*MVP_USER_ID\s*\}/)
})

for (const page of [
  'edit-trip',
  'chat',
  'guide-result',
  'new-trip',
  'photo-guide',
  'spot-detail-sheet',
]) {
  test(`${page} reads route options from onLoad`, async () => {
    const source = await readFile(
      path.join(frontendRoot, `src/pages/${page}/index.vue`),
      'utf8',
    )

    assert.match(source, /from\s+['"]@dcloudio\/uni-app['"]/)
    assert.match(source, /\bonLoad\s*\(/)
    assert.doesNotMatch(source, /function\s+getCurrentPageOptions\s*\(/)
  })
}

test('short success toasts fit the native icon layout', async () => {
  const source = await readFile(
    path.join(frontendRoot, 'src/constants/strings.js'),
    'utf8',
  )

  assert.match(source, /successToast:\s*['"]设置成功['"]/)
  assert.match(source, /deleteSuccessToast:\s*['"]已移入回收站['"]/)
})

test('notification settings are registered and reachable from My', async () => {
  const routes = await readFile(
    path.join(frontendRoot, 'src/constants/routes.js'),
    'utf8',
  )
  const pages = JSON.parse(
    await readFile(path.join(frontendRoot, 'src/pages.json'), 'utf8'),
  )
  const strings = await readFile(
    path.join(frontendRoot, 'src/constants/strings.js'),
    'utf8',
  )
  const page = await readFile(
    path.join(frontendRoot, 'src/pages/notification-setting/index.vue'),
    'utf8',
  )

  assert.match(routes, /NotificationSetting:\s*['"]\/pages\/notification-setting\/index['"]/)
  assert.ok(pages.pages.some((item) => item.path === 'pages/notification-setting/index'))
  assert.match(strings, /id:\s*['"]notification-setting['"]/)
  assert.match(page, /openNotificationSettings/)
})

test('photo guide route is registered', async () => {
  const pages = JSON.parse(
    await readFile(path.join(frontendRoot, 'src/pages.json'), 'utf8'),
  )

  assert.ok(pages.pages.some((item) => item.path === 'pages/photo-guide/index'))
})

test('App checks notification permission when it becomes visible', async () => {
  const source = await readFile(path.join(frontendRoot, 'src/App.vue'), 'utf8')

  assert.match(source, /ensureNotificationPermission/)
  assert.match(source, /void\s+ensureNotificationPermission\(\)/)
})
