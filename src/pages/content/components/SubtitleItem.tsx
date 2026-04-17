import {
  memo,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { Icon } from "@iconify/react";
import { iconScale } from "@src/components/ui/iconScale";
import { SubtitleItem } from "../lib/subtitles/subtitleTypes";

interface SubtitleItemProps {
  subtitle: SubtitleItem;
  isActive: boolean;
  onSubtitleClick?: (subtitle: SubtitleItem, index: number) => void;
  onToast?: (message: string) => void;
  index: number;
}

export const SubtitleItemComponent = memo(function SubtitleItem({
  subtitle,
  isActive,
  onSubtitleClick,
  onToast,
  index,
}: SubtitleItemProps) {
  const [copyStatus, setCopyStatus] = useState(false);
  const [explainStatus, setExplainStatus] = useState(false);
  const [selectionActions, setSelectionActions] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const textContainerRef = useRef<HTMLDivElement | null>(null);
  const selectionPointerDownRef = useRef(false);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = getScopedSelection();
      const textContainer = textContainerRef.current;

      if (!selection || selection.isCollapsed || !textContainer) {
        setSelectionActions(null);
        return;
      }

      if (
        !textContainer.contains(selection.anchorNode) ||
        !textContainer.contains(selection.focusNode)
      ) {
        setSelectionActions(null);
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
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

  const getScopedSelection = () => {
    const rootNode = textContainerRef.current?.getRootNode();
    if (
      rootNode &&
      "getSelection" in rootNode &&
      typeof rootNode.getSelection === "function"
    ) {
      return rootNode.getSelection();
    }

    return window.getSelection();
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

  const handleWordClick = async (
    event: MouseEvent<HTMLSpanElement>,
    word: string,
    fullText: string
  ) => {
    event.stopPropagation();

    try {
      const selectedText = getSelectedText();
      if (selectedText) {
        return;
      }

      const copyText = `Explain this word to me in English: ${word} (Context: ${fullText})`;
      await navigator.clipboard.writeText(copyText);
      onToast?.(`Copied "${word}" prompt`);
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  const handleTextPointerDown = () => {
    selectionPointerDownRef.current = true;
    setSelectionActions(null);
  };

  const handleTextPointerUp = (_event: PointerEvent<HTMLDivElement>) => {
    const selectedText = getSelectedText();
    selectionPointerDownRef.current = false;

    if (!selectedText || selectedText.selection.rangeCount === 0) {
      setSelectionActions(null);
      return;
    }

    const range = selectedText.selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      setSelectionActions(null);
      return;
    }

    const toolbarWidth = 144;
    const nextX = Math.min(
      Math.max(rect.left + rect.width / 2 - toolbarWidth / 2, 12),
      window.innerWidth - toolbarWidth - 12
    );
    const nextY = Math.max(rect.top - 52, 12);

    setSelectionActions({
      text: selectedText.text,
      x: nextX,
      y: nextY,
    });
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

  const handleExplainSelectedText = async (
    event: MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();

    if (!selectionActions) {
      return;
    }

    try {
      const copyText = `Please explain this phrase in English within the context of the whole subtitle: ${selectionActions.text} (Context: ${subtitle.text})`;
      await navigator.clipboard.writeText(copyText);
      onToast?.("Copied selection prompt");
      clearSelection();
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  const renderWordsAsButtons = (text: string) => {
    const words = text.split(/(\s+|[.,!?;:()"])/);

    return words.map((word, wordIndex) => {
      if (/^\s*$/.test(word) || /^[.,!?;:()"]*$/.test(word)) {
        return <span key={wordIndex}>{word}</span>;
      }

      const cleanWord = word.replace(/^[.,!?;:()"]+|[.,!?;:()"]+$/g, "");
      if (!cleanWord) {
        return <span key={wordIndex}>{word}</span>;
      }

      return (
        <span
          key={wordIndex}
          className="inline cursor-pointer rounded-sm text-inherit transition-colors hover:text-blue-700"
          onClick={(event) => handleWordClick(event, cleanWord, text)}
        >
          {word}
        </span>
      );
    });
  };

  return (
    <div
      className={`group cursor-pointer border-b transition-colors last:border-b-0 ${
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
      <div className="relative flex items-start gap-4 px-3 py-2">
        <div
          className={`mt-0.5 w-11 shrink-0 font-mono text-[10px] tabular-nums ${
            isActive ? "text-blue-600" : "text-zinc-400"
          }`}
        >
          {formatTime(subtitle.startTime)}
        </div>

        <div
          ref={textContainerRef}
          className={`min-w-0 flex-1 pr-10 text-xs leading-relaxed ${
            isActive ? "font-medium text-zinc-900" : "text-zinc-600"
          }`}
          onPointerDown={handleTextPointerDown}
          onPointerUp={handleTextPointerUp}
        >
          {renderWordsAsButtons(subtitle.text)}
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

        {selectionActions && (
          <div
            className="fixed z-[10000] flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-1 py-1 shadow-xl"
            style={{
              left: selectionActions.x,
              top: selectionActions.y,
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
              <Icon icon="mdi:translate" className={iconScale.secondaryAction} />
              Explain
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
