// @purpose 在随机 loopback HTTP origin 上托管最小 YouTube IFrame API 包装页，为 macOS WKWebView 提供合法 Referer。
// @role    main 内嵌 iframe 的无权限播放子页；只经 postMessage 交换 ready/cursor/error/control，不接触字幕或 Tauri IPC。
// @deps    std::net、getrandom、tauri
// @gotcha  只绑定 127.0.0.1，路径含随机 token；未知 method/path 一律拒绝，响应禁止缓存并限制请求头大小。

use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    thread,
    time::Duration,
};
use tauri::{State, Webview};

const MAX_REQUEST_BYTES: usize = 8 * 1024;

const PLAYER_HTML: &str = r#"<!doctype html>
<html><head><meta charset="utf-8"><meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>YouTube player</title>
<style>html,body,#player{width:100%;height:100%;margin:0;background:#000;overflow:hidden}</style></head>
<body><div id="player"></div><script>
(() => {
  const CHANNEL = "listenup-youtube-player-v1";
  const videoId = new URLSearchParams(location.search).get("videoId") || "";
  const validVideoId = /^[A-Za-z0-9_-]{11}$/.test(videoId);
  const send = (type, payload = {}) => parent.postMessage({ channel: CHANNEL, type, ...payload }, "*");
  let player = null;
  let cursorTimer = null;
  window.onYouTubeIframeAPIReady = () => {
    if (!validVideoId) { send("error", { code: 2 }); return; }
    player = new YT.Player("player", {
      width: "100%", height: "100%", videoId,
      playerVars: { autoplay: 1, controls: 1, enablejsapi: 1, origin: location.origin, playsinline: 1, rel: 0 },
      events: {
        onReady: () => {
          send("ready");
          cursorTimer = setInterval(() => send("cursor", {
            currentTime: Number(player.getCurrentTime()) || 0,
            isPlaying: player.getPlayerState() === YT.PlayerState.PLAYING,
          }), 100);
        },
        onError: event => send("error", { code: event.data }),
        onAutoplayBlocked: () => send("autoplayBlocked"),
      },
    });
  };
  addEventListener("message", event => {
    if (event.source !== parent || !event.data || event.data.channel !== CHANNEL || event.data.type !== "control") return;
    const { commandId, action, seekTime } = event.data;
    let error = null;
    try {
      if (!player) throw new Error("not-ready");
      if (action === "play") player.playVideo();
      else if (action === "pause") player.pauseVideo();
      else if (action === "seek" && Number.isFinite(seekTime) && seekTime >= 0) player.seekTo(seekTime, true);
      else throw new Error("invalid-command");
    } catch (_) { error = "YouTube iframe 播放控制失败"; }
    send("controlResult", { commandId, ok: error === null, error });
  });
  addEventListener("pagehide", () => { if (cursorTimer !== null) clearInterval(cursorTimer); });
  const script = document.createElement("script");
  script.src = "https://www.youtube.com/iframe_api";
  script.onerror = () => send("loadError");
  document.head.append(script);
})();
</script></body></html>"#;

pub(crate) struct EmbeddedPlayerHost {
    url: String,
}

fn token() -> Result<String, String> {
    let mut bytes = [0u8; 24];
    getrandom::fill(&mut bytes).map_err(|_| "embedded-player-host:random".to_string())?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn respond(mut stream: TcpStream, expected_path: &str) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
    let mut request = [0u8; MAX_REQUEST_BYTES];
    let Ok(read) = stream.read(&mut request) else {
        return;
    };
    let first_line = std::str::from_utf8(&request[..read])
        .ok()
        .and_then(|value| value.lines().next())
        .unwrap_or("");
    let target = first_line
        .strip_prefix("GET ")
        .and_then(|value| value.split_once(' '))
        .map(|(target, _)| target)
        .unwrap_or("");
    let path = target.split('?').next().unwrap_or("");
    let (status, body) = if path == expected_path {
        ("200 OK", PLAYER_HTML)
    } else {
        ("404 Not Found", "Not Found")
    };
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: strict-origin-when-cross-origin\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes());
}

pub(crate) fn start() -> Result<EmbeddedPlayerHost, String> {
    let listener =
        TcpListener::bind(("127.0.0.1", 0)).map_err(|_| "embedded-player-host:bind".to_string())?;
    let port = listener
        .local_addr()
        .map_err(|_| "embedded-player-host:address".to_string())?
        .port();
    let path = format!("/player-{}/index.html", token()?);
    let thread_path = path.clone();
    thread::Builder::new()
        .name("listenup-player-host".to_string())
        .spawn(move || {
            for stream in listener.incoming() {
                if let Ok(stream) = stream {
                    respond(stream, &thread_path);
                }
            }
        })
        .map_err(|_| "embedded-player-host:thread".to_string())?;
    Ok(EmbeddedPlayerHost {
        url: format!("http://127.0.0.1:{port}{path}"),
    })
}

fn ensure_main(webview: &Webview) -> Result<(), String> {
    if webview.label() == "main" {
        Ok(())
    } else {
        Err("embedded-player-host:untrusted-webview".to_string())
    }
}

#[tauri::command]
pub(crate) fn get_embedded_player_host_url(
    webview: Webview,
    host: State<'_, EmbeddedPlayerHost>,
) -> Result<String, String> {
    ensure_main(&webview)?;
    Ok(host.url.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn player_page_keeps_identity_and_transport_minimal() {
        assert!(PLAYER_HTML.contains("https://www.youtube.com/iframe_api"));
        assert!(PLAYER_HTML.contains("location.origin"));
        assert!(PLAYER_HTML.contains("event.source !== parent"));
        assert!(!PLAYER_HTML.contains("__TAURI__"));
        assert!(!PLAYER_HTML.to_ascii_lowercase().contains("cookie"));
    }
}
