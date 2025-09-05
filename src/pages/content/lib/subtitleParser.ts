import { SubtitleItem, ParsedSubtitleData } from "./subtitleTypes";

/**
 * 解析时间字符串为秒数
 */
export const parseTimeString = (timeStr: string): number => {
  const parts = timeStr.split(":");
  const seconds = parseFloat(parts[2]);
  const minutes = parseInt(parts[1]);
  const hours = parseInt(parts[0]);

  return hours * 3600 + minutes * 60 + seconds;
};

/**
 * 解析JSON格式字幕 (YouTube API格式)
 */
export const parseJSONSubtitles = (content: string): SubtitleItem[] => {
  try {
    const data: ParsedSubtitleData = JSON.parse(content);

    if (!data.events) {
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

    return subtitles.sort((a, b) => a.startTime - b.startTime);
  } catch (err) {
    console.error("JSON解析失败:", err);
    return [];
  }
};

/**
 * 解析 WebVTT 格式
 */
export const parseWebVTT = (content: string): SubtitleItem[] => {
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
      while (j < lines.length && lines[j].trim() && !lines[j].includes("-->")) {
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

/**
 * 解析 XML 格式字幕
 */
export const parseXMLSubtitles = (content: string): SubtitleItem[] => {
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

/**
 * 主解析函数 - 自动检测格式并解析
 */
export const parseSubtitleContent = async (
  content: string
): Promise<SubtitleItem[]> => {
  try {
    // 尝试解析JSON格式
    if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
      return parseJSONSubtitles(content);
    }
    // 手动解析其他格式
    else if (content.includes("WEBVTT")) {
      return parseWebVTT(content);
    } else if (content.includes("<transcript>") || content.includes("<text")) {
      return parseXMLSubtitles(content);
    }

    return [];
  } catch (err) {
    console.error("解析失败:", err);
    return [];
  }
};
