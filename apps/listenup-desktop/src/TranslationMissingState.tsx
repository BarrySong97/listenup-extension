/**
 * @purpose 渲染列表与影院模式共用的缺译文提示和本地 AI 指令复制入口。
 * @role    App.tsx 在用户选择译文/双语但当前 revision 无译文时的空状态。
 * @deps    @iconify/react、react-i18next、./components/ui/DesktopButton
 * @gotcha  compact 形态必须保持可点击，不能被影院窗口的拖拽区域吞掉。
 */
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { DesktopButton } from "./components/ui/DesktopButton";

export type TranslationCopyStatus = "idle" | "copying" | "copied" | "error";

interface TranslationMissingStateProps {
  compact?: boolean;
  copyStatus: TranslationCopyStatus;
  onCopy: () => void;
}

export const TranslationMissingState = ({
  compact = false,
  copyStatus,
  onCopy,
}: TranslationMissingStateProps) => {
  const { t } = useTranslation();
  const label =
    copyStatus === "copying"
      ? t("translation.copying")
      : copyStatus === "copied"
        ? t("translation.copied")
        : copyStatus === "error"
          ? t("translation.copyFailed")
          : t("translation.copyInstruction");
  const icon = copyStatus === "copied" ? "mdi:check" : "mdi:content-copy";

  if (compact) {
    return (
      <DesktopButton
        className="pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-black/50 hover:text-fg disabled:cursor-wait disabled:opacity-60"
        onPress={onCopy}
        isDisabled={copyStatus === "copying"}
      >
        <Icon icon={icon} className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
        <span>
          {copyStatus === "idle" ? t("translation.compactMissing") : label}
        </span>
      </DesktopButton>
    );
  }

  return (
    <div className="grid min-h-full place-content-center justify-items-center px-6 text-center">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/[0.04] text-fg-muted">
        <Icon icon="mdi:translate" className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="m-0 text-[14px] font-semibold text-fg">
        {t("translation.missingTitle")}
      </h2>
      <p className="m-0 mt-2 max-w-[290px] text-[11px] leading-[1.55] text-fg-faint">
        {t("translation.missingDescription")}
      </p>
      <DesktopButton
        className="mt-4 flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-[11px] font-medium text-fg transition-colors hover:bg-white/15 disabled:cursor-wait disabled:opacity-60"
        onPress={onCopy}
        isDisabled={copyStatus === "copying"}
      >
        <Icon icon={icon} className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
        {label}
      </DesktopButton>
    </div>
  );
};
