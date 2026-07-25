# Website 隐私政策页

## 职责

`apps/website/app/privacy/page.tsx` 在 `/privacy` 提供 ListenUp 的公开隐私政策，也是 Chrome Web Store 商品详情所填写的隐私政策地址。

页面说明扩展处理的数据、本地存储、用户主动请求 AI 解释或视觉参考时发生的第三方传输、麦克风录音的本地处理、保留规则和用户控制方式。

## 维护要求

- 保持纯静态页面，不使用 API route、`headers()`、cookies 或动态渲染。
- 扩展的数据类型、权限、AI 服务、搜索服务或录音行为变化时，同步更新政策正文。
- Chrome Web Store 的数据使用披露必须与此页面及扩展的实际行为一致。
- 修改后运行 `pnpm build:web:static`、站点 lint 和 `node scripts/check-docs.mjs`。
