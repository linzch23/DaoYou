import { defineConfig } from 'vite'
import vitePluginUni from '@dcloudio/vite-plugin-uni'
import path from 'path'

// Node 25 ESM 处理 CJS module 的 quirk:
// `import uni from '@dcloudio/vite-plugin-uni'` 拿到 module 整个 namespace
// (`{ __esModule: true, default: fn, runDev, runBuild, ... }`),
// 不会自动解开 default。必须 .default 二次取。
const uni = vitePluginUni.default

export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})
