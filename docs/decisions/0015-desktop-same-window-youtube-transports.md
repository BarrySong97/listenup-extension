# 0015. Desktop 同窗 YouTube 的播放与字幕传输边界

- 状态：已采纳
- 日期：2026-08-11

## 背景

Desktop 需要在既有主窗口中播放 YouTube 并显示 ListenUp 字幕，不能新开窗口、替换页面 shell
或改变用户当前窗口尺寸。直接从 `tauri://` 页面加载官方 IFrame API 缺少 HTTP Referer，会触发
播放器错误 153。另一方面，普通 WEB watch response 可能给出返回 `200 + 空正文` 的字幕 URL；
TV client response 能给出可下载字幕，但它签发的 URL 绑定产生该 response 的会话身份。

## 决策

1. Desktop 自播只在现有 `main` layout 增加 16:9 视频行，复用标题栏、按钮、字幕组件、底栏与
   design token；进入、换链接、reload 和退出均不改变窗口尺寸、最小尺寸、vibrancy、透明度或
   shadow。
2. Rust 只绑定随机 `127.0.0.1` 端口与随机路径，托管无 Tauri capability 的最小包装页。包装页
   以真实 HTTP origin 加载官方 YouTube IFrame API，只经 `postMessage` 交换非敏感播放状态和
   控制；main 必须同时校验 iframe window 与精确 loopback origin。
3. 字幕不读取 iframe DOM。可信 main 经受限 Rust transport 读取 watch ytcfg，再使用
   `TVHTML5_SIMPLY` player response 发现字幕轨；host、path 和 videoId 必须逐层复验，响应有大小
   上限且空正文显式失败。
4. 手动 Cookie 永不注入 iframe。watch、TV player response 及其签发的 timedtext 必须保持同一
   Cookie 身份：无保存值时全匿名，有保存值时三段都携带同一串；字幕请求保持 TV User-Agent。
5. macOS GUI 优先通过允许的登录 shell 和固定只读命令解析 HTTP(S) proxy，解析不到再使用进程
   环境，避免 LaunchServices 的缺失或陈旧值；代理 URL/凭据不得进入日志、错误、前端或持久化
   数据，也不得开放给 loopback iframe。
6. 只读字幕链路对 connect/timeout 做最多三次短间隔重试；HTTP 只对 429/5xx 做两次短退避，其他
   4xx、身份、空正文与解析错误立即返回，避免瞬时本地代理或限流抖动覆盖已经可用的字幕状态。
   进程内复用同一个 HTTP client/连接池，Cookie 仍逐请求注入，不进入 client cookie jar。

## 理由

- 同窗复用保证新入口不破坏已经验收的 Desktop 视觉、交互和窗口行为。
- loopback HTTP origin 满足官方播放器对 Referer/origin 的要求，同时把远程内容与 Tauri IPC
  隔离。
- 播放与字幕解耦后，官方 iframe 只负责媒体，字幕仍可经过既有身份校验、选轨和 JSON3 解析。
- 会话身份保持一致可避免“字幕 URL 本身有效，但中途切换 Cookie 身份后下载失败”。

## 后果

- app 运行期间会持有一个仅绑定 loopback 的轻量 HTTP listener。
- 使用 shell proxy fallback 的机器会在首次字幕请求时启动一次短命登录 shell；不支持的 shell 或
  非 HTTP(S) proxy 自动回退到直连。
- YouTube client 响应形状变化时只影响 EmbeddedSource，BrowserSource 仍保持原链路。
- `scripts/check-environment-identifiers.mjs` 固定同窗不 resize、loopback source/origin 校验、TV 字幕
  发现及三段请求共用 Cookie 身份；相关边界变化必须先新增 ADR。
- 手工回归必须确认同一窗口尺寸不变、播放器无 153、游标/控制可用、字幕实时加载且不会在初次
  成功后回落为传输错误。
