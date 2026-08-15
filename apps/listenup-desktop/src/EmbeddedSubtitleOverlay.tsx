/**
 * @purpose 在 Embedded 视频上显示当前 ListenUp 字幕，并通过独立手柄限制性拖动。
 * @role    EmbeddedVideoPanel 的可信 iframe 同级 Overlay；不拥有字幕查询、播放控制或持久化。
 * @deps    react、react-i18next、@iconify/react、DesktopIconButton、TranslationMissingState、位置纯函数。
 * @gotcha  根层必须保持 pointer-events-none；只有字幕卡和手柄拦截视频区域指针。
 */
import { Icon } from "@iconify/react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { DesktopIconButton } from "./components/ui/DesktopIconButton";
import type { DisplayBlock } from "./SubtitleList";
import {
  moveOverlayPositionByPixels,
  overlayPositionToPixels,
  type EmbeddedSubtitleOverlayPosition,
  type OverlayLayoutBounds,
} from "./embeddedSubtitleOverlayPosition";
import {
  TranslationMissingState,
  type TranslationCopyStatus,
} from "./TranslationMissingState";

const OVERLAY_INSET = 12;
const KEYBOARD_STEP = 8;
const KEYBOARD_LARGE_STEP = 24;

interface EmbeddedSubtitleOverlayProps {
  block: DisplayBlock | null;
  copyStatus: TranslationCopyStatus;
  onCopyTranslationPrompt: () => void;
  onPositionChange: (position: EmbeddedSubtitleOverlayPosition) => void;
  position: EmbeddedSubtitleOverlayPosition;
  translationMissing: boolean;
}

const isArrowKey = (key: string) =>
  key === "ArrowLeft" ||
  key === "ArrowRight" ||
  key === "ArrowUp" ||
  key === "ArrowDown";

export const EmbeddedSubtitleOverlay = memo(function EmbeddedSubtitleOverlay({
  block,
  copyStatus,
  onCopyTranslationPrompt,
  onPositionChange,
  position,
  translationMissing,
}: EmbeddedSubtitleOverlayProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const localPositionRef = useRef(position);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPosition: EmbeddedSubtitleOverlayPosition;
  } | null>(null);
  const keyboardMovePendingRef = useRef(false);
  const pendingPointerPositionRef =
    useRef<EmbeddedSubtitleOverlayPosition | null>(null);
  const pointerMoveFrameRef = useRef<number | null>(null);
  const [localPosition, setLocalPosition] = useState(position);
  const [bounds, setBounds] = useState<OverlayLayoutBounds | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const updateLocalPosition = useCallback(
    (nextPosition: EmbeddedSubtitleOverlayPosition) => {
      localPositionRef.current = nextPosition;
      setLocalPosition(nextPosition);
    },
    []
  );

  useEffect(() => {
    if (dragRef.current || keyboardMovePendingRef.current) return;
    updateLocalPosition(position);
  }, [position, updateLocalPosition]);

  useEffect(
    () => () => {
      if (pointerMoveFrameRef.current !== null) {
        cancelAnimationFrame(pointerMoveFrameRef.current);
      }
    },
    []
  );

  const isVisible = Boolean(block) || translationMissing;

  useLayoutEffect(() => {
    const container = containerRef.current;
    const card = cardRef.current;
    if (!container || !card) return;

    const measure = () => {
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      if (
        containerRect.width <= 0 ||
        containerRect.height <= 0 ||
        cardRect.width <= 0 ||
        cardRect.height <= 0
      ) {
        return;
      }
      setBounds({
        containerWidth: containerRect.width,
        containerHeight: containerRect.height,
        itemWidth: cardRect.width,
        itemHeight: cardRect.height,
        inset: OVERLAY_INSET,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(card);
    return () => observer.disconnect();
  }, [isVisible]);

  if (!isVisible) return null;

  const pixels = bounds
    ? overlayPositionToPixels(localPosition, bounds)
    : { x: 0, y: 0 };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!bounds) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: localPositionRef.current,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!bounds || !drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    pendingPointerPositionRef.current = moveOverlayPositionByPixels(
      drag.startPosition,
      {
        x: event.clientX - drag.startClientX,
        y: event.clientY - drag.startClientY,
      },
      bounds
    );
    if (pointerMoveFrameRef.current !== null) return;
    pointerMoveFrameRef.current = requestAnimationFrame(() => {
      pointerMoveFrameRef.current = null;
      const pendingPosition = pendingPointerPositionRef.current;
      pendingPointerPositionRef.current = null;
      if (pendingPosition) updateLocalPosition(pendingPosition);
    });
  };

  const finishPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (pointerMoveFrameRef.current !== null) {
      cancelAnimationFrame(pointerMoveFrameRef.current);
      pointerMoveFrameRef.current = null;
    }
    const pendingPosition = pendingPointerPositionRef.current;
    pendingPointerPositionRef.current = null;
    if (pendingPosition) updateLocalPosition(pendingPosition);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setIsDragging(false);
    onPositionChange(pendingPosition ?? localPositionRef.current);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!bounds || !isArrowKey(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? KEYBOARD_LARGE_STEP : KEYBOARD_STEP;
    const delta = {
      x: event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
      y: event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0,
    };
    keyboardMovePendingRef.current = true;
    updateLocalPosition(
      moveOverlayPositionByPixels(localPositionRef.current, delta, bounds)
    );
  };

  const persistKeyboardMove = () => {
    if (!keyboardMovePendingRef.current) return;
    keyboardMovePendingRef.current = false;
    onPositionChange(localPositionRef.current);
  };

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-20">
      <div
        ref={cardRef}
        className={`pointer-events-auto absolute left-0 top-0 flex max-w-[calc(100%-24px)] items-center gap-2 rounded-[10px] border border-white/[0.08] bg-glass-cinema py-2 pl-1.5 pr-3 text-white shadow-[0_2px_12px_rgba(0,0,0,0.28)] ${
          bounds ? "opacity-100" : "opacity-0"
        }`}
        style={{ transform: `translate3d(${pixels.x}px, ${pixels.y}px, 0)` }}
      >
        <DesktopIconButton
          className={`flex h-7 w-7 touch-none cursor-grab items-center justify-center rounded-md border-none bg-black/15 text-white/55 hover:bg-black/30 hover:text-white active:cursor-grabbing ${
            isDragging ? "cursor-grabbing bg-black/35 text-white" : ""
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerMove}
          onPointerCancel={finishPointerMove}
          onKeyDown={handleKeyDown}
          onKeyUp={(event) => {
            if (isArrowKey(event.key)) persistKeyboardMove();
          }}
          onBlur={persistKeyboardMove}
          tooltip={t("embedded.dragOverlay")}
          ariaLabel={t("embedded.dragOverlayLabel")}
          icon={
            <Icon
              icon="mdi:drag-vertical"
              className="h-4 w-4 flex-none"
              aria-hidden="true"
            />
          }
        />
        <div className="min-w-0 select-text text-center [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
          {translationMissing ? (
            <TranslationMissingState
              compact
              copyStatus={copyStatus}
              onCopy={onCopyTranslationPrompt}
            />
          ) : (
            <>
              {block?.sourceText && (
                <p
                  className={`m-0 whitespace-pre-line tracking-[0.005em] ${
                    block.translationText
                      ? "text-[13px] font-medium leading-[1.4] text-white/85"
                      : "text-[16px] font-semibold leading-[1.4]"
                  }`}
                >
                  {block.sourceText}
                </p>
              )}
              {block?.translationText && (
                <p
                  className={`m-0 whitespace-pre-line font-semibold leading-[1.4] ${
                    block.sourceText ? "mt-1 text-[15px]" : "text-[16px]"
                  }`}
                >
                  {block.translationText}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});
