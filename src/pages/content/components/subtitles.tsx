import { Card, CardBody } from "@heroui/react";
import React, {
  FC,
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { VList, VListHandle } from "virtua";
import { SubtitleItem } from "@src/lib/subtitleTypes";
import { subtitleFetcher } from "@src/lib/subtitleFetcher";
import { useYouTubeTheme } from "@src/hooks/useYouTubeTheme";
import { SubtitleItemComponent } from "./SubtitleItem";
import { SubtitleStates } from "./SubtitleStates";
import { SubtitleHeader } from "./SubtitleHeader";

export interface SubtitlesProps {}
const Subtitles: FC<SubtitlesProps> = () => {
  const [isYoutube, setIsYoutube] = useState(false);
  const [videoHeight, setVideoHeight] = useState(0);
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const vListRef = useRef<VListHandle>(null);
  const subtitleMonitorRef = useRef<NodeJS.Timeout | null>(null);

  // 使用YouTube主题hook
  const { theme, isDark } = useYouTubeTheme();

  // 處理字幕點擊
  const handleSubtitleClick = useCallback((startTime: number) => {
    // 可以添加跳轉到指定時間的邏輯
    console.log("跳轉到時間:", startTime);
  }, []);

  // 計算當前活躍字幕索引
  const currentSubtitleIndex = useMemo(() => {
    const tolerance = 0.1;
    for (let i = 0; i < subtitles.length; i++) {
      const subtitle = subtitles[i];
      const endTime = subtitle.endTime;

      if (
        currentTime >= subtitle.startTime - tolerance &&
        currentTime < endTime + tolerance
      ) {
        return i;
      }
    }
    return -1;
  }, [currentTime, subtitles]);

  // 处理字幕内容
  const processSubtitleContent = async (content: string) => {
    await subtitleFetcher.processSubtitleContent(
      content,
      (parsedSubs) => {
        setSubtitles(parsedSubs);
        setError(null);
      },
      (errorMsg) => {
        setError(errorMsg);
      }
    );
  };

  // 自動滾動到當前字幕
  useEffect(() => {
    if (currentSubtitleIndex >= 0 && vListRef.current) {
      vListRef.current.scrollToIndex(currentSubtitleIndex, {
        align: "center",
        smooth: true,
      });
    }
  }, [currentSubtitleIndex]);

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
    const isYouTubePage = subtitleFetcher.isYouTubePage();
    setIsYoutube(isYouTubePage);

    if (!isYouTubePage) return;

    const setupLayout = () => {
      // 找到视频播放器
      const videoPlayer = subtitleFetcher.getVideoPlayer();

      // 找到右侧推荐视频容器
      const secondaryContent = subtitleFetcher.getSecondaryContent();

      if (videoPlayer && secondaryContent) {
        const playerRect = subtitleFetcher.getPlayerRect();
        if (playerRect) {
          setVideoHeight(playerRect.height);

          // 修改推荐视频容器的样式，为我们的内容腾出空间
          const secondaryEl = secondaryContent as HTMLElement;
          if (secondaryEl) {
            const x = secondaryEl.getBoundingClientRect().x;
            if (containerRef.current) {
              // 在Shadow DOM中，需要相对于页面定位
              containerRef.current.style.left = `${x}px`;
              containerRef.current.style.top = "80px";
            }
            secondaryEl.style.marginTop = `${
              Math.max(playerRect.height, 400) + 32
            }px`;
          }
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
      const secondaryContent = subtitleFetcher.getSecondaryContent();
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
      className={`absolute w-[400px]  ${isDark ? "dark" : "light"}`}
    >
      <Card
        shadow="lg"
        style={{
          height: videoHeight > 0 ? `${videoHeight}px` : "400px",
          maxHeight: "80vh",
        }}
      >
        <SubtitleHeader subtitleCount={subtitles.length} />
        <CardBody className="p-0">
          <SubtitleStates
            loading={loading}
            error={error}
            isEmpty={!loading && !error && subtitles.length === 0}
          />

          {!loading && !error && subtitles.length > 0 && (
            <VList
              ref={vListRef}
              style={{ height: "100%" }}
              className="px-4 py-2"
            >
              {subtitles.map((subtitle, index) => (
                <div key={subtitle.id} className="py-1">
                  <SubtitleItemComponent
                    subtitle={subtitle}
                    isActive={index === currentSubtitleIndex}
                    onSubtitleClick={handleSubtitleClick}
                  />
                </div>
              ))}
            </VList>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default Subtitles;
