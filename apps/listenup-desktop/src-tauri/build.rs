fn main() {
    // 把构建环境传给编译期（lib.rs 用它区分 dev/production 的 socket 路径等）
    println!("cargo:rerun-if-env-changed=LISTENUP_ENV");
    println!(
        "cargo:rustc-env=LISTENUP_ENV={}",
        std::env::var("LISTENUP_ENV").unwrap_or_else(|_| "production".to_string())
    );
    tauri_build::build()
}
