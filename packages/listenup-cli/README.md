# ListenUp CLI

安全读取 ListenUp Desktop 保存在本机 SQLite 中的 YouTube 原字幕，并校验、导入由用户自己的
AI 生成的完整译文。CLI 不包含翻译模型、不上传字幕，也不开放任意 SQL。

## 安装

首个版本仅支持 macOS Apple Silicon，需要 Node.js 20 或更高版本：

```bash
npm install -g @barrysongdev4real/listenup-cli@0.1.0
listenup --version
```

## 常用命令

```bash
listenup info --json
listenup video list --json
listenup subtitle get VIDEO_ID --json
listenup translation list VIDEO_ID --json
listenup translation get VIDEO_ID --language ja --json
listenup translation apply translation.json --dry-run --json
listenup translation apply translation.json --commit --json
```

写操作默认只是 dry-run，只有显式传入 `--commit` 才会修改数据库。默认访问正式版 Desktop
数据库；本地开发可传 `--env dev`，测试可以传 `--db /absolute/path/to/test.sqlite`。

完整的 AI 工作流见不可变版本中的
[`listenup-local-translator`](https://github.com/BarrySong97/listenup-extension/tree/cli-v0.1.0/skills/listenup-local-translator)
Skill。
