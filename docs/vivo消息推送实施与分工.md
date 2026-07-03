# vivo 消息推送实施与分工

更新时间：2026-06-29

## 1. 当前方案

本项目采用 vivo Direct Push，不使用 UniPush、uniCloud 中转、系统 cron 或站内提醒列表。

```text
UniApp Android
  ├─ 启动/恢复前台立即上报位置
  ├─ 前台每 15 分钟上报位置
  ├─ 有效行程期间由原生 location 前台服务在后台直接上报
  └─ VivoPushPlugin 获取 regId 并注册设备
                    |
                    v
FastAPI + PostgreSQL
                    ^
                    |
独立常驻 reminder-worker
  ├─ 每 15 分钟对齐自然季度点执行
  ├─ PostgreSQL advisory lock 防止多实例重复扫描
  ├─ 高德驾车 API 计算 ETA
  ├─ departure_alerts 保证幂等、重试和审计
  └─ vivo Direct Push 发送系统通知
```

当前只支持 vivo Android、单用户 MVP 和驾车方式。

## 2. 数据模型

### 2.1 device_push_tokens

保存 vivo 设备注册信息：

- `user_id`
- `provider`，当前固定为 `vivo`
- `reg_id`
- `device_name`
- `app_version`
- `enabled`
- `last_seen_at`
- `invalidated_at`

`provider + reg_id` 唯一。重复注册会刷新设备信息、最近出现时间并重新启用。

### 2.2 departure_alerts

该表仅供后端幂等、重试和审计使用，不是站内消息：

- `user_id`
- `trip_id`
- `trip_item_id`
- `level`：`warning` / `critical`
- `scheduled_at`
- `evaluated_at`
- `distance_meters`
- `eta_seconds`
- `remaining_seconds`
- `push_status`
- `request_id`
- `provider_task_id`
- `retry_count`
- `last_error_code`
- `last_error_message`
- `pushed_at`

`trip_item_id + level` 唯一，因此同一节点最多发送一次 warning 和一次 critical。

### 2.3 trip_items 到达字段

- `arrived_at`
- `arrival_distance_meters`

距离当前候选目的地小于 200 米时记录到达。同一轮最多确认一个节点，到达不会自动把
`status` 改成 `done`。

## 3. API

### 3.1 位置上报

```http
PUT /api/location
```

```json
{
  "user_id": 1,
  "latitude": 31.2304,
  "longitude": 121.4737,
  "timestamp": 1781140800
}
```

时间戳是设备实际采集位置的 Unix 秒时间戳。后端只允许更新的采集时间覆盖已有位置，
且只保存最新快照，不保存历史轨迹。

### 3.2 注册设备

```http
POST /api/push/devices
```

```json
{
  "user_id": 1,
  "reg_id": "vivo-reg-id",
  "device_name": "vivo device",
  "app_version": "0.1.0"
}
```

前端在 App Plus 环境中通过 `VivoPushPlugin` 获取 regId。首次启动、regId 变化或距上次
成功注册超过 24 小时时重新提交。

### 3.3 禁用设备

```http
DELETE /api/push/devices/{reg_id}?user_id=1
```

当前没有 `/api/reminders/check`、`/api/reminders`、未读提醒接口或前端提醒列表。

## 4. 出发提醒规则

Worker 每轮按以下顺序处理：

1. 读取用户 30 分钟内的最新位置。
2. 从当天未到达且状态有效的节点中选择开始时间最早的下一目的地。
3. 计算当前位置到目的地的直线距离。
4. 距离小于 200 米时记录 `arrived_at`，本轮不继续跨节点判断。
5. 未到达时调用高德 `GET /v3/direction/driving` 获取驾车 ETA。
6. 计算 `slack = remaining_seconds - eta_seconds`。
7. `slack > 15 分钟`：不提醒。
8. `0 < slack <= 15 分钟`：发送 warning。
9. `slack <= 0`：发送 critical。

高德失败、位置过期、节点缺少时间或坐标时跳过，不使用固定 ETA 或演示 fallback 发送通知。

## 5. Worker 与重试

部署使用独立常驻进程：

```bash
uv run --no-sync python -m app.jobs.departure_alerts_worker
```

Docker Compose 服务名为 `reminder-worker`。Worker 对齐每小时的 `00/15/30/45` 分钟执行，
并使用 PostgreSQL advisory lock 保证同一轮只有一个实例运行。

投递状态保存到 `departure_alerts`。失败时只记录脱敏错误摘要；后续轮次可以重试同一条
记录，但唯一约束禁止创建重复提醒。

## 6. Android 前台与后台定位

前台协调器行为：

- 首次安装定位权限未决定时主动请求系统授权；拒绝后不循环弹窗。
- 冷启动立即上报。
- 每次恢复前台立即上报。
- 前台运行期间每 15 分钟上报。
- 合并并发请求，避免重复定时器。
- “我的-定位与后台提醒”可查看权限和原生服务状态、打开应用设置并重新检查启动条件。

后台定位由 `BackgroundLocationPlugin` 启动 Android location 前台服务：

- 只在最新创建且覆盖当天的 active 旅行存在带有效坐标的 planned 节点时启动。
- 显示“导友正在为当前行程提供位置提醒”常驻通知。
- WebView 暂停后仍由原生层直接调用后端。
- 原生 LocationManager 坐标转换为 GCJ-02 后上报。
- 同一时刻只允许一个上传请求。
- 缺少定位权限、配置无效或无有效行程时停止/不启动。

Android 无法绝对保证每 15 分钟唤醒；后端必须继续用 30 分钟位置有效期保护。

## 7. vivo 原生插件

插件目录：

```text
frontend/nativeplugins/VivoPushPlugin/
```

模块：

- `VivoPushPlugin`：初始化 SDK、开启推送、获取 regId。
- `BackgroundLocationPlugin`：启动、停止和查询后台定位前台服务。

HBuilderX 本地原生插件要求实现 AAR 位于插件 `android/` 目录。实现 AAR 是本地生成物，
不提交 Git；vivo 官方 SDK AAR 保留在插件目录。

构建前在根目录 `.env` 填写：

```ini
VIVO_PUSH_APP_ID=
VIVO_PUSH_APP_KEY=
```

执行：

```powershell
& frontend\nativeplugins\VivoPushPlugin\android\build-plugin.ps1
```

脚本只在临时 Manifest 中注入凭据，源码 Manifest 保持占位符。生成文件：

```text
frontend/nativeplugins/VivoPushPlugin/android/VivoPushPlugin-release.aar
```

## 8. 后端配置

vivo AI/OCR 和 vivo Push 使用不同变量：

```ini
# vivo AI / OCR
VIVO_APP_ID=
VIVO_APP_KEY=
VIVO_BASE_URL=https://api-ai.vivo.com.cn

# vivo Push
VIVO_PUSH_APP_ID=
VIVO_PUSH_APP_KEY=
VIVO_PUSH_APP_SECRET=
VIVO_PUSH_API_BASE=https://api-push.vivo.com.cn
VIVO_PUSH_MODE=1
VIVO_PUSH_TIMEOUT_SECONDS=10
```

`VIVO_PUSH_APP_SECRET` 只存在于后端 `.env`，不得写入 Manifest、前端源码、AAR 或日志。

## 9. 安全要求

- 生产后端地址必须使用 HTTPS。
- AppID/AppKey 通过本地 `.env` 注入生成 AAR，不提交源码仓库。
- AppSecret 和第三方 API Key 不得进入前端。
- 日志不记录完整 regId、授权头、密钥或精确经纬度。
- Android 包名、签名、高德 Android Key 和 vivo 平台应用配置必须匹配。
- 测试模式 `VIVO_PUSH_MODE=1` 仅用于联调，正式值按 vivo 平台审核结果配置。

## 10. 当前完成情况

已完成：

- `device_push_tokens`、`departure_alerts` 和到达字段迁移。
- 设备注册/禁用接口。
- 高德驾车 Provider。
- vivo Direct Push Provider 和鉴权缓存。
- 规则判断、幂等、重试与 Worker。
- 前台 15 分钟位置上报。
- Android 原生后台定位前台服务。
- vivo regId 自动注册。
- 原生插件构建和凭据注入。
- 后端、前端和 App 资源本地自动化检查。

尚需真实环境验收：

- 生产 HTTPS 后端地址。
- 正式包名、签名、高德 Android Key 和 vivo 应用配置一致性。
- vivo 云真机前台、后台、锁屏、最近任务清理和省电模式。
- 系统通知点击后的行程详情跳转。
- 后台定位权限说明页和用户开关的完整交互。

## 11. 云真机测试矩阵

| 场景 | 预期 |
| --- | --- |
| 冷启动/恢复前台 | 立即上报一次位置，不产生多个定时器 |
| 前台运行 15 分钟 | 再次上报位置 |
| 后台/锁屏 | 常驻通知存在，系统允许时继续原生上报 |
| 最近任务清理 | 记录服务和推送实际表现，不假定 JS 继续运行 |
| 位置乱序 | 旧时间戳不覆盖新位置 |
| 位置超过 30 分钟 | Worker 跳过提醒 |
| 距目的地 199.9 米 | 记录到达 |
| 距目的地 200 米 | 不判定到达 |
| 余量 16/15/1/0/负数分钟 | 无提醒/warning/warning/critical/critical |
| 相同节点重复扫描 | 每个等级最多一条记录 |
| 高德失败 | 不发送错误提醒 |
| vivo 临时失败 | 记录失败并按策略重试 |
| 点击通知 | 打开对应行程；payload 不完整时进入首页 |
