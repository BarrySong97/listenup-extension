/**
 * @purpose 渲染列表与影院模式共用的缺译文提示和本地 AI 指令复制入口。
 * @role    App.tsx 在用户选择译文/双语但当前 revision 无译文时的空状态。
 * @deps    @iconify/react
 * @gotcha  compact 形态必须保持可点击，不能被影院窗口的拖拽区域吞掉。
 */
import { Icon } from "@iconify/react";

export type TranslationCopyStatus = "idle" | "copying" | "copied" | "error";

interface TranslationMissingStateProps {
  compact?: boolean;
  copyStatus: TranslationCopyStatus;
  onCopy: () => void;
}

const copyLabel = (status: TranslationCopyStatus) => {
  if (status === "copying") return "正在复制…";
  if (status === "copied") return "已复制，粘贴给你的本地 AI";
  if (status === "error") return "复制失败，请重试";
  return "复制本地 AI 翻译指令";
};

export const TranslationMissingState = ({
  compact = false,
  copyStatus,
  onCopy,
}: TranslationMissingStateProps) => {
  const label = copyLabel(copyStatus);
  const icon = copyStatus === "copied" ? "mdi:check" : "mdi:content-copy";

  if (compact) {
    return (
      <button
        type="button"
        className="pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-black/50 hover:text-fg disabled:cursor-wait disabled:opacity-60"
        onClick={onCopy}
        disabled={copyStatus === "copying"}
        title={copyStatus === "error" ? label : "复制给本地 AI Agent 的翻译指令"}
      >
        <Icon icon={icon} className="h-3.5 w-3.5 flex-none" />
        <span>
          {copyStatus === "idle"
            ? "暂无译文 · 点击复制本地 AI 翻译指令"
            : label}
        </span>
      </button>
    );
  }

  return (
    <div className="grid min-h-full place-content-center justify-items-center px-6 text-center">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/[0.04] text-fg-muted">
        <Icon icon="mdi:translate" className="h-5 w-5" />
      </div>
      <h2 className="m-0 text-[14px] font-semibold text-fg">
        当前字幕还没有译文
      </h2>
      <p className="m-0 mt-2 max-w-[290px] text-[11px] leading-[1.55] text-fg-faint">
        使用本地 AI 安全读取字幕、翻译并写回 ListenUp。
      </p>
      <button
        type="button"
        className="mt-4 flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-[11px] font-medium text-fg transition-colors hover:bg-white/15 disabled:cursor-wait disabled:opacity-60"
        onClick={onCopy}
        disabled={copyStatus === "copying"}
      >
        <Icon icon={icon} className="h-3.5 w-3.5 flex-none" />
        {label}
      </button>
    </div>
  );
};
