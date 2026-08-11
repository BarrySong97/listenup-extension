// @purpose 为主窗口 iframe 播放按 videoId 获取可用的 YouTube TV player response 与字幕文档。
// @role    EmbeddedSource 的只读网络 transport；字幕选择与解析仍由 @listenup/youtube-core 完成。
// @deps    reqwest、serde_json、percent-encoding、cookie_vault、embedded_player videoId 校验
// @gotcha  watch 只提供当次公开 ytcfg；TV response 与 timedtext 都必须复验同一 videoId，Cookie 永不返回或记录。

use percent_encoding::percent_decode_str;
use serde_json::Value;
use std::{process::Command, sync::OnceLock};
use tauri::{State, Webview};

use super::{cookie_vault::SharedCookieVault, embedded_player::valid_video_id};

const USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const TV_USER_AGENT: &str = "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version";
const TV_CLIENT_NAME: &str = "TVHTML5_SIMPLY";
const TV_CLIENT_VERSION: &str = "1.0";
const TV_CLIENT_NUMBER: &str = "75";
const MAX_WATCH_BYTES: usize = 8 * 1024 * 1024;
const MAX_CAPTION_BYTES: usize = 4 * 1024 * 1024;
static YOUTUBE_CLIENT: OnceLock<Result<(reqwest::Client, &'static str), String>> = OnceLock::new();

fn ensure_main(webview: &Webview) -> Result<(), String> {
    if webview.label() == "main" {
        Ok(())
    } else {
        Err("youtube-subtitle-command:untrusted-webview".to_string())
    }
}

fn build_client() -> Result<(reqwest::Client, &'static str), String> {
    let mut builder = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .redirect(reqwest::redirect::Policy::limited(3));
    let proxy = configured_proxy_url();
    if let Some((proxy_url, _)) = &proxy {
        builder = builder.proxy(
            reqwest::Proxy::all(proxy_url.as_str())
                .map_err(|_| "youtube-transport:proxy-invalid".to_string())?,
        );
    }
    builder
        .build()
        .map(|client| (client, proxy.map_or("direct", |(_, source)| source)))
        .map_err(|_| "youtube-transport:client".to_string())
}

fn client() -> Result<(reqwest::Client, &'static str), String> {
    match YOUTUBE_CLIENT.get_or_init(build_client) {
        Ok((client, route)) => Ok((client.clone(), *route)),
        Err(error) => Err(error.clone()),
    }
}

fn valid_proxy_url(value: &str) -> bool {
    if value.len() > 2 * 1024 {
        return false;
    }
    tauri::Url::parse(value)
        .ok()
        .is_some_and(|url| matches!(url.scheme(), "http" | "https") && url.host().is_some())
}

fn proxy_from_lines(output: &str) -> Option<String> {
    output
        .lines()
        .map(str::trim)
        .find(|value| !value.is_empty() && valid_proxy_url(value))
        .map(str::to_string)
}

fn configured_proxy_url() -> Option<(String, &'static str)> {
    // LaunchServices 可能保留陈旧的进程代理值；macOS GUI 优先采用用户当前登录 shell 配置。
    #[cfg(target_os = "macos")]
    if let Some(value) = proxy_from_login_shell() {
        return Some((value, "shell-proxy"));
    }
    for key in [
        "https_proxy",
        "HTTPS_PROXY",
        "http_proxy",
        "HTTP_PROXY",
        "all_proxy",
        "ALL_PROXY",
    ] {
        if let Ok(value) = std::env::var(key) {
            if valid_proxy_url(&value) {
                return Some((value, "env-proxy"));
            }
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn proxy_from_login_shell() -> Option<String> {
    // Finder / LaunchServices 启动的 macOS GUI app 不继承登录 shell 环境。只执行固定命令，
    // 只接受 http(s) URL；stdout 仅在内存中解析，代理地址与凭据永不进入日志或错误。
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    if !matches!(shell.as_str(), "/bin/zsh" | "/bin/bash") {
        return None;
    }
    let output = Command::new(shell)
        .args([
            "-lc",
            "printf '%s\\n%s\\n%s\\n' \"${https_proxy:-${HTTPS_PROXY:-}}\" \"${http_proxy:-${HTTP_PROXY:-}}\" \"${all_proxy:-${ALL_PROXY:-}}\"",
        ])
        .output()
        .ok()?;
    output.status.success().then_some(())?;
    std::str::from_utf8(&output.stdout)
        .ok()
        .and_then(proxy_from_lines)
}

fn with_cookie(
    request: reqwest::RequestBuilder,
    vault: &SharedCookieVault,
) -> Result<reqwest::RequestBuilder, String> {
    match vault.0.cookie_header()? {
        Some(cookie) => Ok(request.header(reqwest::header::COOKIE, cookie)),
        None => Ok(request),
    }
}

fn request_error(stage: &str, route: &str, error: reqwest::Error) -> String {
    let kind = if error.is_builder() {
        "build"
    } else if error.is_timeout() {
        "timeout"
    } else if error.is_connect() {
        "connect"
    } else if error.is_request() {
        "request"
    } else if error.is_body() {
        "body"
    } else {
        "send"
    };
    format!("youtube-transport:{stage}-{kind}-{route}")
}

async fn send_with_retry(
    request: reqwest::RequestBuilder,
    stage: &str,
    route: &str,
) -> Result<reqwest::Response, String> {
    let mut next = Some(request);
    for attempt in 0..3 {
        let current = next
            .take()
            .ok_or_else(|| format!("youtube-transport:{stage}-request"))?;
        next = current.try_clone();
        match current.send().await {
            Ok(response)
                if attempt < 2
                    && (response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS
                        || response.status().is_server_error())
                    && next.is_some() =>
            {
                tokio::time::sleep(std::time::Duration::from_millis(750 * (attempt + 1) as u64))
                    .await;
            }
            Ok(response) => return Ok(response),
            Err(error)
                if attempt < 2 && (error.is_connect() || error.is_timeout()) && next.is_some() =>
            {
                tokio::time::sleep(std::time::Duration::from_millis(150)).await;
            }
            Err(error) => return Err(request_error(stage, route, error)),
        }
    }
    Err(format!("youtube-transport:{stage}-request"))
}

async fn bounded_text(
    response: reqwest::Response,
    max_bytes: usize,
    category: &str,
) -> Result<String, String> {
    if !response.status().is_success() {
        return Err(format!("youtube-transport:{category}-http"));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|_| format!("youtube-transport:{category}-read"))?;
    if bytes.len() > max_bytes {
        return Err(format!("youtube-transport:{category}-too-large"));
    }
    if bytes.is_empty() {
        return Err(format!("youtube-transport:{category}-empty"));
    }
    String::from_utf8(bytes.to_vec()).map_err(|_| format!("youtube-transport:{category}-encoding"))
}

fn json_object_after_marker<'a>(html: &'a str, marker: &str) -> Option<&'a str> {
    let marker_index = html.find(marker)?;
    let tail = &html[marker_index + marker.len()..];
    let object_start = tail.find('{')?;
    let bytes = tail.as_bytes();
    let mut depth = 0usize;
    let mut in_string = false;
    let mut escaped = false;
    for index in object_start..bytes.len() {
        let byte = bytes[index];
        if in_string {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == b'"' {
                in_string = false;
            }
            continue;
        }
        match byte {
            b'"' => in_string = true,
            b'{' => depth += 1,
            b'}' => {
                depth = depth.checked_sub(1)?;
                if depth == 0 {
                    return Some(&tail[object_start..=index]);
                }
            }
            _ => {}
        }
    }
    None
}

fn project_player_response(parsed: Value, expected_video_id: &str) -> Result<Value, String> {
    if parsed
        .pointer("/videoDetails/videoId")
        .and_then(Value::as_str)
        != Some(expected_video_id)
    {
        return Err("youtube-transport:player-response-identity".to_string());
    }
    let project_formats = |path: &str| {
        parsed
            .pointer(path)
            .and_then(Value::as_array)
            .map(|formats| {
                formats
                    .iter()
                    .filter_map(|format| format.get("audioTrack").cloned())
                    .map(|audio_track| serde_json::json!({ "audioTrack": audio_track }))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default()
    };
    Ok(serde_json::json!({
        "videoDetails": {
            "videoId": expected_video_id,
            "title": parsed.pointer("/videoDetails/title").and_then(Value::as_str).unwrap_or("YouTube 视频"),
        },
        "captions": parsed.get("captions").cloned().unwrap_or(Value::Null),
        "streamingData": {
            "adaptiveFormats": project_formats("/streamingData/adaptiveFormats"),
            "formats": project_formats("/streamingData/formats"),
        },
    }))
}

#[cfg(test)]
fn extract_watch_player_response(html: &str, expected_video_id: &str) -> Result<Value, String> {
    let response = [
        "ytInitialPlayerResponse =",
        "var ytInitialPlayerResponse =",
        "window[\"ytInitialPlayerResponse\"] =",
    ]
    .into_iter()
    .find_map(|marker| json_object_after_marker(html, marker))
    .ok_or_else(|| "youtube-transport:player-response-missing".to_string())?;
    let parsed: Value = serde_json::from_str(response)
        .map_err(|_| "youtube-transport:player-response-invalid".to_string())?;
    project_player_response(parsed, expected_video_id)
}

#[derive(Debug, PartialEq)]
struct InnertubeConfig {
    api_key: String,
    visitor_data: String,
    signature_timestamp: Option<u64>,
}

fn valid_api_key(value: &str) -> bool {
    (20..=80).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
}

fn decode_visitor_data(value: &str) -> Result<String, String> {
    percent_decode_str(value)
        .decode_utf8()
        .map(|decoded| decoded.into_owned())
        .map_err(|_| "youtube-transport:player-config-invalid".to_string())
}

fn extract_innertube_config(html: &str) -> Result<InnertubeConfig, String> {
    let mut remaining = html;
    while let Some(index) = remaining.find("ytcfg.set(") {
        let candidate = &remaining[index..];
        if let Some(object) = json_object_after_marker(candidate, "ytcfg.set(") {
            if let Ok(config) = serde_json::from_str::<Value>(object) {
                let api_key = config.get("INNERTUBE_API_KEY").and_then(Value::as_str);
                let visitor_data = config.get("VISITOR_DATA").and_then(Value::as_str);
                if let (Some(api_key), Some(visitor_data)) = (api_key, visitor_data) {
                    if !valid_api_key(api_key) {
                        return Err("youtube-transport:player-config-invalid".to_string());
                    }
                    return Ok(InnertubeConfig {
                        api_key: api_key.to_string(),
                        visitor_data: decode_visitor_data(visitor_data)?,
                        signature_timestamp: config.get("STS").and_then(Value::as_u64),
                    });
                }
            }
        }
        remaining = &candidate["ytcfg.set(".len()..];
    }
    Err("youtube-transport:player-config-missing".to_string())
}

fn validate_caption_url(input: &str, expected_video_id: &str) -> Result<tauri::Url, String> {
    if input.len() > 16 * 1024 || !valid_video_id(expected_video_id) {
        return Err("youtube-transport:caption-url-invalid".to_string());
    }
    let url = tauri::Url::parse(input)
        .map_err(|_| "youtube-transport:caption-url-invalid".to_string())?;
    if url.scheme() != "https"
        || !matches!(url.host_str(), Some("www.youtube.com" | "youtube.com"))
        || url.path() != "/api/timedtext"
        || url.port().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
        || !url
            .query_pairs()
            .any(|(key, value)| key == "v" && value == expected_video_id)
    {
        return Err("youtube-transport:caption-url-invalid".to_string());
    }
    Ok(url)
}

#[tauri::command]
pub(crate) async fn fetch_youtube_player_response(
    webview: Webview,
    vault: State<'_, SharedCookieVault>,
    video_id: String,
) -> Result<Value, String> {
    ensure_main(&webview)?;
    if !valid_video_id(&video_id) {
        return Err("youtube-transport:video-id-invalid".to_string());
    }
    let url = format!("https://www.youtube.com/watch?v={video_id}&hl=en");
    let (watch_client, route) = client()?;
    let request = watch_client
        .get(url)
        .header(reqwest::header::ACCEPT_LANGUAGE, "en-US,en;q=0.9");
    let response = send_with_retry(with_cookie(request, &vault)?, "watch", route).await?;
    let html = bounded_text(response, MAX_WATCH_BYTES, "watch").await?;
    // 普通 WEB watch response 目前可能给出带 exp=xpe 的 timedtext URL；该 URL 会返回
    // HTTP 200 + 空正文。watch 只用于取得本次公开 API key / visitorData，字幕轨改从
    // TVHTML5_SIMPLY player response 发现。
    let config = extract_innertube_config(&html)?;
    let mut body = serde_json::json!({
        "context": {
            "client": {
                "clientName": TV_CLIENT_NAME,
                "clientVersion": TV_CLIENT_VERSION,
                "hl": "en",
                "visitorData": config.visitor_data.clone(),
            }
        },
        "videoId": video_id,
    });
    if let Some(timestamp) = config.signature_timestamp {
        body["playbackContext"] = serde_json::json!({
            "contentPlaybackContext": { "signatureTimestamp": timestamp }
        });
    }
    let endpoint = format!(
        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false&key={}",
        config.api_key
    );
    let (player_client, route) = client()?;
    let request = player_client
        .post(endpoint)
        .header(reqwest::header::USER_AGENT, TV_USER_AGENT)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::ORIGIN, "https://www.youtube.com")
        .header(reqwest::header::REFERER, "https://www.youtube.com/")
        .header("x-youtube-client-name", TV_CLIENT_NUMBER)
        .header("x-youtube-client-version", TV_CLIENT_VERSION)
        .header("x-goog-visitor-id", config.visitor_data)
        .json(&body);
    let response = send_with_retry(with_cookie(request, &vault)?, "player", route).await?;
    let document = bounded_text(response, MAX_WATCH_BYTES, "player").await?;
    let parsed = serde_json::from_str::<Value>(&document)
        .map_err(|_| "youtube-transport:player-response-invalid".to_string())?;
    project_player_response(parsed, &video_id)
}

#[tauri::command]
pub(crate) async fn fetch_youtube_caption_document(
    webview: Webview,
    vault: State<'_, SharedCookieVault>,
    video_id: String,
    url: String,
) -> Result<String, String> {
    ensure_main(&webview)?;
    let url = validate_caption_url(&url, &video_id)?;
    // baseUrl 由上面的 TVHTML5_SIMPLY response 签发，必须沿用同一身份：无 Cookie
    // 时三段请求都匿名；有手动 Cookie 时 watch / TV player / timedtext 三段都携带它。
    let (caption_client, route) = client()?;
    let request = caption_client
        .get(url)
        .header(reqwest::header::USER_AGENT, TV_USER_AGENT)
        .header(reqwest::header::ACCEPT, "application/json,text/plain,*/*")
        .header(
            reqwest::header::REFERER,
            format!("https://www.youtube.com/watch?v={video_id}"),
        );
    let response = send_with_retry(with_cookie(request, &vault)?, "caption", route).await?;
    bounded_text(response, MAX_CAPTION_BYTES, "caption").await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_balanced_player_response_and_checks_identity() {
        let html = r#"<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"abcdefghijk","title":"brace } in string"},"captions":{}};</script>"#;
        let response = extract_watch_player_response(html, "abcdefghijk").unwrap();
        assert_eq!(
            response
                .pointer("/videoDetails/title")
                .and_then(Value::as_str),
            Some("brace } in string")
        );
        assert!(extract_watch_player_response(html, "abc_def-123").is_err());
    }

    #[test]
    fn extracts_dynamic_innertube_config_and_decodes_visitor_identity() {
        let html = r#"<script>ytcfg.set({"INNERTUBE_API_KEY":"AIzaSy_example-key_1234567890","VISITOR_DATA":"visitor%3D%3D","STS":20670});</script>"#;
        assert_eq!(
            extract_innertube_config(html).unwrap(),
            InnertubeConfig {
                api_key: "AIzaSy_example-key_1234567890".to_string(),
                visitor_data: "visitor==".to_string(),
                signature_timestamp: Some(20670),
            }
        );
        assert!(extract_innertube_config("<html></html>").is_err());
    }

    #[test]
    fn accepts_only_bounded_http_proxy_urls_from_shell_output() {
        assert_eq!(
            proxy_from_lines("\nhttp://127.0.0.1:7897\nsocks5://127.0.0.1:7897\n"),
            Some("http://127.0.0.1:7897".to_string())
        );
        assert_eq!(proxy_from_lines("socks5://127.0.0.1:7897\nnot-a-url"), None);
        assert!(!valid_proxy_url(&format!(
            "http://example.test/{}",
            "x".repeat(2 * 1024)
        )));
    }

    #[test]
    fn caption_transport_accepts_only_same_video_timedtext() {
        assert!(validate_caption_url(
            "https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=en&fmt=json3",
            "abcdefghijk"
        )
        .is_ok());
        for invalid in [
            "https://evil.test/api/timedtext?v=abcdefghijk",
            "https://www.youtube.com/watch?v=abcdefghijk",
            "https://www.youtube.com/api/timedtext?v=abc_def-123",
            "http://www.youtube.com/api/timedtext?v=abcdefghijk",
        ] {
            assert!(validate_caption_url(invalid, "abcdefghijk").is_err());
        }
    }
}
