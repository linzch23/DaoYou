# Agent 实现思路与内容

本文档记录成员 C 本轮对 `DaoYou/backend` 中 Agent 模块的实现思路与改动内容。当前目标是完成可演示的 LangGraph Demo：使用 `StateGraph` 编排 Agent 节点，并优先把 AI 对话链路接入文本大模型。当前支持 OpenAI-compatible 接口和 vivo 蓝心大模型；未配置 API Key 或模型调用失败时，系统继续使用 mock fallback，保证复赛演示稳定。

## 1. 实现目标

本轮实现让后端具备四条稳定的 Agent 链路：

- AI 对话：结合行程和用户偏好生成旅游搭子式回复。
- 拍照讲解：根据上传图片信息生成 mock 景点识别结果与讲解。
- 智能提醒：根据当前行程和时间生成出发提醒或时间冲突提醒。
- 动态改线：根据用户“累了、不想去下一站”等请求生成改线草案。

所有链路统一通过 `run_agent(state)` 入口调用。`run_agent` 内部调用已编译的 LangGraph 图，并统一返回：

```json
{
  "intent": "chat",
  "reply": "自然语言回复",
  "structured_data": {},
  "follow_up_questions": []
}
```

## 2. 文件改动说明

| 文件 | 改动内容 |
| --- | --- |
| `backend/app/agent/state.py` | 补齐 `AgentState` 字段，增加工具结果、结构化输出、追问建议和错误信息 |
| `backend/app/agent/llm.py` | 新增大模型统一适配层，负责调用 OpenAI-compatible 或 vivo 蓝心大模型接口 |
| `backend/app/agent/tools.py` | 实现 mock 工具，包括行程、偏好、图片识别、OCR、地图、天气和提醒 |
| `backend/app/agent/nodes.py` | 实现意图识别、聊天、拍照讲解、提醒、改线和记忆更新节点 |
| `backend/app/agent/prompts.py` | 写入四类 Prompt 模板，为后续真实 LLM 接入做准备 |
| `backend/app/agent/graph.py` | 保留 `run_agent(state)` 入口，使用 LangGraph `StateGraph` 编排 intent 分发和节点流转 |
| `backend/app/core/config.py` | 增加 LLM 相关配置项，真实 Key 通过 `.env` 注入 |
| `backend/app/services/*.py` | 将 chat、photo、reminder、replan 四个 service 接入 Agent |
| `backend/tests/test_agent_graph.py` | 新增 Agent 单测，覆盖四类 intent |

## 3. 四条链路数据流

### 3.1 AI 对话

```text
/api/chat
→ chat_service 组装 AgentState
→ run_agent
→ StateGraph
→ intent_detect_node
→ chat_response_node
→ call_llm
→ 如果模型不可用则使用 mock fallback
→ memory_update_node
→ 返回 reply / follow_up_questions
```

### 3.2 拍照讲解

```text
/api/photos/explain
→ photo_service 组装 image_info
→ run_agent
→ StateGraph
→ photo_explain_node
→ vision_tool + ocr_tool
→ memory_update_node
→ 返回 recognition_result / explanation / follow_up_questions
```

### 3.3 智能提醒

```text
/api/reminders/check
→ reminder_service 组装 current_time 和 current_location
→ run_agent
→ StateGraph
→ reminder_node
→ reminder_tool
→ memory_update_node
→ 返回 has_risk / reminder
```

### 3.4 动态改线

```text
/api/trips/{trip_id}/replan
→ replan_service 组装用户请求和位置
→ run_agent
→ StateGraph
→ replan_node
→ map_tool + weather_tool
→ memory_update_node
→ 返回 draft_id / summary / reason / new_items / removed_item_ids
```

## 4. Mock 策略

当前 mock 策略强调演示稳定：

- `vision_tool` 根据图片文件名 mock 识别“渔人码头”或“星海广场”。
- `map_tool` 固定返回“距离下一个景点约 40 分钟路程”。
- `weather_tool` 固定返回“大连多云，适合出行”。
- `reminder_tool` 根据时间生成出发提醒或时间冲突提醒。
- `replan_node` 固定生成“附近咖啡馆休息”的轻松版方案。

这样即使没有网络、没有 API Key，也可以跑通复赛演示闭环。

## 5. Fallback 策略

`run_agent` 内部捕获异常，并返回兜底响应：

```json
{
  "intent": "chat",
  "reply": "导友暂时没能生成完整回复，但我会继续帮你看行程和时间安排。",
  "structured_data": {},
  "follow_up_questions": []
}
```

各 service 层保持原有字段结构，避免影响前端 Mock 和接口文档。

## 6. 文本大模型接入

当前只把文本大模型接入 AI 对话链路，不影响拍照讲解、智能提醒和动态改线的 mock 行为。

### 6.1 配置方式

后端从 `DaoYou/.env` 读取配置。OpenAI-compatible 服务使用以下配置：

```text
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=你的真实 API Key
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT_SECONDS=20
```

`LLM_BASE_URL` 采用 OpenAI-compatible 格式，因此后续可以替换为 DeepSeek、通义千问、智谱、火山等兼容服务地址。不要把真实 `LLM_API_KEY` 提交到 Git 仓库。

如果接入 vivo 蓝心大模型，使用以下配置：

```text
LLM_PROVIDER=vivo
VIVO_APP_ID=你的 app_id
VIVO_APP_KEY=你的 app_key
VIVO_BASE_URL=https://api-ai.vivo.com.cn
VIVO_COMPLETIONS_URI=/vivogpt/completions
VIVO_MODEL=vivo-BlueLM-TB
LLM_TIMEOUT_SECONDS=20
```

`VIVO_COMPLETIONS_URI` 和 `VIVO_MODEL` 已做成环境变量。如果赛事平台文档里的接口路径或模型名发生变化，只需要改 `.env`，不用改 Agent 节点代码。

### 6.2 调用流程

```text
chat_response_node
→ 读取 current_trip / user_preferences / chat_history / user_message
→ 使用 CHAT_PROMPT 构造 messages
→ call_llm(messages)
→ 模型返回 JSON 则读取 reply 和 follow_up_questions
→ 模型未配置、超时、异常或返回空，则使用原 mock 回复
```

`backend/app/agent/llm.py` 是成员 C 后续维护的大模型统一入口。其他节点后续接模型时，也应该复用 `call_llm()`，不要在各个 node 里重复写 HTTP 请求逻辑。

### 6.3 vivo 蓝心大模型接入说明

当前代码已经完成 vivo provider 的程序侧接入：

- `LLM_PROVIDER=vivo` 时，`call_llm()` 会走 vivo 蓝心大模型分支。
- 请求会带 `requestId` query 参数。
- body 会包含 `prompt`、`model`、`sessionId`、`extra.temperature`。
- 响应成功时读取 `data.content` 作为模型回复。
- 鉴权请求头会包含 `X-AI-GATEWAY-APP-ID`、`X-AI-GATEWAY-TIMESTAMP`、`X-AI-GATEWAY-NONCE`、`X-AI-GATEWAY-SIGNED-HEADERS`、`X-AI-GATEWAY-SIGNATURE`。

我无法替你完成的事情：

1. 登录 vivo 或赛事平台申请应用。
2. 获取真实 `APP_ID` 和 `APP_KEY`。
3. 确认你的账号是否已经开通蓝心大模型调用权限、白名单和额度。
4. 确认赛事文档中的最新模型名和接口路径是否仍为 `/vivogpt/completions`、`vivo-BlueLM-TB`。
5. 在有网络和可用额度的环境里做真实接口调用验证。

你需要自己操作：

1. 打开赛事或 vivo 蓝心大模型平台文档。
2. 创建或选择应用，拿到 `APP_ID` 和 `APP_KEY`。
3. 在 `D:\学习文件\AIGC创新赛\DaoYou\.env` 写入 vivo 配置。
4. 不要把 `.env` 或真实密钥提交到 Git。
5. 重新运行 chat 手动测试，观察 `reply` 是否变成真实模型生成内容。

### 6.4 Fallback 原则

文本大模型接入后，Agent 仍然必须满足一个要求：

> 没有 API Key、没有网络、模型超时或模型返回异常时，Demo 仍然能跑通。

因此 chat 节点现在是“真实 LLM 优先，mock fallback 兜底”。这样既能在配置模型时展示真实生成能力，也能在比赛现场避免外部服务波动导致演示中断。

## 7. 手动测试方式与固定输出结果

成员 C 可以不启动前端，也不接真实大模型，直接在 PowerShell 里调用 `run_agent()` 验证 Agent 四条链路。

先进入后端目录：

```powershell
cd D:\学习文件\AIGC创新赛\DaoYou\backend
```

### 7.1 测试 AI 对话链路

运行：

```powershell
uv run python -c "from app.agent.graph import run_agent; print(run_agent({'user_id':1,'trip_id':1,'user_message':'今天下午怎么安排比较轻松？','intent_hint':'chat'}))"
```

未配置 `LLM_API_KEY` 时，预期能看到 `intent` 为 `chat`，并返回慢节奏 mock 旅行建议：

```python
{
  'intent': 'chat',
  'reply': '这次旅行我建议按慢节奏走。下午不要排太满，可以保留一个重点景点，再安排一段休息。',
  'structured_data': {},
  'follow_up_questions': [
    '要不要帮你把下午改轻松一点？',
    '需要我推荐附近适合休息的地方吗？'
  ]
}
```

配置 `LLM_API_KEY` 后，`reply` 会优先使用真实大模型生成，但返回字段仍保持 `intent / reply / structured_data / follow_up_questions` 不变。

### 7.2 测试拍照讲解链路

运行：

```powershell
uv run python -c "from app.agent.graph import run_agent; print(run_agent({'user_id':1,'trip_id':1,'intent_hint':'photo_explain','image_info':{'image_path':'uploads/images/yurenmatou.jpg','filename':'yurenmatou.jpg'}}))"
```

预期能看到 `intent` 为 `photo_explain`，并返回“大连渔人码头”的 mock 识别和讲解结果：

```python
{
  'intent': 'photo_explain',
  'reply': '你上传的图片可能是大连渔人码头。这里适合慢节奏散步和拍照，可以重点观察海港空间、建筑立面和步道之间的层次。',
  'structured_data': {
    'recognition_result': '图片可能是大连渔人码头，包含港湾、欧式建筑和海边步道。',
    'explanation': '你上传的图片可能是大连渔人码头。这里适合慢节奏散步和拍照，可以重点观察海港空间、建筑立面和步道之间的层次。',
    'ocr_text': ''
  },
  'follow_up_questions': [
    '这里怎么拍照好看？',
    '附近适合休息的地方有哪些？',
    '可以讲一个儿童版介绍吗？'
  ]
}
```

如果把文件名改成 `xinghai.jpg` 或包含 `星海`，`vision_tool` 会返回“星海广场”的 mock 识别结果。

### 7.3 测试智能提醒链路

运行：

```powershell
uv run python -c "from app.agent.graph import run_agent; print(run_agent({'user_id':1,'trip_id':1,'intent_hint':'reminder','current_time':'2026-07-01T13:30:00'}))"
```

预期能看到 `intent` 为 `reminder`，并因为时间在下午触发“行程节奏偏紧”的提醒：

```python
{
  'intent': 'reminder',
  'reply': '下午行程节奏偏紧，建议减少一个远距离景点，给休息和交通留出缓冲。',
  'structured_data': {
    'has_risk': True,
    'reminder': {
      'id': 1,
      'type': 'conflict',
      'content': '下午行程节奏偏紧，建议减少一个远距离景点，给休息和交通留出缓冲。',
      'status': 'unread'
    }
  },
  'follow_up_questions': []
}
```

### 7.4 测试动态改线链路

运行：

```powershell
uv run python -c "from app.agent.graph import run_agent; print(run_agent({'user_id':1,'trip_id':1,'user_message':'我有点累，不想去下一个景点了，帮我换一个轻松点的安排','intent_hint':'replan','current_location':{'latitude':38.9,'longitude':121.6}}))"
```

预期能看到 `intent` 为 `replan`，并返回 `draft_001` 和“附近咖啡馆休息”的改线方案：

```python
{
  'intent': 'replan',
  'reply': '我建议把较远的户外景点换成附近咖啡馆休息，再保留傍晚海边散步。',
  'structured_data': {
    'draft_id': 'draft_001',
    'summary': '建议取消较远的户外景点，改为附近咖啡馆休息。',
    'reason': '用户当前偏好慢节奏和少步行，原计划下午路线较远。',
    'new_items': [
      {
        'title': '附近咖啡馆休息',
        'item_type': 'rest',
        'start_time': '14:30',
        'end_time': '15:30',
        'address': '渔人码头附近',
        'notes': '减少步行，适合恢复体力'
      }
    ],
    'removed_item_ids': [3]
  },
  'follow_up_questions': [
    '要应用这个改线方案吗？',
    '要不要换成室内博物馆方案？'
  ]
}
```

### 7.5 手动测试和 pytest 的区别

手动测试和 `uv run pytest` 都会覆盖 `run_agent()` 这条核心链路，但用途不同：

- 手动测试适合成员 C 观察 Agent 的完整输出，方便理解数据结构和给队友演示。
- `uv run pytest` 适合自动检查固定断言，确认代码改动后四条链路没有被破坏。
- 手动测试可以临时改输入内容；pytest 只测试 `backend/tests/` 里提前写好的固定场景。

如果只是确认当前代码整体正常，可以运行：

```powershell
uv run pytest
```

当前预期结果是：

```text
5 passed
```

## 8. 后续升级路径

当前实现已经新增 `langgraph` 依赖，并使用 `StateGraph` 完成 Demo 编排；同时 chat 文本链路已经具备 OpenAI-compatible LLM 接入能力。后续可按以下顺序增强：

1. 将 replan 文本生成接入真实 LLM，并要求模型输出固定 JSON。
2. 将 photo explanation 的讲解文案接入真实 LLM，图片识别仍可先保留 mock。
3. 将 `vision_tool` 和 `ocr_tool` 接入真实多模态/OCR API。
4. 将 `map_tool` 和 `weather_tool` 接入真实地图和天气 API。
5. 保留 mock fallback，确保演示现场不受外部服务影响。

## 9. 阶段三：动态改线 Replan 接入大模型

本阶段只处理动态改线链路，不重写前面已经完成的 LangGraph Demo、Chat 大模型接入和 vivo provider 接入。

### 9.1 本阶段目标

让用户说“我有点累，不想去下一个景点了”时，`replan_node` 可以优先调用已配置的大模型生成改线草案。

本阶段完成的是：

- 继续复用 `call_llm()`，不在 `replan_node` 里直接写 DeepSeek、OpenAI 或 vivo 专属请求。
- 使用 `REPLAN_PROMPT` 约束模型输出固定 JSON。
- 模型输出合法时，使用模型生成的 `draft_id`、`summary`、`reason`、`new_items`、`removed_item_ids`。
- 模型不可用、返回空、返回非 JSON 或缺少关键字段时，继续使用原来的 `draft_001` mock 改线方案。

本阶段不做的是：

- 不接真实地图 API。
- 不接真实天气 API。
- 不把改线方案直接写入数据库。
- 不修改前端和 API 返回字段。

### 9.2 本阶段涉及文件

| 文件 | 本阶段改动 |
| --- | --- |
| `backend/app/agent/nodes.py` | `replan_node` 接入 LLM，并新增 replan JSON 校验与 mock fallback |
| `backend/app/agent/prompts.py` | 继续复用已有 `REPLAN_PROMPT` |
| `backend/tests/test_agent_graph.py` | 新增 replan LLM 成功路径和异常 fallback 测试 |
| `docs/agent实现思路与内容.md` | 追加本阶段说明 |

### 9.3 Replan 当前数据流

```text
用户提出改线请求
→ run_agent
→ intent_detect_node
→ replan_node
→ trip_tool / memory_tool / map_tool / weather_tool
→ 使用 REPLAN_PROMPT 调用 call_llm
→ 模型返回合法 JSON
→ 返回模型生成的改线草案
```

如果模型不可用或返回格式不合格：

```text
replan_node
→ call_llm 返回 None 或无法解析
→ _mock_replan_payload
→ 返回 draft_001 和“附近咖啡馆休息”方案
```

### 9.4 模型输出格式要求

模型必须返回 JSON，字段如下：

```json
{
  "draft_id": "draft_llm_001",
  "summary": "模型生成的改线摘要",
  "reason": "模型生成的调整原因",
  "new_items": [
    {
      "title": "新的行程项",
      "item_type": "rest",
      "start_time": "14:30",
      "end_time": "15:30",
      "address": "地点地址",
      "notes": "推荐理由"
    }
  ],
  "removed_item_ids": [3]
}
```

当前代码会检查这些关键字段类型：

- `draft_id` 必须是字符串。
- `summary` 必须是字符串。
- `reason` 必须是字符串。
- `new_items` 必须是列表。
- `removed_item_ids` 必须是列表。

只要校验失败，就不用模型结果，自动回退 mock 草案。

### 9.5 手动测试方式

进入后端目录：

```powershell
cd D:\学习文件\AIGC创新赛\DaoYou\backend
```

运行：

```powershell
uv run python -c "from app.agent.graph import run_agent; print(run_agent({'user_id':1,'trip_id':1,'user_message':'我有点累，不想去下一个景点了，帮我换一个轻松点的安排','intent_hint':'replan','current_location':{'latitude':38.9,'longitude':121.6}}))"
```

如果没有配置模型，预期仍然返回：

```python
{
  'intent': 'replan',
  'structured_data': {
    'draft_id': 'draft_001',
    'summary': '建议取消较远的户外景点，改为附近咖啡馆休息。',
    'new_items': [
      {
        'title': '附近咖啡馆休息'
      }
    ],
    'removed_item_ids': [3]
  }
}
```

如果已经在 `DaoYou/.env` 配置 DeepSeek 或 vivo 蓝心，`summary`、`reason`、`new_items` 有机会变成模型动态生成内容，但字段结构保持不变。

### 9.6 本阶段自测

本阶段新增两类自动化测试：

- 模型返回合法 JSON 时，replan 使用模型草案。
- 模型返回非 JSON 时，replan 回退到 `draft_001`。

运行：

```powershell
uv run pytest
uv run ruff check .
```

### 9.7 后续仍未完成

动态改线目前还不是完整最终版，后续还需要：

1. 接真实地图 POI 和路线 API，让 `map_tool` 不再返回固定咖啡馆。
2. 让模型生成的 `new_items` 更严格兼容前端字段。
3. 用户点击确认后，通过 `apply_replan_draft` 真正更新 `trip_items`。
4. 将改线原因和用户偏好沉淀到长期记忆。

### 9.8 本阶段问题修复：模型输出格式容错

手动测试时发现：DeepSeek API 已经能正常调用，`call_llm()` 可以返回文本，但 replan 仍然可能回退到 `draft_001`。原因不是 API 配置错误，而是动态改线需要结构化 JSON，模型有时会返回自然语言、Markdown 代码块或带前后解释的 JSON。

例如模型可能返回：

```text
好的，方案如下：
{
  "draft_id": "draft_llm_001",
  "summary": "建议改去附近茶馆休息。",
  "reason": "用户表达疲惫，希望减少步行。",
  "new_items": [],
  "removed_item_ids": [3]
}
```

也可能返回：

````text
```json
{
  "draft_id": "draft_llm_001",
  "summary": "建议改去附近茶馆休息。",
  "reason": "用户表达疲惫，希望减少步行。",
  "new_items": [],
  "removed_item_ids": [3]
}
```
````

这些内容人可以读懂，但 `json.loads()` 不能直接解析，因此系统会认为模型结果不可用并回退 mock。

本次修复做了两件事：

1. 强化 `REPLAN_PROMPT`，要求模型只输出 JSON 对象，不要输出解释文字或 Markdown 代码块。
2. 在 `nodes.py` 中新增 JSON 提取容错逻辑，支持解析纯 JSON、```json 代码块，以及“方案如下：{...}”这类带前后文字的返回。

判断 replan 是否真正走模型，可以看输出：

- 如果 `draft_id` 仍是 `draft_001`，说明这次走了 mock fallback。
- 如果 `draft_id` 变成模型生成的值，或 `summary`、`reason`、`new_items` 明显不是固定咖啡馆方案，说明模型结果已经被成功解析并使用。

需要注意：如果模型完全不返回 JSON，而是只返回一段自然语言建议，系统仍会回退 `draft_001`。这是为了保证后续“应用改线方案”时，前端和后端能拿到稳定结构化字段。

## 10. 阶段四：拍照讲解 Photo Explain 接入大模型

本阶段只处理拍照讲解链路，不接真实图片识别 API，也不接真实 OCR API。当前 `vision_tool` 和 `ocr_tool` 仍然是 mock 工具，LLM 负责基于 mock 识别结果生成更自然的景点讲解。

### 10.1 本阶段目标

让用户上传图片后，`photo_explain_node` 可以优先调用已配置的大模型生成讲解文案，提升演示中的 AIGC 感。

本阶段完成的是：

- 继续调用 `vision_tool(image_info)` 得到 mock 景点识别结果。
- 继续调用 `ocr_tool(image_info)` 得到 mock OCR 结果。
- 使用 `PHOTO_EXPLAIN_PROMPT` 调用 `call_llm()`。
- 模型返回合法 JSON 时，使用模型生成的 `recognition_result`、`explanation`、`follow_up_questions`。
- 模型不可用、返回空、返回非 JSON 或缺少关键字段时，继续使用原来的 mock 讲解。

本阶段不做的是：

- 不上传真实图片给多模态模型。
- 不接第三方 OCR。
- 不修改图片上传接口。
- 不修改前端展示字段。

### 10.2 本阶段涉及文件

| 文件 | 本阶段改动 |
| --- | --- |
| `backend/app/agent/prompts.py` | 强化 `PHOTO_EXPLAIN_PROMPT`，要求模型输出固定 JSON |
| `backend/app/agent/nodes.py` | `photo_explain_node` 接入 LLM，并保留 mock fallback |
| `backend/tests/test_agent_graph.py` | 新增 photo LLM 成功、Markdown JSON 和 fallback 测试 |
| `docs/agent实现思路与内容.md` | 追加本阶段说明 |

### 10.3 Photo Explain 当前数据流

```text
用户上传图片
→ photo_service 组装 image_info
→ run_agent
→ intent_detect_node
→ photo_explain_node
→ vision_tool / ocr_tool
→ 使用 PHOTO_EXPLAIN_PROMPT 调用 call_llm
→ 模型返回合法 JSON
→ 返回模型生成的讲解文案
```

如果模型不可用或返回格式不合格：

```text
photo_explain_node
→ call_llm 返回 None 或无法解析
→ _mock_photo_explanation_payload
→ 返回原来的“大连渔人码头”或“星海广场”mock 讲解
```

### 10.4 模型输出格式要求

模型必须返回 JSON，字段如下：

```json
{
  "recognition_result": "图片可能是大连渔人码头，包含港湾、欧式建筑和海边步道。",
  "explanation": "这里适合慢节奏散步和拍照，可以重点观察海港空间、建筑立面和步道之间的层次。",
  "follow_up_questions": [
    "这里怎么拍照好看？",
    "附近适合休息的地方有哪些？"
  ]
}
```

当前代码会检查：

- `recognition_result` 必须是字符串。
- `explanation` 必须是字符串。
- `follow_up_questions` 必须是列表。

只要校验失败，就不用模型结果，自动回退 mock 讲解。

### 10.5 手动测试方式

进入后端目录：

```powershell
cd D:\学习文件\AIGC创新赛\DaoYou\backend
```

运行：

```powershell
uv run python -c "from app.agent.graph import run_agent; print(run_agent({'user_id':1,'trip_id':1,'intent_hint':'photo_explain','image_info':{'image_path':'uploads/images/yurenmatou.jpg','filename':'yurenmatou.jpg'}}))"
```

如果没有配置模型，预期仍然返回 mock 讲解：

```python
{
  'intent': 'photo_explain',
  'structured_data': {
    'recognition_result': '图片可能是大连渔人码头，包含港湾、欧式建筑和海边步道。',
    'explanation': '你上传的图片可能是大连渔人码头。这里适合慢节奏散步和拍照...'
  }
}
```

如果已经在 `DaoYou/.env` 配置 DeepSeek 或 vivo 蓝心，`explanation` 有机会变成模型动态生成内容，但字段结构保持不变。

### 10.6 本阶段自测

本阶段新增三类自动化测试：

- 模型返回合法 JSON 时，photo 使用模型讲解。
- 模型返回 Markdown JSON 时，photo 能解析并使用模型讲解。
- 模型返回非 JSON 时，photo 回退 mock 讲解。

运行：

```powershell
uv run pytest
uv run ruff check .
```

### 10.7 后续仍未完成

拍照讲解目前还不是完整最终版，后续还需要：

1. 将真实图片文件传给多模态模型，替代 `vision_tool` 的文件名 mock 识别。
2. 接真实 OCR，识别说明牌、门票、攻略截图中的文字。
3. 将讲解记录保存到 `photo_records`。
4. 支持基于当前景点的多轮追问。

## 11. 基于 0614 文档的 Agent 负责人工作清单

本节根据 `技术设计文档0614.md` 和 `团队开发协作与项目管理文档0614.md` 重新整理成员 C / Agent 负责人需要做的事。当前内容以 0614 文档中的职责、接口和协作安排为依据，暂不处理前文与真实代码实现之间可能存在的差异。

### 11.1 职责定位

成员 C 是 Agent 与 AI 能力负责人，主要负责 `backend/app/agent/` 下的 LangGraph Agent、Prompt、工具封装和 AI 能力接入。Agent 不是单纯问答函数，而是导友的智能编排层，需要把行程上下文、用户偏好、当前位置、图片信息、地图和天气等工具结果组织起来，再生成前端和后端服务层可以消费的稳定输出。

核心职责包括：

- 搭建并维护 LangGraph 工作流，保证一次请求中的状态流转清晰可测。
- 设计 Agent State，承载单次请求内的临时状态、工具结果、意图和最终响应。
- 实现聊天、拍照讲解、智能提醒、动态改线等业务节点。
- 维护 Prompt 模板，约束大模型输出内容和结构。
- 封装或接入大模型、图片理解、OCR、地图、天气等工具能力。
- 准备模型不可用、外部 API 异常或响应超时时的 fallback 内容，保证复赛 Demo 稳定。

Agent 的长期权威数据不直接写死在 LangGraph State 中。行程、偏好、聊天记录、照片记录、提醒记录等长期数据以 PostgreSQL 和后端 service 为准；State 只负责单次 Agent 调用中的临时编排。

### 11.2 Agent 模块建设任务

按照 0614 技术设计，`backend/app/agent/` 至少需要维护以下文件和职责：

| 文件 | Agent 负责人需要完成的事 |
| --- | --- |
| `graph.py` | 定义 LangGraph 图结构、节点连接、条件分支和统一入口，保证 chat、photo、reminder、replan 都能从同一 Agent 流程进入。 |
| `state.py` | 定义 `AgentState` 字段，包括 `user_id`、`trip_id`、`user_message`、`current_trip`、`current_location`、`user_preferences`、`chat_history`、`image_info`、`tool_results`、`intent`、`final_response`。 |
| `nodes.py` | 实现业务节点，包括上下文读取、意图识别、普通对话、拍照讲解、智能提醒、动态改线和记忆更新。 |
| `tools.py` | 封装工具调用，包括 `trip_tool`、`map_tool`、`weather_tool`、`vision_tool`、`ocr_tool`、`memory_tool`、`reminder_tool`。 |
| `prompts.py` | 保存聊天、拍照讲解、提醒、改线等 Prompt，明确模型角色、输入上下文和输出格式要求。 |

建设时要优先保证接口稳定和节点可测试。Prompt 和工具可以先用 mock 或固定演示数据兜底，但返回结构必须和 API 文档约定保持一致，方便成员 A、B、D 并行联调。

### 11.3 四条核心能力

**AI 对话**

输入来自 `POST /api/chat`，包括 `user_id`、`trip_id`、`message` 和可选 `current_location`。Agent 需要读取当前行程、用户偏好和聊天历史，识别普通聊天意图后生成旅游陪伴式回复，并返回 `reply`、`intent`、`action_options`、`follow_up_questions` 等字段。普通聊天场景下，`action_options` 按 0614 文档应为空数组。

**拍照讲解**

输入来自 `POST /api/photos/explain`，包括上传图片、本地图片路径、用户和行程信息，以及可选当前位置。Agent 需要结合图片理解结果、OCR 文本、当前行程和用户偏好生成景点讲解，输出 `recognition_result`、`explanation` 和 `follow_up_questions`，供拍照讲解页展示。

**智能提醒**

输入来自 `POST /api/reminders/check`，包括用户、当前时间和当前位置。Agent 需要结合行程、位置、天气或路线信息检查出发风险、时间冲突、闭馆风险和休息风险，输出 `has_risk` 与 `reminder`。如果位置超过 30 分钟或外部工具不可用，应安全降级，避免生成误导性精确路线提醒。

**对话内动态改线**

动态改线按 0614 文档复用 `POST /api/chat`，不提供独立 `/replan` 或 `/apply-plan` 接口。Agent 识别到 `intent = "replan"` 后，需要读取当前行程、用户偏好、当前位置和地图工具结果，生成可执行的 `action_options`。每个选项应包含 `operation = "update_trip_item"`、目标 `item_id` 和可直接提交给 `PUT /api/trip-items/{item_id}` 的 `payload`。Chat 流程只生成选项，不直接修改数据库；用户确认后由调用方补充 `user_id` 并调用行程节点更新接口。

### 11.4 与其他成员协作边界

| 协作对象 | Agent 负责人需要对齐的内容 |
| --- | --- |
| 成员 A 前端 | 对齐聊天页、拍照讲解页、提醒展示和动态改线选项交互需要的字段；涉及 `reply`、`follow_up_questions`、`recognition_result`、`reminder`、`action_options` 等展示结构时要提前同步。 |
| 成员 B 后端 API | 对齐 Agent 输入输出和 service 层调用方式；Agent PR 由成员 C 自查，成员 B 重点确认接口输入输出是否兼容。 |
| 成员 D 数据库与测试 | 对齐演示数据、测试图片、位置数据、过期位置、提醒风险数据和 Agent 上下文需要的数据库字段；如果 Agent 需要新增字段，应先说明需求，由成员 D 统一处理迁移。 |
| 全体成员 | 涉及 API 字段变化、动态改线返回结构变化、数据库字段变化时必须同步，避免前端、后端、Agent 和测试在联调阶段集中冲突。 |

Agent 负责人不直接主导数据库迁移，也不直接替前端设计页面交互。需要新增上下文字段、工具结果或响应字段时，应先和成员 B、D 确认数据来源，再和成员 A 确认展示方式。

### 11.5 阶段性交付

| 阶段 | 成员 C 需要完成的事 | 验收标准 |
| --- | --- | --- |
| 第 1 阶段：项目骨架 | 初始化 LangGraph Demo，完成固定输入输出的 Agent 节点。 | Agent Demo 可返回固定回复，后端基础服务可启动。 |
| 第 2 阶段：行程管理 | 实现 Agent 读取当前 trip 上下文的方法，为后续聊天、提醒和改线准备数据输入。 | Agent 可以读取当前 trip 上下文。 |
| 第 3 阶段：AI 对话与拍照讲解 | 实现 chat node、photo explain node、Prompt 和 LLM 调用。 | 用户可发送消息并获得 AI 回复；上传图片后能生成讲解并在前端展示。 |
| 第 4 阶段：智能提醒与动态改线 | 实现 reminder node、Chat 内改线意图分支、地图工具封装、提醒 Prompt 和改线 Prompt。 | 点击检查风险后生成提醒；用户提出改线需求后，Chat 返回合法 `action_options`；用户确认后可通过行程节点接口更新行程。 |
| 第 5 阶段：联调与演示 | 优化 Prompt，准备 AI fallback 内容，配合成员 A、B、D 完成演示链路排查。 | 核心演示流程完整跑通，大模型失败时不影响录制。 |

### 11.6 当前需要优先对齐的问题

0614 技术设计文档要求动态改线在 Chat 响应中返回 `action_options`，并由前端在用户确认后调用 `PUT /api/trip-items/{item_id}` 更新行程。当前 `agent实现思路与内容.md` 前文和真实代码实现可能已经出现 `structured_data` 草案式返回，两者语义和落地方式不同，后续必须择一对齐。

优先需要确认和处理的问题：

1. 动态改线最终对外字段到底以 `action_options` 还是 `structured_data` 为准。
2. 如果采用 `action_options`，Agent 需要保证每个选项都能直接映射到行程节点更新接口的 `item_id` 和 `payload`。
3. 如果采用 `structured_data` 草案，技术设计文档、前端交互、后端 service 和测试用例都需要同步修改。
4. 普通聊天、拍照讲解、智能提醒和动态改线的返回字段要形成统一 API 合同，避免前端按旧字段开发、Agent 按新字段返回。
5. 所有真实大模型、地图、图片理解、OCR 和天气能力都必须保留 fallback，保证比赛现场网络或额度异常时仍可演示。

在未完成这次对齐前，Agent 负责人新增功能时应尽量避免继续扩大返回结构差异，优先把 0614 文档要求、当前代码实现和前端展示需求三者统一起来。

## 12. 从当前代码到完整 Agent 负责人实现的分步骤规划

本章结合 `技术设计文档0614.md`、`团队开发协作与项目管理文档0614.md`、`API接口文档0614.md` 和当前 `DaoYou/backend` 代码状态，整理成员 C 从现有实现继续补齐完整 Agent 负责人工作的实施路径。本章只规划后续实现顺序，不代表当前代码已经全部完成。

### 12.1 当前代码状态

当前 Agent 已经具备 MVP 雏形：

- `backend/app/agent/graph.py` 已使用 LangGraph `StateGraph` 串起 `intent_detect`、chat、photo、reminder、replan 和 `memory_update` 节点。
- `run_agent(state)` 已作为 service 层调用 Agent 的统一入口，并提供基础 fallback。
- `backend/app/agent/nodes.py` 已有 AI 对话、拍照讲解、智能提醒、动态改线四类节点。
- `backend/app/agent/llm.py` 已提供大模型统一适配层，支持 OpenAI-compatible 和 vivo 蓝心大模型配置。
- `backend/app/agent/tools.py` 已有 mock 版行程、偏好、图片识别、OCR、地图、天气和提醒工具。
- `photo_service` 和 `reminder_service` 已经把图片讲解、提醒检查接入 Agent。
- `chat_service` 已经保存用户消息、读取偏好和聊天历史，并调用 `run_agent()` 生成回复。

当前主要差距集中在 API 合同、上下文完整性和工具真实化：

- `/api/chat` 的动态改线按 API 0614 应返回 `action_options`，但当前 replan 节点主要返回 `structured_data` 草案。
- 当前验证发现：运行 `uv run pytest tests/test_api_contract.py tests/test_agent_graph.py` 时，`test_chat_replan_returns_action_options` 失败，原因是 replan 返回的 `action_options` 为空数组。
- `chat_service` 当前没有把 `trip_id` 和真实 `current_trip` 注入 Agent，动态改线只能依赖 mock trip。
- 拍照讲解、地图、天气、OCR 仍以 mock 为主，适合演示兜底，但还不是完整真实能力。
- `memory_update_node` 仍是占位，尚未把聊天偏好或用户记忆沉淀到长期数据。

### 12.2 第一优先级：对齐 API 合同

成员 C 首先要把 Agent 输出对齐 `API接口文档0614.md`，尤其是 `/api/chat` 的输出结构。

对齐目标：

- 普通聊天返回：

```json
{
  "intent": "chat",
  "reply": "给用户展示的自然语言回复",
  "action_options": [],
  "follow_up_questions": []
}
```

- 动态改线返回 `intent = "replan"`，并返回非空 `action_options`。
- 每个 action option 必须包含 `option_id`、`label`、`description`、`operation`、`item_id`、`payload`。
- `operation` 当前固定为 `update_trip_item`。
- `payload` 必须能直接提交给 `PUT /api/trip-items/{item_id}`，且不包含 `user_id`。
- Chat 流程只生成选项，不直接修改 `trip_items`；用户确认后由前端补充 `user_id` 并调用行程节点更新接口。

实现策略建议：

1. 保留 `structured_data` 给 photo、reminder 或 Agent 内部调试使用，但 `/api/chat` 对外合同优先满足 `action_options`。
2. 在 replan 节点中把 LLM 或 mock 生成的草案转换为 `AgentActionOption` 列表。
3. 如果模型无法生成可靠选项，则返回自然语言建议，并将 `action_options` 置为空数组。
4. 如果后端选择严格处理结构错误，可以按 API 文档返回 `5003 Agent 输出解析失败`；如果选择演示稳定优先，则降级为空 `action_options` 的自然语言建议。

本阶段完成后，至少要让 `test_chat_replan_returns_action_options` 通过。

### 12.3 第二优先级：补齐 Agent 输入上下文

Agent 输出质量取决于 service 层传入的上下文。成员 C 需要和成员 B 对齐 service 层如何组装 AgentState。

需要补齐的输入：

| 链路 | 当前问题 | 后续目标 |
| --- | --- | --- |
| Chat | 已传用户消息、偏好、历史和位置，但未传 `trip_id` 与真实 `current_trip`。 | `chat_service` 根据 `trip_id` 读取真实行程详情，并传入 Agent。 |
| Replan | 依赖 mock trip，目标 `item_id` 可能和真实行程不一致。 | 使用真实 current trip 找到要替换或跳过的行程节点。 |
| Photo | 已传图片路径、文件名、content type 和偏好。 | 后续补充 `trip_id` 和当前行程上下文，便于讲解结合当前位置和行程。 |
| Reminder | 已传 current time、location 和 trip detail。 | 保持 30 分钟位置有效性规则，并把天气、路线风险作为工具结果输入。 |

本阶段要遵循一个原则：Agent State 只承载单次请求临时状态，长期权威数据仍由 PostgreSQL、service 层和数据库模型负责。

### 12.4 第三优先级：完善四条核心链路

**AI 对话**

- 继续复用 `call_llm()`，不要在节点中散写不同厂商 HTTP 请求。
- Prompt 需要稳定输出 `reply` 和 `follow_up_questions`。
- 模型不可用或返回非 JSON 时，保留自然语言 fallback。
- 普通聊天的 `action_options` 必须固定为空数组。

**拍照讲解**

- 当前可继续使用 `vision_tool` 和 `ocr_tool` 的 mock 结果作为输入。
- 后续把 `PHOTO_EXPLAIN_PROMPT` 输出收敛为 `recognition_result`、`explanation`、`follow_up_questions`。
- 真实多模态 API 未接入前，必须保证上传图片后仍能生成可展示讲解。
- `photo_service` 保存 `photo_records` 时使用 Agent 输出的识别结果和讲解文案。

**智能提醒**

- reminder 节点继续输出 `has_risk` 和 `reminder`。
- 提醒类型保持 API 文档约定：`departure`、`conflict`、`weather`、`rest`。
- 请求携带位置时优先使用请求位置；未携带时使用用户 30 分钟内最新位置；过期位置要安全降级。
- 地图或天气不可用时，不生成过度精确的路程判断。

**对话内动态改线**

- 动态改线是最需要优先修正的链路。
- replan 节点要根据真实行程、用户偏好、当前位置和地图工具结果生成 `action_options`。
- LLM 输出可以先生成草案，但进入最终响应前必须转换成 API 0614 的 `AgentActionOption`。
- 至少提供两个演示可用选项：改为附近休息点、跳过下一站。
- 每个选项的 `item_id` 必须来自真实 current trip 或明确 fallback 目标，不能和前端要更新的行程节点脱节。

### 12.5 第四优先级：工具真实化与 fallback

工具真实化应分阶段推进，不要一次性替换所有 mock。

推荐顺序：

1. 先把 `trip_tool` 和 `memory_tool` 从默认 mock 改成优先使用 service 注入的真实上下文。
2. 再接地图 POI 和路线估算，用于提醒和动态改线。
3. 再接天气 API，用于天气风险提醒和改线理由。
4. 再接多模态图片理解，让拍照讲解不再只靠文件名判断景点。
5. 最后接 OCR，用于攻略截图、说明牌和门票文字识别。

每接入一个真实工具，都必须保留本地 fallback：

- 外部 API 超时，返回固定演示数据。
- 外部 API 报错，记录错误类型但不记录 API key、token、Cookie。
- 返回结构不符合预期，降级到 mock 工具结果。
- 演示环境无网络时，四条核心链路仍能跑通。

### 12.6 第五优先级：测试与验收

成员 C 后续至少维护四类测试。

| 测试类型 | 重点场景 |
| --- | --- |
| Agent 单测 | `run_agent()` 对 chat、photo、reminder、replan 的输出结构稳定。 |
| API 合同测试 | `/api/chat` 的 replan 返回非空 `action_options`，并符合 `AgentActionOption` 字段约定。 |
| Service 集成测试 | chat/photo/reminder service 能正确组装 AgentState，并把 Agent 输出映射成 API 响应。 |
| Fallback 测试 | LLM、地图、天气、图片理解或 OCR 失败时，仍返回可演示内容。 |

建议每次修改 Agent 后运行：

```powershell
cd D:\学习文件\AIGC创新赛\DaoYou\backend
uv run pytest tests/test_agent_graph.py
uv run pytest tests/test_api_contract.py
```

涉及 service 或数据库上下文时，再运行：

```powershell
uv run pytest tests/test_chat_service_db.py tests/test_photo_service_db.py tests/test_reminder_location_db.py
```

关键手动验收：

- 普通聊天：用户发送“下午怎么安排比较轻松”，返回 `intent = "chat"` 和空 `action_options`。
- 动态改线：用户发送“我累了，不想去下一个景点”，返回 `intent = "replan"` 和可执行 `action_options`。
- 拍照讲解：上传图片后返回 `recognition_result`、`explanation`、`follow_up_questions`。
- 智能提醒：传入当前时间和位置后返回 `has_risk` 与 `reminder`，过期位置不会生成误导性精确提醒。

### 12.7 推荐实施顺序

1. **修正 `/api/chat` replan 输出合同**：让 replan 节点返回 `action_options`，并保证普通 chat 返回空数组。验收：`test_chat_replan_returns_action_options` 通过。
2. **把 replan 草案转换为可执行选项**：保留 LLM 草案解析，但最终统一映射为 `AgentActionOption`。验收：每个选项都有 `operation = "update_trip_item"`、`item_id` 和可提交的 `payload`。
3. **补齐 chat 上下文输入**：让 `chat_service` 传入 `trip_id` 和真实 `current_trip`。验收：replan 的 `item_id` 能对应真实行程节点。
4. **稳定四条链路输出结构**：分别检查 chat、photo、reminder、replan 的 service 映射，避免 Agent 输出字段和 API 响应字段错位。
5. **完善 Prompt 和 JSON 容错**：对 chat、photo、replan 的模型输出做结构校验；不合格时回退 fallback。
6. **推进工具真实化**：优先地图和天气，再做多模态和 OCR；每一步都保留 mock fallback。
7. **补测试和演示样例**：把 API 合同、Agent 单测、service 集成和 fallback 场景补齐，并写清手动测试命令。
8. **联调前冻结字段合同**：与成员 A、B、D 确认 `action_options`、photo 输出、reminder 输出不再随意改名或改类型，避免前端和测试返工。

完成以上步骤后，成员 C 的 Agent 工作应达到 0614 三份文档要求：能通过 LangGraph 编排四条核心链路，能按 API 合同稳定输出，能在真实大模型和外部工具不可用时保持演示流程不断。
