/**
 * @purpose 注入 YouTube 页面上下文的桥接脚本：读播放器内部字幕轨与原始音轨、代拉字幕文档。
 * @role    内容脚本经 PageBridge 用自定义事件与它通信；作为 web-accessible resource 暴露。
 * @deps    YouTube 的 #movie_player API 与 window.ytInitialPlayerResponse
 * @gotcha  原始音轨只取 streamingData 中 audioIsDefault=true；与内容脚本是两个 JS 上下文，改 payload 要同步 BridgeCaptionSource。见 docs/modules/extension/build-and-manifest.md
 */
(function () {
  const REQUEST_EVENT = "listenup:list-caption-tracks:request";
  const RESPONSE_EVENT = "listenup:list-caption-tracks:response";
  const FETCH_REQUEST_EVENT = "listenup:fetch-subtitle-document:request";
  const FETCH_RESPONSE_EVENT = "listenup:fetch-subtitle-document:response";

  if (window.__LISTENUP_BRIDGE_READY__) {
    return;
  }

  window.__LISTENUP_BRIDGE_READY__ = true;

  const getPlayerResponse = function () {
    const player = document.getElementById("movie_player");
    const playerResponse =
      player &&
      typeof player.getPlayerResponse === "function" &&
      player.getPlayerResponse();

    if (playerResponse) {
      return playerResponse;
    }

    return window.ytInitialPlayerResponse || null;
  };

  const getCurrentTrack = function () {
    const player = document.getElementById("movie_player");
    if (!player || typeof player.getAudioTrack !== "function") {
      return null;
    }

    return player.getAudioTrack();
  };

  const getOriginalAudioTrack = function (playerResponse) {
    const streamingData = playerResponse && playerResponse.streamingData;
    const formats = [
      ...((streamingData && streamingData.adaptiveFormats) || []),
      ...((streamingData && streamingData.formats) || []),
    ];

    const originalFormat = formats.find(function (format) {
      return format.audioTrack && format.audioTrack.audioIsDefault === true;
    });

    return (originalFormat && originalFormat.audioTrack) || null;
  };

  window.addEventListener(REQUEST_EVENT, function (event) {
    const data = event.detail;
    if (!data || !data.requestId) {
      return;
    }

    try {
      const playerResponse = getPlayerResponse();
      const payload =
        playerResponse &&
        playerResponse.captions &&
        playerResponse.captions.playerCaptionsTracklistRenderer;
      const currentTrack = getCurrentTrack();
      const ytcfg = window.ytcfg && window.ytcfg.data_;
      const responsePayload =
        currentTrack || payload
          ? {
              currentTrack,
              ytcfg,
              playerVideoId:
                playerResponse &&
                playerResponse.videoDetails &&
                playerResponse.videoDetails.videoId,
              originalAudioTrack: getOriginalAudioTrack(playerResponse),
              captionTracks: payload && payload.captionTracks,
              audioTracks: payload && payload.audioTracks,
              translationLanguages: payload && payload.translationLanguages,
            }
          : null;

      window.dispatchEvent(
        new CustomEvent(RESPONSE_EVENT, {
          detail: {
            requestId: data.requestId,
            ok: Boolean(responsePayload),
            payload: responsePayload,
            error:
              responsePayload ? undefined : "No caption track data found",
          },
        })
      );
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent(RESPONSE_EVENT, {
          detail: {
            requestId: data.requestId,
            ok: false,
            error: error instanceof Error ? error.message : "Bridge failure",
          },
        })
      );
    }
  });

  window.addEventListener(FETCH_REQUEST_EVENT, async function (event) {
    const data = event.detail;
    if (!data || !data.requestId || !data.url) {
      return;
    }

    try {
      const response = await fetch(data.url, {
        credentials: "include",
      });
      const content = await response.text();

      window.dispatchEvent(
        new CustomEvent(FETCH_RESPONSE_EVENT, {
          detail: {
            requestId: data.requestId,
            ok: response.ok,
            payload: {
              status: response.status,
              statusText: response.statusText,
              contentType: response.headers.get("content-type"),
              content: content,
            },
            error: response.ok
              ? undefined
              : "Failed to fetch subtitle document in page bridge",
          },
        })
      );
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent(FETCH_RESPONSE_EVENT, {
          detail: {
            requestId: data.requestId,
            ok: false,
            error: error instanceof Error ? error.message : "Bridge failure",
          },
        })
      );
    }
  });
})();
