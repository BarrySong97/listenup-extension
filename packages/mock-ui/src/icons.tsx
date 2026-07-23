import type { SVGProps } from "react";

/* Minimal inline icons — mirror the mdi icons used in the desktop app. */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Official YouTube brand mark (Simple Icons path). */
export function YoutubeLogo({ size = 22, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#FF0000"
        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
      />
      <path fill="#FFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

/** mdi:movie-open-outline — cinema-mode toggle. */
export function MovieOpen({ size = 14, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 9.5h16a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7.5z" />
      <path d="M3.4 9.5 5 5.7l3.7.9-1.6 3.7M8.7 6.6l3.7.9-1.6 3.6M12.4 7.5l3.7.9-1.6 3.6" />
    </svg>
  );
}

/** mdi:close */
export function Close({ size = 14, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  );
}

/** The app's own subtitle-frame mark (used elsewhere, e.g. the site nav). */
export function LogoMark({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <g fill="currentColor">
        <rect x="6" y="9.5" width="7" height="1.8" rx="0.9" />
        <rect x="14.4" y="9.5" width="3.6" height="1.8" rx="0.9" />
        <rect x="6" y="13.4" width="4" height="1.8" rx="0.9" />
        <rect x="11.4" y="13.4" width="6.6" height="1.8" rx="0.9" />
      </g>
    </svg>
  );
}
