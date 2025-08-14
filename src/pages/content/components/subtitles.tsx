import React, { FC, useEffect, useState, useRef } from "react";

interface SubtitleItem {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

export interface SubtitlesProps {}
const Subtitles: FC<SubtitlesProps> = () => {
  const [isYoutube, setIsYoutube] = useState(false);
  const [videoHeight, setVideoHeight] = useState(0);
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 等待YouTube页面数据加载
  const waitForYouTubeData = async (maxWait = 10000): Promise<any> => {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const ytInitialData = (window as any).ytInitialData;
      const ytInitialPlayerResponse = (window as any).ytInitialPlayerResponse;
      const ytcfg = (window as any).ytcfg;
      const yt = (window as any).yt;

      if (ytInitialPlayerResponse || ytInitialData || ytcfg || yt) {
        console.log("找到YouTube数据:", {
          ytInitialData: !!ytInitialData,
          ytInitialPlayerResponse: !!ytInitialPlayerResponse,
          ytcfg: !!ytcfg,
          yt: !!yt,
        });
        return { ytInitialData, ytInitialPlayerResponse, ytcfg, yt };
      }

      // 等待100ms再重试
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error("等待YouTube数据超时");
  };

  // 从URL获取视频ID
  const getVideoId = (): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get("v");
    if (videoId) return videoId;

    // 从URL路径中提取
    const pathMatch = window.location.pathname.match(/\/watch/);
    if (pathMatch) {
      const hashMatch = window.location.href.match(/[?&]v=([^&]+)/);
      return hashMatch ? hashMatch[1] : null;
    }

    return null;
  };

  // 获取完整字幕数据
  const getFullSubtitles = async () => {
    window.addEventListener("esYoutubeCaptionsData", (event) => {
      console.log(event);
    });
    window.addEventListener("esYoutubeCaptionsChanged", (event) => {
      console.log(event);
    });
    window.addEventListener("esYoutubeLoaded", (event) => {
      console.log(event);
    });
    // try {
    //   console.log('开始获取字幕数据...');

    //   // 等待YouTube数据加载
    //   const { ytInitialData, ytInitialPlayerResponse, ytcfg, yt } = await waitForYouTubeData();

    //   console.log('YouTube数据详情:', {
    //     ytInitialData,
    //     ytInitialPlayerResponse,
    //     ytcfg,
    //     yt
    //   });

    //   // 方法1: 从 ytInitialPlayerResponse 获取
    //   if (ytInitialPlayerResponse?.captions) {
    //     console.log('从ytInitialPlayerResponse获取字幕');
    //     const captionTracks = ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer?.captionTracks;
    //     console.log('captionTracks:', captionTracks);

    //     if (captionTracks && captionTracks.length > 0) {
    //       const firstTrack = captionTracks[0];
    //       const subtitleUrl = firstTrack.baseUrl;

    //       if (subtitleUrl) {
    //         return await fetchAndParseSubtitles(subtitleUrl);
    //       }
    //     }
    //   }

    //   // 方法2: 从 ytInitialData 获取
    //   if (ytInitialData) {
    //     console.log('尝试从ytInitialData获取字幕');
    //     const playerResponse = ytInitialData?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find((content: any) =>
    //       content.videoPrimaryInfoRenderer || content.videoSecondaryInfoRenderer
    //     );

    //     console.log('playerResponse from ytInitialData:', playerResponse);
    //   }

    //   // 方法3: 从HTML中解析script标签
    //   const scriptTags = document.querySelectorAll('script');
    //   for (const script of scriptTags) {
    //     const content = script.textContent || '';
    //     if (content.includes('captionTracks')) {
    //       console.log('在script标签中找到captionTracks');
    //       try {
    //         const captionTracksMatch = content.match(/"captionTracks":\s*(\[[^\]]+\])/);
    //         if (captionTracksMatch) {
    //           const captionTracks = JSON.parse(captionTracksMatch[1]);
    //           console.log('解析到的captionTracks:', captionTracks);

    //           if (captionTracks.length > 0) {
    //             const firstTrack = captionTracks[0];
    //             const subtitleUrl = firstTrack.baseUrl;
    //             if (subtitleUrl) {
    //               return await fetchAndParseSubtitles(subtitleUrl);
    //             }
    //           }
    //         }
    //       } catch (parseError) {
    //         console.error('解析script标签失败:', parseError);
    //       }
    //     }
    //   }

    //   // 方法4: 尝试从视频元素的 textTracks
    //   const video = document.querySelector("video");
    //   if (video && video.textTracks && video.textTracks.length > 0) {
    //     console.log('尝试从textTracks获取:', video.textTracks);

    //     for (let i = 0; i < video.textTracks.length; i++) {
    //       const track = video.textTracks[i];
    //       if (track.kind === "subtitles" || track.kind === "captions") {
    //         const cues = track.cues;
    //         if (cues && cues.length > 0) {
    //           const subtitleItems: SubtitleItem[] = [];
    //           for (let j = 0; j < cues.length; j++) {
    //             const cue = cues[j];
    //             subtitleItems.push({
    //               id: j,
    //               startTime: cue.startTime,
    //               endTime: cue.endTime,
    //               text: cue.text || "",
    //             });
    //           }
    //           return subtitleItems.sort((a, b) => a.startTime - b.startTime);
    //         }
    //       }
    //     }
    //   }

    //   throw new Error("未找到可用的字幕数据源");
    // } catch (err) {
    //   console.error("获取字幕失败:", err);
    //   throw err;
    // }
  };

  // 获取并解析字幕文件
  const fetchAndParseSubtitles = async (
    subtitleUrl: string
  ): Promise<SubtitleItem[]> => {
    console.log("获取字幕URL:", subtitleUrl);
    const response = await fetch(subtitleUrl);
    const xmlText = await response.text();
    console.log("字幕XML内容长度:", xmlText.length);

    // 解析字幕XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const textNodes = xmlDoc.querySelectorAll("text");

    const subtitleItems: SubtitleItem[] = [];
    textNodes.forEach((node, index) => {
      const start = parseFloat(node.getAttribute("start") || "0");
      const dur = parseFloat(node.getAttribute("dur") || "0");
      const text = node.textContent || "";

      subtitleItems.push({
        id: index,
        startTime: start,
        endTime: start + dur,
        text: text.trim(),
      });
    });

    console.log(`解析到 ${subtitleItems.length} 条字幕`);
    return subtitleItems.sort((a, b) => a.startTime - b.startTime);
  };

  // 格式化时间为 MM:SS 格式
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  useEffect(() => {
    // 检查是否在YouTube页面
    const isYouTubePage = window.location.hostname.includes("youtube.com");
    setIsYoutube(isYouTubePage);

    if (!isYouTubePage) return;

    const loadSubtitles = async () => {
      setLoading(true);
      setError(null);

      // 等待视频加载
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        getFullSubtitles();
        // setSubtitles(subtitleData);

        // if (subtitleData.length === 0) {
        //   setError("未找到字幕数据");
        // }
      } catch (err) {
        setError(err instanceof Error ? err.message : "获取字幕时出错");
      } finally {
        setLoading(false);
      }
    };

    const setupLayout = () => {
      // 找到视频播放器
      const videoPlayer = document.querySelector(
        "#movie_player, .html5-video-container, video"
      );

      // 找到右侧推荐视频容器
      const secondaryContent = document.querySelector(
        "#secondary, #secondary-inner, ytd-watch-next-secondary-results-renderer"
      );

      if (videoPlayer && secondaryContent) {
        const playerRect = videoPlayer.getBoundingClientRect();
        setVideoHeight(playerRect.height);

        // 修改推荐视频容器的样式，为我们的内容腾出空间
        const secondaryEl = secondaryContent as HTMLElement;
        if (secondaryEl) {
          secondaryEl.style.marginTop = `${Math.max(playerRect.height, 400)}px`;
        }

        // 尝试加载字幕
        loadSubtitles();
      }
    };

    // 等待页面加载完成
    const timer = setTimeout(setupLayout, 1000);

    // 监听页面变化（YouTube是单页应用）
    const observer = new MutationObserver(setupLayout);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      // 清理样式
      const secondaryContent = document.querySelector(
        "#secondary, #secondary-inner, ytd-watch-next-secondary-results-renderer"
      );
      if (secondaryContent) {
        (secondaryContent as HTMLElement).style.marginTop = "";
      }
    };
  }, []);

  if (!isYoutube) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="fixed top-[80px] right-4 w-[400px] z-[9999] bg-gray-900 border border-gray-700 rounded-lg shadow-xl"
      style={{
        height: videoHeight > 0 ? `${videoHeight}px` : "400px",
        maxHeight: "80vh",
      }}
    >
      <div className="h-full flex flex-col">
        <div className="bg-gray-800 px-4 py-3 rounded-t-lg border-b border-gray-700">
          <h3 className="text-white font-semibold text-lg">🎵 字幕助手</h3>
        </div>
        <div className="flex-1 text-white overflow-y-auto">
          {loading && (
            <div className="p-4 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm">正在加载字幕...</p>
            </div>
          )}

          {error && (
            <div className="p-4 text-center text-yellow-400">
              <p className="text-sm">{error}</p>
              <p className="text-xs mt-1">请确保视频有字幕且已加载</p>
            </div>
          )}

          {!loading && !error && subtitles.length > 0 && (
            <div className="p-2">
              <div className="mb-2 text-xs text-gray-400 text-center">
                共 {subtitles.length} 条字幕
              </div>
              <div className="space-y-1">
                {subtitles.map((subtitle) => (
                  <div
                    key={subtitle.id}
                    className="bg-gray-800 p-2 rounded text-sm hover:bg-gray-700 transition-colors"
                  >
                    <div className="text-blue-400 text-xs mb-1">
                      [{formatTime(subtitle.startTime)} -{" "}
                      {formatTime(subtitle.endTime)}]
                    </div>
                    <div className="text-white leading-relaxed">
                      {subtitle.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !error && subtitles.length === 0 && (
            <div className="p-4 text-center text-gray-400">
              <p className="text-sm">暂无字幕数据</p>
              <p className="text-xs mt-1">请尝试播放有字幕的视频</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Subtitles;
