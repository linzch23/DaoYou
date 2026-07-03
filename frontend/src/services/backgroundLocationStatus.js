const BACKGROUND_FAILURE_MESSAGES = {
  plugin_unavailable: '当前安装包未包含后台定位原生插件',
  location_permission_required: '定位权限未开启，请先授权或打开应用设置',
  no_pending_destination: '今日待出发节点缺少坐标，或没有可监控的目的地',
  trip_check_failed: '无法读取今日行程，请检查网络和后端服务',
  not_app_plus: '后台定位仅支持 Android App',
}

export function describeBackgroundLocationResult(locationResult, backgroundResult) {
  if (!backgroundResult?.success) {
    return {
      success: false,
      message: BACKGROUND_FAILURE_MESSAGES[backgroundResult?.code]
        || `后台服务启动失败（${backgroundResult?.code || 'unknown'}）`,
    }
  }
  if (!locationResult?.success) {
    return {
      success: false,
      message: '后台服务已启动，但本次位置上传失败',
    }
  }
  return {
    success: true,
    message: '定位已上传，后台提醒服务正在运行',
  }
}
