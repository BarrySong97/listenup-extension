/**
 * @purpose 用 React Query 调用 Tauri SQLite 字幕视图，按视频、模式和目标语言隔离缓存。
 * @role    App.tsx 的持久字幕读取入口。
 * @deps    @tanstack/react-query、@tauri-apps/api、./types
 * @gotcha  没有 videoId 时 Rust 返回最近缓存；不监听数据库文件，也不配置 refetchInterval。
 */
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { SubtitleDisplayMode, SubtitleView } from "./types";

export const useSubtitleView = (
  videoId: string | null,
  sourceRevision: string | null,
  displayMode: SubtitleDisplayMode,
  targetLanguage: string | null
) =>
  useQuery({
    queryKey: [
      "subtitle-view",
      videoId ?? "latest",
      sourceRevision ?? "current",
      displayMode,
      targetLanguage ?? "source",
    ],
    queryFn: () =>
      invoke<SubtitleView | null>("get_subtitle_view", {
        videoId,
        targetLanguage:
          displayMode === "source" ? null : targetLanguage,
      }),
    refetchOnWindowFocus: true,
  });
