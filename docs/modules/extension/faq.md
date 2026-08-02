# 内容脚本 FAQ

记录这个模块最容易踩的坑。每条都来自一次真实排查。

## 为什么不直接用 HeroUI 的默认交互？

内容脚本运行在 Shadow DOM 里，部分 HeroUI 组件的默认交互在这个环境下不稳定。既有结论：

- 按钮交互用 `onPressStart`，不要用 `onPress`
- 下拉菜单复用自建的 `src/components/ui/Dropdown.tsx`，不要假设 HeroUI Dropdown 可用

引入新的 overlay 组件前，先在**真实内容脚本**里验证；预览页看起来没问题不算数。见 [ADR-0001](../../decisions/0001-content-script-shadow-dom.md)。

## 为什么样式里要把 `rem` 改成 `em`？

样式不是挂在文档根上，而是注入 Shadow Root。转成 `em` 是为了让面板尺寸相对自身字号，降低宿主页面字体设置对布局的影响。这是本项目的实现约定，别顺手"优化"掉。

## 为什么视频切换后很多状态会被重置？

`app.tsx` 用 `videoId` 作 `Subtitles` 的 key。YouTube 是 SPA，多数切换不触发真正刷新；靠 key 重建可以确保旧视频状态不泄漏到新视频。

## 为什么字幕轨有时要重试？

刚进入视频页时，YouTube 给的 track URL 可能缺 `pot` 参数，直接用拿不到字幕。`SubtitleRepository` 为此做了短延迟重试，等播放器信息稳定后再选轨。

## 为什么字幕面板突然不出字幕 / 不跟随播放了？

优先怀疑 `lib/youtube-sdk/` 里的 DOM 选择器——它们依赖 YouTube 的 class 名，改版后会静默失效。其次看 Console 里的 `[ListenUp:subtitles]` 日志和 `chrome.storage.local` 的字幕缓存。

## 为什么图片搜索要绕 background？

内容脚本直接抓 Bing / Google / Baidu 的 HTML 会受页面 CSP 和跨域限制。所以由 `chrome.runtime.sendMessage` 委托给 background service worker 抓，前端只负责解析。

## 为什么 Preview 页面不能代替真实验证？

预览页没有 YouTube DOM、真实时间轴、广告状态、页面桥接与字幕抓取链路。涉及这些能力的改动必须回真实 YouTube 页面。完整分工见 [testing.md](../../testing.md)。

## 相关

- [内容脚本分层](content.md) · [YouTube SDK](youtube-sdk.md) · [入口页面](entry-pages.md)
