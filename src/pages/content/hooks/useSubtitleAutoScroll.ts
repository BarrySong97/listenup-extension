import { useEffect, useRef, useState } from "react";
import { VListHandle } from "virtua";

/**
 * 字幕自动滚动钩子
 * 处理字幕列表的自动滚动到当前活跃字幕
 * 初始加载时立即跳转，避免长时间滚动动画
 */
export const useSubtitleAutoScroll = (
  currentSubtitleIndex: number,
  isAdPlaying: boolean
) => {
  const vListRef = useRef<VListHandle>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showReturnToActive, setShowReturnToActive] = useState(false);
  const [isFollowingCurrent, setIsFollowingCurrent] = useState(true);
  const isProgrammaticScroll = useRef(false);

  const isActiveSubtitleVisible = () => {
    if (!vListRef.current || currentSubtitleIndex < 0) {
      return true;
    }

    const startIndex = vListRef.current.findStartIndex();
    const endIndex = vListRef.current.findEndIndex();

    return (
      currentSubtitleIndex >= startIndex && currentSubtitleIndex <= endIndex
    );
  };

  const scrollToActiveSubtitle = (smooth: boolean) => {
    if (currentSubtitleIndex < 0 || !vListRef.current) {
      return;
    }

    isProgrammaticScroll.current = true;
    setIsFollowingCurrent(true);
    setShowReturnToActive(false);
    vListRef.current.scrollToIndex(currentSubtitleIndex, {
      align: "center",
      smooth,
    });
  };

  useEffect(() => {
    if (isAdPlaying) {
      return;
    }

    if (currentSubtitleIndex < 0 || !vListRef.current || !isFollowingCurrent) {
      return;
    }

    if (isInitialLoad) {
      scrollToActiveSubtitle(false);
      setIsInitialLoad(false);
      return;
    }

    scrollToActiveSubtitle(true);
  }, [
    currentSubtitleIndex,
    isInitialLoad,
    isAdPlaying,
    isFollowingCurrent,
  ]);

  const handleListScroll = () => {
    if (isProgrammaticScroll.current || currentSubtitleIndex < 0) {
      return;
    }

    if (isActiveSubtitleVisible()) {
      setShowReturnToActive(false);
      setIsFollowingCurrent(true);
      return;
    }

    setShowReturnToActive(true);
    setIsFollowingCurrent(false);
  };

  const handleListScrollEnd = () => {
    if (isProgrammaticScroll.current) {
      isProgrammaticScroll.current = false;
    }

    if (currentSubtitleIndex < 0) {
      setShowReturnToActive(false);
      return;
    }

    if (isActiveSubtitleVisible()) {
      setShowReturnToActive(false);
    }
  };

  const returnToActiveSubtitle = () => {
    scrollToActiveSubtitle(true);
  };

  return {
    vListRef,
    showReturnToActive,
    returnToActiveSubtitle,
    handleListScroll,
    handleListScrollEnd,
  };
};
