/**
 * @purpose 正式 AI 设置页：包住共享的 AiSettingsForm，并提供打开 UI Preview 的入口。
 * @role    扩展的用户设置入口。
 * @deps    react-i18next、components/ai/AiSettingsForm、components/ui/LanguageSwitcher、utils/extensionPages
 * @gotcha  表单本体是共享组件，改字段去 AiSettingsForm；见 docs/modules/extension/ai-settings.md
 */
import { FC } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { AiSettingsForm } from "@src/components/ai/AiSettingsForm";
import { EXTENSION_PAGE_URLS, openExtensionPage } from "@src/utils/extensionPages";
import { LanguageSwitcher } from "@src/components/ui";
import { useTranslation } from "react-i18next";

const Options: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">
                {t("options.title")}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {t("options.description")}
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
              {t("options.openPreview")}
            </Button>
          </div>
          <div className="mt-4">
            <LanguageSwitcher />
          </div>
        </header>

        <AiSettingsForm />
      </div>
    </div>
  );
};

export default Options;
