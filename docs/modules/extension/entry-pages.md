# 入口页面：popup / options / newtab / devtools

四个页面都很轻。内容脚本才是产品主体（见 [content.md](content.md)）。

## popup（`src/pages/popup/`）

扩展图标弹窗，当前只有一句说明 + 两个跳转：

- `AI Settings` → 打开 options 页
- `UI Preview` → 打开 newtab 预览页

都用 `chrome.tabs.create()` 打开后自动关闭 popup。桌面端 Demo 联调时，popup 里的 "Open ListenUp Desktop" 走 `listenup://open`（dev 构建走 `listenup-dev://open`）深链接。

**边界**：不要把用户核心能力堆进 popup。真要做成产品入口需要单独设计。

## options（`src/pages/options/`）

正式的 AI 设置入口，承载 `AiSettingsForm`。字段与排错见 [ai-settings.md](ai-settings.md)。

顶部保留一个 `Open UI Preview` 按钮，方便配置完切回预览页调样式。

三处入口最终都指向同一个表单：popup 的 `AI Settings`、面板 header 菜单的 `AI settings`（面板内右侧滑出）、Explain 卡片头部与错误态。

## newtab（`src/pages/newtab/`）

UI Preview / 字幕面板实验室。直接复用内容脚本的大部分 UI 组件，用 mock 数据和本地 state 模拟：

- loaded / loading / empty / error / ad 五种状态
- 足够长的 mock 字幕列表，验证滚动与「返回当前句」
- "Show Explain Card" 按钮离线切换 Explain 卡片的四种状态

**为什么存在**：真实内容脚本依赖 YouTube 宿主页面，为了调一个间距就重载扩展代价太高。

**边界**：预览页不能证明 YouTube 生命周期、字幕抓取、播放器同步、广告检测、Shadow DOM 真实行为。涉及这些必须回真实页面（见 [testing.md](../../testing.md)）。

## devtools（`src/pages/devtools/`）

只在浏览器 DevTools 里注册一个名为 `Dev Tools` 的面板，当前没有实际内容。未来的字幕调试、日志导出、播放器状态面板适合放这里。

## 相关

- [构建与 manifest](build-and-manifest.md) · [AI 设置](ai-settings.md)
