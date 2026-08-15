/**
 * @purpose Explain 解释卡片：词性、音标朗读、AI 讲解、图片参考与错误态。
 * @role    面板内右侧滑出的覆盖层，数据来自 useExplain。
 * @deps    services/ai/explainSchema、services/search/imageSearch、services/tts/speak、framer-motion、react-i18next
 * @gotcha  加载分 skeleton → 原始 JSON 文本 → 正式 UI 三段；缺 key 时错误区要给出打开设置的入口。见 docs/modules/extension/explain-card.md
 */
import { FC, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Button, Chip } from "@heroui/react";
import { iconScale } from "@src/components/ui/iconScale";
import { ExplainResult } from "@src/services/ai/explainSchema";
import { ImageSearchResult } from "@src/services/search/imageSearch";
import { buildWebSearchUrl } from "@src/services/search/imageSearch";
import { AiSettings } from "@src/services/ai/aiSettings";
import { speak } from "@src/services/tts/speak";
import { ExplainTarget } from "../hooks/useExplain";
import { useTranslation } from "react-i18next";

interface ExplainCardProps {
  target: ExplainTarget | null;
  data: ExplainResult | null;
  loading: boolean;
  error: string | null;
  streamText: string;
  images: ImageSearchResult[];
  imagesLoading: boolean;
  settings: AiSettings | null;
  onClose: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

function highlightSelection(context: string, selection: string) {
  if (!selection) return context;
  const idx = context.toLowerCase().indexOf(selection.toLowerCase());
  if (idx < 0) return context;
  return (
    <>
      {context.slice(0, idx)}
      <strong className="font-semibold text-zinc-900">
        {context.slice(idx, idx + selection.length)}
      </strong>
      {context.slice(idx + selection.length)}
    </>
  );
}

const SkeletonBar: FC<{ className?: string }> = ({ className }) => (
  <div
    className={`animate-pulse rounded bg-zinc-200/80 ${className ?? "h-3 w-full"}`}
  />
);

export const ExplainCard: FC<ExplainCardProps> = ({
  target,
  data,
  loading,
  error,
  streamText,
  images,
  imagesLoading,
  settings,
  onClose,
  onRefresh,
  onOpenSettings,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (!target) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [target, onClose]);

  const headerActionButtonClassName =
    "h-9 w-9 min-w-0 rounded-md p-0 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 data-[hover=true]:bg-zinc-100 data-[hover=true]:text-zinc-900";
  const isStreamingPreviewVisible = loading && !data && Boolean(streamText);
  const showInitialSkeleton = loading && !data && !streamText;

  return (
    <AnimatePresence>
      {target && (
        <motion.div
          key="explain-card"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[26em] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.22)]"
        >
          <div className="flex items-start justify-between gap-2 px-4 pt-3 pb-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xl font-bold leading-tight text-zinc-900">
                {target.text}
              </div>
              {data?.partOfSpeech ? (
                <div className="mt-1.5">
                  <Chip size="sm" variant="flat" className="bg-zinc-100 text-zinc-700">
                    {data.partOfSpeech}
                  </Chip>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <Button
                isIconOnly
                size="md"
                variant="light"
                className={headerActionButtonClassName}
                onPressStart={onOpenSettings}
                aria-label={t("explainCard.aiSettings")}
              >
                <Icon icon="mdi:cog-outline" className={iconScale.headerAction} />
              </Button>
              <Button
                isIconOnly
                size="md"
                variant="light"
                className={headerActionButtonClassName}
                onPressStart={onRefresh}
                aria-label={t("common.refresh")}
                isDisabled={loading}
              >
                <Icon icon="mdi:refresh" className={iconScale.headerAction} />
              </Button>
              <Button
                isIconOnly
                size="md"
                variant="light"
                className={headerActionButtonClassName}
                onPressStart={onClose}
                aria-label={t("common.close")}
              >
                <Icon icon="mdi:close" className={iconScale.headerAction} />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {data?.phonetics?.us || data?.phonetics?.uk ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {data.phonetics.us ? (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 transition-colors hover:bg-zinc-200"
                    onClick={() => speak(target.text, "us")}
                  >
                    <span className="font-semibold text-[10px] uppercase tracking-wide text-zinc-500">
                      US
                    </span>
                    <span>/{data.phonetics.us}/</span>
                    <Icon icon="mdi:volume-high" className={iconScale.secondaryAction} />
                  </button>
                ) : null}
                {data.phonetics.uk ? (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 transition-colors hover:bg-zinc-200"
                    onClick={() => speak(target.text, "uk")}
                  >
                    <span className="font-semibold text-[10px] uppercase tracking-wide text-zinc-500">
                      UK
                    </span>
                    <span>/{data.phonetics.uk}/</span>
                    <Icon icon="mdi:volume-high" className={iconScale.secondaryAction} />
                  </button>
                ) : null}
              </div>
            ) : null}

            {target.context ? (
              <div className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs italic text-zinc-600">
                "{highlightSelection(target.context, target.text)}"
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <div>{error}</div>
                <div className="mt-2">
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    onPressStart={onOpenSettings}
                  >
                    {t("explainCard.openAiSettings")}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-700">
                <Icon icon="mdi:book-open-page-variant-outline" className={iconScale.secondaryAction} />
                <span>{t("explainCard.meaning")}</span>
              </div>
              <div className="mt-1 text-[15px] font-semibold text-zinc-900">
                {showInitialSkeleton ? (
                  <div className="space-y-2">
                    <SkeletonBar className="h-3 w-full" />
                    <SkeletonBar className="h-3 w-3/4" />
                  </div>
                ) : isStreamingPreviewVisible ? (
                  <pre className="overflow-auto rounded-md bg-zinc-50 px-3 py-2 font-mono text-[12px] leading-5 font-normal text-zinc-700 whitespace-pre-wrap break-words">
                    {streamText}
                  </pre>
                ) : (
                  data?.meaningExplain || (error ? "—" : "")
                )}
              </div>
            </div>

            <div className="my-4 h-px bg-zinc-200/70" />

            <div>
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-700">
                <Icon icon="mdi:format-list-bulleted" className={iconScale.secondaryAction} />
                <span>{t("explainCard.detailsUsage")}</span>
              </div>
              {showInitialSkeleton ? (
                <div className="mt-2 space-y-2">
                  <SkeletonBar className="h-3 w-11/12" />
                  <SkeletonBar className="h-3 w-9/12" />
                  <SkeletonBar className="h-3 w-10/12" />
                </div>
              ) : isStreamingPreviewVisible ? (
                <pre className="mt-2 overflow-auto rounded-md bg-zinc-50 px-3 py-2 font-mono text-[12px] leading-5 text-zinc-700 whitespace-pre-wrap break-words">
                  {streamText}
                </pre>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-800">
                  {(data?.detailExplain ?? []).map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="my-4 h-px bg-zinc-200/70" />

            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-700">
                  <Icon icon="mdi:image-multiple-outline" className={iconScale.secondaryAction} />
                  <span>{t("explainCard.visualReference")}</span>
                </div>
                {settings ? (
                  <a
                    href={buildWebSearchUrl(
                      settings.imageSearchEngine,
                      target.text
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-200"
                  >
                    <Icon icon="mdi:magnify" className="h-3.5 w-3.5" />
                    {t("explainCard.moreImages")}
                  </a>
                ) : null}
              </div>
              {imagesLoading && images.length === 0 ? (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <SkeletonBar
                      key={idx}
                      className="h-24 w-24 shrink-0 rounded-md"
                    />
                  ))}
                </div>
              ) : images.length > 0 ? (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <a
                      key={idx}
                      href={img.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="h-24 w-24 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100"
                    >
                      <img
                        src={img.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs text-zinc-500">
                  {t("explainCard.noImages")}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
