/**
 * @purpose 扩展弹窗：打开 AI 设置页、UI Preview 页与 ListenUp Desktop 深链接。
 * @role    轻量入口，不承载产品能力。
 * @deps    chrome.tabs、react-i18next、components/ui、utils/extensionPages、shared/nativeSubtitleProtocol
 * @gotcha  深链接按构建环境切 listenup:// 与 listenup-dev://；见 docs/modules/extension/entry-pages.md
 */
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { iconScale } from "@src/components/ui/iconScale";
import { EXTENSION_PAGE_URLS } from "@src/utils/extensionPages";
import { DESKTOP_DEEP_LINK } from "@src/shared/nativeSubtitleProtocol";
import { LanguageSwitcher } from "@src/components/ui";
import { useTranslation } from "react-i18next";

export default function Popup() {
  const { t } = useTranslation();
  const openDesktopApp = () => {
    // 通过深链接打开 ListenUp Desktop（dev 构建打开 DEV app）；
    // app 打开后播放视频即自动连接（Native Messaging 只做无窗口桥接）
    chrome.tabs.create({ url: DESKTOP_DEEP_LINK });
    window.close();
  };

  const openPreviewPage = () => {
    chrome.tabs.create({ url: EXTENSION_PAGE_URLS.preview });
    window.close();
  };

  const openSettingsPage = () => {
    chrome.tabs.create({ url: EXTENSION_PAGE_URLS.options });
    window.close();
  };

  return (
    <main className="w-[21rem] bg-[radial-gradient(circle_at_top,#ffffff_0%,#f4f4f5_100%)] p-4 text-zinc-900">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <Icon icon="mdi:monitor-dashboard" className={iconScale.surface} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Listen Up
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">
              {t("popup.quickAccess")}
            </h1>
            <p className="mt-2 text-sm leading-5 text-zinc-600">
              {t("popup.description")}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Button
            color="primary"
            variant="solid"
            className="h-11 w-full justify-center text-sm font-semibold"
            startContent={
              <Icon icon="mdi:monitor-shimmer" className={iconScale.secondaryAction} />
            }
            onPressStart={openDesktopApp}
          >
            {t("popup.openDesktop")}
          </Button>
          <Button
            color="default"
            variant="flat"
            className="h-11 w-full justify-center text-sm font-semibold"
            startContent={
              <Icon icon="mdi:cog-outline" className={iconScale.secondaryAction} />
            }
            onPressStart={openSettingsPage}
          >
            {t("popup.openAiSettings")}
          </Button>
          <Button
            color="default"
            variant="flat"
            className="h-11 w-full justify-center text-sm font-semibold"
            startContent={
              <Icon icon="mdi:open-in-new" className={iconScale.secondaryAction} />
            }
            onPressStart={openPreviewPage}
          >
            {t("popup.openPreview")}
          </Button>
        </div>

        <div className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500">
          {t("popup.preview")}
          <span className="ml-1 font-mono text-[11px] text-zinc-700">
            src/pages/newtab/index.html
          </span>
        </div>
        <div className="mt-3 flex justify-end">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  );
}
