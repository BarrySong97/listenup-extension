import { FC } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { AiSettingsForm } from "@src/components/ai/AiSettingsForm";
import { EXTENSION_PAGE_URLS, openExtensionPage } from "@src/utils/extensionPages";

const Options: FC = () => {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">
                ListenUp Settings
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Configure the AI provider used by the Explain card and the image
                source for visual references.
              </p>
            </div>
            <Button
              color="default"
              variant="flat"
              startContent={
                <Icon icon="mdi:monitor-dashboard" className="h-4 w-4" />
              }
              onPressStart={() => openExtensionPage(EXTENSION_PAGE_URLS.preview)}
            >
              Open UI Preview
            </Button>
          </div>
        </header>

        <AiSettingsForm />
      </div>
    </div>
  );
};

export default Options;
