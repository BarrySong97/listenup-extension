const PREFIX = "[ListenUp:subtitles]";
const MAX_LOG_ENTRIES = 500;

type SubtitleDebugLevel = "log" | "warn" | "error";

interface SubtitleDebugEntry {
  timestamp: string;
  level: SubtitleDebugLevel;
  message: string;
  data?: unknown;
}

const debugEntries: SubtitleDebugEntry[] = [];

const pushEntry = (
  level: SubtitleDebugLevel,
  message: string,
  data?: unknown
) => {
  debugEntries.push({
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  });

  if (debugEntries.length > MAX_LOG_ENTRIES) {
    debugEntries.splice(0, debugEntries.length - MAX_LOG_ENTRIES);
  }
};

const writeConsole = (
  level: SubtitleDebugLevel,
  message: string,
  data?: unknown
) => {
  if (data === undefined) {
    console[level](`${PREFIX} ${message}`);
    return;
  }
  console[level](`${PREFIX} ${message}`, data);
};

export const subtitleDebug = {
  log(message: string, data?: unknown) {
    pushEntry("log", message, data);
    writeConsole("log", message, data);
  },
  warn(message: string, data?: unknown) {
    pushEntry("warn", message, data);
    writeConsole("warn", message, data);
  },
  error(message: string, data?: unknown) {
    pushEntry("error", message, data);
    writeConsole("error", message, data);
  },
  getEntries() {
    return [...debugEntries];
  },
  exportLogs() {
    const payload = {
      exportedAt: new Date().toISOString(),
      location: window.location.href,
      userAgent: navigator.userAgent,
      entries: this.getEntries(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `listenup-subtitle-debug-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
  clear() {
    debugEntries.length = 0;
  },
};
