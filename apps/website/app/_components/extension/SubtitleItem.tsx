/**
 * @purpose 演示用的单条字幕，含选中文本后的浮动工具条。
 * @role    演示列表的行组件（扩展同名组件的副本）。
 * @deps    @iconify/react、./iconScale、./subtitleTypes
 * @gotcha  交互是演示性质的，不连任何真实 AI 服务
 */
"use client";
import {
  memo,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { Icon } from "@iconify/react";
import { iconScale } from "./iconScale";
import { SubtitleItem } from "./subtitleTypes";

interface SubtitleItemProps {
  subtitle: SubtitleItem;
  isActive: boolean;
  onSubtitleClick?: (subtitle: SubtitleItem, index: number) => void;
  onToast?: (message: string) => void;
  onRequestExplain?: (target: { text: string; context: string }) => void;
  index: number;
  showTip?: boolean;
  tipWord?: string;
}

export const SubtitleItemComponent = memo(function SubtitleItem({
  subtitle,
  isActive,
  onSubtitleClick,
  onToast,
  onRequestExplain,
  index,
  showTip = false,
  tipWord,
}: SubtitleItemProps) {
  const TOOLBAR_WIDTH = 156;
  const TOOLBAR_HEIGHT = 36;
  const TOOLBAR_GAP = 6;
  const TOOLBAR_PADDING = 8;
  const [copyStatus, setCopyStatus] = useState(false);
  const [explainStatus, setExplainStatus] = useState(false);
  const [selectionActions, setSelectionActions] = useState<{
    text: string;
    left: number;
    top: number;
    placement: "top" | "bottom";
  } | null>(null);
  const itemContentRef = useRef<HTMLDivElement | null>(null);
  const textContainerRef = useRef<HTMLDivElement | null>(null);
  const selectionPointerDownRef = useRef(false);
  const selectionRafRef = useRef<number | null>(null);

  const getScopedSelection = () => {
    const rootNode = textContainerRef.current?.getRootNode();
    if (
      rootNode &&
      "getSelection" in rootNode &&
      typeof (rootNode as Document).getSelection === "function"
    ) {
      return (rootNode as Document).getSelection();
    }

    return window.getSelection();
  };

  const getScrollViewport = (element: HTMLElement | null) => {
    let current = element?.parentElement ?? null;

    while (current) {
      const computedStyle = window.getComputedStyle(current);
      const overflowY = computedStyle.overflowY;
      const isScrollable =
        (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
        current.scrollHeight > current.clientHeight;

      if (isScrollable) {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  };

  const syncSelectionActions = () => {
    const selection = getScopedSelection();
    const textContainer = textContainerRef.current;
    const itemContent = itemContentRef.current;
    const containerRect = itemContent?.getBoundingClientRect();
    const viewportRect =
      getScrollViewport(itemContent)?.getBoundingClientRect() ?? containerRect;

    if (
      !selection ||
      selection.isCollapsed ||
      !textContainer ||
      !containerRect ||
      !viewportRect ||
      !textContainer.contains(selection.anchorNode) ||
      !textContainer.contains(selection.focusNode) ||
      selection.rangeCount === 0
    ) {
      setSelectionActions(null);
      return;
    }

    const text = selection.toString().replace(/\s+/g, " ").trim();
    if (!text) {
      setSelectionActions(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      setSelectionActions(null);
      return;
    }

    const centerX = rect.left + rect.width / 2 - containerRect.left;
    const maxLeft = Math.max(
      containerRect.width - TOOLBAR_WIDTH - TOOLBAR_PADDING,
      TOOLBAR_PADDING
    );
    const left = Math.min(
      Math.max(centerX - TOOLBAR_WIDTH / 2, TOOLBAR_PADDING),
      maxLeft
    );

    const canPlaceTop = rect.top - viewportRect.top >= TOOLBAR_HEIGHT + TOOLBAR_GAP;
    const canPlaceBottom =
      viewportRect.bottom - rect.bottom >= TOOLBAR_HEIGHT + TOOLBAR_GAP;
    const placement =
      canPlaceTop || !canPlaceBottom ? "top" : "bottom";
    const top =
      placement === "top"
        ? rect.top - containerRect.top
        : rect.bottom - containerRect.top + TOOLBAR_GAP;

    setSelectionActions({
      text,
      left,
      top,
      placement,
    });
  };

  const scheduleSelectionActionsSync = () => {
    if (selectionRafRef.current) {
      window.cancelAnimationFrame(selectionRafRef.current);
    }

    selectionRafRef.current = window.requestAnimationFrame(() => {
      selectionRafRef.current = null;
      syncSelectionActions();
    });
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      if (selectionPointerDownRef.current) {
        return;
      }

      scheduleSelectionActionsSync();
    };

    const handleGlobalPointerUp = () => {
      if (!selectionPointerDownRef.current) {
        return;
      }

      selectionPointerDownRef.current = false;
      scheduleSelectionActionsSync();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("pointerup", handleGlobalPointerUp, true);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("pointerup", handleGlobalPointerUp, true);
      if (selectionRafRef.current) {
        window.cancelAnimationFrame(selectionRafRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const showCopySuccess = () => {
    setCopyStatus(true);
    window.setTimeout(() => {
      setCopyStatus(false);
    }, 1500);
  };

  const showExplainSuccess = () => {
    setExplainStatus(true);
    window.setTimeout(() => {
      setExplainStatus(false);
    }, 1500);
  };

  const clearSelection = () => {
    const selection = getScopedSelection();
    selection?.removeAllRanges();
    setSelectionActions(null);
  };

  const getSelectedText = () => {
    const selection = getScopedSelection();
    const textContainer = textContainerRef.current;

    if (
      !selection ||
      selection.isCollapsed ||
      !textContainer ||
      !textContainer.contains(selection.anchorNode) ||
      !textContainer.contains(selection.focusNode)
    ) {
      return null;
    }

    const text = selection.toString().replace(/\s+/g, " ").trim();
    if (!text) {
      return null;
    }

    return { selection, text };
  };

  const handleCopySubtitle = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    try {
      const timeText = `${formatTime(subtitle.startTime)} - ${formatTime(
        subtitle.endTime
      )}`;
      const copyText = `${timeText}\n${subtitle.text}`;

      await navigator.clipboard.writeText(copyText);
      showCopySuccess();
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  const handleCopyExplain = async (
    event: MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();

    try {
      const explainText = `Explain this sentence to me in the context of the whole subtitle: ${subtitle.text}`;

      await navigator.clipboard.writeText(explainText);
      showExplainSuccess();
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  const handleTextPointerDown = () => {
    selectionPointerDownRef.current = true;
    setSelectionActions(null);
  };

  const handleCopySelectedText = async (
    event: MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();

    if (!selectionActions) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectionActions.text);
      onToast?.("Copied selection");
      clearSelection();
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  const handleExplainSelectedText = (
    event: MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();

    if (!selectionActions) {
      return;
    }

    onRequestExplain?.({
      text: selectionActions.text,
      context: subtitle.text,
    });
    clearSelection();
  };

  return (
    <div
      className={`group border-b transition-colors last:border-b-0 ${
        isActive
          ? "border-blue-100 bg-blue-50"
          : "border-zinc-100/80 hover:bg-zinc-100/50"
      }`}
      onClick={() => {
        if (getSelectedText() || selectionPointerDownRef.current) {
          return;
        }

        onSubtitleClick?.(subtitle, index);
      }}
    >
      <div
        ref={itemContentRef}
        className="relative flex items-start gap-4 px-3 py-2"
      >
        <div
          className={`mt-0.5 w-11 shrink-0 font-mono text-[10px] tabular-nums ${
            isActive ? "text-blue-600" : "text-zinc-400"
          }`}
        >
          {formatTime(subtitle.startTime)}
        </div>

        <div
          ref={textContainerRef}
          className={`min-w-0 cursor-text flex-1 pr-20 text-xs leading-relaxed ${
            isActive ? "text-zinc-900" : "text-zinc-600"
          }`}
          onPointerDown={handleTextPointerDown}
        >
          {showTip && tipWord && subtitle.text.includes(tipWord) ? (() => {
            const idx = subtitle.text.indexOf(tipWord);
            return (
              <>
                {subtitle.text.slice(0, idx)}
                <span data-lu-target="word" className="bg-blue-100 text-blue-900 rounded px-0.5">
                  {tipWord}
                </span>
                {subtitle.text.slice(idx + tipWord.length)}
              </>
            );
          })() : subtitle.text}
        </div>

        <div className="absolute right-2 top-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white hover:text-zinc-700"
            onClick={handleCopyExplain}
            aria-label="Copy explanation prompt"
          >
            <Icon
              icon={explainStatus ? "mdi:check" : "mdi:translate"}
              className={`${iconScale.secondaryAction} ${
                explainStatus ? "text-blue-600" : ""
              }`}
            />
          </button>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white hover:text-zinc-700"
            onClick={handleCopySubtitle}
            aria-label="Copy subtitle"
          >
            <Icon
              icon={copyStatus ? "mdi:check" : "mdi:content-copy"}
              className={`${iconScale.secondaryAction} ${
                copyStatus ? "text-blue-600" : ""
              }`}
            />
          </button>
        </div>

        {showTip && (
          <div
            className="absolute z-20 flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-1 py-1 shadow-xl"
            style={{
              left: TOOLBAR_PADDING,
              top: 0,
              transform: `translateY(calc(-100% - ${TOOLBAR_GAP}px))`,
            }}
          >
            <button
              type="button"
              className="flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              onClick={(e) => { e.stopPropagation(); }}
            >
              <Icon
                icon="mdi:content-copy"
                className={iconScale.secondaryAction}
              />
              Copy
            </button>
            <button
              type="button"
              className="flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              onClick={(e) => { e.stopPropagation(); onRequestExplain?.({ text: subtitle.text, context: subtitle.text }); }}
              data-lu-target="explain"
            >
              <Icon
                icon="mdi:translate"
                className={iconScale.secondaryAction}
              />
              Explain
            </button>
          </div>
        )}

        {!showTip && selectionActions && (
          <div
            className="absolute z-20 flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-1 py-1 shadow-xl"
            style={{
              left: selectionActions.left,
              top: selectionActions.top,
              transform:
                selectionActions.placement === "top"
                  ? `translateY(calc(-100% - ${TOOLBAR_GAP}px))`
                  : undefined,
              maxWidth: `calc(100% - ${TOOLBAR_PADDING * 2}px)`,
            }}
          >
            <button
              type="button"
              className="flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              onClick={handleCopySelectedText}
            >
              <Icon
                icon="mdi:content-copy"
                className={iconScale.secondaryAction}
              />
              Copy
            </button>
            <button
              type="button"
              className="flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              onClick={handleExplainSelectedText}
            >
              <Icon
                icon="mdi:translate"
                className={iconScale.secondaryAction}
              />
              Explain
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
