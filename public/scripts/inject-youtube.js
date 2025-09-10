(function () {
  try {
    const eventName = "grab_youtube_metacontext_youmind";

    // 找到播放器
    const player = document.getElementById("movie_player");
    if (!player) {
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: { error: "movie_player not found" },
        })
      );
      return;
    }

    // 获取当前音轨
    const currentTrack = player.getAudioTrack?.();
    if (!currentTrack || !currentTrack.captionTracks?.length) {
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: { error: "No caption tracks available" },
        })
      );
      return;
    }

    // 通过事件回传给 content script
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: { currentTrack, ytcfg: window.ytcfg.data_ },
      })
    );
  } catch (err) {
    console.error("[inject_youtube_caption] error:", err);
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: { error: err.message },
      })
    );
  }
})();
