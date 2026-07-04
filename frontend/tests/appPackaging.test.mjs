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

test('API base URL is selected by Vite mode instead of editing source code', async () => {
  const config = await readFile(
    path.join(frontendRoot, 'src/services/config.js'),
    'utf8',
  )
  const developmentEnv = await readFile(
    path.join(frontendRoot, '.env.development'),
    'utf8',
  ).catch(() => '')
  const productionEnv = await readFile(
    path.join(frontendRoot, '.env.production'),
    'utf8',
  ).catch(() => '')
  const guideResult = await readFile(
    path.join(frontendRoot, 'src/pages/guide-result/index.vue'),
    'utf8',
  )

  assert.match(config, /export const BASE_URL = import\.meta\.env\.VITE_API_BASE_URL/)
  assert.doesNotMatch(config, /https?:\/\/(?:localhost|8\.163\.114\.90)/)
  assert.match(developmentEnv, /^VITE_API_BASE_URL=http:\/\/localhost:8000\s*$/)
  assert.match(productionEnv, /^VITE_API_BASE_URL=https:\/\/8\.163\.114\.90\s*$/)
  assert.match(guideResult, /import\s*\{\s*BASE_URL\s*\}\s*from\s*['"]\.\.\/\.\.\/services\/config\.js['"]/)
  assert.match(guideResult, /return `\$\{BASE_URL\}\/\$\{imagePath\.replace/)
  assert.doesNotMatch(guideResult, /return `http:\/\/localhost:8000\//)
})

test('app location uses the DCloud Geolocation AMap configuration with a local key placeholder', async () => {
  const manifest = JSON.parse(
    await readFile(path.join(frontendRoot, 'src/manifest.json'), 'utf8'),
  )
  const appPlus = manifest['app-plus']

  assert.deepEqual(appPlus.modules.Geolocation, {})
  assert.equal(appPlus.modules.Amap, undefined)
  assert.deepEqual(
    appPlus.distribute.sdkConfigs.geolocation.amap,
    {
      __platform__: ['android'],
      appkey_android: '__AMAP_ANDROID_APP_KEY__',
    },
  )
  assert.equal(appPlus.distribute.sdkConfigs.amap, undefined)
})

test('production app packaging injects the local AMap Android key and copies native plugins', async () => {
  const script = await readFile(
    path.join(frontendRoot, 'scripts/build-app-package.ps1'),
    'utf8',
  ).catch(() => '')

  assert.match(script, /AMAP_ANDROID_APP_KEY/)
  assert.match(script, /__AMAP_ANDROID_APP_KEY__/)
  assert.match(script, /Get-Content\s+-LiteralPath\s+\$envPath\s+-Encoding\s+UTF8/)
  assert.match(script, /npm(?:\.cmd)?\s+run\s+build:app/)
  assert.match(script, /nativeplugins/)
  assert.match(script, /finally/)
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
  const deleteToastValues = [
    ...source.matchAll(/deleteSuccessToast:\s*['"]([^'"]+)['"]/g),
  ].map((match) => match[1])

  assert.match(source, /successToast:\s*['"]设置成功['"]/)
  assert.deepEqual(deleteToastValues, ['已移入回收站', '已移入回收站'])
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

test('location and background reminder settings are registered and reachable from My', async () => {
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
    path.join(frontendRoot, 'src/pages/location-setting/index.vue'),
    'utf8',
  ).catch(() => '')

  assert.match(routes, /LocationSetting:\s*['"]\/pages\/location-setting\/index['"]/)
  assert.ok(pages.pages.some((item) => item.path === 'pages/location-setting/index'))
  assert.match(strings, /id:\s*['"]location-setting['"]/)
  assert.match(page, /openAppSettings/)
  assert.match(page, /getBackgroundLocationStatus/)
  assert.match(page, /requestLocationPermission/)
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
  assert.match(
    source,
    /startLocationReporter\(\)\.finally\(async \(\) => \{[\s\S]*await syncBackgroundLocation\(\)[\s\S]*await ensureNotificationPermission\(\)/,
  )
})
