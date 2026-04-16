import React, { memo } from "react";

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
  if (isAd) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm ml-3">ad...</p>
      </div>
    );
  }
  // Loading状态
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm ml-3">loading...</p>
      </div>
    );
  }

  // Error状态
  if (error) {
    return (
      <div className="p-4 flex items-center justify-center h-full">
        <p className="text-xs mt-1 break-words whitespace-pre-wrap text-center">
          {error}
        </p>
      </div>
    );
  }

  // Empty状态
  if (isEmpty) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm">empty</p>
        </div>
      </div>
    );
  }

  // 如果都不是以上状态，返回null（不渲染任何内容）
  return children;
});
