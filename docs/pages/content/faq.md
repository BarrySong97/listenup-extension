# 内容脚本 FAQ

> 目的: 记录这个模块最容易踩坑的约束和经验，减少重复排查
>
> 源码路径: `src/pages/content/`, `src/components/ui/Dropdown.tsx`
>
> 覆盖范围: Shadow DOM、YouTube SPA、字幕抓取、预览页使用边界

## 源码定位

- 主路径: `src/pages/content/index.tsx`
- 相关路径: `src/components/ui/Dropdown.tsx`
- 相关路径: `src/pages/content/lib/subtitle-domain/SubtitleRepository.ts`

## 为什么不直接依赖 HeroUI 的默认交互？

内容脚本运行在 Shadow DOM 里，部分 HeroUI 组件的默认交互在这个环境下不稳定。当前已有明确经验：

- 按钮交互优先用 `onPressStart`
- 下拉菜单优先复用自定义 `Dropdown.tsx`

如果要引入新的 overlay 组件，先在真实内容脚本里验证，不要只在 Preview 页面里看起来没问题就合并。

## 为什么样式里要把 `rem` 改成 `em`？

内容脚本样式不是挂在文档根上，而是注入到 Shadow Root。为了降低宿主页面对字体尺寸和布局的影响，当前做法是在注入时把 `rem` 转成 `em`。这属于这个项目的实现约定，不要轻易移除。

## 为什么视频切换后很多状态会被重置？

`app.tsx` 用 `videoId` 作为 `Subtitles` 的 key。YouTube 是 SPA，很多页面切换不会触发真正刷新；通过 key 重建可以确保旧视频状态不泄漏到新视频。

## 为什么字幕轨有时要重试？

YouTube 刚进入视频页时，字幕轨 URL 可能缺少关键参数。`SubtitleRepository` 针对 `pot` 缺失做了短延迟重试，目的是等待播放器信息稳定后再选轨。

## 为什么 Preview 页面不能代替真实验证？

Preview 页面可以验证视觉和局部交互，但它不具备：

- YouTube DOM
- 真正的视频时间轴
- 广告状态
- 页面桥接与字幕抓取链路

任何涉及这些能力的改动，都必须回到真实 YouTube 页面验证。

## 相关文档

- [内容脚本概览](overview.md)
- [内容脚本架构](architecture.md)
- [内容脚本测试](testing.md)
