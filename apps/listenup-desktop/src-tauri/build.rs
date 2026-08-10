// @purpose 构建脚本：打包 Embedded bridge、注入环境矩阵与独立 CLI 版本，再走 tauri_build。
// @role    dev / production 两个 app 隔离的 Rust 配置入口。
// @deps    pnpm/Vite、tauri-build、serde_json、config/listenup-environments.json、LISTENUP_CLI_VERSION
// @gotcha  Embedded bridge 只写 Cargo OUT_DIR，不得生成进仓库；CLI 版本与 Desktop/Cargo 版本解耦。
use serde::Deserialize;
use std::{fs, path::PathBuf, process::Command};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Environment {
    extension_id: String,
    native_host_name: String,
    desktop_bundle_id: String,
    desktop_product_name: String,
    deep_link_scheme: String,
}

#[derive(Deserialize)]
struct Environments {
    production: Environment,
    development: Environment,
}

fn main() {
    println!("cargo:rerun-if-env-changed=LISTENUP_ENV");
    println!("cargo:rerun-if-env-changed=LISTENUP_CLI_VERSION");
    let desktop_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("desktop app directory")
        .to_path_buf();
    let embedded_bridge_path = desktop_dir.join("src/embedded/bridge.ts");
    let embedded_vite_config = desktop_dir.join("vite.embedded.config.ts");
    let youtube_core_dir = desktop_dir.join("../../packages/youtube-core/src");
    println!("cargo:rerun-if-changed={}", embedded_bridge_path.display());
    println!("cargo:rerun-if-changed={}", embedded_vite_config.display());
    for entry in fs::read_dir(&youtube_core_dir).expect("failed to read youtube-core sources") {
        let path = entry
            .expect("failed to read youtube-core source entry")
            .path();
        if path.extension().is_some_and(|extension| extension == "ts") {
            println!("cargo:rerun-if-changed={}", path.display());
        }
    }

    let output_dir = PathBuf::from(std::env::var_os("OUT_DIR").expect("Cargo OUT_DIR"));
    let bridge_status = Command::new("pnpm")
        .current_dir(&desktop_dir)
        .args([
            "exec",
            "vite",
            "build",
            "--config",
            "vite.embedded.config.ts",
        ])
        .env("LISTENUP_EMBEDDED_BRIDGE_OUT_DIR", &output_dir)
        .status()
        .expect("failed to start Vite for Embedded bridge");
    assert!(bridge_status.success(), "failed to bundle Embedded bridge");
    let config_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../config/listenup-environments.json");
    println!("cargo:rerun-if-changed={}", config_path.display());

    let config: Environments = serde_json::from_str(
        &fs::read_to_string(&config_path).expect("failed to read ListenUp environment matrix"),
    )
    .expect("failed to parse ListenUp environment matrix");
    let environment_name =
        std::env::var("LISTENUP_ENV").unwrap_or_else(|_| "production".to_string());
    let environment = match environment_name.as_str() {
        "production" => config.production,
        "development" => config.development,
        other => panic!("unknown LISTENUP_ENV={other}; expected production or development"),
    };

    println!("cargo:rustc-env=LISTENUP_ENV={}", environment_name);
    println!(
        "cargo:rustc-env=LISTENUP_EXTENSION_ID={}",
        environment.extension_id
    );
    println!(
        "cargo:rustc-env=LISTENUP_NATIVE_HOST_NAME={}",
        environment.native_host_name
    );
    println!(
        "cargo:rustc-env=LISTENUP_BUNDLE_ID={}",
        environment.desktop_bundle_id
    );
    println!(
        "cargo:rustc-env=LISTENUP_PRODUCT_NAME={}",
        environment.desktop_product_name
    );
    println!(
        "cargo:rustc-env=LISTENUP_DEEP_LINK_SCHEME={}",
        environment.deep_link_scheme
    );
    let cli_version = std::env::var("LISTENUP_CLI_VERSION")
        .unwrap_or_else(|_| env!("CARGO_PKG_VERSION").to_string());
    println!("cargo:rustc-env=LISTENUP_CLI_VERSION={cli_version}");
    tauri_build::build()
}
