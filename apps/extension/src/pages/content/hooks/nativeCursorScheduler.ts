/**
 * @purpose 对 Native cursor 做 250ms 节流，并允许 seek/索引变化强制发送最新值。
 * @role    useNativeSubtitleBridge 的纯时序单元，可在 Node 中用 fake clock 确定性测试。
 * @deps    src/shared/nativeSubtitleProtocol
 * @gotcha  force 必须先取消旧 timer；dispose 后任何旧回调都不得继续发送。
 */
import type { NativeSubtitleCursorPayload } from "@src/shared/nativeSubtitleProtocol";

interface CursorTimer {
  cancel: () => void;
}

export interface NativeCursorSchedulerOptions {
  throttleMs: number;
  now: () => number;
  schedule: (callback: () => void, delayMs: number) => CursorTimer;
  send: (cursor: NativeSubtitleCursorPayload) => void;
}

export interface NativeCursorUpdateOptions {
  force?: boolean;
}

export class NativeCursorScheduler {
  private readonly options: NativeCursorSchedulerOptions;
  private latest: NativeSubtitleCursorPayload | null = null;
  private timer: CursorTimer | null = null;
  private lastSentAt = Number.NEGATIVE_INFINITY;
  private lastSubtitleIndex: number | null = null;
  private disposed = false;

  constructor(options: NativeCursorSchedulerOptions) {
    this.options = options;
  }

  update(
    cursor: NativeSubtitleCursorPayload,
    { force = false }: NativeCursorUpdateOptions = {}
  ) {
    if (this.disposed) return;
    this.latest = cursor;

    const indexChanged = this.lastSubtitleIndex !== cursor.currentIndex;
    const elapsed = this.options.now() - this.lastSentAt;
    if (force || indexChanged || elapsed >= this.options.throttleMs) {
      this.cancelTimer();
      this.flush();
      return;
    }

    if (!this.timer) {
      this.timer = this.options.schedule(
        () => {
          this.timer = null;
          this.flush();
        },
        Math.max(0, this.options.throttleMs - elapsed)
      );
    }
  }

  dispose() {
    this.disposed = true;
    this.latest = null;
    this.cancelTimer();
  }

  private flush() {
    if (this.disposed || !this.latest) return;
    const cursor = this.latest;
    this.latest = null;
    this.lastSentAt = this.options.now();
    this.lastSubtitleIndex = cursor.currentIndex;
    this.options.send(cursor);
  }

  private cancelTimer() {
    this.timer?.cancel();
    this.timer = null;
  }
}
