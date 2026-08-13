/**
 * @purpose 提供 Embedded 悬浮字幕位置的版本化校验、像素换算与边界约束。
 * @role    Overlay 与 App 偏好层共用的纯布局模块，可脱离 DOM 独立测试。
 * @deps    无。
 * @gotcha  position 表示扣除卡片尺寸与安全边距后的可移动范围比例，不是容器绝对比例。
 */

export interface EmbeddedSubtitleOverlayPosition {
  version: 1;
  x: number;
  y: number;
}

export interface OverlayLayoutBounds {
  containerHeight: number;
  containerWidth: number;
  itemHeight: number;
  itemWidth: number;
  inset: number;
}

export interface PixelPosition {
  x: number;
  y: number;
}

export const DEFAULT_EMBEDDED_SUBTITLE_OVERLAY_POSITION: EmbeddedSubtitleOverlayPosition = {
  version: 1,
  x: 0.5,
  y: 0.72,
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const finiteNonNegative = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

export const normalizeOverlayPosition = (
  value: unknown
): EmbeddedSubtitleOverlayPosition => {
  if (!value || typeof value !== "object") {
    return DEFAULT_EMBEDDED_SUBTITLE_OVERLAY_POSITION;
  }
  const candidate = value as Partial<EmbeddedSubtitleOverlayPosition>;
  if (
    candidate.version !== 1 ||
    !Number.isFinite(candidate.x) ||
    !Number.isFinite(candidate.y) ||
    candidate.x! < 0 ||
    candidate.x! > 1 ||
    candidate.y! < 0 ||
    candidate.y! > 1
  ) {
    return DEFAULT_EMBEDDED_SUBTITLE_OVERLAY_POSITION;
  }
  return { version: 1, x: candidate.x!, y: candidate.y! };
};

export const parseOverlayPosition = (raw: string | null) => {
  if (!raw) return DEFAULT_EMBEDDED_SUBTITLE_OVERLAY_POSITION;
  try {
    return normalizeOverlayPosition(JSON.parse(raw));
  } catch {
    return DEFAULT_EMBEDDED_SUBTITLE_OVERLAY_POSITION;
  }
};

const axisMetrics = (
  containerSize: number,
  itemSize: number,
  inset: number
) => {
  const safeContainer = finiteNonNegative(containerSize);
  const safeItem = finiteNonNegative(itemSize);
  const safeInset = finiteNonNegative(inset);
  const travel = Math.max(0, safeContainer - safeItem - safeInset * 2);
  const start = travel > 0 ? safeInset : Math.max(0, (safeContainer - safeItem) / 2);
  return { start, travel };
};

export const overlayPositionToPixels = (
  position: EmbeddedSubtitleOverlayPosition,
  bounds: OverlayLayoutBounds
): PixelPosition => {
  const horizontal = axisMetrics(
    bounds.containerWidth,
    bounds.itemWidth,
    bounds.inset
  );
  const vertical = axisMetrics(
    bounds.containerHeight,
    bounds.itemHeight,
    bounds.inset
  );
  return {
    x: horizontal.start + clamp(position.x, 0, 1) * horizontal.travel,
    y: vertical.start + clamp(position.y, 0, 1) * vertical.travel,
  };
};

export const overlayPixelsToPosition = (
  pixels: PixelPosition,
  bounds: OverlayLayoutBounds
): EmbeddedSubtitleOverlayPosition => {
  const horizontal = axisMetrics(
    bounds.containerWidth,
    bounds.itemWidth,
    bounds.inset
  );
  const vertical = axisMetrics(
    bounds.containerHeight,
    bounds.itemHeight,
    bounds.inset
  );
  return {
    version: 1,
    x:
      horizontal.travel === 0
        ? 0.5
        : clamp((pixels.x - horizontal.start) / horizontal.travel, 0, 1),
    y:
      vertical.travel === 0
        ? 0.5
        : clamp((pixels.y - vertical.start) / vertical.travel, 0, 1),
  };
};

export const moveOverlayPositionByPixels = (
  position: EmbeddedSubtitleOverlayPosition,
  delta: PixelPosition,
  bounds: OverlayLayoutBounds
) => {
  const current = overlayPositionToPixels(position, bounds);
  return overlayPixelsToPosition(
    { x: current.x + delta.x, y: current.y + delta.y },
    bounds
  );
};
