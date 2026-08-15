/**
 * @purpose 字幕四态渲染：ad / loading / error / empty，都不命中才渲染 children。
 * @role    列表区域的状态守卫，扩展与预览页共用。
 * @deps    react、react-i18next
 * @gotcha  四态的判定顺序固定（ad 优先），改顺序会影响广告期间的表现
 */
import React, { memo } from "react";
import { useTranslation } from "react-i18next";

interface SubtitleStatesProps {
  loading?: boolean;
  error: string | null;
  isEmpty: boolean;
  isAd: boolean;
  children?: React.ReactNode;
}

export const SubtitleStates = memo(function SubtitleStates({
  loading = false,
  error,
  isEmpty,
  isAd,
  children,
}: SubtitleStatesProps) {
  const { t } = useTranslation();

  if (isAd) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center">
        <p className="text-xs text-zinc-500">{t("subtitles.pausedDuringAds")}</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center">
        <p className="text-xs text-zinc-500">{t("subtitles.loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="break-words whitespace-pre-wrap text-center text-xs text-zinc-500">
          {error}
        </p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center">
        <div className="text-center">
          <p className="text-xs text-zinc-500">{t("subtitles.empty")}</p>
        </div>
      </div>
    );
  }

  return children;
});
