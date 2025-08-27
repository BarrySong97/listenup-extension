import { Card, CardBody } from "@heroui/react";
import React, { FC, useEffect } from "react";
import { VList } from "virtua";
import { useYouTubeTheme } from "@src/hooks/useYouTubeTheme";
import { useYouTubeLayout } from "@src/hooks/useYouTubeLayout";
import { useSubtitleContent } from "@src/hooks/useSubtitleContent";
import { useSubtitleSync } from "@src/hooks/useSubtitleSync";
import { useSubtitleNavigation } from "@src/hooks/useSubtitleNavigation";
import { useSubtitleAutoScroll } from "@src/hooks/useSubtitleAutoScroll";
import { useSubtitleLoop } from "@src/hooks/useSubtitleLoop";
import { SubtitleItemComponent } from "./SubtitleItem";
import { SubtitleStates } from "./SubtitleStates";
import { SubtitleHeader } from "./SubtitleHeader";
import { SubtitleFooter } from "./SubtitleFooter";

export interface SubtitlesProps {}
const Subtitles: FC<SubtitlesProps> = () => {
  // 使用各种专门的hooks
  const { theme, isDark } = useYouTubeTheme();
  const { isYoutube, videoHeight, containerRef, isPositioned } =
    useYouTubeLayout();
  const { subtitles, loading, error } = useSubtitleContent();
  const { currentSubtitleIndex } = useSubtitleSync(isYoutube, subtitles);
  const { handleSubtitleClick } = useSubtitleNavigation(subtitles);
  const { vListRef } = useSubtitleAutoScroll(currentSubtitleIndex);
  const { isLooping, toggleLooping, cleanup: cleanupLoop } = useSubtitleLoop();

  // 获取当前字幕项
  const currentSubtitle =
    currentSubtitleIndex >= 0 && currentSubtitleIndex < subtitles.length
      ? subtitles[currentSubtitleIndex]
      : null;

  // 组件卸载时清理循环播放
  useEffect(() => {
    return () => {
      cleanupLoop();
    };
  }, [cleanupLoop]);

  if (!isYoutube) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`absolute w-[400px] ${isDark ? "dark" : "light"}`}
      style={{
        opacity: isPositioned ? 1 : 0,
        transition: "opacity 0.2s ease-in-out",
      }}
    >
      <Card
        shadow="lg"
        style={{
          height: videoHeight > 0 ? `${videoHeight}px` : "400px",
          maxHeight: "80vh",
        }}
      >
        <SubtitleHeader
          subtitleCount={subtitles.length}
          subtitles={subtitles}
        />
        <CardBody className="p-0 h-full">
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
                    index={index}
                    isActive={index === currentSubtitleIndex}
                    onSubtitleClick={handleSubtitleClick}
                  />
                </div>
              ))}
            </VList>
          )}

          {/* 字幕底部控制组件 */}
          <SubtitleFooter
            currentSubtitle={currentSubtitle}
            isActive={
              !loading &&
              !error &&
              subtitles.length > 0 &&
              currentSubtitleIndex >= 0
            }
            isLooping={isLooping}
            onToggleLoop={() => toggleLooping(currentSubtitle)}
          />
        </CardBody>
      </Card>
    </div>
  );
};

export default Subtitles;
