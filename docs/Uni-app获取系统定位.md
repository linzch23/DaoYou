在 `uni-app` 做 Android App 时，前端拿定位的核心 API 是：

```javascript
uni.getLocation()
```

官方说明里，`uni.getLocation` 用于获取当前位置、速度；成功返回 `latitude`、`longitude`、`accuracy` 等字段。Android App 端还要注意定位权限、手机定位服务、以及国内 Android 没有 GMS 时可能需要配置高德/腾讯等定位 SDK Key。参考 DCloud 官方文档：[uni.getLocation](https://uniapp.dcloud.io/api/location/location)。

**1. manifest 里先配置定位能力**

在 HBuilderX 里通常检查：

```latex
manifest.json
→ App模块配置
→ Geolocation 定位
```

Android 权限至少需要：

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
```

DCloud 官方 Android 权限配置也列了这两个定位权限：[Android 权限配置](https://uniapp.dcloud.io/tutorial/app-nativeresource-android)。

如果你们要在国内 Android 手机上稳定定位，建议配置高德或腾讯定位 SDK。官方文档也说明：Android 因为 GMS 问题，很多国内手机需要向高德等三方服务商申请 SDK 资质和 AppKey。

**2. 前端获取当前位置**

推荐封装成一个函数：

```javascript
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 5000,
      success: (res) => {
        resolve({
          lat: res.latitude,
          lng: res.longitude,
          accuracy: res.accuracy,
          speed: res.speed,
          recorded_at: new Date().toISOString()
        })
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}
```

这里建议用：

```javascript
type: 'gcj02'
```

原因是国内地图、高德、腾讯、`map` 组件、路线规划通常使用国测局坐标。官方也说明 `gcj02` 可用于 `uni.openLocation` 和 map 组件坐标。

如果你只是做 GPS 原始坐标，可以用：

```javascript
type: 'wgs84'
```

但后端如果要调用高德/腾讯地图路线服务，通常还是 `gcj02` 更方便。

**3. 调用并上传后端**

例如进入行程页时获取一次位置：

```javascript
async function uploadCurrentLocation(tripId) {
  try {
    const location = await getCurrentLocation()

    await uni.request({
      url: 'https://your-api.com/api/location/update',
      method: 'POST',
      data: {
        trip_id: tripId,
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        source: 'gps',
        recorded_at: location.recorded_at
      }
    })

    return location
  } catch (err) {
    uni.showToast({
      title: '无法获取当前位置',
      icon: 'none'
    })

    throw err
  }
}
```

对应后端接口可以是：

```http
POST /api/location/update
```

```json
{
  "trip_id": 1,
  "lat": 38.914,
  "lng": 121.6147,
  "accuracy": 30,
  "source": "gps",
  "recorded_at": "2026-06-01T10:30:00.000Z"
}
```

**4. 判断定位权限**

可以用：

```javascript
const setting = uni.getAppAuthorizeSetting()
console.log(setting.locationAuthorized)
```

可能值包括：

```latex
authorized
denied
not determined
config error
```

官方说明：`denied` 表示用户拒绝，通常需要引导用户去系统设置打开权限；`config error` 在 Android 上可能表示没有授予 `ACCESS_COARSE_LOCATION` 权限。参考：[uni.getAppAuthorizeSetting](https://uniapp.dcloud.net.cn/api/system/getappauthorizesetting.html)。

简单处理：

```javascript
function checkLocationPermission() {
  const setting = uni.getAppAuthorizeSetting()

  if (setting.locationAuthorized === 'denied') {
    uni.showModal({
      title: '需要定位权限',
      content: '请在系统设置中开启定位权限，用于行程提醒和路线调整。',
      confirmText: '去设置',
      success: (res) => {
        if (res.confirm) {
          uni.openAppAuthorizeSetting()
        }
      }
    })

    return false
  }

  return true
}
```

**5. MVP 推荐实现方式**

你们现在做比赛项目，可以这样做：

```latex
进入首页/行程页
→ 调用 uni.getLocation
→ 成功后上传后端
→ 失败时使用演示固定位置
→ 后端基于位置做提醒、改线、附近推荐
```

前端逻辑：

```javascript
async function initTripLocation(tripId) {
  try {
    checkLocationPermission()
    return await uploadCurrentLocation(tripId)
  } catch (err) {
    return {
      lat: 38.914,
      lng: 121.6147,
      accuracy: 999,
      source: 'demo',
      recorded_at: new Date().toISOString()
    }
  }
}
```

结论：

```latex
uni-app Android 前端用 uni.getLocation 获取系统定位
manifest 需要配置定位模块和 Android 定位权限
国内 Android 建议配置高德/腾讯定位 SDK Key
前端拿到经纬度后发给后端
后端不能自己直接拿手机定位
MVP 建议加演示兜底位置
```

