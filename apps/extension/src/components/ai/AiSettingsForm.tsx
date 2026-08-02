/**
 * @purpose AI 设置表单：base URL / API key / model / 图片搜索引擎，含连通性测试。
 * @role    被 options 页和内容脚本面板内的 AiSettingsCard 共用。
 * @deps    @heroui/react、services/ai/aiSettings、services/ai/explainClient 的 testAiConnection
 * @gotcha  API key 明文存 chrome.storage.local；字段说明见 docs/modules/extension/ai-settings.md
 */
import { FC, useEffect, useState } from "react";
import { Button, Input, Select, SelectItem } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  AiSettings,
  DEFAULT_AI_SETTINGS,
  ImageSearchEngine,
  loadAiSettings,
  saveAiSettings,
} from "@src/services/ai/aiSettings";
import { testAiConnection } from "@src/services/ai/explainClient";

type SaveState = "idle" | "saving" | "saved";
type TestState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "success"; sample: string }
  | { kind: "error"; message: string };

const ENGINE_OPTIONS: Array<{ key: ImageSearchEngine; label: string }> = [
  { key: "bing", label: "Bing Images" },
  { key: "google", label: "Google Images" },
  { key: "baidu", label: "Baidu Images" },
];

interface AiSettingsFormProps {
  sectionClassName?: string;
}

export const AiSettingsForm: FC<AiSettingsFormProps> = ({
  sectionClassName,
}) => {
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });

  useEffect(() => {
    loadAiSettings().then((nextSettings) => {
      setSettings(nextSettings);
      setLoaded(true);
    });
  }, []);

  const update = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
    setSaveState("idle");
  };

  const handleSave = async () => {
    setSaveState("saving");
    await saveAiSettings(settings);
    setSaveState("saved");
    window.setTimeout(() => {
      setSaveState((current) => (current === "saved" ? "idle" : current));
    }, 1600);
  };

  const handleTest = async () => {
    setTestState({ kind: "running" });
    await saveAiSettings(settings);
    const result = await testAiConnection(settings);
    if (result.ok) {
      setTestState({
        kind: "success",
        sample: result.sample.meaningExplain,
      });
      return;
    }

    setTestState({ kind: "error", message: result.error });
  };

  const resolvedSectionClassName =
    sectionClassName ??
    "rounded-xl border border-zinc-200 bg-white p-6 shadow-sm";

  if (!loaded) {
    return (
      <div
        className={`flex min-h-[12rem] items-center justify-center text-sm text-zinc-500 ${resolvedSectionClassName}`}
      >
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={resolvedSectionClassName}>
        <h2 className="text-base font-semibold text-zinc-900">AI Provider</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Any OpenAI-compatible endpoint works (OpenAI, Groq, OpenRouter,
          Azure OpenAI, self-hosted, …).
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <Input
            label="Base URL"
            placeholder="https://api.openai.com/v1"
            value={settings.baseUrl}
            onValueChange={(value) => update("baseUrl", value)}
            description="Must end without a trailing slash."
          />

          <Input
            label="API Key"
            placeholder="sk-…"
            value={settings.apiKey}
            onValueChange={(value) => update("apiKey", value)}
            type={showKey ? "text" : "password"}
            endContent={
              <button
                type="button"
                aria-label={showKey ? "Hide key" : "Show key"}
                onClick={() => setShowKey((current) => !current)}
                className="text-zinc-500"
              >
                <Icon
                  icon={showKey ? "mdi:eye-off-outline" : "mdi:eye-outline"}
                  width={18}
                />
              </button>
            }
          />

          <Input
            label="Model"
            placeholder="gpt-4o-mini"
            value={settings.model}
            onValueChange={(value) => update("model", value)}
          />
        </div>
      </section>

      <section className={resolvedSectionClassName}>
        <h2 className="text-base font-semibold text-zinc-900">
          Visual Reference
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          The engine used to fetch the image strip shown inside the Explain
          card.
        </p>
        <div className="mt-4">
          <Select
            label="Image search engine"
            selectedKeys={[settings.imageSearchEngine]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as
                | ImageSearchEngine
                | undefined;
              if (value) {
                update("imageSearchEngine", value);
              }
            }}
          >
            {ENGINE_OPTIONS.map((option) => (
              <SelectItem key={option.key}>{option.label}</SelectItem>
            ))}
          </Select>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 px-1">
        <Button
          color="primary"
          onPressStart={handleSave}
          isLoading={saveState === "saving"}
        >
          {saveState === "saved" ? "Saved" : "Save"}
        </Button>
        <Button
          color="default"
          variant="flat"
          onPressStart={handleTest}
          isLoading={testState.kind === "running"}
        >
          Test connection
        </Button>

        {testState.kind === "success" ? (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            <Icon icon="mdi:check-circle" width={18} />
            Connected · sample: "{testState.sample}"
          </span>
        ) : null}
        {testState.kind === "error" ? (
          <span className="flex items-center gap-1 text-sm text-red-600">
            <Icon icon="mdi:alert-circle" width={18} />
            {testState.message}
          </span>
        ) : null}
      </div>
    </div>
  );
};
