import React, { FC, useEffect, useState, useRef } from "react";
import { VList } from "virtua";

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

  // 计算字幕项的大概高度
  const getItemSize = (item: SubtitleItem): number => {
    const baseHeight = 60; // 基础高度
    const textLines = Math.ceil(item.text.length / 50); // 粗略估算行数
    return baseHeight + (textLines - 1) * 20; // 每多一行增加20px
  };

  // 解析字幕内容
  const parseSubtitleContent = async (
    content: string
  ): Promise<SubtitleItem[]> => {
    console.log("🔍 解析字幕内容，前100字符:", content.substring(0, 100));

    try {
      // 尝试解析JSON格式
      if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
        console.log("📄 检测到JSON格式");
        return parseJSONSubtitles(content);
      }
      // 手动解析其他格式
      else if (content.includes("WEBVTT")) {
        console.log("📄 检测到WebVTT格式");
        return parseWebVTT(content);
      } else if (
        content.includes("<transcript>") ||
        content.includes("<text")
      ) {
        console.log("📄 检测到XML格式");
        return parseXMLSubtitles(content);
      }

      console.log("❌ 未识别的字幕格式");
      return [];
    } catch (err) {
      console.error("解析失败:", err);
      return [];
    }
  };

  // 解析JSON格式字幕 (YouTube API格式)
  const parseJSONSubtitles = (content: string): SubtitleItem[] => {
    try {
      const data = JSON.parse(content);
      console.log("📊 JSON数据结构:", data);

      if (!data.events) {
        console.log("❌ 未找到events字段");
        return [];
      }

      const subtitles: SubtitleItem[] = [];

      data.events.forEach((event: any, index: number) => {
        const startTime = (event.tStartMs || 0) / 1000; // 转换为秒
        const duration = (event.dDurationMs || 0) / 1000; // 转换为秒
        const endTime = startTime + duration;

        // 组合所有segments的文本
        let text = "";
        if (event.segs && Array.isArray(event.segs)) {
          text = event.segs.map((seg: any) => seg.utf8 || "").join("");
        }

        if (text.trim()) {
          subtitles.push({
            id: index,
            startTime,
            endTime,
            text: text.trim(),
          });
        }
      });

      console.log("✅ JSON格式解析完成，字幕数量:", subtitles.length);
      return subtitles.sort((a, b) => a.startTime - b.startTime);
    } catch (err) {
      console.error("JSON解析失败:", err);
      return [];
    }
  };

  // 解析 WebVTT 格式
  const parseWebVTT = (content: string): SubtitleItem[] => {
    const lines = content.split("\n");
    const subtitles: SubtitleItem[] = [];
    let currentIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 匹配时间戳行 (例如: 00:00:01.000 --> 00:00:03.000)
      const timeMatch = line.match(
        /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/
      );
      if (timeMatch) {
        const startTime = parseTimeString(timeMatch[1]);
        const endTime = parseTimeString(timeMatch[2]);

        // 获取字幕文本（下一行或多行）
        let text = "";
        let j = i + 1;
        while (
          j < lines.length &&
          lines[j].trim() &&
          !lines[j].includes("-->")
        ) {
          text += (text ? "\n" : "") + lines[j].trim();
          j++;
        }

        if (text) {
          subtitles.push({
            id: currentIndex++,
            startTime,
            endTime,
            text: text.replace(/<[^>]*>/g, ""), // 移除HTML标签
          });
        }

        i = j - 1; // 跳过已处理的行
      }
    }

    return subtitles;
  };

  // 解析 XML 格式字幕
  const parseXMLSubtitles = (content: string): SubtitleItem[] => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, "text/xml");
    const textNodes = xmlDoc.querySelectorAll("text");

    const subtitles: SubtitleItem[] = [];
    textNodes.forEach((node, index) => {
      const start = parseFloat(node.getAttribute("start") || "0");
      const dur = parseFloat(node.getAttribute("dur") || "0");
      const text = node.textContent || "";

      subtitles.push({
        id: index,
        startTime: start,
        endTime: start + dur,
        text: text.trim(),
      });
    });

    return subtitles.sort((a, b) => a.startTime - b.startTime);
  };

  // 解析时间字符串为秒数
  const parseTimeString = (timeStr: string): number => {
    const parts = timeStr.split(":");
    const seconds = parseFloat(parts[2]);
    const minutes = parseInt(parts[1]);
    const hours = parseInt(parts[0]);

    return hours * 3600 + minutes * 60 + seconds;
  };

  // 监听来自background的消息
  const setupBackgroundListener = () => {
    console.log("🎵 设置Background消息监听器...");
  };

  // 处理字幕内容
  const processSubtitleContent = async (content: string) => {
    try {
      console.log("📄 内容预览:", JSON.parse(content));

      if (content.trim()) {
        const parsedSubs = await parseSubtitleContent(content);
        setSubtitles(parsedSubs);
        setError(null);
        console.log("✅ 成功解析字幕数量:", parsedSubs.length);
      }
    } catch (err) {
      console.error("❌ 处理字幕失败:", err);
      setError("处理字幕失败: " + (err as Error).message);
    }
  };

  // 获取完整字幕数据
  const getFullSubtitles = async () => {
    setupBackgroundListener();

    console.log("✅ Background监听器已设置，等待字幕请求...");
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
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "SUBTITLE_CONTENT_READY") {
        console.log(
          "🎯 收到Background字幕内容:",
          message.content.length,
          "字符"
        );

        // 直接处理字幕内容
        processSubtitleContent(message.content);
      }

      return true;
    });
  }, []);

  useEffect(() => {
    // 检查是否在YouTube页面
    const isYouTubePage = window.location.hostname.includes("youtube.com");
    setIsYoutube(isYouTubePage);

    if (!isYouTubePage) return;

    const loadSubtitles = async () => {
      setLoading(true);
      setError(null);

      try {
        getFullSubtitles();

        // 设置一个提示信息
        setError("Background监听器已启动，请播放视频以获取字幕...");
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
          // 在 secondaryEl 的子元素前面插入一个新的元素
          // const customDiv = document.createElement("div");
          // customDiv.textContent = "这里是自定义插入的元素";
          // customDiv.style.background = "#222";
          // customDiv.style.color = "#fff";
          // customDiv.style.padding = "8px";
          // customDiv.style.marginBottom = "8px";
          // customDiv.style.borderRadius = "6px";
          // secondaryEl.insertBefore(customDiv, secondaryEl.firstChild);
          const x = secondaryEl.getBoundingClientRect().x;
          if (containerRef.current) {
            containerRef.current.style.left = `${x}px`;
          }
          secondaryEl.style.marginTop = `${Math.max(playerRect.height, 400)}px`;
        }

        // 尝试加载字幕
        // loadSubtitles();
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
      className="fixed top-[80px] w-[400px] z-[9999] bg-gray-900 border border-gray-700 rounded-lg shadow-xl"
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
            <div className="flex flex-col h-full">
              <div className="p-2 text-xs text-gray-400 text-center border-b border-gray-700">
                共 {subtitles.length} 条字幕
              </div>
              <div className="flex-1 px-2 py-2">
                <VList style={{ height: "100%" }}>
                  {subtitles.map((subtitle) => (
                    <div
                      key={subtitle.id}
                      className="bg-gray-800 p-3 mb-2 rounded-lg text-sm hover:bg-gray-700 transition-colors cursor-pointer"
                      style={{
                        minHeight: getItemSize(subtitle) + "px",
                        marginBottom: "8px",
                      }}
                    >
                      <div className="text-blue-400 text-lg mb-2 font-mono">
                        [{formatTime(subtitle.startTime)} -{" "}
                        {formatTime(subtitle.endTime)}]
                      </div>
                      <div className="text-white leading-relaxed text-xl">
                        {subtitle.text}
                      </div>
                    </div>
                  ))}
                </VList>
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
