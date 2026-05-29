(function () {
  const REQUEST_EVENT = "listenup:list-caption-tracks:request";
  const RESPONSE_EVENT = "listenup:list-caption-tracks:response";
  const FETCH_REQUEST_EVENT = "listenup:fetch-subtitle-document:request";
  const FETCH_RESPONSE_EVENT = "listenup:fetch-subtitle-document:response";

  if (window.__LISTENUP_BRIDGE_READY__) {
    return;
  }

  window.__LISTENUP_BRIDGE_READY__ = true;

  const getTracklistRenderer = function () {
    const player = document.getElementById("movie_player");
    const playerResponseRenderer =
      player &&
      typeof player.getPlayerResponse === "function" &&
      player.getPlayerResponse()?.captions?.playerCaptionsTracklistRenderer;

    if (playerResponseRenderer) {
      return playerResponseRenderer;
    }

    return (
      window.ytInitialPlayerResponse &&
      window.ytInitialPlayerResponse.captions &&
      window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer
    );
  };

  const getCurrentTrack = function () {
    const player = document.getElementById("movie_player");
    if (!player || typeof player.getAudioTrack !== "function") {
      return null;
    }

    return player.getAudioTrack();
  };

  window.addEventListener(REQUEST_EVENT, function (event) {
    const data = event.detail;
    if (!data || !data.requestId) {
      return;
    }

    try {
      const payload = getTracklistRenderer();
      const currentTrack = getCurrentTrack();
      const ytcfg = window.ytcfg && window.ytcfg.data_;
      const responsePayload =
        currentTrack || payload
          ? {
              currentTrack,
              ytcfg,
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
