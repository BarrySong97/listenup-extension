// @purpose listenup 字幕数据库 CLI 的独立可执行入口。
// @role    为用户自己的 AI Agent 暴露安全的原字幕读取和译文写入接口。
// @deps    listenup_desktop::cli
// @gotcha  不启动 Tauri GUI，也不复用 Native Messaging stdout 协议。

#[tokio::main]
async fn main() {
    std::process::exit(listenup_desktop::cli::run().await);
}
