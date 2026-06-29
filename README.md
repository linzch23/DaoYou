# 导友——你的个人旅游搭子

《导友》是面向 AIGC 创新赛的主动式旅游陪伴 Agent MVP。系统目标是跑通行程创建、首页今日行程、AI 对话、拍照讲解、智能提醒、动态改线和用户偏好个性化闭环。

## 技术栈

- 前端：UniApp + Vue3。
- 后端：Python + FastAPI。
- Agent：LangGraph，已实现意图分流、对话、拍照讲解、提醒和改线建议主流程。
- 数据库：PostgreSQL。
- 文件存储：MVP 使用本地 `backend/uploads/`。
- 依赖管理：`uv`。
- 部署与本地联调：Docker Compose。

## 当前进展

- 前端已形成 UniApp + Vue3 v1，包含首页、新建/编辑行程、拍照讲解、个人中心、回收站等页面，并保留本地 Mock 和草稿存储能力。
- 后端已完成 FastAPI 分层骨架、SQLAlchemy 模型、Alembic 迁移、演示种子数据和统一响应合同；聊天、照片讲解、偏好和提醒命名已接入真实数据库。
- Agent 已完成 LangGraph 对话、拍照讲解、提醒和改线主流程；LLM 与 Qwen 视觉已通过 `.env` 配置完成真实调用验证，地图、天气、OCR 和记忆更新仍保留 fallback 或待继续完善。
- 动态改线统一通过 `POST /api/chat` 返回受控 `action_options`，用户确认后调用 `PUT /api/trip-items/{item_id}`。
- 聊天记录和照片讲解记录重新绑定 `trip_id`，前端按“每个旅程一个对话页面”组织上下文；业务提醒表统一命名为 `reminders`。
- Docker Compose 启动后端时会读取根目录 `.env`，自动执行 `alembic upgrade head` 并运行演示种子数据。

## 环境变量

根目录 `.env.example` 是模板，真实密钥写入根目录 `.env`。当前 `docker-compose.yml` 的后端服务通过 `env_file: .env` 注入环境变量，`.env` 不应提交到 Git。

常用外部能力配置：

```bash
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=...
LLM_MODEL=deepseek-v4-flash

VISION_PROVIDER=qwen
QWEN_API_KEY=...
QWEN_VISION_MODEL=qwen-vl-plus

OCR_PROVIDER=vivo
VIVO_APP_ID=...
VIVO_APP_KEY=...
VIVO_BASE_URL=https://api-ai.vivo.com.cn
VIVO_COMPLETIONS_URI=/vivogpt/completions
VIVO_MODEL=vivo-BlueLM-TB

VIVO_PUSH_APP_ID=...
VIVO_PUSH_APP_KEY=...
VIVO_PUSH_APP_SECRET=...
VIVO_PUSH_API_BASE=https://api-push.vivo.com.cn
```

Android 原生插件的源码 Manifest 只保留凭据占位符。正式打包前在根目录
`.env` 填写 `VIVO_PUSH_APP_ID` 和 `VIVO_PUSH_APP_KEY`，再生成本地 AAR：

```powershell
& frontend\nativeplugins\VivoPushPlugin\android\build-plugin.ps1
```

生成的 `VivoPushPlugin-release.aar`、HBuilderX `dist/`、`unpackage/`、
APK/AAB 和签名文件均为本地产物，不提交到 Git；HBuilderX 打包前只需确认
AAR 已在插件的 `android/` 目录生成。

## Docker 一键启动

在仓库根目录执行：

```bash
docker compose up -d --build
```

该命令会启动 PostgreSQL 和后端服务。后端容器启动时会先执行 Alembic 迁移，迁移成功后再启动 FastAPI。

## 后端本地启动

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

健康检查：

```bash
curl http://localhost:8000/health
```

预期响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "status": "ok"
  }
}
```

## 前端本地启动

首次进入前端目录安装依赖：

```bash
cd frontend
npm install
```

启动 H5 调试：

```bash
npm run dev:h5
```

其他端调试命令：

```bash
npm run dev:mp-weixin
npm run dev:app
```

## 常用检查

```bash
cd backend
uv run pytest
uv run ruff check .
```

真实 Agent 链路可用以下命令快速验证：

```bash
curl -X POST "http://localhost:8000/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"trip_id":1,"message":"请结合当前行程给一个轻松安排建议"}'

curl -X POST "http://localhost:8000/api/photos/explain" \
  -F "user_id=1" \
  -F "trip_id=1" \
  -F "image=@frontend/static/tabbar/camera.png;type=image/png"
```

## 文档入口

- `docs/API接口文档.md`：团队 API 合同。
- `docs/技术设计文档.md`：详细技术设计。
- `docs/团队开发协作与项目管理文档.md`：团队协作规范。
- `docs/vivo消息推送实施与分工.md`：vivo 消息推送方案、职责和验收流程。
