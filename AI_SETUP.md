# AI 回复：v0.3.1

当前接口：`https://api.deepseek.com`，模型：`deepseek-flash`。

2026-10-23 已通过本机 DeepSeek 真实接口验证。手表的 v0.3.0 聊天功能仍需安装后确认。此前用户反馈通过的是 v0.2.0 已执行的真机测试。

## 使用当前电脑服务

你之前启动服务的工程是 `outputs/watch-pet-open-source`，继续在该工程运行即可，不需要运行两个服务。`server/.env` 已填入接口地址、模型名和非思考模式，密钥由你本地填写。

```bash
npm run check:ai
npm run companion
```

`check:ai` 会用模型 API 发送一句简短问候作真实验证。它只输出结果或经过整理的错误说明，不输出 API 密钥。当前监听地址为 `0.0.0.0:8081`，用于你已经验证过的局域网环境。

运行中的旧服务必须重启，才能加载本轮代码和 `.env`。如果终端显示端口已占用，先停止原先的服务，不要同时启动多份。

## 手表使用

1. 用原来的安装方式覆盖更新到同包名的 v0.3.1，不要先卸载。
2. 保留已经验证通过的配套服务地址和配对。聊天自动使用这个连接，无需填写模型地址或模型密钥，也不需要重新配对。
3. 进入聊天，点“有点累”“想你了”“晚安”，或输入文字发送。
4. 回复会使用当前角色名和你的称呼，并携带最近 6 轮成功对话及虚拟养成状态。
5. 请求失败保留当前草稿和已有成功聊天，不生成假的成功回复。离开页面后迟到的回复不会写入存档。

如果在首页设置里从未创建过配对，请先创建一次。旧的独立 `/chat` 地址与 `WATCH_TOKEN` 配置仍兼容，但新的配对方式不需要手工设置该令牌。

## 模型参数

```dotenv
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-flash
AI_API_KEY=只在本地填写
AI_THINKING=disabled
AI_TIMEOUT_MS=20000
```

DeepSeek 的思考模式默认开启，本项目显式设置 `thinking.type=disabled`，使用非流式短句回复，最多生成 280 tokens。其他兼容服务如果不支持 `thinking` 字段，应将 `AI_THINKING` 留空。

官方依据：

- https://api-docs.deepseek.com/guides/search_fetch
- https://api-docs.deepseek.com/api/create-chat-completion/

## 语音输入

目前不支持承诺在 REDMI Watch 6 第三方应用内直接录音：官方 `system.record` 支持表将该型号标为“不支持”。不要把系统自带录音机或通话的麦克风能力等同于第三方应用可调用。

官方依据：https://iot.mi.com/vela/quickapp/zh/features/system/record.html

手机语音输入转文字，再通过配套服务交给手表，是可选后续方案；本轮未增加手机聊天入口或语音识别服务。

## v0.3.1 消息显示修复

2026-10-23 用户照片显示状态“回复了”但消息区空白。列表和列表项此前未指定高度；现补充明确尺寸、按内容扩展消息高度，并延后滚动到最新回复。23 项检查通过，最终显示仍以修复后的真机复查为准。服务端沿用 v0.3.0，不需要因此重新配置模型、配对或重启服务。
