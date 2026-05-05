import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { iconScale } from "@src/components/ui/iconScale";
import { EXTENSION_PAGE_URLS } from "@src/utils/extensionPages";

export default function Popup() {
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
              Quick Access
            </h1>
            <p className="mt-2 text-sm leading-5 text-zinc-600">
              Open AI settings for real usage, or open the standalone preview
              tab to iterate on panel styles without reloading YouTube.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Button
            color="primary"
            variant="solid"
            className="h-11 w-full justify-center text-sm font-semibold"
            startContent={
              <Icon icon="mdi:cog-outline" className={iconScale.secondaryAction} />
            }
            onPressStart={openSettingsPage}
          >
            Open AI Settings
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
            Open UI Preview
          </Button>
        </div>

        <div className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500">
          Preview:
          <span className="ml-1 font-mono text-[11px] text-zinc-700">
            src/pages/newtab/index.html
          </span>
        </div>
      </div>
    </main>
  );
}
