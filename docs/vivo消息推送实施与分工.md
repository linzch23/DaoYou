# vivo 消息推送实施与分工

更新时间：2026-06-11

## 1. 文档目标

本文档用于指导《导友》MVP 实现面向 vivo Android 手机的行程提醒推送。

MVP 采用以下技术方案：

- FastAPI 后端负责定时检查行程、天气和交通时间，并生成提醒。
- PostgreSQL 保存设备、提醒和推送状态。
- UniPush 2.0 负责统一推送服务。
- vivo 厂商离线通道负责在应用进入后台或被系统清理后显示系统通知。
- UniApp Android 客户端负责设备注册、通知权限、消息接收和点击跳转。
- UniApp Android 客户端每 15 分钟上报一次设备实际采集的用户位置。
- vivo 云真机用于验证真实厂商推送链路。

本阶段只支持 vivo Android 设备，不接入华为、小米、OPPO、荣耀、iOS 或 FCM。

## 2. 总体架构

```text
reminder-worker 定时执行
        |
        v
查询未来行程节点
        |
        +----> users 最新位置（30 分钟有效）
        |
        +----> 天气服务
        |
        +----> 地图路线服务
        |
        v
计算建议出发时间和天气风险
        |
        v
写入 reminders，使用 dedup_key 去重
        |
        v
调用受保护的 uniCloud 推送云函数
        |
        v
UniPush 2.0 -> vivo 厂商离线通道
        |
        v
vivo 系统通知栏
        |
        v
用户点击通知 -> 打开指定行程或提醒页面
```

FCM 不参与本方案。

## 3. 前置条件

团队需要准备并固定以下信息：

- DCloud AppID。
- Android 应用包名。
- Android 应用签名证书和对应指纹。
- vivo 开放平台 AppID。
- vivo 开放平台 AppKey。
- vivo 开放平台 AppSecret。
- 可使用的 uniCloud 服务空间。
- vivo 云真机使用资格。

只有 AppID 和 AppKey 通常不足以完成服务端厂商通道配置，还需要确认能够取得 AppSecret。

包名、签名、DCloud AppID 和 vivo 平台配置必须一致。测试期间不要随意更换包名或签名。

## 4. 前端职责

### 4.1 配置 UniPush 2.0

前端负责人需要在 HBuilderX 和 DCloud 开发者中心完成：

1. 在 `manifest.json` 中启用 UniPush 2.0。
2. 启用 Android 离线推送。
3. 仅配置 vivo 厂商通道。
4. 填写 vivo AppID、AppKey 和 AppSecret。
5. 核对 Android 包名及签名信息。
6. 制作自定义调试基座或云打包 APK。

标准 HBuilderX 运行基座不能作为 vivo 离线推送的最终验证环境。

### 4.2 获取并注册设备 CID

应用启动后调用：

```ts
uni.getPushClientId({
  success(result) {
    registerPushDevice({
      cid: result.cid,
      platform: "android",
      vendor: "vivo"
    })
  }
})
```

前端将 CID 上传至：

```http
POST /api/push/devices
```

请求示例：

```json
{
  "cid": "unipush-device-cid",
  "platform": "android",
  "vendor": "vivo"
}
```

应用每次启动时都应检查 CID。重装应用、清除数据或设备环境变化后，CID 可能变化。

### 4.3 通知权限

前端负责：

- Android 13 及以上申请通知运行时权限。
- 在应用设置页提供提醒通知开关。
- 权限被拒绝时给出可操作提示。
- 引导用户前往系统设置重新开启通知。

### 4.4 接收消息

应用应在启动阶段注册消息监听：

```ts
uni.onPushMessage((event) => {
  const payload = event.data?.payload

  if (event.type === "click" && payload?.trip_id) {
    uni.navigateTo({
      url: `/pages/trip-detail/index?id=${payload.trip_id}`
    })
  }
})
```

前端需要处理：

- 前台收到消息时刷新提醒列表。
- 后台收到系统通知时不重复创建相同通知。
- 用户点击通知时跳转到对应行程、节点或提醒详情。
- 当前已位于目标页面时只刷新数据，避免重复跳转。
- payload 缺少必要字段时跳转到通知列表，而不是直接报错。

### 4.5 前端接口协作

前端需要接入：

```text
POST   /api/push/devices
DELETE /api/push/devices/{cid}
GET    /api/reminders
PUT    /api/location
```

Android 获得定位权限后，建议每 15 分钟上报一次；明显移动时可以提前上报。`timestamp` 必须是设备实际采集位置的 Unix 秒时间戳。

```json
{
  "user_id": 1,
  "latitude": 31.2304,
  "longitude": 121.4737,
  "timestamp": 1781140800
}
```

应用进入后台后能否持续执行 15 分钟定时任务受 Android 系统限制。前端应在系统允许时上报，但后端必须依靠 `location_updated_at` 判断数据是否过期，不能假定客户端一定准时运行。

开发环境可使用：

```text
POST /api/push/test
```

测试推送接口不得暴露在生产环境。

### 4.6 前端验收标准

- [ ] 云打包 APK 能安装到 vivo 云真机。
- [ ] 应用可以取得有效 CID。
- [ ] CID 能上传并绑定默认用户。
- [ ] Android 能上传最新位置，并使用设备实际采集时间。
- [ ] 应用前台时能收到消息并刷新提醒列表。
- [ ] 应用后台时能显示 vivo 系统通知。
- [ ] 应用被系统清理后仍能收到离线通知。
- [ ] 点击通知能进入正确页面。
- [ ] Android 13 以上通知权限流程正常。
- [ ] 注销或关闭提醒后不再接收业务推送。

## 5. 后端职责

### 5.1 设备管理

后端增加设备推送令牌表：

```text
device_push_tokens
- id
- user_id
- cid
- platform
- vendor
- enabled
- last_seen_at
- created_at
- updated_at
```

约束：

- `cid` 必须唯一。
- 同一用户可以绑定多个设备。
- CID 重复注册时更新用户归属和 `last_seen_at`。
- 用户关闭通知或注销时将设备禁用。
- 推送服务确认 CID 无效时将其禁用。
- 日志中不得记录完整 CID。

建议接口：

```text
POST   /api/push/devices
DELETE /api/push/devices/{cid}
POST   /api/push/test
```

即使 MVP 使用默认 `user_id=1`，查询和更新时仍需执行用户所有权检查。

### 5.2 提醒定时任务

定时任务使用独立进程或容器运行：

```text
backend-api
reminder-worker
postgres
```

不应将 Scheduler 直接运行在多个 Uvicorn Worker 中，否则相同任务可能被重复执行。

MVP 建议每 5 分钟执行一次：

1. 查询未来 2 小时内的行程节点。
2. 读取用户最新位置，并检查采集时间是否在 30 分钟内。
3. 查询目的地天气。
4. 查询起点到目的地的交通时间。
5. 计算建议出发时间。
6. 判断是否达到提醒阈值。
7. 写入提醒记录。
8. 向用户有效设备发送推送。

用户位置保存在 `users`：

```text
latitude
longitude
location_updated_at
```

位置规则：

- 默认演示位置的 `location_updated_at` 为 `NULL`，不能当作真实定位。
- 只有更晚的采集时间可以覆盖已有位置。
- 位置超过 30 分钟时，不执行依赖精确起点的路线时间计算，也不发送精确到分钟的出发提醒。
- 无有效位置时仍可执行天气、固定时间冲突等不依赖实时位置的规则。
- MVP 不保存位置历史轨迹，日志不记录精确经纬度。

计算示例：

```text
计划到达时间：15:00
交通时间：40 分钟
天气缓冲：15 分钟
建议出发时间：14:05
当前时间：14:00
提醒结果：5 分钟后建议出发
```

### 5.3 提醒生成规则

MVP 优先支持：

- 出发提醒。
- 降雨、强风、高温等天气提醒。
- 交通时间增加导致的提前出发提醒。
- 行程节点时间冲突提醒。

天气或地图服务调用失败时：

- 不生成未经验证的紧急提醒。
- 记录失败原因。
- 必要时使用明确标记的演示 fallback。
- 不向客户端暴露第三方服务原始异常。

### 5.4 去重与推送状态

建议在 `reminders` 中增加：

```text
dedup_key
push_status
pushed_at
push_error
retry_count
```

示例：

```text
departure:1:trip_item:8:2026-06-10T14:05
weather:1:trip_day:2:rain
```

`dedup_key` 应有数据库唯一约束，防止并发任务重复生成提醒。

建议状态：

```text
pending
sent
failed
cancelled
```

### 5.5 推送服务

后端通过受保护的 uniCloud 云函数发送消息。

请求示例：

```json
{
  "cid": "unipush-device-cid",
  "title": "建议提前出发",
  "content": "前往星海广场预计需要 40 分钟，请于 14:05 出发。",
  "payload": {
    "reminder_id": 23,
    "trip_id": 1,
    "trip_item_id": 8,
    "type": "departure_reminder"
  }
}
```

云函数职责应保持精简：

1. 验证 FastAPI 请求签名。
2. 校验消息字段和长度。
3. 调用 UniPush 2.0。
4. 返回推送结果或标准化错误。

天气计算、交通计算、提醒规则和数据库业务不得放入云函数。

### 5.6 后端安全要求

- vivo AppSecret 不得进入前端代码。
- vivo AppSecret、云函数密钥和第三方 API Key 不得提交到 Git。
- FastAPI 与云函数之间必须使用 HTTPS。
- FastAPI 调用云函数时使用签名、时间戳和防重放校验。
- 测试推送接口仅允许开发环境使用。
- 日志不得输出 AppSecret、完整 CID、授权头或用户敏感信息。
- 日志不得输出用户精确经纬度。
- 推送 payload 只包含页面跳转所需的资源 ID，不包含敏感数据。

### 5.7 后端验收标准

- [ ] 设备注册、更新和禁用逻辑可用。
- [ ] 同一 CID 重复注册不会产生重复记录。
- [ ] 定时任务只由一个 Worker 执行。
- [ ] 天气和交通时间可以参与提醒计算。
- [ ] 位置更新接口能拒绝旧时间戳覆盖，30 分钟过期规则生效。
- [ ] `dedup_key` 能阻止重复提醒。
- [ ] 提醒生成后写入 PostgreSQL。
- [ ] 推送成功、失败和重试状态可追踪。
- [ ] 无效 CID 会被禁用。
- [ ] 第三方服务失败时有可控降级。
- [ ] 日志和错误响应不泄露凭据。

## 6. Agent 负责人职责

本功能不应依赖大模型才能正常运行。确定性的时间、天气和交通提醒由后端规则引擎生成。

Agent 负责人只需要：

- 提供可选的自然语言提醒文案生成能力。
- 保证输出符合结构化 schema。
- 在 Agent 失败时允许后端使用固定模板。
- 不直接调用推送服务。
- 不直接写入设备令牌或通知表。

推荐后端固定模板优先于大模型：

```text
前往{place_name}预计需要{travel_minutes}分钟，
受{weather_condition}影响，建议于{departure_time}前出发。
```

## 7. 数据流与状态

```text
trip_items
    |
    v
reminder-worker
    |
    +--> users 最新位置（30 分钟有效）
    |
    +--> weather adapter
    |
    +--> route adapter
    |
    v
reminders(pending)
    |
    v
push service
    |
    v
uniCloud function
    |
    v
UniPush/vivo
    |
    +--> 成功：reminders.sent
    |
    +--> 临时失败：reminders.failed，按策略重试
    |
    +--> CID 无效：禁用 device_push_tokens
```

推送成功只表示服务端接受消息，不等同于用户已经阅读。MVP 不要求实现可靠的已读回执。

## 8. 实施顺序

### 阶段一：验证厂商链路

1. 固定包名和签名。
2. 配置 UniPush 2.0 和 vivo 厂商参数。
3. 云打包 APK。
4. 在 vivo 云真机安装应用。
5. 获取 CID。
6. 通过 DCloud 控制台向 CID 手动推送。
7. 验证前台、后台、应用被清理和点击跳转。

只有阶段一通过后，才进入后端定时提醒开发。

### 阶段二：设备绑定

1. 后端建立 `device_push_tokens`。
2. 实现设备注册和注销接口。
3. 前端上传 CID。
4. 验证 CID 更新和用户绑定。

### 阶段三：位置上报

1. 为 `users` 增加 `latitude`、`longitude`、`location_updated_at`。
2. 实现 `PUT /api/location`。
3. Android 接入定位权限和 15 分钟上报。
4. 验证重复请求幂等、旧时间戳不覆盖新位置。
5. 验证超过 30 分钟的位置被提醒 Worker 判定为过期。

### 阶段四：程序化测试推送

1. 创建受保护的 uniCloud 推送云函数。
2. 后端实现 Push Adapter。
3. 增加仅开发环境可用的测试推送接口。
4. 验证推送结果记录。

### 阶段五：提醒规则

1. 实现天气 Adapter。
2. 实现路线时间 Adapter。
3. 实现建议出发时间计算。
4. 实现 `dedup_key`。
5. 写入 `reminders`。
6. 增加规则单元测试。

### 阶段六：定时执行

1. 创建独立 `reminder-worker`。
2. 配置每 5 分钟执行。
3. 接入推送重试和无效 CID 禁用。
4. 完成端到端云真机测试。

## 9. 云真机测试矩阵

| 场景 | 操作 | 预期结果 |
| --- | --- | --- |
| 应用前台 | 保持应用打开并发送通知 | 收到消息，提醒列表刷新 |
| 应用后台 | 返回系统桌面后发送通知 | vivo 系统通知栏显示 |
| 应用被清理 | 从最近任务清理后发送通知 | 仍能收到厂商离线通知 |
| 点击通知 | 点击系统通知 | 打开对应行程或提醒页面 |
| 通知权限关闭 | 关闭系统通知权限后发送 | 不显示通知，应用内可提示用户开启 |
| CID 更新 | 清除数据或重装后启动 | 新 CID 上传，旧 CID 被替换或禁用 |
| 位置首次上报 | 使用当前时间上传位置 | users 最新位置和采集时间更新 |
| 位置乱序 | 先上传新时间，再上传旧时间 | 旧位置不覆盖新位置，接口返回 `updated=false` |
| 位置过期 | 将采集时间设为 30 分钟以前 | 不生成依赖精确路线时间的出发提醒 |
| 后台上报受限 | 系统限制后台定位执行 | Worker 根据过期规则安全降级，不使用陈旧位置 |
| 重复任务 | 同一提醒执行两次 | 数据库只保留一个 `dedup_key` |
| 天气服务失败 | 模拟天气接口异常 | 不发送错误天气提醒，记录标准化错误 |
| 路线服务失败 | 模拟地图接口异常 | 使用明确 fallback 或跳过提醒 |

## 10. 团队交付清单

### 前端交付

- UniPush 2.0 与 vivo 通道配置。
- 可安装到 vivo 云真机的签名 APK。
- CID 获取与上传。
- Android 定位权限、15 分钟位置上报和失败重试。
- Android 通知权限处理。
- 消息监听与点击跳转。
- 前台、后台、被清理状态测试记录。

### 后端交付

- 设备令牌模型、迁移和接口。
- users 最新位置字段、位置更新接口和过期判定。
- 通知状态与去重字段迁移。
- Push Adapter 和 uniCloud 调用。
- 天气、路线 Adapter。
- 提醒规则和独立定时 Worker。
- 推送日志、失败重试和无效 CID 处理。
- 单元测试和端到端联调记录。

### Agent 交付

- 可选的提醒文案生成 schema。
- 固定 fallback 文案。
- Agent 失败不阻断规则提醒的验证结果。

## 11. MVP 完成定义

以下条件全部满足，才认为 vivo 消息提醒功能完成：

- vivo 云真机在应用被清理后仍能收到通知。
- 用户点击通知能进入正确的行程页面。
- 后端能根据真实或演示天气和交通时间生成提醒。
- Android 能上报位置，旧位置不会覆盖新位置，过期位置不会参与精确出发提醒。
- 相同提醒不会重复推送。
- 推送状态可以在数据库中追踪。
- 无效 CID、外部服务失败和权限关闭都有可控处理。
- AppSecret 和服务端密钥未进入客户端或 Git。
- 核心规则测试和端到端测试均有执行记录。

## 12. 参考资料

- UniPush 2.0：<https://uniapp.dcloud.net.cn/unipush-v2.html>
- UniPush 厂商通道配置：<https://uniapp.dcloud.net.cn/unipush_vendor_config.html>
- vivo 开放平台：<https://dev.vivo.com.cn/>
