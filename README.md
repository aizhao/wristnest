# WatchPet · 腕上小屋

面向 Xiaomi Vela 手表的 AI 陪伴应用，支持自定义角色、宠物互动与 AI 聊天。当前主要适配 REDMI Watch 6 标准版。

## 功能

- 小屋场景与角色形象，顶部显示饱食度、心情和亲密度。
- 摸摸、喂食、陪玩及离线养成存档。
- 短句按钮和文字输入，AI 回复使用当前角色名、用户称呼及最近对话。
- 手机网页修改名字、称呼、形象、背景，保存后同步到手表。
- 支持单张静态形象与 8 × 11 动作图集；单张图片不会自动生成动画。
- 角色更换保留养成数值和聊天记录，支持恢复上一份形象。

## 安装与使用

1. 获取与设备兼容的 RPK，通过安卓手机上的 AstroBox 安装。
2. 在手表设置中填写配套服务地址并创建配对，手机扫描二维码。
3. 在手机网页修改角色并保存，让手表停留在设置页等待同步，也可手动同步。
4. 进入聊天后，直接使用已保存的配对连接 AI 服务。

本仓库提供源码和示例资源，不提供公共托管服务。使用者需要自行运行配套服务；手表需通过手机代理联网。断网时可继续使用已经保存的形象和离线互动。

## 运行配套服务

需要 Node.js 22+。

```bash
npm ci
cp server/.env.example server/.env
npm run companion
```

在本地 `server/.env` 填写模型接口基础地址 `AI_BASE_URL`、模型名 `AI_MODEL` 和密钥 `AI_API_KEY`。接口需兼容 Chat Completions；基础地址不包含 `/chat/completions`。支持相应参数的服务可以用 `AI_THINKING=disabled` 关闭思考模式，不支持时留空。

默认监听 `127.0.0.1:8787`。局域网使用时设置 `HOST=0.0.0.0`，手表填写手机能够访问的主机地址；公网部署使用 HTTPS。`SYNC_DATA_DIR` 指定角色和配对数据目录，需要持久保存。

模型密钥只放在服务端。手表使用设备配对令牌，无需填写模型密钥。

验证模型连接：

```bash
npm run check:ai
```

该命令会向所配置的模型发送一次简短问候。

也可以通过 Docker 运行：

```bash
docker build -t watch-pet .
docker run --env-file server/.env -e HOST=0.0.0.0 -e PORT=8787 -p 8787:8787 -v watch-pet-data:/data watch-pet
```

## 构建手表安装包

需要 npm 和 openssl。在项目根目录为安装包预设配套服务地址后构建：

```bash
node scripts/set-sync-origin.mjs https://your-companion.example
cd watch
npm ci
npm run release
```

安装包生成在 `watch/dist/`。首次构建会生成项目签名；后续覆盖更新必须保留同一个包名和签名。签名和安装包均不纳入源码仓库。

## 自定义素材

透明背景 PNG 适合角色形象，也可上传 JPG 或 WebP。图片先在手机端处理，再保存到配套服务。同步仅在手表设置页可见时检查，退出后停止轮询。

角色包格式见 [ROLE_PACK.md](ROLE_PACK.md)，资源来源与许可见 [ASSETS.md](ASSETS.md)。

## 检查与目录

```bash
npm test
```

- `watch/`：手表应用源码与构建入口。
- `companion/`：手机自定义网页、配对及素材同步服务。
- `server/`：可配置的 AI 聊天代理。
- `examples/`：通用示例角色与动作图集。
- `scripts/`：配置、素材生成与连接检查脚本。
- `test/`：养成、存档、聊天和同步检查。

代码许可见 [LICENSE](LICENSE)。用户自行上传的角色和背景不自动适用项目许可。
