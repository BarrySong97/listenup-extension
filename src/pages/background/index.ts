// 存储字幕数据
let subtitleCache: { [tabId: number]: any[] } = {};

// 记录已处理的URL，避免重复处理
interface ProcessedUrlEntry {
  url: string;
  tabId: number;
  timestamp: number;
  videoId?: string;
}
