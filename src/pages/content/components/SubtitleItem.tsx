import { memo, useEffect, useState, type MouseEvent } from "react";
import { Icon } from "@iconify/react";
import { iconScale } from "@src/components/ui/iconScale";
import { SubtitleItem } from "../lib/subtitles/subtitleTypes";

interface SubtitleItemProps {
  subtitle: SubtitleItem;
  isActive: boolean;
  onSubtitleClick?: (subtitle: SubtitleItem, index: number) => void;
  index: number;
}

export const SubtitleItemComponent = memo(function SubtitleItem({
  subtitle,
  isActive,
  onSubtitleClick,
  index,
}: SubtitleItemProps) {
  const [copyStatus, setCopyStatus] = useState(false);
  const [explainStatus, setExplainStatus] = useState(false);
  const [wordCopyStatus, setWordCopyStatus] = useState<number | null>(null);
  const [selectedRange, setSelectedRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift" && selectedRange) {
        setSelectedRange(null);
        setLastClickedIndex(null);
      }
    };

    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedRange]);

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
    event: MouseEvent<HTMLButtonElement>,
    wordIndex: number,
    word: string,
    fullText: string
  ) => {
    event.stopPropagation();

    try {
      if (event.shiftKey && lastClickedIndex !== null) {
        const start = Math.min(lastClickedIndex, wordIndex);
        const end = Math.max(lastClickedIndex, wordIndex);
        setSelectedRange({ start, end });

        const words = fullText.split(/(\s+|[.,!?;:()"])/);
        const selectedTokens = words.slice(start, end + 1);
        const selectedPhrase = selectedTokens.join("").trim();
        const copyText = `Please explain this phrase in English within the context of the whole subtitle: ${selectedPhrase} (Context: ${fullText})`;
        await navigator.clipboard.writeText(copyText);

        setWordCopyStatus(-1);
        window.setTimeout(() => {
          setWordCopyStatus(null);
        }, 1500);
        return;
      }

      setSelectedRange(null);
      setLastClickedIndex(wordIndex);

      const copyText = `Explain this word to me in English: ${word} (Context: ${fullText})`;
      await navigator.clipboard.writeText(copyText);

      setWordCopyStatus(wordIndex);
      window.setTimeout(() => {
        setWordCopyStatus(null);
      }, 1500);
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

      const isInSelectedRange =
        selectedRange &&
        wordIndex >= selectedRange.start &&
        wordIndex <= selectedRange.end;

      const isWordCopied =
        wordCopyStatus === wordIndex ||
        (selectedRange && wordCopyStatus === -1 && isInSelectedRange);

      return (
        <button
          key={wordIndex}
          type="button"
          className={`inline rounded-sm transition-colors outline-none ${
            isWordCopied
              ? "bg-emerald-100 text-emerald-700"
              : isInSelectedRange
              ? "bg-blue-100 text-blue-700"
              : "text-inherit hover:text-blue-700"
          }`}
          onClick={(event) =>
            handleWordClick(event, wordIndex, cleanWord, text)
          }
        >
          {word}
        </button>
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
      onClick={() => onSubtitleClick?.(subtitle, index)}
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
          className={`min-w-0 flex-1 pr-10 text-xs leading-relaxed ${
            isActive ? "font-medium text-zinc-900" : "text-zinc-600"
          }`}
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
      </div>
    </div>
  );
});
