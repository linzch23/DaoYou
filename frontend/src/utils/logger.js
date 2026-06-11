// frontend/utils/logger.js
// 统一日志器 —— 取代 console.log/console.error(参见 docs/Frontend Code Style Guide.md §13)
//
// 等级:
//   info    —— 关键业务事件(成功、跳过、提交完成)
//   warn    —— 可恢复的异常(本地校验失败、retried 后的成功)
//   error   —— 不可恢复的异常(API 失败、网络断开),调用方已捕获并向用户提示
//   debug   —— 调试信息(prod 不输出)
//
// 用法:
//   import { logger } from '@/utils/logger'   // 或相对路径
//   logger.info('submit ok', { userId, interests })
//   logger.error('submit failed', err)

// MVP: 暂不区分 dev / prod 环境的 build 标记(无 vite/webpack 配置);
// 输出到 console 即可,生产可由 uni-app 编译时移除或替换。
const PREFIX = '[DaoYou]'

function fmt(level, args) {
  return [`${PREFIX}[${level}]`, ...args]
}

export const logger = {
  info(...args) {
    // eslint-disable-next-line no-console
    console.info(...fmt('INFO', args))
  },
  warn(...args) {
    // eslint-disable-next-line no-console
    console.warn(...fmt('WARN', args))
  },
  error(...args) {
    // eslint-disable-next-line no-console
    console.error(...fmt('ERROR', args))
  },
  debug(...args) {
    // eslint-disable-next-line no-console
    console.debug(...fmt('DEBUG', args))
  },
}
