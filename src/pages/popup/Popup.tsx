import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { iconScale } from "@src/components/ui/iconScale";

const previewUrl = chrome.runtime.getURL("src/pages/options/index.html");

export default function Popup() {
  const openPreviewPage = () => {
    chrome.tabs.create({ url: previewUrl });
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
              UI Preview
            </h1>
            <p className="mt-2 text-sm leading-5 text-zinc-600">
              Open the standalone preview tab to iterate on panel styles without
              reloading YouTube.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <Button
            color="primary"
            variant="solid"
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
          This opens:
          <span className="ml-1 font-mono text-[11px] text-zinc-700">
            src/pages/options/index.html
          </span>
        </div>
      </div>
    </main>
  );
}
