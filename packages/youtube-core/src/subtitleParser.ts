/**
 * @purpose 自动识别并解析 YouTube JSON3、XML 与 WebVTT 字幕文档。
 * @role    BrowserSource 与 EmbeddedSource 下载文本后的平台无关解析入口。
 * @deps    types、DOMParser
 * @gotcha  空文档和畸形文档必须抛具名错误，不能静默当成无字幕。
 */
import type { ParsedSubtitleData, SubtitleItem } from "./types.ts";

export type SubtitleParseErrorCode =
  | "EMPTY_CONTENT"
  | "UNSUPPORTED_FORMAT"
  | "INVALID_JSON"
  | "INVALID_XML";

export class SubtitleParseError extends Error {
  public readonly code: SubtitleParseErrorCode;
  constructor(code: SubtitleParseErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export const parseTimeString = (timeStr: string): number => {
  const parts = timeStr.split(":");
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
};

export const parseJSONSubtitles = (content: string): SubtitleItem[] => {
  try {
    const data: ParsedSubtitleData = JSON.parse(content);
    if (!data.events) {
      throw new SubtitleParseError("INVALID_JSON", "JSON subtitle data is missing events");
    }
    return data.events
      .map((event, index) => {
        const startTime = (event.tStartMs || 0) / 1000;
        const text = event.segs?.map((segment) => segment.utf8 || "").join("").trim() || "";
        return {
          id: index,
          startTime,
          endTime: startTime + (event.dDurationMs || 0) / 1000,
          text,
        };
      })
      .filter((subtitle) => Boolean(subtitle.text))
      .sort((left, right) => left.startTime - right.startTime);
  } catch (error) {
    if (error instanceof SubtitleParseError) throw error;
    throw new SubtitleParseError("INVALID_JSON", "Failed to parse JSON subtitles");
  }
};

export const parseWebVTT = (content: string): SubtitleItem[] => {
  const lines = content.split("\n");
  const subtitles: SubtitleItem[] = [];
  let currentIndex = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]
      .trim()
      .match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (!match) continue;
    let text = "";
    let nextIndex = index + 1;
    while (
      nextIndex < lines.length &&
      lines[nextIndex].trim() &&
      !lines[nextIndex].includes("-->")
    ) {
      text += `${text ? "\n" : ""}${lines[nextIndex].trim()}`;
      nextIndex += 1;
    }
    if (text) {
      subtitles.push({
        id: currentIndex,
        startTime: parseTimeString(match[1]),
        endTime: parseTimeString(match[2]),
        text: text.replace(/<[^>]*>/g, ""),
      });
      currentIndex += 1;
    }
    index = nextIndex - 1;
  }
  return subtitles;
};

export const parseXMLSubtitles = (content: string): SubtitleItem[] => {
  const xmlDocument = new DOMParser().parseFromString(content, "text/xml");
  if (xmlDocument.querySelector("parsererror")) {
    throw new SubtitleParseError("INVALID_XML", "Failed to parse XML subtitles");
  }
  return Array.from(xmlDocument.querySelectorAll("text"))
    .map((node, index) => {
      const startTime = parseFloat(node.getAttribute("start") || "0");
      return {
        id: index,
        startTime,
        endTime: startTime + parseFloat(node.getAttribute("dur") || "0"),
        text: (node.textContent || "").trim(),
      };
    })
    .sort((left, right) => left.startTime - right.startTime);
};

export const parseSubtitleContent = async (content: string): Promise<SubtitleItem[]> => {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    throw new SubtitleParseError("EMPTY_CONTENT", "Subtitle document is empty");
  }
  if (trimmedContent.startsWith("{") || trimmedContent.startsWith("[")) {
    return parseJSONSubtitles(trimmedContent);
  }
  if (trimmedContent.includes("WEBVTT")) return parseWebVTT(trimmedContent);
  if (trimmedContent.includes("<transcript>") || trimmedContent.includes("<text")) {
    return parseXMLSubtitles(trimmedContent);
  }
  throw new SubtitleParseError("UNSUPPORTED_FORMAT", "Unsupported subtitle document format");
};
